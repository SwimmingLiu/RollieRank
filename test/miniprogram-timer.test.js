import assert from "node:assert/strict";
import test from "node:test";
import nativeTimer from "../mini-program/vendor/practice-timer.js";
import timing from "../mini-program/utils/timing.js";
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
  assert.deepEqual(collections.map(group => group.label), ["一期 · 地市 / 执法", "二期 · 副省"]);
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
  const saved = storage(t, [[timing.TIMER_KEY, legacy], ["rr:timing:pending", olderReceipt]]);
  assert.deepEqual(timing.homeTimerView(5000), { status: "paused", actualMs: 800 });
  const restored = timing.loadTimerRecord([version], 5000);
  assert.equal(restored.plans.paper.status, "paused");
  assert.equal(restored.plans.paper.plannedMs, 90 * 60000);
  saved.set(timing.TIMER_KEY, restored);
  assert.deepEqual(timing.homeTimerView(19000), { status: "paused", actualMs: 800 });
  timing.clearEntryTiming(version.id, "other-attempt");
  assert.deepEqual(timing.entrySummary(version.id, "old-attempt", 19000), olderReceipt.whole);
});
