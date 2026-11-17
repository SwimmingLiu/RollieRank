import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Previous refreshes copied an obsolete screenshot set into new release directories.
// Keep the approved paper-card files authoritative and change only their cache keys.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = "screens/ios-refinement-2";
// The animation is recorded from the current app, so refreshing stills cannot retain an old logo.
const gif = "motion/interaction-current.gif";
const files = (await readdir(resolve(root, directory)))
  .filter((name) => name.endsWith(".png"))
  .sort()
  .map((name) => `${directory}/${name}`);
if (!files.length) throw new Error(`No approved screenshots in ${directory}`);
files.push(gif);
const digest = createHash("sha256");
const hashes = {};
for (const file of files) {
  const data = await readFile(resolve(root, file));
  digest.update(file).update("\0").update(data);
  hashes[file] = createHash("sha256").update(data).digest("hex");
}
const key = digest.digest("hex").slice(0, 12);
const indexPath = resolve(root, "index.html");
let html = await readFile(indexPath, "utf8");
html = html.replace(/screens\/(?:current|release-[a-f0-9]+)\//g, `${directory}/`);
html = html.replace(/(\.png\?v=)[\w-]+/g, `$1${key}`);
html = html.replace(/motion\/interaction(?:-[a-z0-9-]+)?\.gif(?:\?v=[\w-]+)?/g, `${gif}?v=${key}`);
await writeFile(indexPath, html);
const readmePath = resolve(root, "README.md");
let readme = await readFile(readmePath, "utf8");
readme = readme.replace(/index\.html\?design=paper-cards-1114-v3(?:&assets=[a-f0-9]+)?/g, `index.html?design=paper-cards-1114-v3&assets=${key}`);
if (!readme.includes("[交互 GIF]")) {
  readme = readme.replace(/(\[独立手机页面\]\([^\n]+?\))/, `$1 · [交互 GIF](${gif}?v=${key})`);
} else {
  readme = readme.replace(/motion\/interaction(?:-[a-z0-9-]+)?\.gif(?:\?v=[\w-]+)?/g, `${gif}?v=${key}`);
}
await writeFile(readmePath, readme);
await writeFile(resolve(root, "preview-assets.json"), `${JSON.stringify({ revision: "paper-cards-1114-v3", key, directory, gif, hashes }, null, 2)}\n`);
process.stdout.write(`${key}\n${directory}\n${gif}\n`);
