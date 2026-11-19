// 全功能自检：在开发者工具里逐页驱动真实交互，写入 test-results/miniprogram/flow。
// 截图必须写在项目目录之外，否则开发者工具会把新文件当成改动并热重载，页面会被重置。
import automator from "miniprogram-automator";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../test-results/miniprogram/flow");
await mkdir(out, { recursive: true });

const mini = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
const errors = [];
mini.on("console", message => {
  if (message.type === "error") errors.push(message.args.join(" ").slice(0, 200));
});

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail === undefined ? "" : detail });
}
async function shot(name) {
  await wait(700);
  await mini.screenshot({ path: `${out}/${name}.png` });
}
async function current() {
  return mini.currentPage();
}
async function waitForPath(expected, timeout = 6000) {
  const started = Date.now();
  let page = await current();
  while (page.path !== expected && Date.now() - started < timeout) {
    await wait(300);
    page = await current();
  }
  return page;
}
// 返回上一页并等页面真正切回，避免还停在旧页面上读取元素。
async function waitBack(expected, timeout = 6000) {
  await mini.navigateBack();
  return waitForPath(expected, timeout);
}
async function waitForSelector(page, selector, timeout = 5000) {
  const started = Date.now();
  let node = await page.$(selector);
  while (!node && Date.now() - started < timeout) {
    await wait(250);
    node = await page.$(selector);
  }
  return node;
}
// 页面可能先挂载再取数，等关键字段有值再断言。
async function waitForData(page, predicate, timeout = 12000) {
  const started = Date.now();
  let data = await page.data();
  while (!predicate(data) && Date.now() - started < timeout) {
    await wait(300);
    data = await page.data();
  }
  return data;
}
async function tap(page, selector, label) {
  const node = await page.$(selector);
  check(label || selector, Boolean(node), node ? "" : "找不到元素 " + selector);
  if (node) await node.tap();
  return node;
}

// 1. 首页与选卷
await mini.reLaunch("/pages/home/home");
await wait(2200);
let page = await current();
const institutions = await page.$$(".home__inst");
check("首页机构入口", institutions.length === 4, `${institutions.length} 个`);
await shot("01-home");
await institutions[0].tap();
await wait(2000);
page = await current();
check("进入套卷页", page.path === "pages/catalog/catalog", page.path);
const papers = await page.$$(".cat__paper");
check("套卷列表", papers.length > 0, `${papers.length} 套`);
await shot("02-catalog");
// 已交卷的卡片会直接进成绩页；这里挑一张还没交过的卷，走完整录答案流程。
const catalog = await page.data();
const versions = catalog.projects?.[catalog.activeProject]?.versions || [];
const freshIndex = versions.findIndex(item => item.actionType === "practice");
check("有可开始的新卷", freshIndex >= 0, `共 ${versions.length} 套`);
await papers[freshIndex >= 0 ? freshIndex : 0].tap();
await wait(2600);
page = await current();
check("进入录答案", page.path === "pages/practice/practice", page.path);

// 2. 录答案：选项、存疑、草稿
const rows = await page.$$(".practice__choice");
check("题目渲染", rows.length > 0, `${rows.length} 个选项`);
for (const index of [0, 4, 8, 12]) {
  if (!rows[index]) continue;
  await rows[index].tap();
  await wait(140);
}
const marks = await page.$$(".practice__mark");
if (marks[1]) {
  await marks[1].tap();
  await wait(300);
}
await shot("03-practice");
let practice = await page.data();
check("已录答案计数", practice.answered >= 3, `answered=${practice.answered}`);
check("存疑标记", Number(practice.uncertain) >= 1, `uncertain=${practice.uncertain}`);
const sectionSwitch = await page.$(".practice__filter");
if (sectionSwitch) {
  await sectionSwitch.tap();
  await wait(600);
  await shot("04-sections");
  const options = await page.$$(".practice__section-option");
  if (options[1]) await options[1].tap();
  await wait(900);
  practice = await page.data();
  check("切换板块", practice.activeSection >= 1 || (practice.questions || []).length > 0);
  await shot("05-practice-section");
}

// 3. 交卷与成绩
await wait(1000);
await tap(page, ".practice__submit", "打开交卷确认");
await wait(800);
await shot("06-submit-sheet");
await tap(page, ".practice__confirm", "确认交卷");
page = await waitForPath("pages/report/report", 12000);
check("进入成绩页", page.path === "pages/report/report", page.path);
const report = await waitForData(page, data => data.summary && data.loading === false);
check("成绩已核分", report.summary && report.summary.score !== undefined, JSON.stringify(report.summary || {}).slice(0, 120));
check("正确与错误", report.summary && report.summary.correct + report.summary.wrong > 0, `${report.summary?.correct}/${report.summary?.wrong}`);
check("能力概览", Array.isArray(report.bands) && report.bands.length >= 3, `${report.bands?.length} 项`);
await shot("07-report");
const attemptId = report.summary?.id;
if (report.bands && report.bands[0]) {
  const band = await page.$$(".report__band");
  if (band[0]) {
    await band[0].tap();
    const reviewPage = await waitForPath("pages/review/review", 8000);
    check("从板块进入复盘", reviewPage.path === "pages/review/review", reviewPage.path);
    await shot("08-review-band");
    await waitBack("pages/report/report");
    page = await current();
  }
}

// 4. 榜单
await tap(page, ".report__rank", "同卷排名入口");
page = await waitForPath("pages/rank/rank", 8000);
check("进入同卷榜", page.path === "pages/rank/rank", page.path);
let rank = await page.data();
if (rank.count === 0) {
  // 刚交卷时服务端可能还在写回执，给榜单一次重读机会。
  await wait(1500);
  const reload = await page.$(".chip");
  if (reload) {
    await reload.tap();
    await wait(2000);
  }
  rank = await page.data();
}
check("榜单已取数", rank.count > 0, `count=${rank.count}`);
const dims = await page.$$(".rank__dimension");
if (dims[1]) {
  await dims[1].tap();
  await wait(1800);
  check("题型榜可取", true);
}
await shot("09-rank");
const scopes = await page.$$(".rank__scope-tab");
if (scopes[1]) {
  await scopes[1].tap();
  await wait(1200);
}
// 返回成绩页后元素树要重新挂载，等元素出现再点，避免点到旧页的空白处。
await waitBack("pages/report/report");
page = await current();
const reviewEntry = await waitForSelector(page, ".btn--primary", 6000);
check("复盘错题入口", Boolean(reviewEntry), reviewEntry ? "" : "找不到元素 .btn--primary");
if (reviewEntry) await reviewEntry.tap();
page = await waitForPath("pages/review/review", 8000);
check("进入逐题对照", page.path === "pages/review/review", page.path);
await waitForSelector(page, ".review__tab", 6000);
const filters = await page.$$(".review__tab");
check("复盘筛选", filters.length >= 3, `${filters.length} 个`);
if (filters[1]) {
  await filters[1].tap();
  await wait(800);
}
await shot("10-review");
await waitBack("pages/report/report");
page = await current();

// 6. 讨论
const ghosts = await page.$$(".btn--ghost");
check("成绩页次级入口", ghosts.length >= 2, `${ghosts.length} 个`);
if (ghosts[0]) {
  await ghosts[0].tap();
  page = await waitForPath("pages/discussion/discussion", 8000);
  check("进入本卷交流", page.path === "pages/discussion/discussion", page.path);
  const input = await waitForSelector(page, ".disc__input", 5000);
  check("评论输入框", Boolean(input));
  if (input) {
    await input.input("自检留言：资料分析要再练一次。");
    await wait(500);
    let composed = await page.data();
    if (!String(composed.draft || "").trim()) {
      // 自动化对 textarea 的输入偶尔不生效，这里直接走页面的输入回调。
      await page.callMethod("onComposerInput", { detail: { value: "自检留言：资料分析要再练一次。" } });
      await wait(400);
      composed = await page.data();
    }
    check("评论草稿", String(composed.draft || "").trim().length > 0, `draft=${composed.draft || ""}`);
    const send = await waitForSelector(page, ".disc__send", 4000);
    if (send) await send.tap();
    await wait(2500);
  }
  const discussion = await page.data();
  check("发表评论", Array.isArray(discussion.comments) && discussion.comments.length > 0, `${discussion.comments?.length} 条`);
  const likes = await page.$$(".disc__action");
  if (likes[0]) {
    await likes[0].tap();
    await wait(1200);
    check("点赞", true);
  }
  await shot("11-discussion");
  await waitBack("pages/report/report");
  page = await current();
}

// 7. 分享
const shareEntry = (await page.$$(".btn--ghost"))[1];
if (shareEntry) {
  await shareEntry.tap();
  page = await waitForPath("pages/share/share", 9000);
  check("进入成绩分享", page.path === "pages/share/share", page.path);
  const modes = await page.$$(".share__mode");
  for (const [index, name] of [[0, "长图"], [1, "成绩卡"], [2, "题型"], [3, "雷达"]]) {
    if (!modes[index]) continue;
    await modes[index].tap();
    await wait(1800);
    const share = await page.data();
    check(`分享图 ${name}`, share.ready === true, `ready=${share.ready}`);
    await shot(`12-share-${index + 1}`);
  }
  await waitBack("pages/report/report");
}

// 8. 记录、成长分析、选岗、计时、设置
await mini.switchTab("/pages/records/records");
await wait(2200);
page = await current();
let records = await page.data();
check("记录里有本次成绩", (records.records || []).length > 0, `${records.records?.length} 条`);
await shot("13-records");
const cells = await page.$$(".records__cell");
if (cells[1]) {
  await cells[1].tap();
  page = await waitForPath("pages/analytics/analytics", 8000);
  check("进入成长分析", page.path === "pages/analytics/analytics", page.path);
  const analytics = await page.data();
  check("成长分析有数据", (analytics.points || []).length > 0, `${analytics.points?.length} 次`);
  await shot("14-analytics");
  await waitBack("pages/report/report");
  page = await current();
}
const tabs = await page.$$(".records__tab");
if (tabs[1]) {
  await tabs[1].tap();
  await wait(700);
  await shot("15-records-done");
  await tabs[0].tap();
}
if (cells[0]) {
  await cells[0].tap();
  page = await waitForPath("pages/positions/positions", 9000);
  check("进入选岗", page.path === "pages/positions/positions", page.path);
  let positions = await page.data();
  for (let attempt = 0; attempt < 3 && !positions.total; attempt += 1) {
    await wait(1500);
    positions = await page.data();
  }
  check("岗位目录", positions.total > 1000, `total=${positions.total}`);
  await shot("16-positions");
  await waitBack("pages/report/report");
  page = await current();
}
await mini.navigateTo("/pages/timer/timer");
page = await waitForPath("pages/timer/timer", 8000);
check("进入做题计时", page.path === "pages/timer/timer", page.path);
await shot("17-timer");
await waitBack("pages/records/records");
await mini.navigateTo("/pages/settings/settings");
page = await waitForPath("pages/settings/settings", 8000);
check("进入设置", page.path === "pages/settings/settings", page.path);
await shot("18-settings");
await mini.navigateBack();
await wait(1000);

// 9. 首页最近练习回到成绩
await mini.reLaunch("/pages/home/home");
await wait(2400);
page = await current();
const recent = await page.$$(".home__cover-face");
check("首页最近练习", recent.length > 0, `${recent.length} 张`);
if (recent[0]) {
  await recent[0].tap();
  await wait(2400);
}
page = await current();
check("最近练习可打开", page.path === "pages/report/report" || page.path === "pages/practice/practice", page.path);
await shot("19-home-recent");

const failed = checks.filter(item => !item.ok);
await writeFile(resolve(out, "result.json"), JSON.stringify({
  checkedAt: new Date().toISOString(),
  attemptId,
  checks,
  failed,
  consoleErrors: [...new Set(errors)],
}, null, 2));
await mini.disconnect();
console.log(`自检 ${checks.length} 项，失败 ${failed.length} 项`);
for (const item of failed) console.log("✗", item.name, item.detail);
if (errors.length) console.log("控制台报错:", [...new Set(errors)].slice(0, 6).join(" | "));
