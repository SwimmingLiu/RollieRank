import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const registryDirectory = resolve(
  directory,
  "../../../../.beauye/tasks/pinterest-reference-redesign/evidence/beui",
);
const slugs = ["button", "tabs", "tilt-card"];
const sources = new Map();
const entries = [];
const sha256 = (content) => createHash("sha256").update(content).digest("hex");

for (const slug of slugs) {
  const registryText = await readFile(resolve(registryDirectory, `${slug}.json`), "utf8");
  const entry = JSON.parse(registryText);
  if (entry.slug !== slug || !Array.isArray(entry.files)) {
    throw new Error(`Unexpected beUI registry entry: ${slug}`);
  }

  const files = [];
  for (const file of entry.files) {
    if (file.type !== "component" && file.type !== "util") continue;
    if (typeof file.path !== "string" || typeof file.content !== "string") {
      throw new Error(`Invalid beUI source in ${slug}`);
    }
    const destination = resolve(directory, file.path);
    const localPath = relative(directory, destination);
    if (isAbsolute(localPath) || localPath === ".." || localPath.startsWith(`..${sep}`)) {
      throw new Error(`beUI source escapes the isolated package: ${file.path}`);
    }
    const previous = sources.get(file.path);
    if (previous !== undefined && previous !== file.content) {
      throw new Error(`beUI shared source differs between entries: ${file.path}`);
    }
    sources.set(file.path, file.content);
    files.push({ path: file.path, sha256: sha256(file.content) });
  }
  entries.push({
    slug,
    sourceUrl: entry.source_url,
    registryUrl: entry.detail_url,
    pageUrl: entry.page_url,
    updatedAt: entry.updated_at,
    registrySha256: sha256(registryText),
    files,
  });
}

for (const [path, content] of sources) {
  const destination = resolve(directory, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
}
await writeFile(
  resolve(directory, "beui-sources.json"),
  `${JSON.stringify({ license: "MIT", entries }, null, 2)}\n`,
);
