// 小程序静态检查：语法、页面注册、事件绑定、组件声明，以及与网页端计时口径的一致性。
// 用法：node mini-program/tools/check.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const repo = path.resolve(root, "..");
const require = createRequire(path.join(root, "package.json"));
const problem = message => { console.log("✖ " + message); process.exitCode = 1; };

for (const name of readdirSync(root, { recursive: true })) {
  if (!/^(?:app\.js|config\.js|(?:components|pages|services|utils)\/.*\.js)$/.test(name)) continue;
  const result = spawnSync(process.execPath, ["--check", path.join(root, name)], { encoding: "utf8" });
  if (result.status !== 0) problem(result.stderr.trim() || name);
}

const app = JSON.parse(readFileSync(path.join(root, "app.json"), "utf8"));
const pages = readdirSync(path.join(root, "pages"), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => `pages/${entry.name}/${entry.name}`);

for (const page of app.pages) {
  if (!pages.includes(page)) problem(`app.json 注册的页面不存在：${page}`);
  for (const ext of ["js", "json", "wxml", "wxss"]) {
    if (!existsSync(path.join(root, `${page}.${ext}`))) problem(`缺少文件 ${page}.${ext}`);
  }
}
for (const page of pages) if (!app.pages.includes(page)) problem(`页面未在 app.json 注册：${page}`);

for (const page of pages) {
  const wxml = readFileSync(path.join(root, `${page}.wxml`), "utf8");
  const js = readFileSync(path.join(root, `${page}.js`), "utf8");
  const config = JSON.parse(readFileSync(path.join(root, `${page}.json`), "utf8"));
  for (const [tag] of wxml.matchAll(/<scroll-view\b[^>]*>/gs)) {
    if (!/show-scrollbar\s*=\s*"\{\{false\}\}"/.test(tag)) problem(`${page}.wxml 的 scroll-view 必须隐藏视觉滚动条`);
  }
  for (const match of wxml.matchAll(/bind:?(?:tap|input|confirm|blur|change|longpress)="([^"{}]*)"/g)) {
    const handler = match[1].split(":").pop();
    if (handler && !new RegExp(`\\b${handler}\\s*\\(`).test(js)) problem(`${page}.wxml 绑定的 ${handler} 在页面脚本中不存在`);
  }
  for (const component of new Set([...wxml.matchAll(/<(rr-[a-z-]+)/g)].map(m => m[1]))) {
    if (!config.usingComponents?.[component]) problem(`${page}.wxml 使用 ${component} 但未在 usingComponents 声明`);
  }
}

// Component scroll views have their own WXML files and follow the same hidden-scrollbar rule.
for (const name of readdirSync(path.join(root, "components"), { recursive: true })) {
  if (!name.endsWith(".wxml")) continue;
  const wxml = readFileSync(path.join(root, "components", name), "utf8");
  for (const [tag] of wxml.matchAll(/<scroll-view\b[^>]*>/gs)) {
    if (!/show-scrollbar\s*=\s*"\{\{false\}\}"/.test(tag)) problem(`components/${name} 的 scroll-view 必须隐藏视觉滚动条`);
  }
}

// 原生与网页端用同一份计时模型；直接打开小程序目录也能复现已提交的构建。
const timerBuild = spawnSync(process.execPath, [path.join(root, "tools/build-timer.mjs"), "--check"], { encoding: "utf8" });
if (timerBuild.status !== 0) problem(timerBuild.stderr.trim() || "原生计时模块校验失败");
const catalog = require(path.join(root, "utils/catalog.js"));
const format = require(path.join(root, "utils/format.js"));
const { IMPORTED_PAPERS } = await import(path.join(repo, "src/data/imported-papers.js"));

if (format.score(2595) !== "25.95") problem("分数格式化不正确");
if (format.score(10000) !== "100") problem(`满分应省略多余零：${format.score(10000)}`);
if (format.score(2590) !== "25.9") problem(`一位小数应省略末尾零：${format.score(2590)}`);
if (format.percent(0.2595) !== "26%") problem(`百分比格式化不正确：${format.percent(0.2595)}`);

const groups = catalog.groupByInstitution(IMPORTED_PAPERS.map(item => ({ ...item, id: `${item.id}:v1`, status: "published", questionCount: item.answerKey.length })));
if (!groups.length) problem("机构分组为空");
for (const group of groups) if (!group.projects.length) problem(`${group.name} 没有期数分组`);

console.log(process.exitCode ? "检查未通过" : `检查通过：${pages.length} 个页面，${groups.length} 个机构`);
