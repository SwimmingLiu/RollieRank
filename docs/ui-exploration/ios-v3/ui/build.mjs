import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const directory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(directory, "../vendor");
const license = await readFile(resolve(directory, "beui.LICENSE"), "utf8");
await mkdir(outputDirectory, { recursive: true });

await build({
  // Only explicit islands mount React; the native application keeps its own renderer and business state.
  entryPoints: [resolve(directory, "bridge.tsx")],
  outfile: resolve(outputDirectory, "beui.js"),
  tsconfig: resolve(directory, "tsconfig.json"),
  bundle: true,
  format: "iife",
  globalName: "RollieUI",
  platform: "browser",
  target: ["safari17", "chrome120"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  minify: true,
  legalComments: "inline",
  banner: { js: `/*! beUI · https://beui.dev · https://github.com/starc007/ui-components\n${license}*/` },
  // Embedded hosts must receive the bridge even when they isolate script-level variables.
  footer: { js: "window.RollieUI = RollieUI;" },
});

execFileSync(process.execPath, [
  resolve(directory, "node_modules/@tailwindcss/cli/dist/index.mjs"),
  "--input", resolve(directory, "styles.css"),
  "--output", resolve(outputDirectory, "beui.css"),
  "--minify",
], { cwd: directory, stdio: "inherit" });
