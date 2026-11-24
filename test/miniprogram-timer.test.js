import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import nativeTimer from "../mini-program/vendor/practice-timer.js";
import timing from "../mini-program/utils/timing.js";
import config from "../mini-program/config.js";
import { validateTimingSummary } from "../src/practice-timer.js";

const version = {
  id: "paper-peanut-01:v1", institution: "四海", project: "2026 下半年 · 国考行测",
  period: "一期", variant: "地市级 / 行政执法类", title: "四海 · 第 1 套", number: 1, questionCount: 3,
  timeLimitMinutes: 120, timeLimitKind: "publisher",
  questions: [{ number: 1, type: "政治理论" }, { number: 2, type: "逻辑判断" }, { number: 3, type: "资料分析" }],
};

function storage(t, entries) {
  const saved = new Map(entries);
  const original = globalThis.wx;
  globalThis.wx = {
    getStorageSync: key => saved.get(key),
    setStorageSync: (key, value) => saved.set(key, structuredClone(value)),
    removeStorageSync: key => saved.delete(key),
  };
  t.after(() => {
    if (original === undefined) delete globalThis.wx;
    else globalThis.wx = original;
  });
  return saved;
}

test("native timer groups and searches the original published paper identities", () => {
  const province = { ...version, id: "province", variant: "副省级", period: "二期" };
  const collections = nativeTimer.timerCollections([version, province]);
  assert.deepEqual(collections.map(group => group.label), ["第1期 · 地市 / 执法", "第2期 · 副省"]);
  assert.equal(nativeTimer.timerPaperTitle(version, true), "第 1 套");
  assert.match(nativeTimer.timerPaperSearchText(version), /花生.*一期/);
});

test("native modules time actual switches and submit only the owning attempt's entry time", t => {
  storage(t, []);
  const attemptId = "native-attempt-1";
  let timer = timing.timerForPaper(version, attemptId);
  timer = nativeTimer.setTimerMode(timer, "modules");
  assert.deepEqual(timer.modules.map(module => module.id), ["section-1", "section-2", "section-3"]);
  timer = nativeTimer.startPracticeTimer(timer, 1000);
  timer = nativeTimer.switchTimerModule(timer, "section-2", 3000);
  timer = nativeTimer.pausePracticeTimer(timer, 6000);
  timer = nativeTimer.startPracticeTimer(timer, 9000);
  timer = nativeTimer.finishPracticeTimer(timer, 10000);
  timing.setEntryTiming(nativeTimer.resumeEntryTimer(timer, 11000));
  const result = timing.entrySummary(version.id, attemptId, 13500);
  const checked = validateTimingSummary(result, { attemptId, versionId: version.id, timeLimitMinutes: 120, sections: nativeTimer.timerSectionsForQuestions(version.questions) });
  assert.equal(checked.actualMs, 6000);
  assert.equal(checked.entryMs, 2500);
  assert.deepEqual(checked.modules.map(module => module.actualMs), [2000, 4000, 0]);
  assert.equal(timing.entrySummary(version.id, "another-attempt", 13500), null);
});

test("native timer preserves legacy paused totals and pending receipts across upgrade", t => {
  const legacy = { source: "paper", selectedId: version.id, wholeMinutes: 90, plannedMinutes: 90, startedAt: 1000, running: true, paused: true, elapsedMs: 800 };
  const olderReceipt = { attemptId: "old-attempt", versionId: version.id, whole: { actualMs: 400 } };
  const saved = storage(t, [[timing.TIMER_KEY, legacy], [config.storageKey("rr:timing:pending"), olderReceipt]]);
  assert.deepEqual(timing.homeTimerView(5000), { status: "paused", actualMs: 800 });
  const restored = timing.loadTimerRecord([version], 5000);
  assert.equal(restored.plans.paper.status, "paused");
  assert.equal(restored.plans.paper.plannedMs, 90 * 60000);
  saved.set(timing.TIMER_KEY, restored);
  assert.deepEqual(timing.homeTimerView(19000), { status: "paused", actualMs: 800 });
  timing.clearEntryTiming(version.id, "other-attempt");
  assert.deepEqual(timing.entrySummary(version.id, "old-attempt", 19000), olderReceipt.whole);
});

test("native timer and home/practice/report/sheet modules boot cleanly without Intl, Array.at or String.replaceAll", () => {
  const miniRoot = path.resolve("mini-program");
  const createAndroidContext = () => {
    const store = new Map();
    let registered = { app: 0, page: 0, component: 0 };
    const context = vm.createContext({
      console, setTimeout, clearTimeout, setInterval, clearInterval,
      wx: {
        getStorageSync: key => store.get(key),
        setStorageSync: (key, value) => store.set(key, value),
        removeStorageSync: key => store.delete(key),
        getAccountInfoSync: () => ({ miniProgram: { envVersion: "release" } }),
        getWindowInfo: () => ({ statusBarHeight: 24, windowWidth: 360, screenTop: 0 }),
        getMenuButtonBoundingClientRect: () => ({ top: 30, height: 32, left: 260 }),
        loadFontFace: () => {},
        request: () => {},
      },
      App: () => { registered.app += 1; },
      Page: () => { registered.page += 1; },
      Component: () => { registered.component += 1; },
      getApp: () => ({ globalData: { versions: [] } }),
    });
    vm.runInContext(
      "Object.defineProperty(globalThis, 'Intl', { value: undefined, configurable: true, writable: true }); delete Array.prototype.at; delete String.prototype.replaceAll;",
      context,
    );
    const cache = new Map();
    const loadModule = targetPath => {
      const abs = path.resolve(targetPath);
      if (cache.has(abs)) return cache.get(abs).exports;
      const mod = { exports: {} };
      cache.set(abs, mod);
      const source = readFileSync(abs, "utf8");
      const wrapper = vm.runInContext(
        `(function(exports, require, module, __filename, __dirname){\n${source}\n})`,
        context,
        { filename: abs },
      );
      wrapper(mod.exports, req => loadModule(path.resolve(path.dirname(abs), req)), mod, abs, path.dirname(abs));
      return mod.exports;
    };
    return { loadModule, registered };
  };

  // 无 Intl/at/replaceAll 时，计时模块的函数调用和自然排序均正常工作。
  const { loadModule } = createAndroidContext();
  const sandboxTimer = loadModule(path.join(miniRoot, "vendor/practice-timer.js"));
  const p1 = { ...version, id: "p1", period: "第10期", variant: "副省级" };
  const p2 = { ...version, id: "p2", period: "第2期", variant: "地市级 / 行政执法类" };
  const p3 = { ...version, id: "p3", period: "第1期", variant: "" };
  const collections = sandboxTimer.timerCollections([p1, p2, p3]);
  assert.deepEqual(Array.from(collections, item => item.label), ["第1期", "第2期 · 地市 / 执法", "第10期 · 副省"]);
  assert.equal(sandboxTimer.timerPaperTitle(version, true), "第 1 套");
  assert.match(sandboxTimer.timerPaperSearchText(version), /花生.*一期/);
  assert.deepEqual(
    Array.from(sandboxTimer.timerSectionsForQuestions(version.questions), item => item.name),
    ["政治理论", "判断推理", "资料分析"],
  );

  // 依赖计时模块的页面和组件在安卓精简 V8 下均可完成注册，不发生启动白屏。
  for (const [entry, kind] of [
    ["pages/home/home.js", "page"],
    ["pages/practice/practice.js", "page"],
    ["pages/report/report.js", "page"],
    ["components/rr-timer-sheet/rr-timer-sheet.js", "component"],
  ]) {
    const env = createAndroidContext();
    env.loadModule(path.join(miniRoot, entry));
    assert.equal(env.registered[kind], 1, `${entry} should register ${kind} without Intl`);
  }
});
