import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import navigation from "../mini-program/utils/navigation.js";
import catalog from "../mini-program/utils/catalog.js";
import rank from "../mini-program/utils/rank.js";
import tabSwipe from "../mini-program/utils/tab-swipe.js";
import sheetGesture from "../mini-program/utils/sheet-gesture.js";
import practiceScroll from "../mini-program/utils/practice-scroll.js";
import { IMPORTED_PAPERS } from "../src/data/imported-papers.js";
import { PAPERS } from "../src/data/papers.js";

const { navigationLayout } = navigation;
const markup = path => readFileSync(new URL("../mini-program/" + path, import.meta.url), "utf8");

test("native records keep the practice filters directly after the two tools", () => {
  const view = markup("pages/records/records.wxml");
  assert.equal((view.match(/class="records__cell"/g) || []).length, 2);
  assert.match(view, /bindtap="openAnalytics"[\s\S]*?<\/button>\s*<\/view>\s*<view class="records__tools">/);
  assert.doesNotMatch(view, /答案反馈|维护者审核|(?:correction|feedback)(?:__|Open|s\.)/i);
  assert.match(markup("pages/review/review.wxml"), /反馈记录[\s\S]*?bindtap="openAdmin">维护者审核/);
});

test("the native homepage uses the capsule-aligned title row and includes a first-use card", () => {
  const view = markup("pages/home/home.wxml");
  assert.equal((view.match(/<rr-nav title="卷卷小榜" logo="{{asset\.logo}}"/g) || []).length, 2);
  assert.match(view, /!loading && !error && !recent\.length}}".*?home__recent--empty/);
  assert.doesNotMatch(view, /class="home__brand"/);
  assert.match(view, /catchtouchmove="moveDeck"/);
  assert.equal((view.match(/class="home__deck-layer"/g) || []).length, 1);
  assert.match(view, /class="home__swipe-cue"/);
});

test("native catalog uses the issue number and keeps regular papers before the provincial variant", () => {
  const entries = [["第10期", ""], ["二期", "副省级"], ["一期", ""], ["第十一期", ""], ["第2期", "地市级"]];
  const versions = entries.map(([period, variant]) => ({
    institution: "四海", project: "2026 下半年", period, variant, number: 1, status: "published",
  }));
  const [{ projects }] = catalog.groupByInstitution(versions);
  assert.deepEqual(projects.map(({ period, variant }) => [catalog.periodLabel(period), variant]),
    [["第1期", ""], ["第2期", "地市级"], ["第2期", "副省级"], ["第10期", ""], ["第11期", ""]]);
  assert.equal(catalog.periodLabel("极致模考6套卷"), "极致模考6套卷");
  assert.doesNotMatch(markup("pages/catalog/catalog.wxml"), />\s*开始\s*</);
  assert.match(markup("pages/catalog/catalog.wxml"), /class="cat__paper-main"/);
});

test("paper-count labels do not split one raw mock-exam folder into separate catalogs", () => {
  const versions = [1, 2, 3, 7, 10].map(number => ({
    id: "chaoge-" + number, institution: "超格", project: "2027 公考 · 行测", period: "10套卷",
    variant: number <= 6 ? "130题版" : "120题版", number, status: "published",
  }));
  const [{ projects }] = catalog.groupByInstitution(versions);
  assert.equal(projects.length, 1);
  assert.equal(projects[0].variant, "");
  assert.deepEqual(projects[0].versions.map(item => item.number), [1, 2, 3, 7, 10]);
});

test("native catalog follows the .raw folder hierarchy for all supplied mock exams", () => {
  const firstPeriod = PAPERS.map(paper => ({
    ...paper, institution: "四海", project: "2026 下半年 · 国考行测",
    period: "一期", variant: "地市级 / 行政执法类",
  }));
  const versions = [...firstPeriod, ...IMPORTED_PAPERS].map((paper, index) => ({
    ...paper, id: paper.id + ":test-" + index, status: "published",
  }));
  const groups = catalog.groupByInstitution(versions);
  const projectSizes = Object.fromEntries(groups.map(group => [
    group.name,
    group.projects.map(project => project.versions.length),
  ]));
  assert.deepEqual(projectSizes, {
    四海: [12, 12, 12],
    超格: [10],
    粉笔: [6],
    上岸村: [10],
  });
});

test("first-use cards keep their actions separate from decorative artwork", () => {
  const home = markup("pages/home/home.wxml");
  assert.doesNotMatch(home, /home__cover-status/);
  assert.match(home, /home__empty-title[^<]*>[^<]+<\/text>\s*<\/view>\s*<image class="home__empty-art"/);
});

test("native sharing renders the designed artifact instead of a scaled canvas screenshot", () => {
  const share = markup("pages/share/share.wxml");
  assert.match(share, /class="share__artifact share__artifact--\{\{mode\}\}"/);
  assert.match(share, /class="share__stage"[\s\S]*transform: scale\(\{\{previewScale\}\}\)/);
  assert.match(share, /show-scrollbar="\{\{false\}\}"/);
  assert.doesNotMatch(share, /class="share__image"/);
  assert.match(share, /<image wx:if="\{\{radarSrc\}\}" class="share__radar"/);
  assert.doesNotMatch(share, /\{\{item\.percent\}\}<text class="share__percent">%<\/text>/);
  assert.doesNotMatch(markup("pages/share/share.json"), /rr-radar/);
});

test("tied leaderboard rows keep visual places while preserving the shared rank", () => {
  const rows = rank.placeLeaderboardRows({
    page: 1,
    pageSize: 20,
    rows: Array.from({ length: 4 }, (_, index) => ({ publicId: String(index), rank: 1 })),
  });
  assert.deepEqual(rows.map(item => [item.rank, item.place, item.placeText]),
    [[1, 1, "01"], [1, 2, "02"], [1, 3, "03"], [1, 4, "04"]]);
  assert.equal(rank.placeLeaderboardRows({ page: 2, pageSize: 20, rows: [{ rank: 1 }] })[0].placeText, "21");
});

test("native records use a plain empty message and position picker exposes a drag handle", () => {
  const records = markup("pages/records/records.wxml");
  assert.match(records, /没有练习记录/);
  assert.doesNotMatch(records, />去选卷</);
  const picker = markup("components/rr-position-picker/rr-position-picker.wxml");
  assert.match(picker, /class="positions__grabber-zone"/);
  assert.match(picker, /class="positions__grabber"/);
});

test("native discussion uses social comment metadata and per-thread replies", () => {
  const discussion = markup("pages/discussion/discussion.wxml");
  assert.doesNotMatch(discussion, /class="disc__head"/);
  assert.match(discussion, /class="disc__avatar"/);
  assert.match(discussion, /class="disc__meta"/);
  assert.match(discussion, /replyByRoot\[item\.id\]/);
  assert.match(discussion, /class="disc__reply-meta"/);
});

test("native catalog uses clean non-redundant series titles and unified numeric cards for Shangancun", () => {
  const huasheng = [
    { project: "2026 下半年 · 国考行测", period: "一期", variant: "地市级 / 行政执法类" },
    { project: "2026 下半年 · 国考行测", period: "二期", variant: "地市级 / 行政执法类" },
    { project: "2026 下半年 · 国考行测", period: "二期", variant: "副省级" },
  ];
  assert.deepEqual(huasheng.map(item => catalog.projectTitle(item, huasheng)), [
    "2026 下半年 · 第1期",
    "2026 下半年 · 第2期（地市）",
    "2026 下半年 · 第2期（副省）",
  ]);
  assert.equal(catalog.projectTitle({ project: "2027 公考 · 行测", period: "公考10套卷", variant: "" }), "2027 公考 · 10套卷");
  assert.deepEqual(catalog.paperCardParts({ institution: "上岸村", number: 1, title: "上岸村 · 26国考卷" }), {
    numeric: true, primary: "26", unit: "国考卷", shortTitle: "26国考卷", compactTitle: "26国考卷",
  });
  assert.deepEqual(catalog.paperCardParts({ institution: "上岸村", number: 3, title: "上岸村 · 混合组卷1" }), {
    numeric: true, primary: "01", unit: "混合组卷", shortTitle: "混合组卷 01", compactTitle: "混合组卷 01",
  });
  assert.equal(
    catalog.practiceIdentity({ institution: "上岸村", project: "2027 公考 · 行测", period: "公考10套卷", number: 1, title: "上岸村 · 26国考卷" }),
    "上岸村 · 2027 公考 · 10套卷 · 26国考卷",
  );
});

test("WeChat navigation centers the row on the capsule and clears its left edge", () => {
  for (const [windowWidth, statusBarHeight, menu] of [
    [320, 20, { top: 26, left: 225, height: 32 }],
    [393, 54, { top: 58, left: 299, height: 32 }],
    [430, 62, { top: 67, left: 335, height: 32 }],
  ]) {
    const layout = navigationLayout({ windowWidth, statusBarHeight }, menu);
    assert.equal(layout.statusBarHeight + layout.navHeight / 2, menu.top + menu.height / 2);
    assert.equal(windowWidth - layout.menuClearance + 8, menu.left);
  }
});

test("WeChat keeps a zero status bar and handles invalid capsule data", () => {
  const layout = navigationLayout({ windowWidth: 320, statusBarHeight: 0 }, { top: 0, left: 0, height: 0 });
  assert.equal(layout.statusBarHeight, 0);
  assert.ok(layout.navHeight >= 44);
  assert.ok(layout.menuClearance + 44 < 320);
});

test("WeChat measures a window below the screen origin in window coordinates", () => {
  const layout = navigationLayout({ windowWidth: 390, screenTop: 24, statusBarHeight: 24 },
    { top: 29, left: 296, height: 32 });
  assert.equal(layout.statusBarHeight, 0);
  assert.equal(layout.navHeight / 2, 21);
});

test("root tabs swipe cleanly between home and records without hijacking vertical scroll", () => {
  // 首页向左滑切换到练习记录
  const toRecords = tabSwipe.createSwipeSession({ currentKey: "home", x: 300, y: 260, now: 1000, width: 390 });
  const moveLeft = tabSwipe.updateSwipeSession(toRecords, { x: 220, y: 266 });
  assert.equal(moveLeft.axis, "x");
  assert.equal(moveLeft.target?.key, "records");
  assert.ok(moveLeft.offset < 0);
  const doneLeft = tabSwipe.finishSwipeSession(toRecords, { x: 180, y: 270, now: 1180 });
  assert.equal(doneLeft.switchTo?.url, "/pages/records/records");
  assert.equal(doneLeft.moved, true);

  // 练习记录向右滑切回首页
  const toHome = tabSwipe.createSwipeSession({ currentKey: "records", x: 90, y: 300, now: 2000, width: 390 });
  const moveRight = tabSwipe.updateSwipeSession(toHome, { x: 165, y: 305 });
  assert.equal(moveRight.axis, "x");
  assert.equal(moveRight.target?.key, "home");
  assert.ok(moveRight.offset > 0);
  const doneRight = tabSwipe.finishSwipeSession(toHome, { x: 210, y: 308, now: 2150 });
  assert.equal(doneRight.switchTo?.url, "/pages/home/home");

  // 边缘方向不切换
  const edgeHome = tabSwipe.createSwipeSession({ currentKey: "home", x: 80, y: 260, now: 3000, width: 390 });
  assert.equal(tabSwipe.updateSwipeSession(edgeHome, { x: 190, y: 262 }).offset, 0);
  assert.equal(tabSwipe.finishSwipeSession(edgeHome, { x: 220, y: 262, now: 3120 }).switchTo, null);

  // 纵向滑动锁定为 y，不触发切 tab
  const vertical = tabSwipe.createSwipeSession({ currentKey: "home", x: 200, y: 400, now: 4000, width: 390 });
  assert.equal(tabSwipe.updateSwipeSession(vertical, { x: 195, y: 320 }).axis, "y");
  assert.equal(tabSwipe.finishSwipeSession(vertical, { x: 110, y: 260, now: 4160 }).switchTo, null);

  assert.match(markup("pages/home/home.wxml"), /bindtouchstart="startTabSwipe"[\s\S]*bindtouchend="endTabSwipe"/);
  assert.match(markup("pages/records/records.wxml"), /bindtouchstart="startTabSwipe"[\s\S]*bindtouchend="endTabSwipe"/);
});

test("single-question mode animates horizontal swipes and all pages hide scrollbars", () => {
  const practiceWxml = markup("pages/practice/practice.wxml");
  const practiceJs = markup("pages/practice/practice.js");
  const practiceWxss = markup("pages/practice/practice.wxss");
  assert.match(practiceWxml, /scroll-with-animation="\{\{scrollAnimated\}\}"/);
  assert.match(practiceWxml, /binddragstart="onListDragStart"/);
  assert.match(practiceJs, /scrollListToRow\(/);
  assert.match(practiceJs, /scrollerNode\.scrollTo\(/);
  assert.match(practiceJs, /schedulePersist\(/);
  assert.match(practiceJs, /`questions\[\$\{rowIndex\}\]\.answer`/);
  assert.match(practiceJs, /transitionSingleTo\(/);
  assert.match(practiceWxml, /bindtouchmove="moveSwipe"[\s\S]*bindtouchcancel="cancelSwipe"/);
  assert.match(practiceWxml, /practice__single-card--dragging/);
  assert.match(practiceWxss, /\.practice__single-card\s*\{[^}]*transition:\s*transform/);
  assert.match(practiceWxss, /\.practice__row\s*\{[^}]*transition:\s*background-color/);

  // 正常屏内舒适区作答不触发滚动，避免逐行抖动；下一题接近底部约 2 行时干脆轻推到视口中部，时长 260~380ms 且不锁死用户连点。
  const list = { top: 130, bottom: 690, height: 560 };
  const inView = practiceScroll.planListScroll({
    list,
    offset: { scrollTop: 0 },
    row: { top: 320, bottom: 386 },
    keepVisible: true,
    animated: true,
  });
  assert.equal(inView.shouldScroll, false);

  const bottomEdge = practiceScroll.planListScroll({
    list,
    offset: { scrollTop: 0 },
    row: { top: 560, bottom: 626 },
    keepVisible: true,
    animated: true,
  });
  assert.equal(bottomEdge.shouldScroll, true);
  assert.equal(bottomEdge.isAutoTurn, true);
  assert.ok(bottomEdge.targetTop > 120 && bottomEdge.targetTop < 260, `应轻推 2~3 行到视口中部舒适区，实际 ${bottomEdge.targetTop}`);
  assert.ok(bottomEdge.duration >= 260 && bottomEdge.duration <= 380, `自动跟手滑动应干脆控制在 260~380ms，实际 ${bottomEdge.duration}ms`);
  assert.equal(bottomEdge.guardMs, 0, "自动轻推期间不应锁死用户连续点击");

  // 主动跳题（如答题卡/板块切换）仍快速定位到顶部且不加防误触锁。
  const manualJump = practiceScroll.planListScroll({
    list,
    offset: { scrollTop: 0 },
    row: { top: 820, bottom: 886 },
    keepVisible: false,
    animated: true,
  });
  assert.equal(manualJump.shouldScroll, true);
  assert.equal(manualJump.isAutoTurn, false);
  assert.equal(manualJump.duration, practiceScroll.MANUAL_JUMP_DURATION_MS);
  assert.equal(manualJump.guardMs, 0);
  assert.equal(practiceScroll.easeInOutCubic(0), 0);
  assert.equal(practiceScroll.easeInOutCubic(0.5), 0.5);
  assert.equal(practiceScroll.easeInOutCubic(1), 1);
  assert.equal(practiceScroll.easeOutCubic(0), 0);
  assert.ok(practiceScroll.easeOutCubic(0.5) > 0.8);
  assert.equal(practiceScroll.easeOutCubic(1), 1);

  const appWxss = markup("app.wxss");
  assert.match(appWxss, /(?:^|\n)::-webkit-scrollbar/);
  assert.match(appWxss, /\.wx-scroll-view::-webkit-scrollbar/);
  assert.match(appWxss, /color:\s*transparent\s*!important/);
  for (const component of ["rr-option-sheet", "rr-position-picker", "rr-timer-sheet"]) {
    assert.match(markup(`components/${component}/${component}.wxss`), /::-webkit-scrollbar/);
  }
  // Every native page disables root WebView scrolling and delegates vertical scroll to an enhanced hidden-scrollbar scroll-view.
  for (const page of ["home", "catalog", "records", "report", "discussion", "review", "rank", "admin", "analytics", "settings", "profile"]) {
    const cfg = JSON.parse(markup(`pages/${page}/${page}.json`));
    assert.equal(cfg.disableScroll, true, `${page}.json must disable root document scroll to hide native scrollbar`);
    assert.match(markup(`pages/${page}/${page}.wxml`), /<scroll-view[^>]*class="page-scroll"[^>]*enhanced[^>]*show-scrollbar="\{\{false\}\}"/);
  }
  for (const page of ["practice", "share", "positions", "timer", "web-action"]) {
    const cfg = JSON.parse(markup(`pages/${page}/${page}.json`));
    assert.equal(cfg.disableScroll, true, `${page}.json must disable root document scroll`);
  }
});

test("all sheets share a unified paper theme and iPhone-style 1:1 drag gestures", () => {
  // 1:1 downward tracking with linked backdrop opacity and top rubber-band damping.
  const dismissSession = sheetGesture.createSheetSession({
    x: 195,
    y: 300,
    now: 1000,
    panelHeight: 360,
    expanded: false,
    canExpand: false,
    canDismiss: true,
    atTop: true,
    fromHandle: true,
  });
  const draggedDown = sheetGesture.updateSheetSession(dismissSession, { x: 196, y: 390, now: 1120 });
  assert.equal(draggedDown.active, true);
  assert.equal(draggedDown.offsetY, 90);
  assert.ok(draggedDown.shadeOpacity < 0.8 && draggedDown.shadeOpacity > 0.5);

  // Pull past top edge applies rubber-band damping instead of raw offset.
  const pulledUp = sheetGesture.updateSheetSession(dismissSession, { x: 196, y: 200, now: 1180 });
  assert.equal(pulledUp.active, true);
  assert.ok(pulledUp.offsetY < 0 && Math.abs(pulledUp.offsetY) < 36);

  // Distance threshold dismisses slowly dragged sheet.
  assert.equal(
    sheetGesture.finishSheetSession(dismissSession, { x: 196, y: 440, now: 1700 }).action,
    "dismiss",
  );

  // Fast downward flick dismisses even below the distance threshold.
  const flickSession = sheetGesture.createSheetSession({
    x: 195,
    y: 300,
    now: 2000,
    panelHeight: 400,
    expanded: false,
    canExpand: false,
    canDismiss: true,
    atTop: true,
    fromHandle: true,
  });
  sheetGesture.updateSheetSession(flickSession, { x: 195, y: 345, now: 2045 });
  assert.equal(
    sheetGesture.finishSheetSession(flickSession, { x: 195, y: 360, now: 2060 }).action,
    "dismiss",
  );

  // Expandable sheet tracks upward pull 1:1 via heightDelta while keeping the bottom anchored (offsetY === 0).
  const expandSession = sheetGesture.createSheetSession({
    x: 195,
    y: 480,
    now: 2500,
    panelHeight: 420,
    expandDelta: 220,
    expanded: false,
    canExpand: true,
    canDismiss: true,
    atTop: true,
    fromHandle: false,
  });
  const pullingUp = sheetGesture.updateSheetSession(expandSession, { x: 195, y: 380, now: 2580 });
  assert.equal(pullingUp.active, true);
  assert.equal(pullingUp.heightDelta, 100);
  assert.equal(pullingUp.offsetY, 0);
  assert.equal(sheetGesture.finishSheetSession(expandSession, { x: 195, y: 380, now: 2600 }).action, "expand");

  // Expanded sheet shrinks 1:1 first when pulled down, then transitions smoothly into translateY dismissal.
  const collapseSession = sheetGesture.createSheetSession({
    x: 195,
    y: 120,
    now: 3000,
    panelHeight: 620,
    expandDelta: 200,
    expanded: true,
    canExpand: true,
    canDismiss: true,
    atTop: true,
    fromHandle: true,
  });
  const shrinking = sheetGesture.updateSheetSession(collapseSession, { x: 195, y: 188, now: 3180 });
  assert.equal(shrinking.heightDelta, -68);
  assert.equal(shrinking.offsetY, 0);
  assert.equal(
    sheetGesture.finishSheetSession(collapseSession, { x: 195, y: 188, now: 3200 }).action,
    "collapse",
  );

  // Position picker keeps detail title fixed outside scroll-view and avoids duplicate listTouch handlers.
  const pickerWxml = markup("components/rr-position-picker/rr-position-picker.wxml");
  assert.match(pickerWxml, /class="positions__detail-head"/);
  assert.doesNotMatch(pickerWxml, /listTouchStart|listTouchEnd/);
  assert.match(pickerWxml, /scroll-y="\{\{expanded \|\| !canExpand\}\}"/);

  // Horizontal gesture and non-top body drag stay yielded to swipe-back and scrolling.
  const horizontalSession = sheetGesture.createSheetSession({
    x: 240,
    y: 300,
    now: 4000,
    panelHeight: 400,
    atTop: true,
    fromHandle: false,
  });
  assert.equal(sheetGesture.updateSheetSession(horizontalSession, { x: 150, y: 306, now: 4080 }).axis, "x");
  assert.equal(sheetGesture.finishSheetSession(horizontalSession, { x: 140, y: 308, now: 4100 }).action, "reset");

  const scrolledSession = sheetGesture.createSheetSession({
    x: 195,
    y: 300,
    now: 5000,
    panelHeight: 400,
    atTop: false,
    fromHandle: false,
  });
  assert.equal(sheetGesture.updateSheetSession(scrolledSession, { x: 195, y: 380, now: 5080 }).active, false);

  // Unified sheet shell tokens in Mini Program global CSS and H5 base CSS.
  const appWxss = markup("app.wxss");
  assert.match(appWxss, /\.sheet-shade(?:,\s*\.sheet-shade--blur)?\s*\{[^}]*rgba\(249,\s*246,\s*239,\s*\.46\)/);
  assert.match(appWxss, /\.sheet-panel\s*\{[^}]*background:\s*#fffdf8;[^}]*border:\s*1px solid #ebe2d3;[^}]*border-radius:\s*24px 24px 0 0;/);
  assert.match(appWxss, /\.sheet-grabber\s*\{[^}]*width:\s*40px;[^}]*height:\s*4px;[^}]*background:\s*#d5cfc5;/);

  const h5BaseCss = readFileSync(new URL("../docs/ui-exploration/ios-v3/features/base.css", import.meta.url), "utf8");
  assert.match(h5BaseCss, /\.rr-options-shade\s*\{[^}]*rgba\(249,\s*246,\s*239,\s*\.46\)/);
  assert.match(h5BaseCss, /body\.beui-island \.rr-sheet\s*\{[^}]*#fffdf8[^}]*#ebe2d3[^}]*24px 24px 0 0/);

  // Every Mini Program sheet surface wires drag handlers and a top grabber.
  const sheetSurfaces = [
    ["components/rr-position-picker/rr-position-picker.wxml", /positions__grabber/, /moveGesture/],
    ["components/rr-option-sheet/rr-option-sheet.wxml", /options-grabber/, /moveTouch/],
    ["components/rr-timer-sheet/rr-timer-sheet.wxml", /timer__grabber/, /moveGesture/],
    ["pages/practice/practice.wxml", /sheet-grabber/, /moveSheetDrag/],
    ["pages/report/report.wxml", /sheet-grabber/, /moveSheetDrag/],
    ["pages/review/review.wxml", /sheet-grabber/, /moveSheetDrag/],
    ["pages/analytics/analytics.wxml", /sheet-grabber/, /moveSheetDrag/],
    ["pages/admin/admin.wxml", /sheet-grabber/, /moveSheetDrag/],
  ];
  for (const [file, grabberRe, moveRe] of sheetSurfaces) {
    const content = markup(file);
    assert.match(content, grabberRe, `${file} missing grabber`);
    assert.match(content, moveRe, `${file} missing drag move handler`);
  }

  // 所有底部抽屉的关闭按钮不得被父级 catchtouchstart 拦截，并显式标记 data-sheet-no-drag="1" 与 catchtap。
  const timerSheet = markup("components/rr-timer-sheet/rr-timer-sheet.wxml");
  assert.doesNotMatch(timerSheet, /timer__heading[^>]*catchtouchstart/, "timer__heading must not intercept close button taps");
  assert.match(timerSheet, /class="timer__close"[^>]*data-sheet-no-drag="1"[^>]*catchtap="dismiss"/);
  for (const file of [
    "pages/practice/practice.wxml",
    "pages/report/report.wxml",
    "pages/review/review.wxml",
    "pages/analytics/analytics.wxml",
    "pages/admin/admin.wxml",
    "pages/credits/credits.wxml",
  ]) {
    const content = markup(file);
    const closeButtons = content.match(/<button[^>]*class="sheet-close"[^>]*>/g) || [];
    assert.ok(closeButtons.length > 0, `${file} should have at least one sheet-close button`);
    for (const tag of closeButtons) {
      assert.match(tag, /data-sheet-no-drag="1"/, `${file} sheet-close missing data-sheet-no-drag="1"`);
      assert.match(tag, /catchtap="/, `${file} sheet-close should use catchtap`);
    }
  }
});

test("custom tabBar configuration includes a valid custom-tab-bar component", () => {
  const appConfig = JSON.parse(markup("app.json"));
  if (appConfig.tabBar?.custom) {
    for (const ext of ["js", "json", "wxml", "wxss"]) {
      assert.ok(
        existsSync(new URL(`../mini-program/custom-tab-bar/index.${ext}`, import.meta.url)),
        `missing mini-program/custom-tab-bar/index.${ext}`,
      );
    }
    const tabBarMeta = JSON.parse(markup("custom-tab-bar/index.json"));
    assert.equal(tabBarMeta.component, true);
  }
});
