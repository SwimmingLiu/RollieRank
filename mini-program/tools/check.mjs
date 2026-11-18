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
  for (const match of wxml.matchAll(/bind:?(?:tap|input|confirm|blur|change|longpress)="([^"{}]*)"/g)) {
    const handler = match[1].split(":").pop();
    if (handler && !new RegExp(`\\b${handler}\\s*\\(`).test(js)) problem(`${page}.wxml 绑定的 ${handler} 在页面脚本中不存在`);
  }
  for (const component of new Set([...wxml.matchAll(/<(rr-[a-z-]+)/g)].map(m => m[1]))) {
    if (!config.usingComponents?.[component]) problem(`${page}.wxml 使用 ${component} 但未在 usingComponents 声明`);
  }
}

// 计时记录必须是服务端接受的结构；这里用真实校验器检查两种口径。
const timing = require(path.join(root, "utils/timing.js"));
const catalog = require(path.join(root, "utils/catalog.js"));
const format = require(path.join(root, "utils/format.js"));
const { validateTimingSummary } = await import(path.join(repo, "src/practice-timer.js"));
const { IMPORTED_PAPERS } = await import(path.join(repo, "src/data/imported-papers.js"));

const paper = IMPORTED_PAPERS[0];
const questions = [...paper.answerKey].map((answer, index) => {
  const section = paper.sections.find(item => index + 1 >= item.start && index + 1 <= item.end);
  return { number: index + 1, correctAnswer: answer, type: section.name, typeId: section.id, cents: section.cents };
});
const sections = [...new Set(questions.map(question => catalog.subjectName(question.type)))]
  .map((name, index) => ({ id: `subject-${index + 1}`, name, count: questions.filter(question => catalog.subjectName(question.type) === name).length }));

for (const mode of ["whole", "modules"]) {
  const built = timing.buildTiming({ attemptId: "attempt-1234567890", versionId: "paper:v1", startedAt: 1000, endedAt: 1000 + 107 * 60000, plannedMinutes: 120, sections, mode });
  const summary = built[mode];
  try {
    validateTimingSummary(summary, { versionId: "paper:v1", attemptId: "attempt-1234567890", sections });
  } catch (error) {
    problem(`${mode} 计时记录未被服务端接受：${error.message}`);
  }
}

if (format.score(2595) !== "25.95") problem("分数格式化不正确");
if (format.percent(0.2595) !== "26%") problem(`百分比格式化不正确：${format.percent(0.2595)}`);

const groups = catalog.groupByInstitution(IMPORTED_PAPERS.map(item => ({ ...item, id: `${item.id}:v1`, status: "published", questionCount: item.answerKey.length })));
if (!groups.length) problem("机构分组为空");
for (const group of groups) if (!group.projects.length) problem(`${group.name} 没有期数分组`);

console.log(process.exitCode ? "检查未通过" : `检查通过：${pages.length} 个页面，${groups.length} 个机构`);
