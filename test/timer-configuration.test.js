import test from "node:test";
import assert from "node:assert/strict";
import { createPracticeTimer, createCustomPracticeTimer, resolveTimerLimit, allocateTimerMinutes, DEFAULT_TIMER_SECTIONS, TIMER_MODULE_WEIGHTS, timerView, setTimerMode, reorderTimerModules, changeTimerPlan, balanceTimerModules, startPracticeTimer, switchTimerModule, pausePracticeTimer, finishPracticeTimer, restorePracticeTimer, timingSummary, validateTimingSummary, bindPracticeTimer, resumeEntryTimer } from "../src/practice-timer.js";

const sections = [
  { id: "paper-politics", name: "政治理论", count: 20 }, { id: "paper-general", name: "常识判断", count: 15 },
  { id: "paper-verbal", name: "言语理解", count: 30 }, { id: "paper-quant", name: "数量关系", count: 10 },
  { id: "paper-judgment", name: "判断推理", count: 35 }, { id: "paper-data", name: "资料分析", count: 20 },
];
const paper = () => createPracticeTimer({ attemptId: "paper-timer-attempt-123", versionId: "paper-timer-version-123", sections });

// Preset chips were removed; the model still supplies a default and accepts explicit integer minutes.
test("custom timing defaults to 120 minutes and accepts direct integer changes", () => {
  let timer = createCustomPracticeTimer({ sessionId: "custom-default-minutes-123" });
  assert.equal(timerView(timer).plannedMs, 120 * 60000);
  timer = changeTimerPlan(timer, { minutes: 121 });
  assert.equal(timerView(timer).plannedMs, 121 * 60000);
  timer = changeTimerPlan(timer, { minutes: 45 });
  assert.equal(timerView(timer).plannedMs, 45 * 60000);
  assert.throws(() => changeTimerPlan(timer, { minutes: 45.5 }), /整数分钟/);
});

test("paper timing uses declared limits or an explicit suggestion and starts with one whole-paper clock", () => {
  assert.deepEqual(resolveTimerLimit(), { minutes: 120, kind: "suggested", label: "建议时长" });
  assert.equal(resolveTimerLimit({ timeLimitMinutes: 1.5, timeLimitKind: "official" }).kind, "suggested");
  assert.equal(resolveTimerLimit({ timeLimitMinutes: 120, timeLimitKind: "suggested" }).kind, "suggested");
  const limit = resolveTimerLimit({ timeLimitMinutes: 90, timeLimitKind: "official", timeLimitUrl: "https://example.gov.cn/outline" });
  let timer = createPracticeTimer({ attemptId: "timed-paper-123456", versionId: "version-paper-123456", sections, limit });
  assert.equal(timerView(timer).plannedMs, 90 * 60000);
  assert.equal(timer.mode, "whole");
  assert.deepEqual(timer.modules.map(module => module.name), ["整卷"]);
  assert.throws(() => changeTimerPlan(timer, { minutes: 120 }), /套卷时限/);
  timer = finishPracticeTimer(startPracticeTimer(timer, 100000), 110000);
  const summary = timingSummary(timer);
  assert.equal(summary.modules[0].actualMs, 10000);
  assert.deepEqual(validateTimingSummary(summary, { sections, timeLimitMinutes: 90 }), summary);
  assert.throws(() => validateTimingSummary(summary, { sections, timeLimitMinutes: 120 }), /套卷时限/);
  assert.throws(() => validateTimingSummary({ ...summary, modules: [{ ...summary.modules[0], id: "paper-politics", name: "政治理论" }] }), /整卷计时/);
});

test("suggested module plans use integer minutes with exact totals, including short custom sessions and ties", () => {
  for (const total of [1, 7, 30, 90, 120, 135, 720]) {
    const allocated = allocateTimerMinutes(total, DEFAULT_TIMER_SECTIONS);
    assert.ok(allocated.every(module => module.plannedMs % 60000 === 0));
    assert.equal(allocated.reduce((sum, module) => sum + module.plannedMs, 0), total * 60000);
  }
  assert.deepEqual(allocateTimerMinutes(120, DEFAULT_TIMER_SECTIONS).map(module => module.plannedMs / 60000), Object.values(TIMER_MODULE_WEIGHTS));
  assert.deepEqual(allocateTimerMinutes(2, [{ name: "x" }, { name: "y" }, { name: "z" }], [1, 1, 1]).map(module => module.plannedMs / 60000), [1, 1, 0]);
  assert.equal(allocateTimerMinutes(120, [{ name: "x" }, { name: "y" }], [1e308, 1e308]).reduce((sum, module) => sum + module.plannedMs, 0), 7200000);
  assert.throws(() => allocateTimerMinutes(90.5, sections), /整数分钟/);
});

test("module changes keep the whole limit fixed; mismatches survive reload and block start until explicitly balanced", () => {
  let timer = setTimerMode(paper(), "modules");
  timer = changeTimerPlan(timer, { moduleId: "paper-politics", minutes: 11 });
  assert.equal(timerView(timer).plannedMs, 7200000);
  assert.equal(timerView(timer).planDeltaMs, -60000);
  assert.equal(timerView(timer).canStart, false);
  assert.equal(timerView(restorePracticeTimer(JSON.parse(JSON.stringify(timer)))).planDeltaMs, -60000);
  assert.throws(() => startPracticeTimer(timer, 100000), /合计/);
  timer = balanceTimerModules(timer);
  assert.equal(timerView(timer).canStart, true);
  assert.equal(timerView(timer).planDeltaMs, 0);
  const whole = setTimerMode(timer, "whole");
  assert.equal(whole.modules.length, 1);
  assert.equal(whole.modules[0].plannedMs, 7200000);
});

test("reordered module timing keeps module ownership and is valid against the original paper order", () => {
  let timer = setTimerMode(paper(), "modules");
  const ids = timer.modules.map(module => module.id).reverse();
  timer = reorderTimerModules(timer, ids);
  assert.deepEqual(restorePracticeTimer(timer).modules.map(module => module.id), ids);
  assert.throws(() => reorderTimerModules(timer, [...ids.slice(1), ids[1]]), /顺序/);
  timer = startPracticeTimer(timer, 100000);
  timer = switchTimerModule(timer, "paper-politics", 102000);
  timer = finishPracticeTimer(timer, 105000);
  assert.equal(timer.modules.find(module => module.id === "paper-data").actualMs, 2000);
  assert.equal(timer.modules.find(module => module.id === "paper-politics").actualMs, 3000);
  const summary = timingSummary(timer);
  assert.deepEqual(validateTimingSummary(summary, { sections }), summary);
});

test("custom whole-paper timing needs no paper and can bind after finish without inventing module times", () => {
  let timer = createCustomPracticeTimer({ sessionId: "custom-independent-session-123", minutes: 30 });
  assert.equal(timer.versionId, null);
  assert.equal(timer.origin, "custom");
  timer = startPracticeTimer(timer, 100000);
  timer = pausePracticeTimer(timer, 102000);
  timer = startPracticeTimer(restorePracticeTimer(timer), 200000);
  timer = finishPracticeTimer(timer, 203000);
  assert.equal(timerView(timer).actualMs, 5000);
  assert.equal(resumeEntryTimer(timer, 210000).entrySince, null);
  assert.deepEqual(validateTimingSummary(timingSummary(timer)), timingSummary(timer));
  assert.throws(() => validateTimingSummary(timingSummary(timer), { versionId: "paper-timer-version-123" }), /用时记录/);
  timer = bindPracticeTimer(timer, { attemptId: "bound-custom-attempt-123", versionId: "paper-timer-version-123", sections });
  timer = resumeEntryTimer(timer, 210000);
  const summary = timingSummary(timer, 212000);
  assert.equal(summary.actualMs, 5000);
  assert.equal(summary.entryMs, 2000);
  assert.equal(summary.modules[0].name, "整卷");
  assert.deepEqual(validateTimingSummary(summary, { sections, versionId: "paper-timer-version-123", timeLimitMinutes: 120 }), summary);
  assert.throws(() => bindPracticeTimer(timer, { attemptId: "other-custom-attempt-123", versionId: "paper-timer-version-123", sections }), /已关联/);
});

test("legacy fractional module plans remain readable without becoming new whole-paper measurements", () => {
  const legacy = { schema: 1, attemptId: "legacy-timer-attempt-123", versionId: "legacy-timer-version-123", status: "finished", startedAt: 100000, endedAt: 110000, activeSince: null, activeId: "paper-politics", entrySince: null, entryMs: 0,
    modules: [{ id: "paper-politics", name: "政治理论", count: 20, plannedMs: 3600001, actualMs: 1000 }, { id: "paper-general", name: "常识判断", count: 15, plannedMs: 3599999, actualMs: 2000 }] };
  assert.deepEqual(restorePracticeTimer(JSON.parse(JSON.stringify(legacy))), legacy);
  assert.equal(timerView(legacy).limit.label, "原计划");
  assert.equal(timerView(legacy).mode, "modules");
  const summary = timingSummary(legacy);
  assert.equal(summary.schema, 1);
  assert.equal(summary.modules[0].plannedMs, 3600001);
  assert.deepEqual(validateTimingSummary(summary), summary);
});
