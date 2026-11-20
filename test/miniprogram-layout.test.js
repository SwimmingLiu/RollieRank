import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import navigation from "../mini-program/utils/navigation.js";
import catalog from "../mini-program/utils/catalog.js";

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
