import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import {
  IPADIC_DIST_DIRECTORY,
  IPADIC_FILES,
  IPADIC_RUNTIME_FILES,
} from "./ipadic-archive.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = join(projectRoot, "dist");

const expectedPermissions = new Set([
  "activeTab",
  "scripting",
  "storage",
  "offscreen",
]);
const expectedOptionalHosts = new Set(["https://*/*", "http://*/*"]);
const forbiddenActiveNames = new Set([
  ".python-version",
  "Pipfile",
  "pyproject.toml",
  "requirements.txt",
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sameSet(actual, expected) {
  return (
    actual.size === expected.size &&
    [...actual].every((entry) => expected.has(entry))
  );
}

async function listFiles(root, ignoredDirectories = new Set()) {
  const files = [];

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      const projectPath = relative(projectRoot, absolutePath);

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(projectPath) && !ignoredDirectories.has(entry.name)) {
          await visit(absolutePath);
        }
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  await visit(root);
  return files;
}

async function assertFile(path) {
  assert((await stat(path)).isFile(), `Missing built file: ${relative(projectRoot, path)}`);
}

const manifestPath = join(distRoot, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

assert(manifest.manifest_version === 3, "Built manifest must use Manifest V3");
assert(manifest.minimum_chrome_version === "109", "Unexpected minimum Chrome version");
assert(!Object.hasOwn(manifest, "host_permissions"), "Persistent host permissions are forbidden");
assert(!Object.hasOwn(manifest, "content_scripts"), "Persistent static content scripts are forbidden");
assert(!Object.hasOwn(manifest, "externally_connectable"), "External messaging is forbidden");

assert(
  Array.isArray(manifest.permissions) &&
    sameSet(new Set(manifest.permissions), expectedPermissions),
  "Built permissions differ from the reviewed Phase 0 set",
);
assert(
  Array.isArray(manifest.optional_host_permissions) &&
    sameSet(new Set(manifest.optional_host_permissions), expectedOptionalHosts),
  "Optional host permissions differ from the reviewed patterns",
);
assert(
  !manifest.permissions.includes("nativeMessaging"),
  "nativeMessaging must never be present",
);
assert(
  manifest.content_security_policy?.extension_pages ===
    "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  "Extension CSP differs from the reviewed WASM policy",
);

await Promise.all([
  assertFile(join(distRoot, manifest.background.service_worker)),
  assertFile(join(distRoot, manifest.action.default_popup)),
  assertFile(join(distRoot, "assets/content-script.js")),
  assertFile(join(distRoot, "src/processor/offscreen.html")),
  assertFile(
    join(
      distRoot,
      "third_party/licenses/lindera-wasm-bundler-MIT.txt",
    ),
  ),
  assertFile(join(distRoot, "third_party/licenses/wanakana-MIT.txt")),
  assertFile(
    join(
      distRoot,
      "third_party/licenses/lindera-ipadic-5.3.0-NOTICE.txt",
    ),
  ),
]);

for (const dictionaryFile of IPADIC_RUNTIME_FILES) {
  const path = join(distRoot, IPADIC_DIST_DIRECTORY, dictionaryFile);
  await assertFile(path);
  const bytes = await readFile(path);
  const expected = IPADIC_FILES[dictionaryFile];
  assert(expected !== undefined, `Missing dictionary provenance for ${dictionaryFile}`);
  assert(bytes.length === expected.bytes, `Built dictionary size mismatch: ${dictionaryFile}`);
  assert(
    createHash("sha256").update(bytes).digest("hex") === expected.sha256,
    `Built dictionary SHA-256 mismatch: ${dictionaryFile}`,
  );
}

const distFiles = await listFiles(distRoot);
const executableFiles = distFiles.filter((path) =>
  new Set([".html", ".js"]).has(extname(path)),
);

for (const path of distFiles) {
  assert(extname(path) !== ".py", "Python file found in distribution");
}

const forbiddenExecutablePatterns = [
  { pattern: /https?:\/\//u, message: "remote URL" },
  { pattern: /(?:localhost|127\.0\.0\.1)/u, message: "local service URL" },
  { pattern: /legacy\//u, message: "legacy dependency" },
  { pattern: /nativeMessaging/u, message: "native messaging reference" },
  { pattern: /\beval\s*\(/u, message: "eval call" },
  { pattern: /\bnew\s+Function\s*\(/u, message: "dynamic Function call" },
];

for (const path of executableFiles) {
  const source = await readFile(path, "utf8");
  for (const forbidden of forbiddenExecutablePatterns) {
    assert(
      !forbidden.pattern.test(source),
      `${forbidden.message} found in ${relative(distRoot, path)}`,
    );
  }
}

const activeFiles = await listFiles(
  projectRoot,
  new Set([".git", "dist", "legacy", "node_modules"]),
);
for (const path of activeFiles) {
  assert(extname(path) !== ".py", `Active Python file found: ${relative(projectRoot, path)}`);
  assert(
    !forbiddenActiveNames.has(basename(path)),
    `Active Python environment file found: ${relative(projectRoot, path)}`,
  );
}

const wasmFiles = distFiles.filter((path) => extname(path) === ".wasm");
assert(wasmFiles.length === 1, "Expected exactly one packaged Lindera WASM module");

const totalBytes = (
  await Promise.all(distFiles.map(async (path) => (await stat(path)).size))
).reduce((total, bytes) => total + bytes, 0);

console.log(
  JSON.stringify(
    {
      ok: true,
      files: distFiles.length,
      wasmFiles: wasmFiles.length,
      totalBytes,
      dictionaryBytes: IPADIC_RUNTIME_FILES.reduce(
        (total, name) => total + IPADIC_FILES[name].bytes,
        0,
      ),
    },
    null,
    2,
  ),
);
