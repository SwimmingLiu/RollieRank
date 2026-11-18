// 连接真实开发者工具自动化端口，驱动实际小程序页面并截图。
// 用法：node mini-program/tools/drive.mjs [输出目录]
import automator from "miniprogram-automator";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const out = path.resolve(process.argv[2] || "test-results/miniprogram");
await mkdir(out, { recursive: true });

const mini = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
const log = [];
const errors = [];
mini.on("console", m => { if (m.type === "error") errors.push(m.args.join(" ").slice(0, 200)); });

const shot = async name => {
  await mini.screenshot({ path: path.join(out, `${name}.png`) });
  log.push(`shot ${name}`);
};
const pause = ms => new Promise(r => setTimeout(r, ms));
const find = async (selector, timeout = 6000) => {
  const page = await mini.currentPage();
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const el = await page.$(selector);
    if (el) return el;
    await pause(300);
  }
  return null;
};

// 1. 首页
await mini.reLaunch("/pages/home/home");
await pause(3500);
await shot("01-home");
{
  const page = await mini.currentPage();
  const data = await page.data();
  log.push(`home: loading=${data.loading} error=${data.error || "无"} institutions=${(data.institutions || []).map(i => `${i.name}(${i.projects.length}期)`).join(" ")}`);
}

// 2. 机构套卷
const inst = await find(".home__inst");
if (inst) {
  await inst.tap();
  await pause(2500);
  await shot("02-catalog");
  const page = await mini.currentPage();
  const data = await page.data();
  log.push(`catalog: ${data.institution} | projects=${(data.projects || []).length} | papers=${((data.projects || [])[0] || {}).versions?.length || 0}`);
}

// 3. 录答案
const paper = await find(".cat__paper");
if (paper) {
  await paper.tap();
  await pause(3000);
  await shot("03-practice");
  const page = await mini.currentPage();
  let data = await page.data();
  log.push(`practice: ${data.title} | ${data.identity} | 行数=${(data.questions || []).length} | 章节=${(data.sections || []).map(s => s.type).join("/")}`);

  const choices = await page.$$(".practice__choice");
  for (const choice of choices.slice(0, 8)) { await choice.tap(); await pause(100); }
  data = await page.data();
  log.push(`after taps: answered=${data.answered}`);
  await shot("04-practice-answered");

  const mark = await page.$(".practice__mark");
  if (mark) { await mark.tap(); await pause(600); await shot("05-practice-mark"); }

  // 答题卡章节切换
  const sheet = await page.$(".btn--ghost");
  if (sheet) { await sheet.tap(); await pause(1200); await shot("06-practice-sheet"); }
}

// 4. 记录页
await mini.reLaunch("/pages/records/records");
await pause(2500);
await shot("07-records");

// 5. 计时页
await mini.navigateTo("/pages/timer/timer");
await pause(2500);
await shot("08-timer");
{
  const page = await mini.currentPage();
  const data = await page.data();
  log.push(`timer: papers groups=${(data.papers || []).length} whole=${data.wholeMinutes}`);
}

// 6. 设置页
await mini.navigateTo("/pages/settings/settings");
await pause(1500);
await shot("09-settings");

// 7. 成长分析
await mini.navigateTo("/pages/analytics/analytics");
await pause(1800);
await shot("10-analytics");

// 8. 选岗
await mini.navigateTo("/pages/positions/positions");
await pause(3500);
await shot("11-positions");
{
  const page = await mini.currentPage();
  const data = await page.data();
  log.push(`positions: items=${(data.items || []).length} total=${data.total} pages=${data.pages}`);
}

await mini.disconnect();
console.log(log.join("\n"));
if (errors.length) console.log("页面报错:\n" + [...new Set(errors)].slice(0, 10).join("\n"));
