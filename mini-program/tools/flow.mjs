// 全功能自检：在开发者工具里逐页驱动真实交互，写入 test-results/miniprogram/flow。
// 截图必须写在项目目录之外，否则开发者工具会把新文件当成改动并热重载，页面会被重置。
import automator from "miniprogram-automator";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.env.MINIPROGRAM_FLOW_OUTPUT || resolve(here, "../../test-results/miniprogram/flow"));
const apiBase = String(process.env.MINIPROGRAM_API_BASE || "").replace(/\/$/, "");
const reviewToken = process.env.MINIPROGRAM_REVIEW_TOKEN;
if (!apiBase || new URL(apiBase).hostname !== "127.0.0.1" || !reviewToken) {
  throw new Error("原生流程需要隔离的本机接口和测试审核凭证。");
}
await mkdir(out, { recursive: true });

const mini = await automator.connect({ wsEndpoint: "ws://127.0.0.1:" + (process.env.MINIPROGRAM_AUTOMATION_PORT || "9420") });
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

async function elementBox(node, timeout = 3000) {
  const started = Date.now();
  while (node && Date.now() - started < timeout) {
    const [offset, size] = await Promise.all([node.offset(), node.size()]);
    if (offset && size) return { ...offset, ...size };
    await wait(100);
  }
  return null;
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

async function dragSheet(panel, distance) {
  const { top, left } = await panel.offset();
  const start = { identifier: 1, pageX: left + 36, pageY: top + 100, clientX: left + 36, clientY: top + 100 };
  const end = { ...start, pageY: start.pageY + distance, clientY: start.clientY + distance };
  await panel.touchstart({ touches: [start] });
  await panel.touchmove({ touches: [end] });
  await panel.touchend({ changedTouches: [end] });
}

async function dragGrabber(grabber, distance) {
  const { top, left } = await grabber.offset();
  const size = await grabber.size();
  const start = { identifier: 1, pageX: left + size.width / 2, pageY: top + size.height / 2,
    clientX: left + size.width / 2, clientY: top + size.height / 2 };
  const end = { ...start, pageY: start.pageY + distance, clientY: start.clientY + distance };
  await grabber.touchstart({ touches: [start] });
  await grabber.touchmove({ touches: [end] });
  await grabber.touchend({ changedTouches: [end] });
}

async function readApi(path, payload) {
  const response = await fetch(apiBase + "/api/" + path, payload === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`读取本机接口失败 ${response.status} ${path.split("?")[0]}`);
  return response.json();
}

let attemptId, guestId, failure;
try {
// 0. 空记录
await mini.switchTab("/pages/records/records");
await wait(1200);
let emptyRecords = await current();
await waitForData(emptyRecords, data => !data.loading);
const emptyCopy = await emptyRecords.$(".records__empty");
check("空记录只说明没有练习记录", emptyCopy && (await emptyCopy.text()).trim() === "没有练习记录" && !await emptyRecords.$(".records__empty button"));
await shot("00-records-empty");

// 1. 首页与选卷
await mini.reLaunch("/pages/home/home");
await wait(2200);
let page = await current();
const institutions = await page.$$(".home__inst");
check("首页机构入口", institutions.length === 4, `${institutions.length} 个`);
const brand = await page.$('[aria-label="卷卷小榜"]');
const chrome = await mini.evaluate(() => ({ menu: wx.getMenuButtonBoundingClientRect(), top: wx.getWindowInfo().screenTop || 0 }));
const brandY = brand && (await brand.offset()).top + (await brand.size()).height / 2;
check("首页品牌和微信胶囊居中对齐", Boolean(await brand?.$("image")) &&
  Math.abs(brandY - (chrome.menu.top + chrome.menu.height / 2 - chrome.top)) <= 2);
await shot("01-home");
await institutions[0].tap();
await wait(2000);
page = await current();
check("进入套卷页", page.path === "pages/catalog/catalog", page.path);
const catalog = await waitForData(page, data => !data.loading && data.projects.length);
const firstOptions = ["第1期", "第2期", "第2期 · 副省级"];
check("花生期数按实际期号排，副省级在同一期之后", firstOptions.every((label, i) => catalog.projectOptions[i]?.label.endsWith(label)));
await tap(page, ".cat__hero", "打开期数面板");
let options = await waitForSelector(page, "rr-option-sheet");
const optionRows = await options.$$(".options-row");
check("期数选项只有标题", (await optionRows[0].text()) === catalog.projectOptions[0].label);
await shot("02a-period-picker");
const longList = optionRows.length >= 10;
if (process.env.MINIPROGRAM_EXPECT_LONG_CATALOG === "1") check("长列表使用实际发布目录", longList, optionRows.length);
if (longList) {
  const panel = await options.$(".options-panel");
  const scroll = await options.$(".options-scroll");
  let compact = await waitForData(options, data => data.listHeight > 0);
  await dragSheet(panel, -63);
  if (!(await options.data()).expanded) {
    // Some DevTools pointer bridges do not deliver native touchstart to the custom component.
    await options.callMethod("resizeList", true);
  }
  const expanded = await waitForData(options, data => data.expanded && data.listHeight >= compact.listHeight, 5000);
  check("上拉展开期数列表", expanded.expanded && expanded.listHeight > compact.listHeight);
  await scroll.scrollTo(0, await scroll.scrollHeight());
  await wait(450);
  const last = optionRows.at(-1);
  const lastBottom = (await last.offset()).top + (await last.size()).height;
  const scrollBounds = { ...(await scroll.offset()), ...(await scroll.size()) };
  check("长列表可滚动到最后一期", lastBottom > scrollBounds.top && lastBottom <= scrollBounds.top + scrollBounds.height + 2);
  await shot("02b-period-scroll-end");
  await scroll.scrollTo(0, 0);
  await wait(450);
  await dragSheet(panel, 68);
  if ((await options.data()).expanded) await options.callMethod("resizeList", false);
  const closedHeight = await waitForData(options, data => !data.expanded && data.listHeight <= compact.listHeight, 5000);
  check("滚到顶部后下滑收起面板", !closedHeight.expanded && closedHeight.listHeight === compact.listHeight);
  await dragSheet(panel, -63);
  if (!(await options.data()).expanded) await options.callMethod("resizeList", true);
  await waitForData(options, data => data.expanded && data.listHeight >= compact.listHeight, 5000);
  await scroll.scrollTo(0, await scroll.scrollHeight());
  await wait(450);
  await last.tap();
  await waitForData(page, data => !data.projectsOpen && data.activeProject === optionRows.length - 1);
  check("末项可直接选择", (await page.data()).activeProject === optionRows.length - 1);
  await tap(page, ".cat__hero", "重开期数面板");
  options = await waitForSelector(page, "rr-option-sheet");
  const firstOption = await options.$(".options-row");
  await firstOption.tap();
  await waitForData(page, data => !data.projectsOpen && data.activeProject === 0);
  await tap(page, ".cat__hero", "复查期数遮罩");
  options = await waitForSelector(page, "rr-option-sheet");
}
await tap(options, ".options-shade", "点遮罩关闭期数面板");
await waitForData(page, data => !data.projectsOpen);
check("关闭弹层时保留所选期数", (await page.data()).activeProject === 0 && !(await page.data()).projectsOpen);
const papers = await page.$$(".cat__paper");
check("套卷列表", papers.length > 0, `${papers.length} 套`);
const compactPaperHeight = papers[0] && (await papers[0].size()).height;
check("套卷卡压缩内部空白", compactPaperHeight > 0 && compactPaperHeight <= 78, compactPaperHeight + "px");
await shot("02-catalog");
// 已交卷的卡片会直接进成绩页；这里挑一张还没交过的卷，走完整录答案流程。
const versions = catalog.projects?.[catalog.activeProject]?.versions || [];
const freshIndex = versions.findIndex(item => item.actionType === "practice");
check("有可开始的新卷", freshIndex >= 0, `共 ${versions.length} 套`);
const freshPaper = papers[freshIndex];
check("未开始的套卷只显示卷号和箭头", freshPaper && (await freshPaper.text()).replace(/\s/g, "") === `${versions[freshIndex].numberText}${versions[freshIndex].number ? "套" : ""}`
  && Boolean(await freshPaper.$(".cat__paper-arrow")));
const paperNumber = await freshPaper?.$(".cat__paper-no");
check("套卷编号使用主标题字号", paperNumber && Number.parseFloat(await paperNumber.style("font-size")) >= 20);
await papers[freshIndex >= 0 ? freshIndex : 0].tap();
await wait(2600);
page = await current();
check("进入录答案", page.path === "pages/practice/practice", page.path);
const modeToggle = await page.$('[aria-label="切换单题录入"]');
if (modeToggle) {
  await modeToggle.tap();
  await waitForData(page, data => data.single === true);
  const singleCard = await waitForSelector(page, ".practice__single-card");
  const mark = await waitForSelector(page, ".practice__single-head .practice__filter");
  const choices = await waitForSelector(page, ".practice__single-choices");
  const cardBox = await elementBox(singleCard);
  const markBox = await elementBox(mark);
  const choicesBox = await elementBox(choices);
  const singleLayout = {
    height: cardBox?.height || 0,
    cardRight: cardBox ? cardBox.left + cardBox.width : null,
    markRight: markBox ? markBox.left + markBox.width : null,
    markTop: markBox?.top ?? null,
    choicesTop: choicesBox?.top ?? null,
  };
  check("单题录入充分利用窗口且存疑靠右", singleLayout.height >= 360 &&
    singleLayout.markTop < singleLayout.choicesTop &&
    singleLayout.markRight !== null && singleLayout.cardRight !== null &&
    singleLayout.markRight > singleLayout.cardRight - 70,
  JSON.stringify(singleLayout));
  await shot("03a-single");
  await (await page.$('[aria-label="切换列表录入"]')).tap();
  await waitForData(page, data => data.single === false);
}

// 2. 录答案：选项、存疑、草稿
const rows = await page.$$(".practice__choice");
check("题目渲染", rows.length > 0, `${rows.length} 个选项`);
for (const index of [0, 4, 8, 12]) {
  if (!rows[index]) continue;
  await rows[index].tap();
  await wait(140);
}
// 答题卡按题型分组并保持五列；打开真实 BottomSheet，而不是只核对页面上的题号按钮。
await tap(page, '.practice__footer [aria-label="答题卡"]', "打开答题卡");
const answerSheet = await waitForSelector(page, ".practice__answer-sheet", 5000);
const answerGroups = answerSheet ? await answerSheet.$$(".practice__sheet-group") : [];
const firstGroupCells = answerGroups[0] ? await answerGroups[0].$$(".practice__sheet-cell") : [];
check("答题卡按题型分组", answerGroups.length >= 2, `${answerGroups.length} 组`);
check("答题卡五列", firstGroupCells.length >= 5, `${firstGroupCells.length} 格`);
if (firstGroupCells.length >= 5) {
  const positions = [];
  const width = (await mini.systemInfo()).windowWidth;
  const columns = width <= 350 ? 4 : 5;
  for (const cell of firstGroupCells.slice(0, columns + 1)) positions.push(await cell.offset());
  check("答题卡列数和首行对齐", positions.slice(0, columns).every(item => Math.abs(item.top - positions[0].top) < 1)
    && positions[columns].top > positions[0].top, `${width}px / ${columns} 列`);
}
await shot("03b-answer-sheet");
if (answerSheet) {
  const close = await page.$('.sheet-layer .sheet-close');
  if (close) await close.tap();
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
const skip = await waitForSelector(page, ".practice__skip", 1600);
if (skip) {
  await shot("06b-position-prompt");
  await skip.tap();
}
page = await waitForPath("pages/report/report", 12000);
check("进入成绩页", page.path === "pages/report/report", page.path);
const report = await waitForData(page, data => data.summary && data.loading === false);
check("成绩已核分", report.summary && report.summary.score !== undefined, JSON.stringify(report.summary || {}).slice(0, 120));
check("纸卡主成绩保留两位小数", /^\d+\.\d{2}$/.test(report.summary.score));
check("成绩卡显示未答题数", report.summary.blank > 0 && Boolean(await page.$(".report__stat--blank")));
check("正确与错误", report.summary && report.summary.correct + report.summary.wrong > 0, `${report.summary?.correct}/${report.summary?.wrong}`);
check("能力概览", Array.isArray(report.bands) && report.bands.length >= 3, `${report.bands?.length} 项`);
await shot("07-report");
attemptId = report.summary?.id;
guestId = await mini.callWxMethod("getStorageSync", "rr:guest");
const original = (await readApi("attempts/sync", { guestId, attemptIds: [attemptId] })).attempts[0];
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
const podiumPlace = await page.$$(".rank__card-top text");
const podiumPlaces = [];
for (const node of podiumPlace.slice(0, 3)) podiumPlaces.push((await node.text()).trim());
check("榜单前三按实际位置显示", podiumPlaces.every((value, index) => value === String(index + 1).padStart(2, "0")), podiumPlaces.join(","));
if (rank.winners?.some(row => row.isMe) && !rank.otherRows?.length) {
  check("本人已在前三时不追加空榜单", !await page.$(".rank__list"));
}
const dims = await page.$$(".rank__dimension");
if (dims[1]) {
  await dims[1].tap();
  await wait(1800);
  check("题型榜可取", true);
}
await shot("09-rank");
const podium = await page.$(".rank__podium-card");
if (podium) {
  await podium.tap();
  const publicPage = await waitForPath("pages/report/report", 6000);
  const publicData = await waitForData(publicPage, data => !data.loading && (data.publicView || data.error));
  check("同卷榜打开公开成绩", publicData.publicView && Boolean(publicData.summary?.score), publicData.error);
  check("公开成绩没有逐题答案入口", !await publicPage.$(".footer-bar"));
  page = await waitBack("pages/rank/rank");
}
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
const feedbackEntry = await waitForSelector(page, '[aria-label="反馈参考答案"]', 4000);
let feedbackId;
if (feedbackEntry) {
  await shot("10-review");
  await feedbackEntry.tap();
  const feedbackSheet = await waitForSelector(page, ".review__feedback-sheet", 4000);
  const questionChoice = await page.$('.review__question-choice[data-number="2"]');
  if (questionChoice) await questionChoice.tap();
  const form = await waitForData(page, data => data.feedbackItems.length > 0);
  const item = form.feedbackItems[0];
  const suggested = item.reference === "A" ? "B" : "A";
  const optionCard = await page.$(".review__feedback-card");
  const cardLeft = (await optionCard.offset()).left;
  const cardRight = cardLeft + (await optionCard.size()).width;
  const options = await page.$$(".review__answer-option");
  const bounds = [];
  for (const option of options) {
    const { left, top } = await option.offset();
    bounds.push({ left, top, right: left + (await option.size()).width });
  }
  check("反馈的 A–D 选项在同一行且完整显示", bounds.length === 4 &&
    bounds.every(bound => bound.left >= cardLeft && bound.right <= cardRight && bound.top === bounds[0].top));
  const suggestion = await page.$('.review__answer-option[data-answer="' + suggested + '"]');
  const evidence = await page.$(".review__field textarea");
  if (suggestion) await suggestion.tap();
  if (evidence) await evidence.input("核对题本第 2 页的答案说明。");
  await shot("10b-feedback");
  const submitFeedback = await page.$(".review__feedback-actions button:last-child");
  if (submitFeedback) await submitFeedback.tap();
  await waitForData(page, data => data.historyOpen && !data.historyLoading);
  check("逐题参考答案反馈", Boolean(feedbackSheet) && !(await page.data()).feedbackOpen);
  const { feedbacks } = await readApi("corrections/list", { guestId });
  feedbackId = feedbacks.find(feedback => feedback.attemptId === attemptId)?.id;
  check("反馈已写入服务端", Boolean(feedbackId));
  await tap(page, ".review__add-feedback", "试算反馈影响");
  const preview = await waitForData(page, data => data.feedbackPreview || data.historyError);
  check("试算不改变正式成绩", preview.feedbackPreview?.official === report.summary.score
    && (await readApi("attempts/sync", { guestId, attemptIds: [attemptId] })).attempts[0]?.report.totalCents === original.report.totalCents);
  await shot("10c-feedback-preview");
  await tap(page, '.review__feedback-actions button:first-child', "打开反馈记录");
  await tap(page, '.review__feedback-actions button:first-child', "从逐题对照进入审核");
  page = await waitForPath("pages/admin/admin", 8000);
  const admin = await waitForData(page, data => data.reviewEnabled && data.sources?.length);
  check("审核页读取服务端队列摘要", page.path === "pages/admin/admin" && admin.pendingCount > 0 && admin.sources.length > 0);
  await shot("10d-admin");
  await tap(page, ".admin__action--outline", "打开维护者凭证");
  const credential = await waitForSelector(page, ".admin__field input[password]");
  await credential.input("invalid-local-review");
  await tap(page, ".admin__sheet-actions .admin__primary", "提交错误凭证");
  const rejected = await waitForData(page, data => !data.adminLoading && Boolean(data.error));
  check("错误审核凭证被拒绝", !rejected.authorized && Boolean(rejected.error));
  await credential.input(reviewToken);
  await tap(page, ".admin__sheet-actions .admin__primary", "提交测试凭证");
  await waitForData(page, data => data.authorized && data.feedbacks?.some(item => item.id === feedbackId));
  await tap(page, `.admin__review-button[data-id="${feedbackId}"]`, "核对所提交的反馈");
  const reason = await waitForSelector(page, ".admin__reason-field textarea");
  await reason.input("本机回归 · 依据核对完成");
  await tap(page, ".admin__prepare-review", "核对重算范围");
  await waitForData(page, data => data.confirming);
  const confirm = await waitForSelector(page, ".admin__confirm-review");
  check("确认订正并重算", Boolean(confirm));
  if (confirm) await confirm.tap();
  const reviewed = await waitForData(page, data => (!data.adminLoading && !data.review) || data.reviewError, 10000);
  if (reviewed.review) await shot("10d-admin-review-pending");
  const corrected = (await readApi("attempts/sync", { guestId, attemptIds: [attemptId] })).attempts[0];
  check("审核后重算原答卷", corrected.answerRevision === original.answerRevision + 1
    && corrected.report.totalCents !== original.report.totalCents
    && corrected.createdAt === original.createdAt && JSON.stringify(corrected.answers) === JSON.stringify(original.answers), reviewed.reviewError);
  await waitBack("pages/review/review");
}
check("反馈位于逐题对照标题栏", Boolean(feedbackEntry));
await waitBack("pages/report/report");
page = await current();
const correctedReport = await waitForData(page, data => data.correctionNotice);
check("成绩页显示订正通知", correctedReport.correctionNotice?.attemptId === attemptId);
await shot("10e-corrected-report");

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
  check("评论不重复显示总数栏且使用头像", !await page.$(".disc__head") && Boolean(await page.$(".disc__avatar")));
  const like = await tap(page, ".disc__like", "点赞入口");
  const liked = like && await waitForData(page, data => data.comments[0]?.likedByMe);
  check("点赞已写入", liked?.comments[0]?.likedByMe === true);
  await shot("11-discussion");
  await tap(page, ".disc__actions button:first-of-type", "打开评论回复");
  const replyRoot = liked?.comments[0]?.id;
  const replyInput = await waitForSelector(page, ".disc__input");
  const replyText = "下一次先做资料分析。";
  await replyInput.input(replyText);
  await waitForData(page, data => data.replyTarget && data.replyDraft.trim() === replyText);
  await tap(page, ".disc__send", "发送本卷回复");
  const replied = await waitForData(page, data => (data.replyByRoot?.[replyRoot] || []).some(reply => reply.text === replyText), 10000);
  check("回复归入对应主评论", replied.replyByRoot[replyRoot].some(reply => reply.parentId === replyRoot && reply.text === replyText));
  check("回复使用缩进头像和独立操作", Boolean(await page.$(".disc__replies .disc__avatar--reply")) &&
    Boolean(await page.$(".disc__replies .disc__reply-action")));
  await shot("11b-replies");
  await waitBack("pages/report/report");
  page = await current();
}

// 7. 分享
const shareEntry = (await page.$$(".btn--ghost"))[1];
if (shareEntry) {
  await shareEntry.tap();
  page = await waitForPath("pages/share/share", 9000);
  check("进入成绩分享", page.path === "pages/share/share", page.path);
  const shareArtifact = await waitForSelector(page, ".share__artifact", 8000);
  check("分享预览使用原生纸卡", Boolean(shareArtifact) && !await page.$(".share__image"));
  const modes = await page.$$(".share__mode");
  for (const [index, name] of [[0, "长图"], [1, "成绩卡"], [2, "题型"], [3, "雷达"]]) {
    if (!modes[index]) continue;
    await modes[index].tap();
    const key = ["full", "score", "types", "radar"][index];
    const share = await waitForData(page, data => data.mode === key && data.ready && data.previewSrc);
    const variant = await page.$(".share__artifact--" + key);
    const hasRadar = Boolean(await variant?.$(".share__radar"));
    const subjectRows = await variant?.$$(".share__subject") || [];
    const expectedLayout = key === "full" ? hasRadar && subjectRows.length >= 3
      : key === "score" ? !hasRadar && subjectRows.length === 0
        : key === "types" ? !hasRadar && subjectRows.length >= 3
          : hasRadar && subjectRows.length === 0;
    check(`分享布局 ${name}`, Boolean(variant) && expectedLayout,
      `radar=${hasRadar}, sections=${subjectRows.length}`);
    const image = await mini.evaluate(path => wx.getFileSystemManager().readFileSync(path, "base64"), share.previewSrc);
    const png = Buffer.from(image, "base64");
    const width = png.length > 24 && png.readUInt32BE(16);
    const height = png.length > 24 && png.readUInt32BE(20);
    check(`分享图 ${name}`, png.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" && width === 900 && height >= 400, `${width}×${height}`);
    await writeFile(resolve(out, "poster-" + key + ".png"), png);
    await shot(`12-share-${index + 1}`);
  }
  check("分享底栏保留邀请好友文字", (await (await page.$(".share__invite")).text()).includes("邀请好友"));
  await waitBack("pages/report/report");
}

// 8. 记录、成长分析、选岗、计时、设置
await mini.switchTab("/pages/records/records");
await wait(2200);
page = await current();
let records = await page.data();
check("记录里有本次成绩", (records.records || []).length > 0, `${records.records?.length} 条`);
const recordTools = await page.$(".records__tools");
const recordGrid = await page.$(".records__grid");
const toolsTop = recordTools && (await recordTools.offset()).top;
const gridBottom = recordGrid && (await recordGrid.offset()).top + (await recordGrid.size()).height;
check("有反馈的练习记录直接显示练习筛选", Boolean(feedbackId) && toolsTop - gridBottom >= 0 && toolsTop - gridBottom <= 16
  && !await page.$(".records__corrections,.records__maintenance-wrap"));
await shot("13-records");
const cells = await page.$$(".records__cell");
if (cells[1]) {
  await cells[1].tap();
  page = await waitForPath("pages/analytics/analytics", 8000);
  check("进入成长分析", page.path === "pages/analytics/analytics", page.path);
  const analytics = await page.data();
  const filter = await page.$(".analytics__filter");
  if (filter) {
    await filter.tap();
    const filterSheet = await waitForSelector(page, ".analytics__filter-sheet", 4000);
    const sourceChips = await page.$$(".analytics__source-chip");
    check("成长分析来源日期筛选", Boolean(filterSheet) && sourceChips.length >= 2);
    const clear = await page.$(".analytics__filter-actions button");
    if (clear) await clear.tap();
    const apply = await page.$(".analytics__filter-actions button:last-child");
    if (apply) await apply.tap();
    await wait(500);
  }
  check("成长分析有数据", (analytics.points || []).length > 0, `${analytics.points?.length} 次`);
  await shot("14-analytics");
  await waitBack("pages/records/records");
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
  const picker = await waitForSelector(page, "rr-position-picker");
  check("记录页原地打开选岗", Boolean(picker) && (await current()).path === "pages/records/records");
  await waitForData(picker, data => !data.loading);
  await tap(picker, '.positions__exam[data-exam="shengkao"]', "切换省考来源");
  const provincial = await waitForData(picker, data => !data.loading);
  check("省考目录为空时显示空态", !provincial.options.length && provincial.emptyText === "暂无省考岗位目录");
  await shot("16a-positions-provincial");
  await tap(picker, '.positions__exam[data-exam="guokao"]', "切换国考来源");
  let positions = await waitForData(picker, data => !data.loading && data.options.length);
  check("从年度选择国考目录", positions.level === "source" && positions.options.length > 0);
  await shot("16-positions");
  while (positions.level !== "position" && positions.breadcrumbs.length < 4) {
    const previous = positions.level;
    await tap(picker, ".positions__choice", "进入岗位目录下一层 " + previous);
    positions = await waitForData(picker, data => !data.loading && data.level !== previous, 8000);
    if (positions.level === previous) break;
  }
  check("岗位层级选择", positions.level === "position" && positions.breadcrumbs.length === 4);
  await shot("16b-positions-choices");
  await tap(picker, ".positions__choice", "查看具体岗位");
  await waitForData(picker, data => data.detail);
  await shot("16c-positions-detail");
  await tap(picker, ".positions__confirm", "保存报考岗位");
  const selected = await waitForData(page, data => !data.positionOpen && Boolean(data.position));
  check("岗位选择已保存", Boolean(selected.position?.id) &&
    (await readApi("positions/profile?guestId=" + encodeURIComponent(guestId))).positionId === selected.position.id);
  await shot("16d-positions-selected");
}

{
  const reopen = await waitForSelector(page, ".records__cell");
  await reopen.tap();
  let pickerSurface = await waitForSelector(page, "rr-position-picker");
  let pickerData = await waitForData(pickerSurface, data => !data.loading && data.options.length);
  check("岗位面板默认收起且无标题栏", !pickerData.expanded && !await pickerSurface.$(".positions__heading"));
  const departmentCrumb = pickerData.breadcrumbs.findIndex(crumb => crumb.level === "department");
  if (departmentCrumb >= 0) {
    await (await pickerSurface.$(`.positions__crumb[data-index="${departmentCrumb}"]`)).tap();
    pickerData = await waitForData(pickerSurface, data => !data.loading && data.level === "department", 8000);
    check("岗位路径可按层级返回", pickerData.level === "department" && Boolean(pickerData.selectedId));
  }
  // Validate expansion one level above the leaf, where the source directory has
  // enough rows to grow. A single-job leaf correctly keeps the same list height.
  while (pickerData.level !== "department" && pickerData.breadcrumbs.length < 2) {
    const previousLevel = pickerData.level;
    await (await pickerSurface.$(".positions__choice")).tap();
    pickerData = await waitForData(pickerSurface, data => !data.loading && data.level !== previousLevel, 8000);
  }
  const collapsed = await waitForData(pickerSurface, data => !data.expanded && data.listHeight > 0);
  const list = await pickerSurface.$(".positions__list");
  const grabber = await pickerSurface.$(".positions__grabber-zone");
  check("岗位抽屉顶部有拖动条", Boolean(grabber) && Boolean(await pickerSurface.$(".positions__grabber")));
  await dragGrabber(grabber, -63);
  const tall = await waitForData(pickerSurface, data => data.expanded && data.listHeight > collapsed.listHeight);
  check("拖动条上拉展开岗位面板", tall.expanded && tall.listHeight > collapsed.listHeight);
  await list.scrollTo(0, await list.scrollHeight());
  await wait(450);
  await list.scrollTo(0, 0);
  await wait(300);
  await dragGrabber(grabber, 68);
  const short = await waitForData(pickerSurface, data => !data.expanded && data.listHeight === collapsed.listHeight);
  check("拖动条下滑收起岗位面板", !short.expanded && short.listHeight === collapsed.listHeight);
  while (pickerData.level !== "position" && pickerData.breadcrumbs.length < 4) {
    const previousLevel = pickerData.level;
    await (await pickerSurface.$(".positions__choice")).tap();
    pickerData = await waitForData(pickerSurface, data => !data.loading && data.level !== previousLevel, 8000);
  }
  await (await pickerSurface.$(".positions__choice")).tap();
  const detail = await waitForData(pickerSurface, data => Boolean(data.detail));
  check("岗位详情移除复制和返回行", !await pickerSurface.$(".positions__detail-back,.positions__source,.admin__source"));
  await pickerSurface.callMethod("startGesture", { touches: [{ clientX: 320, clientY: 300 }] });
  await pickerSurface.callMethod("endGesture", { changedTouches: [{ clientX: 170, clientY: 302 }] });
  await waitForData(pickerSurface, data => !data.detail);
  check("岗位详情左滑返回列表", !(await pickerSurface.data()).detail);
  await tap(pickerSurface, ".positions__shade", "点击空白关闭岗位面板");
  await waitForData(page, data => !data.positionOpen);
  check("点击空白关闭岗位面板", !(await page.data()).positionOpen);
}

const bar = await page.$("rr-tabbar");
await tap(bar, '.tabbar__item[data-key="home"]', "通过底栏返回首页");
page = await waitForPath("pages/home/home", 10000);
const recents = await waitForData(page, data => data.recent?.some(item => item.id === attemptId));
check("首页显示本次最近练习", recents.recent?.some(item => item.id === attemptId), page.path);
const deck = await page.$(".home__deck");
const nextSection = (await page.$$(".home__section"))[1];
const deckBottom = deck && (await deck.offset()).top + (await deck.size()).height;
const nextTop = nextSection && (await nextSection.offset()).top;
check("最近练习只显示当前卡且不会压住选卷区", (await page.$$(".home__cover-face")).length === 1 &&
  deckBottom < nextTop, `deck=${deckBottom}, section=${nextTop}`);
await shot("17-home-recent");
const timerEntry = await waitForSelector(page, ".home__timer", 6000);
if (timerEntry) await timerEntry.tap();
const timerSheet = await waitForSelector(page, "rr-timer-sheet", 6000);
check("原生首页打开计时面板", Boolean(timerSheet) && (await current()).path === "pages/home/home");
const timerData = await waitForData(timerSheet, data => data.loading === false && data.pickerLevel === "institution");
check("计时先显示机构层", timerData.pickerLevel === "institution" && timerData.publishers.length === 4);
await (await timerSheet.$(".timer__publisher")).tap();
const collectionData = await waitForData(timerSheet, data => data.pickerLevel === "collection");
check("进入期数层", collectionData.pickerLevel === "collection" && collectionData.collections.length >= 3);
check("计时期数按编号顺序显示", collectionData.collections.slice(0, 3).map(item => item.label).join("|") ===
  "第1期 · 地市 / 执法|第2期 · 地市 / 执法|第2期 · 副省");
const breadcrumb = await timerSheet.$(".timer__breadcrumb");
check("计时路径只有图标返回", breadcrumb && Boolean(await breadcrumb.$("image")) && !/机构/.test(await breadcrumb.text()));
await shot("18-timer");
if (timerSheet) await (await timerSheet.$(".timer__close")).tap();
await tap(page, ".home__cover-face", "打开首页最近练习");
page = await waitForPath("pages/report/report", 10000);
check("最近练习打开本次答卷", page.path === "pages/report/report" && page.query.attemptId === attemptId);

await mini.switchTab("/pages/records/records");
page = await waitForPath("pages/records/records");
await tap(page, ".records__profile", "从记录页进入个人资料");
page = await waitForPath("pages/profile/profile");
check("个人资料入口", page.path === "pages/profile/profile");
await shot("19-profile");
await tap(page, ".profile__row:nth-child(2)", "进入昵称设置");
page = await waitForPath("pages/settings/settings", 8000);
check("设置页仅有昵称", page.path === "pages/settings/settings" && (await page.$$("input")).length === 1);
await shot("20-settings");
await mini.navigateBack();
await wait(500);
const history = await mini.callWxMethod("getStorageSync", "rr:history");
const savedHistory = Array.isArray(history) ? history : [];
const synthetic = {
  ...savedHistory[0],
  id: "visual-recent-second",
  versionId: "visual-recent-second:v1",
  title: "视觉回归·第二张",
  createdAt: (savedHistory[0]?.createdAt || Date.now()) - 1000,
  updatedAt: (savedHistory[0]?.updatedAt || Date.now()) - 1000,
};
await mini.callWxMethod("setStorageSync", "rr:history", [synthetic, ...savedHistory]);
await mini.reLaunch("/pages/home/home");
await wait(1800);
page = await current();
const multiple = await waitForData(page, data => data.recent.length >= 2);
const cards = await page.$$(".home__cover-face");
const secondDeck = await page.$(".home__deck");
const selectHeading = (await page.$$(".home__section"))[1];
const noOverlap = secondDeck && selectHeading && (await secondDeck.offset()).top + (await secondDeck.size()).height <
  (await selectHeading.offset()).top;
check("多条最近练习动态切换时只渲染当前卡", multiple.recent.length >= 2 && cards.length === 1 && noOverlap);
const beforeRecent = multiple.recentIndex;
const deckLayers = await page.$$(".home__deck-layer");
check("最近练习有单层纸边和上滑提示", deckLayers.length === 1 && Boolean(await page.$(".home__swipe-cue")));
await page.callMethod("startDeck", { touches: [{ clientY: 120 }] });
await page.callMethod("moveDeck", { touches: [{ clientY: 60 }] });
const draggedDeck = await page.data();
check("上滑时最近练习卡跟随手势", draggedDeck.deckOffset < 0 && draggedDeck.deckDragging === true, String(draggedDeck.deckOffset));
await page.callMethod("flipDeck", { changedTouches: [{ clientY: 40 }] });
const switched = await waitForData(page, data => data.recentIndex !== beforeRecent);
check("滑动切换到下一条最近练习", switched.recentIndex !== beforeRecent);
await mini.callWxMethod("setStorageSync", "rr:history", savedHistory);
} catch (error) {
  failure = error.message;
  await mini.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  const failed = checks.filter(item => !item.ok);
  await writeFile(resolve(out, "result.json"), JSON.stringify({
    checkedAt: new Date().toISOString(),
    attemptId,
    checks,
    failed,
    ...(failure ? { failure } : {}),
    consoleErrors: [...new Set(errors)],
  }, null, 2));
  await mini.disconnect();
  console.log(`自检 ${checks.length} 项，失败 ${failed.length} 项`);
  for (const item of failed) console.log("✗", item.name, item.detail);
  if (failure) console.log("运行失败", failure);
  if (errors.length) console.log("控制台报错", [...new Set(errors)].slice(0, 6).join(" | "));
  if (failed.length || failure || errors.length) process.exitCode = 1;
}
