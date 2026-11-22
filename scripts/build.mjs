import { execFileSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
execFileSync(process.execPath, [fileURLToPath(new URL("./build-admin.mjs", import.meta.url))], { stdio: "inherit" });
const dist = new URL("dist/", root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
// 原构建会复制参考答案；浏览器产物仅包含公开模块，答案留在本地服务。
for (const name of ["index.html", "styles.css", "favicon.svg", "src", "admin"]) {
  await cp(new URL(name, root), new URL(name, dist), {
    recursive: true,
    filter: (source) => !source.includes("/src/data") && !source.includes("/admin/src"),
  });
}
console.log("Built dist/ with browser assets only.");
