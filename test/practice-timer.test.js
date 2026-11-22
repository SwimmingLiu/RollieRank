import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
import { initialState, loadState } from "../src/prototype-state.js";
import { createPracticeTimer, changeTimerPlan, timerView, startPracticeTimer, pausePracticeTimer, switchTimerModule, finishPracticeTimer, resumeEntryTimer, pauseEntryTimer, timingSummary, validateTimingSummary, restorePracticeTimer, timerSectionsForQuestions, createCustomPracticeTimer, setTimerMode, reorderTimerModules, balanceTimerModules, allocateTimerMinutes, bindPracticeTimer, resolveTimerLimit, DEFAULT_TIMER_SECTIONS } from "../src/practice-timer.js";

const sections = [{ id: "section-1", name: "言语理解", start: 1, end: 3 }, { id: "section-4", name: "判断推理", start: 4, end: 5 }];
const fresh = () => createPracticeTimer({ attemptId: "timer-attempt-12345", versionId: "timer-version-12345", sections, mode: "modules" });

test("explicit timer excludes pause and entry time, attributes module switches and survives restoration", () => {
  let timer = fresh();
  timer = startPracticeTimer(timer, 100000);
  timer = switchTimerModule(timer, "section-4", 103000);
  timer = pausePracticeTimer(timer, 105000);
  assert.equal(timerView(timer, 200000).actualMs, 5000);
  timer = restorePracticeTimer(JSON.parse(JSON.stringify(timer)));
  timer = startPracticeTimer(timer, 205000);
  timer = finishPracticeTimer(timer, 208000);
  assert.deepEqual(timerView(timer).modules.map(module => module.actualMs), [3000, 5000]);
  timer = resumeEntryTimer(timer, 209000);
  timer = pauseEntryTimer(timer, 211000);
  timer = resumeEntryTimer(timer, 219000);
  const summary = timingSummary(timer, 220000);
  assert.equal(summary.actualMs, 8000);
  assert.equal(summary.entryMs, 3000);
  assert.equal(summary.endedAt, 208000);
  assert.equal(summary.plannedMs, 7200000);
  assert.deepEqual(validateTimingSummary(summary), summary);
  assert.equal(timingSummary(fresh()), null);
});

test("module edits preserve the fixed whole limit and start waits for a balanced integer allocation", () => {
  let timer = createCustomPracticeTimer({ sessionId: "custom-timer-plan-12345", sections, mode: "modules" });
  timer = changeTimerPlan(timer, { minutes: 90 });
  assert.equal(timerView(timer).plannedMs, 5400000);
  timer = changeTimerPlan(timer, { moduleId: "section-1", minutes: 30 });
  assert.equal(timerView(timer).plannedMs, 5400000);
  assert.notEqual(timerView(timer).allocatedMs, 5400000);
  assert.equal(timerView(timer).canStart, false);
  assert.throws(() => startPracticeTimer(timer, 100000), /合计/);
  timer = balanceTimerModules(timer);
  assert.equal(timerView(timer).allocatedMs, 5400000);
  assert.ok(timer.modules.every(module => module.plannedMs % 60000 === 0));
  const started = startPracticeTimer(timer, 100000);
  assert.deepEqual(changeTimerPlan(started, { minutes: 120 }), started);
  assert.throws(() => changeTimerPlan(fresh(), { minutes: -1 }), /整数分钟/);
  assert.throws(() => changeTimerPlan(fresh(), { minutes: 90 }), /套卷时限/);
  const zeroFirst = changeTimerPlan(fresh(), { moduleId: "section-1", minutes: 0 });
  const zeroAll = changeTimerPlan(zeroFirst, { moduleId: "section-4", minutes: 0 });
  assert.equal(timerView(zeroAll).planDeltaMs, -7200000);
  assert.throws(() => startPracticeTimer(zeroAll, 100000), /合计/);
  assert.throws(() => finishPracticeTimer(fresh(), 100000), /先开始/);
});

test("timer boundary rejects tampered totals, phases, ownership and module identities", () => {
  let timer = finishPracticeTimer(startPracticeTimer(fresh(), 100000), 110000);
  const summary = timingSummary(timer);
  for (const invalid of [{ ...summary, actualMs: 1 }, { ...summary, endedAt: 99999 }, { ...summary, plannedMs: -1 }, { ...summary, entryMs: "100" }]) assert.throws(() => validateTimingSummary(invalid), /用时记录/);
  assert.throws(() => validateTimingSummary(summary, { attemptId: "other-attempt" }), /用时记录/);
  assert.throws(() => validateTimingSummary(summary, { sections: sections.slice(1) }), /模块/);
  assert.equal(restorePracticeTimer({ ...timer, status: "running", activeSince: null }), null);
});

test("real submit stores timing and blanks, retry preserves it, sync and restore keep it", async t => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-timing-"));
  const api = await createApi({ dataDirectory: pathToFileURL(directory + "/") });
  const server = createServer((request, response) => api(request, response, new URL(request.url, "http://localhost").pathname));
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); server.close(); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const request = async (path, input) => { const response = await fetch(base + path, input ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : {}); return { status: response.status, data: await response.json() }; };
  const version = (await request("catalog")).data.versions[0];
  const attemptId = "timed-server-attempt-12345", guestId = "timed-server-guest-12345";
  let timer = createPracticeTimer({ attemptId, versionId: version.id, sections: timerSectionsForQuestions(version.questions) });
  timer = finishPracticeTimer(startPracticeTimer(timer, 100000), 110000);
  const timing = timingSummary(resumeEntryTimer(timer, 120000), 122000);
  const answers = Array(version.questionCount).fill(null); answers[0] = "A";
  const input = { guestId, attemptId, versionId: version.id, answers, timing };
  assert.equal((await request("submit", { ...input, timing: { ...timing, actualMs: 2 } })).status, 400);
  const submitted = await request("submit", input);
  assert.equal(submitted.status, 200);
  assert.equal(submitted.data.report.blank, version.questionCount - 1);
  assert.equal(submitted.data.timing.actualMs, 10000);
  assert.equal(submitted.data.timing.entryMs, 2000);
  assert.deepEqual((await request("submit", input)).data, submitted.data);
  const synced = (await request("attempts/sync", { guestId })).data.attempts;
  assert.deepEqual(synced[0].timing, timing);
  const state = initialState(); state.guestId = guestId; state.attempts = synced;
  const restored = loadState({ getItem: () => JSON.stringify(state) }, [version]);
  assert.deepEqual(restored.state.attempts[0].timing, timing);
});
