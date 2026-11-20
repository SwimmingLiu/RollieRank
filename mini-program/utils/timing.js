const model = require("../vendor/practice-timer.js");
const storage = require("./storage.js");

const TIMER_KEY = "rr:timer";
const LEGACY_ENTRY_KEY = "rr:timing:pending";
const entryKey = attemptId => `rr:timing:entry:${attemptId}`;
const validMinutes = value => Number.isSafeInteger(value) && value >= 1 && value <= 720;

function timerForPaper(version, attemptId) {
  return model.createPracticeTimer({
    versionId: version.id,
    attemptId,
    sections: model.timerSectionsForQuestions(version.questions),
    limit: model.resolveTimerLimit(version),
  });
}

function attemptFor(versionId) {
  return storage.loadDraft(versionId)?.id || storage.pendingId(versionId);
}

// 旧版只存整段用时。迁移保留已跑的总时长，分模块用时从新版实际切换后才开始记录。
function restoreLegacyPlan(source, saved, versions, now) {
  const plan = saved.plans?.[source] || (saved.source === source || !saved.source && source === "paper" ? saved : null);
  if (!plan) return null;
  const version = source === "paper" && versions.find(item => item.id === plan.selectedId);
  if (source === "paper" && !version) return null;
  const minutes = validMinutes(plan.wholeMinutes) ? plan.wholeMinutes : 120;
  let timer = version ? timerForPaper(version, attemptFor(version.id)) : model.createCustomPracticeTimer({ sessionId: storage.uuid(), minutes });
  const active = saved.source === source && saved.running && Number.isSafeInteger(saved.startedAt) && saved.startedAt > 0;
  const since = saved.segmentStartedAt || saved.startedAt;
  if (active && since >= saved.startedAt && since <= now && now - since <= 6 * 60 * 60000) {
    const plannedMinutes = validMinutes(saved.plannedMinutes) ? saved.plannedMinutes : timer.plannedMs / 60000;
    if (plannedMinutes * 60000 !== timer.plannedMs) {
      timer = model.changeTimerPlan({ ...timer, origin: "custom" }, { minutes: plannedMinutes });
    }
    const elapsed = Number(saved.elapsedMs);
    return {
      ...timer,
      status: saved.paused ? "paused" : "running",
      startedAt: saved.startedAt,
      activeSince: saved.paused ? null : since,
      modules: [{ ...timer.modules[0], actualMs: Number.isSafeInteger(elapsed) ? Math.max(0, Math.min(elapsed, 12 * 60 * 60000)) : 0 }],
    };
  }
  if (plan.mode !== "modules" || !Array.isArray(plan.sections)) return timer;
  timer = model.setTimerMode(timer, "modules");
  for (const module of timer.modules) {
    const savedModule = plan.sections.find(section => section.name === module.name);
    if (savedModule && (savedModule.minutes === 0 || validMinutes(savedModule.minutes))) {
      timer = model.changeTimerPlan(timer, { minutes: savedModule.minutes, moduleId: module.id });
    }
  }
  return timer;
}

function loadTimerRecord(versions, now = Date.now()) {
  const saved = wx.getStorageSync(TIMER_KEY) || {};
  const source = saved.source === "custom" ? "custom" : "paper";
  const plans = {};
  for (const key of ["paper", "custom"]) {
    plans[key] = saved.format === 2
      ? model.restorePracticeTimer(saved.plans?.[key])
      : restoreLegacyPlan(key, saved, versions, now);
  }
  return { format: 2, source, plans };
}

function homeTimerView(now = Date.now()) {
  const saved = wx.getStorageSync(TIMER_KEY) || {};
  const timer = saved.plans?.[saved.source];
  if (saved.format === 2 && Array.isArray(timer?.modules)) {
    // Only the running module changes between home card ticks.
    const actual = timer.modules.reduce((total, item) => total + item.actualMs, 0);
    const elapsed = actual + (timer.status === "running" ? Math.max(0, now - timer.activeSince) : 0);
    return { status: timer.status, actualMs: Math.min(elapsed, 12 * 60 * 60000) };
  }
  if (!saved.running || !saved.startedAt) return { status: "ready", actualMs: 0 };
  const actualMs = (saved.elapsedMs || 0) + (saved.paused ? 0 : now - (saved.segmentStartedAt || saved.startedAt));
  if (actualMs < 0 || actualMs > 6 * 60 * 60000) return { status: "ready", actualMs: 0 };
  return { status: saved.paused ? "paused" : "running", actualMs };
}

function readTimedEntry(versionId, attemptId) {
  const timer = model.restorePracticeTimer(wx.getStorageSync(entryKey(attemptId)));
  return timer?.versionId === versionId && timer.attemptId === attemptId ? timer : null;
}

function setEntryTiming(timer) {
  wx.setStorageSync(entryKey(timer.attemptId), timer);
}

function entrySummary(versionId, attemptId, now) {
  const timer = readTimedEntry(versionId, attemptId);
  if (timer) return model.timingSummary(timer, now);
  const legacy = wx.getStorageSync(LEGACY_ENTRY_KEY);
  return legacy?.versionId === versionId && legacy.attemptId === attemptId ? legacy.modules || legacy.whole || null : null;
}

function clearEntryTiming(versionId, attemptId) {
  wx.removeStorageSync(entryKey(attemptId));
  const legacy = wx.getStorageSync(LEGACY_ENTRY_KEY);
  if (legacy?.versionId === versionId && legacy.attemptId === attemptId) wx.removeStorageSync(LEGACY_ENTRY_KEY);
}

module.exports = { TIMER_KEY, timerForPaper, attemptFor, loadTimerRecord, homeTimerView, readTimedEntry, setEntryTiming, entrySummary, clearEntryTiming };
