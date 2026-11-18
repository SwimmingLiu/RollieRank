import assert from "node:assert/strict";
import test from "node:test";
import navigation from "../mini-program/utils/navigation.js";

const { navigationLayout } = navigation;

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
