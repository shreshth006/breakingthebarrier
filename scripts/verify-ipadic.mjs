import {
  IPADIC_ARCHIVE_BYTES,
  IPADIC_ARCHIVE_SHA256,
  IPADIC_ARCHIVE_URL,
  IPADIC_FILES,
  IPADIC_FORMAT_VERSION,
  IPADIC_VERSION,
  readVerifiedIpadicArchive,
} from "./ipadic-archive.mjs";

await readVerifiedIpadicArchive();

console.log(
  JSON.stringify(
    {
      ok: true,
      version: IPADIC_VERSION,
      formatVersion: IPADIC_FORMAT_VERSION,
      source: IPADIC_ARCHIVE_URL,
      archiveSha256: IPADIC_ARCHIVE_SHA256,
      archiveBytes: IPADIC_ARCHIVE_BYTES,
      unpackedBytes: Object.values(IPADIC_FILES).reduce(
        (total, file) => total + file.bytes,
        0,
      ),
      files: Object.keys(IPADIC_FILES).length,
    },
    null,
    2,
  ),
);
