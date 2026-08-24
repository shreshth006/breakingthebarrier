import { rename, writeFile } from "node:fs/promises";
import {
  IPADIC_ARCHIVE_PATH,
  IPADIC_ARCHIVE_URL,
  IPADIC_VERSION,
  verifyIpadicArchiveBytes,
} from "./ipadic-archive.mjs";

const temporaryPath = `${IPADIC_ARCHIVE_PATH}.download`;
const response = await fetch(IPADIC_ARCHIVE_URL, {
  headers: { "user-agent": "breaking-the-barrier-build" },
  redirect: "follow",
});

if (!response.ok) {
  throw new Error(`Unable to acquire IPADIC ${IPADIC_VERSION}: HTTP ${response.status}`);
}

const archive = Buffer.from(await response.arrayBuffer());
verifyIpadicArchiveBytes(archive);
await writeFile(temporaryPath, archive);
await rename(temporaryPath, IPADIC_ARCHIVE_PATH);

console.log(`Acquired and verified IPADIC ${IPADIC_VERSION}`);
