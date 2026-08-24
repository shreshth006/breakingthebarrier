import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

export const IPADIC_VERSION = "5.3.0";
export const IPADIC_FORMAT_VERSION = 2;
export const IPADIC_ARCHIVE_URL =
  "https://github.com/lindera/lindera/releases/download/v5.3.0/lindera-ipadic-5.3.0.zip";
export const IPADIC_ARCHIVE_SHA256 =
  "6c361500b091abc1143c1d5abdd66a69463ab911685daf6ba74d6aeee7e180fe";
export const IPADIC_ARCHIVE_BYTES = 10_519_545;
export const IPADIC_ARCHIVE_PATH = resolve(
  import.meta.dirname,
  "../third_party/assets/lindera-ipadic-5.3.0.zip",
);
export const IPADIC_DIST_DIRECTORY = "assets/dictionaries/ipadic-5.3.0";

const ARCHIVE_ROOT = "lindera-ipadic/";

export const IPADIC_FILES = Object.freeze({
  "metadata.json": {
    bytes: 779,
    sha256: "305addfbf05e41d985a1541035c79a7b6f8ae254e4bc94f1721be21adf31068f",
  },
  "dict.trie": {
    bytes: 4_587_428,
    sha256: "697014aabf3672bb2d59ff7fb27b056fb35d189feaa62b833aff06ea81cb7f19",
  },
  "dict.valsidx": {
    bytes: 1_303_480,
    sha256: "f1b17f1c4682a5bd42dabe95ab7cefb461c888b839a18d213dd5c7133d3a1a76",
  },
  "dict.vals": {
    bytes: 3_921_250,
    sha256: "62af946542a17c4f16cf1122cb069b5d26f7cf652066b3b846cc4c230b6a8aa1",
  },
  "dict.wordsidx": {
    bytes: 1_568_504,
    sha256: "a38e0b55d6e0fa67555078f8beb6f634f264b2a6b2ea2c9a7aa111f085ada721",
  },
  "dict.words": {
    bytes: 32_674_733,
    sha256: "fc1d924e12af84a352feccce35b772383322760ee2b3da4be0e173ad82953938",
  },
  "matrix.mtx": {
    bytes: 3_463_718,
    sha256: "915733be6589bee90b8f2af5cd314c384a1f9a2fc3af498384555986447b168b",
  },
  "char_def.bin": {
    bytes: 2_360,
    sha256: "ef37cf70d7e72ec023bec8e632783a6fe255b2d5fd1bce22600b595fccae48b1",
  },
  "unk.bin": {
    bytes: 2_492,
    sha256: "3eeebe0ef3f8907be325aa3acb0ccbd4ccb6f5ac20ff3dd0742ff1af1c468da6",
  },
  "NOTICE.txt": {
    bytes: 4_092,
    sha256: "2cf235bf0842d6d61eb0244fb22e645a321b12408a3cf75feb3a53577d885bde",
  },
});

export const IPADIC_RUNTIME_FILES = Object.freeze(
  Object.keys(IPADIC_FILES).filter((name) => name !== "NOTICE.txt"),
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findEndOfCentralDirectory(archive) {
  const minimumOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error("IPADIC archive has no ZIP end-of-central-directory record");
}

function readArchiveEntries(archive) {
  const eocdOffset = findEndOfCentralDirectory(archive);
  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  let offset = archive.readUInt32LE(eocdOffset + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    assert(
      archive.readUInt32LE(offset) === 0x02014b50,
      "IPADIC archive has an invalid central-directory entry",
    );

    const compressionMethod = archive.readUInt16LE(offset + 10);
    const compressedBytes = archive.readUInt32LE(offset + 20);
    const uncompressedBytes = archive.readUInt32LE(offset + 24);
    const fileNameBytes = archive.readUInt16LE(offset + 28);
    const extraBytes = archive.readUInt16LE(offset + 30);
    const commentBytes = archive.readUInt16LE(offset + 32);
    const localHeaderOffset = archive.readUInt32LE(offset + 42);
    const fileName = archive
      .subarray(offset + 46, offset + 46 + fileNameBytes)
      .toString("utf8");

    if (!fileName.endsWith("/")) {
      assert(
        archive.readUInt32LE(localHeaderOffset) === 0x04034b50,
        `IPADIC archive has an invalid local header for ${fileName}`,
      );
      const localNameBytes = archive.readUInt16LE(localHeaderOffset + 26);
      const localExtraBytes = archive.readUInt16LE(localHeaderOffset + 28);
      const dataOffset =
        localHeaderOffset + 30 + localNameBytes + localExtraBytes;
      const compressed = archive.subarray(
        dataOffset,
        dataOffset + compressedBytes,
      );
      const bytes =
        compressionMethod === 0
          ? Buffer.from(compressed)
          : compressionMethod === 8
            ? inflateRawSync(compressed)
            : null;

      assert(bytes !== null, `Unsupported ZIP compression for ${fileName}`);
      assert(
        bytes.length === uncompressedBytes,
        `Unexpected uncompressed size for ${fileName}`,
      );
      assert(!entries.has(fileName), `Duplicate ZIP entry: ${fileName}`);
      entries.set(fileName, bytes);
    }

    offset += 46 + fileNameBytes + extraBytes + commentBytes;
  }

  return entries;
}

export function verifyIpadicArchiveBytes(archive) {
  assert(
    archive.length === IPADIC_ARCHIVE_BYTES,
    `IPADIC archive size mismatch: expected ${IPADIC_ARCHIVE_BYTES}, received ${archive.length}`,
  );
  assert(
    sha256(archive) === IPADIC_ARCHIVE_SHA256,
    "IPADIC archive SHA-256 does not match the official release digest",
  );

  const archiveEntries = readArchiveEntries(archive);
  const verified = new Map();

  for (const [name, expected] of Object.entries(IPADIC_FILES)) {
    const archiveName = `${ARCHIVE_ROOT}${name}`;
    const bytes = archiveEntries.get(archiveName);
    assert(bytes, `Missing IPADIC archive entry: ${archiveName}`);
    assert(bytes.length === expected.bytes, `IPADIC file size mismatch: ${name}`);
    assert(sha256(bytes) === expected.sha256, `IPADIC file SHA-256 mismatch: ${name}`);
    verified.set(name, bytes);
  }

  assert(
    archiveEntries.size === Object.keys(IPADIC_FILES).length,
    "IPADIC archive contains an unexpected file set",
  );

  const metadata = JSON.parse(verified.get("metadata.json").toString("utf8"));
  assert(metadata.format_version === IPADIC_FORMAT_VERSION, "Unexpected IPADIC format version");
  assert(metadata.name === "ipadic", "Unexpected IPADIC dictionary name");
  assert(metadata.encoding === "UTF-8", "Unexpected IPADIC encoding");
  assert(
    JSON.stringify(metadata.dictionary_schema?.fields) ===
      JSON.stringify([
        "surface",
        "left_context_id",
        "right_context_id",
        "cost",
        "part_of_speech",
        "part_of_speech_subcategory_1",
        "part_of_speech_subcategory_2",
        "part_of_speech_subcategory_3",
        "conjugation_form",
        "conjugation_type",
        "base_form",
        "reading",
        "pronunciation",
      ]),
    "Unexpected IPADIC dictionary schema",
  );

  return verified;
}

export async function readVerifiedIpadicArchive() {
  return verifyIpadicArchiveBytes(await readFile(IPADIC_ARCHIVE_PATH));
}
