import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiDir = resolve(root, "docs/ui-exploration/ios-v3/ui");
const adminDir = resolve(root, "admin");
const requireFromUi = createRequire(resolve(uiDir, "package.json"));
const { build } = requireFromUi("esbuild");

await build({
  entryPoints: [resolve(adminDir, "src/main.tsx")],
  outfile: resolve(adminDir, "app.js"),
  tsconfig: resolve(adminDir, "tsconfig.json"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["safari17", "chrome120"],
  jsx: "automatic",
  nodePaths: [resolve(uiDir, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
  minify: true,
});

execFileSync(
  process.execPath,
  [
    resolve(uiDir, "node_modules/@tailwindcss/cli/dist/index.mjs"),
    "--input",
    resolve(adminDir, "src/styles.css"),
    "--output",
    resolve(adminDir, "app.css"),
    "--minify",
  ],
  { cwd: uiDir, stdio: "inherit" },
);

console.log("Built admin/app.js and admin/app.css with React + Base UI + beUI + Tailwind v4.");
