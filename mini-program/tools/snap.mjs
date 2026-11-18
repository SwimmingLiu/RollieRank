// 逐页截图：用真实自动化端口打开每个页面并保存原始分辨率截图。
import automator from "miniprogram-automator";
import { mkdir } from "node:fs/promises";

const out = "test-results/miniprogram";
await mkdir(out, { recursive: true });
const mini = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = [];
const errors = [];
mini.on("console", message => {
  if (message.type === "error") errors.push(message.args.join(" ").slice(0, 160));
});

async function shot(name, ms = 1500) {
  await wait(ms);
  await mini.screenshot({ path: `${out}/${name}.png` });
  log.push(name);
}

await mini.reLaunch("/pages/home/home");
await shot("p01-home", 2600);
const home = await mini.currentPage();
const inst = await home.$(".home__inst");
if (inst) {
  await inst.tap();
  await shot("p02-catalog", 2200);
}
const catalog = await mini.currentPage();
const papers = await catalog.$$(".cat__paper");
if (papers.length) {
  await papers[0].tap();
  await shot("p03-practice", 2600);
}
const practice = await mini.currentPage();
const choices = await practice.$$(".practice__choice");
for (const choice of choices.slice(0, 12)) {
  await choice.tap();
  await wait(80);
}
await shot("p04-practice-answered", 600);

// records 是 tabBar 页面，只能 switchTab；其余用 navigateTo。
await mini.switchTab("/pages/records/records");
await shot("p05-records", 2200);
const pages = [
  ["/pages/analytics/analytics", "p06-analytics", 1600],
  ["/pages/timer/timer", "p07-timer", 2200],
  ["/pages/settings/settings", "p08-settings", 1400],
  ["/pages/positions/positions", "p09-positions", 3200],
];
for (const [url, name, ms] of pages) {
  await mini.navigateTo(url);
  await shot(name, ms);
}

await mini.disconnect();
console.log(log.join("\n"));
if (errors.length) console.log("报错:", [...new Set(errors)].slice(0, 6).join(" | "));
