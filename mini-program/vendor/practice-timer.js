// 由 mini-program/tools/build-timer.mjs 生成。计时数据是由数字、文本和普通对象构成的快照。
function copyTimerData(value) { return JSON.parse(JSON.stringify(value)); }
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// <stdin>
var stdin_exports = {};
__export(stdin_exports, {
  balanceTimerModules: () => balanceTimerModules,
  bindPracticeTimer: () => bindPracticeTimer,
  changeTimerPlan: () => changeTimerPlan,
  createCustomPracticeTimer: () => createCustomPracticeTimer,
  createPracticeTimer: () => createPracticeTimer,
  finishPracticeTimer: () => finishPracticeTimer,
  formatElapsed: () => formatElapsed,
  pauseEntryTimer: () => pauseEntryTimer,
  pausePracticeTimer: () => pausePracticeTimer,
  reorderTimerModules: () => reorderTimerModules,
  resolveTimerLimit: () => resolveTimerLimit,
  restorePracticeTimer: () => restorePracticeTimer,
  resumeEntryTimer: () => resumeEntryTimer,
  setTimerMode: () => setTimerMode,
  startPracticeTimer: () => startPracticeTimer,
  switchTimerModule: () => switchTimerModule,
  timerCollections: () => timerCollections,
  timerPaperSearchText: () => timerPaperSearchText,
  timerPaperTitle: () => timerPaperTitle,
  timerSectionsForQuestions: () => timerSectionsForQuestions,
  timerView: () => timerView,
  timingSummary: () => timingSummary
});
module.exports = __toCommonJS(stdin_exports);

// src/subjects.js
var judgmentNames = /* @__PURE__ */ new Set(["\u5224\u65AD\u63A8\u7406", "\u903B\u8F91\u5224\u65AD", "\u7C7B\u6BD4\u63A8\u7406", "\u56FE\u5F62\u63A8\u7406", "\u5B9A\u4E49\u5224\u65AD"]);
var isJudgmentSection = (name) => judgmentNames.has(name);
var subjectName = (name) => isJudgmentSection(name) ? "\u5224\u65AD\u63A8\u7406" : name;

// src/practice-timer.js
var MAX_DURATION = 12 * 60 * 60 * 1e3;
var MINUTE = 6e4;
var duration = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_DURATION;
var wholeMinutes = (value) => Number.isSafeInteger(value) && value >= 1 && value <= 720;
var stamp = (value) => Number.isSafeInteger(value) && value > 0;
var identity = (value) => typeof value === "string" && value.length > 0 && value.length <= 100;
var clone = (value) => copyTimerData(value);
var sumPlan = (modules) => modules.reduce((sum, module2) => sum + module2.plannedMs, 0);
var sumActual = (modules) => modules.reduce((sum, module2) => sum + module2.actualMs, 0);
var WHOLE_MODULE = { id: "whole", name: "\u6574\u5377", count: 1 };
var TIMER_MODULE_WEIGHTS = { "\u653F\u6CBB\u7406\u8BBA": 12, "\u5E38\u8BC6\u5224\u65AD": 8, "\u8A00\u8BED\u7406\u89E3": 27, "\u6570\u91CF\u5173\u7CFB": 13, "\u5224\u65AD\u63A8\u7406": 33, "\u8D44\u6599\u5206\u6790": 27 };
var DEFAULT_TIMER_SECTIONS = Object.keys(TIMER_MODULE_WEIGHTS).map((name, index) => ({ id: `custom-${index + 1}`, name, count: 1 }));
function timerSectionsForQuestions(questions) {
  const sections = [];
  for (const question of questions) {
    const name = subjectName(question.type), last = sections[sections.length - 1];
    if (last?.name === name && last.end + 1 === question.number) last.end = question.number;
    else sections.push({ id: `section-${question.number}`, name, start: question.number, end: question.number });
  }
  return sections;
}
function resolveTimerLimit(version = {}) {
  if (!wholeMinutes(version.timeLimitMinutes)) return { minutes: 120, kind: "suggested", label: "\u5EFA\u8BAE\u65F6\u957F" };
  const proposed = version.timeLimitKind ?? version.timeLimitSource?.kind;
  const kind = ["official", "publisher", "suggested"].includes(proposed) ? proposed : "publisher";
  const url = version.timeLimitUrl ?? version.timeLimitSource?.url;
  return { minutes: version.timeLimitMinutes, kind, label: kind === "official" ? "\u8003\u8BD5\u65F6\u9650" : kind === "suggested" ? "\u5EFA\u8BAE\u65F6\u957F" : "\u5957\u5377\u65F6\u9650", ...typeof url === "string" && /^https?:\/\//.test(url) ? { url } : {} };
}
function limitOf(limit, minutes, origin) {
  const kind = origin === "custom" ? "custom" : ["official", "publisher", "suggested"].includes(limit?.kind) ? limit.kind : "suggested";
  const label = { custom: "\u81EA\u5B9A\u4E49", official: "\u8003\u8BD5\u65F6\u9650", publisher: "\u5957\u5377\u65F6\u9650", suggested: "\u5EFA\u8BAE\u65F6\u957F" }[kind];
  return { minutes, kind, label, ...typeof limit?.url === "string" && /^https?:\/\//.test(limit.url) ? { url: limit.url } : {} };
}
function sectionsOf(sections) {
  if (!Array.isArray(sections) || !sections.length || sections.length > 20 || !sections.every((section) => identity(section.id) && identity(section.name))) throw new Error("\u8BF7\u5148\u9009\u62E9\u6709\u6548\u7684\u8BA1\u65F6\u6A21\u5757\u3002");
  if (new Set(sections.map((section) => section.id)).size !== sections.length) throw new Error("\u8BA1\u65F6\u6A21\u5757\u4E0D\u80FD\u91CD\u590D\u3002");
  return sections.map((section) => ({ id: section.id, name: section.name, count: Number.isInteger(section.count) && section.count > 0 ? section.count : Number.isInteger(section.start) && Number.isInteger(section.end) && section.end >= section.start ? section.end - section.start + 1 : 1 }));
}
function allocateTimerMinutes(totalMinutes, modules, weights) {
  if (!wholeMinutes(totalMinutes) || !Array.isArray(modules) || !modules.length) throw new Error("\u8BA1\u5212\u603B\u65F6\u957F\u5E94\u4E3A 1\u2013720 \u7684\u6574\u6570\u5206\u949F\u3002");
  const baseWeights = modules.map((module2, index) => {
    const value = weights?.[index] ?? TIMER_MODULE_WEIGHTS[subjectName(module2.name)] ?? module2.count ?? 1;
    return Number.isFinite(value) && value > 0 ? value : 1;
  });
  const max = Math.max(...baseWeights), relative = baseWeights.map((value) => value / max);
  const sum = relative.reduce((a, b) => a + b, 0);
  const quotas = relative.map((value) => totalMinutes * value / sum);
  const allocations = quotas.map(Math.floor);
  const remainder = totalMinutes - allocations.reduce((a, b) => a + b, 0);
  const order = quotas.map((quota, index) => ({ index, fraction: quota - allocations[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index++) allocations[order[index].index]++;
  return modules.map((module2, index) => ({ ...module2, plannedMs: allocations[index] * MINUTE, actualMs: module2.actualMs ?? 0 }));
}
function newTimer({ attemptId, versionId, sections, minutes, origin, limit, mode }) {
  if (!identity(attemptId) || versionId !== null && !identity(versionId)) throw new Error("\u8BA1\u65F6\u51ED\u8BC1\u65E0\u6548\u3002");
  if (!wholeMinutes(minutes)) throw new Error("\u8BA1\u5212\u603B\u65F6\u957F\u5E94\u4E3A 1\u2013720 \u7684\u6574\u6570\u5206\u949F\u3002");
  if (!["whole", "modules"].includes(mode)) throw new Error("\u8BF7\u9009\u62E9\u6574\u5377\u6216\u5206\u6A21\u5757\u8BA1\u65F6\u3002");
  const plans = sectionsOf(sections);
  const modules = mode === "whole" ? [{ ...WHOLE_MODULE, plannedMs: minutes * MINUTE, actualMs: 0 }] : allocateTimerMinutes(minutes, plans);
  return {
    schema: 2,
    origin,
    mode,
    attemptId,
    versionId,
    plannedMs: minutes * MINUTE,
    limit: limitOf(limit, minutes, origin),
    status: "ready",
    startedAt: null,
    endedAt: null,
    activeSince: null,
    activeId: modules[0].id,
    entrySince: null,
    entryMs: 0,
    sections: plans,
    modules
  };
}
function createPracticeTimer({ attemptId, versionId, sections, minutes, limit, mode = "whole" }) {
  if (!identity(versionId)) throw new Error("\u8BF7\u5148\u9009\u62E9\u5957\u5377\u3002");
  const source = limit ?? resolveTimerLimit();
  const total = minutes ?? source.minutes;
  return newTimer({ attemptId, versionId, sections, minutes: total, origin: "paper", limit: { ...source, minutes: total }, mode });
}
function createCustomPracticeTimer({ sessionId, minutes = 120, sections = DEFAULT_TIMER_SECTIONS, mode = "whole" }) {
  return newTimer({ attemptId: sessionId, versionId: null, sections, minutes, origin: "custom", limit: { minutes, kind: "custom", label: "\u81EA\u5B9A\u4E49" }, mode });
}
function validPhase(raw) {
  if (!["ready", "running", "paused", "finished"].includes(raw.status)) return false;
  if (raw.status === "ready" ? raw.startedAt !== null || raw.endedAt !== null || raw.activeSince !== null : !stamp(raw.startedAt)) return false;
  if (raw.status === "running" ? !stamp(raw.activeSince) || raw.activeSince < raw.startedAt || raw.endedAt !== null : raw.activeSince !== null) return false;
  if (raw.status === "finished" ? !stamp(raw.endedAt) || raw.endedAt < raw.startedAt : raw.endedAt !== null) return false;
  if (raw.entrySince !== null && (raw.status !== "finished" || !stamp(raw.entrySince) || raw.entrySince < raw.endedAt)) return false;
  return true;
}
function restorePracticeTimer(raw) {
  if (!raw || typeof raw !== "object" || ![1, 2].includes(raw.schema) || !identity(raw.attemptId) || !Array.isArray(raw.modules) || !raw.modules.length || raw.modules.length > 20 || !raw.modules.every((module2) => identity(module2.id) && identity(module2.name) && duration(module2.plannedMs) && duration(module2.actualMs) && Number.isInteger(module2.count) && module2.count > 0) || new Set(raw.modules.map((module2) => module2.id)).size !== raw.modules.length || !raw.modules.some((module2) => module2.id === raw.activeId) || !duration(raw.entryMs) || sumActual(raw.modules) > MAX_DURATION || !validPhase(raw)) return null;
  if (raw.schema === 1) {
    if (!identity(raw.versionId) || sumPlan(raw.modules) < MINUTE || sumPlan(raw.modules) > MAX_DURATION) return null;
    return clone(raw);
  }
  if (!["paper", "custom"].includes(raw.origin) || (raw.origin === "paper" ? !identity(raw.versionId) : raw.versionId !== null && !identity(raw.versionId)) || !["whole", "modules"].includes(raw.mode) || !duration(raw.plannedMs) || raw.plannedMs < MINUTE || raw.plannedMs % MINUTE || !raw.modules.every((module2) => module2.plannedMs % MINUTE === 0) || raw.status !== "ready" && sumPlan(raw.modules) !== raw.plannedMs) return null;
  try {
    sectionsOf(raw.sections);
  } catch {
    return null;
  }
  if (raw.mode === "whole" ? raw.modules.length !== 1 || raw.modules[0].id !== "whole" || raw.modules[0].name !== "\u6574\u5377" || raw.modules[0].plannedMs !== raw.plannedMs : raw.sections.length !== raw.modules.length || raw.modules.some((module2) => !raw.sections.some((section) => section.id === module2.id && section.name === module2.name))) return null;
  const restored = clone(raw);
  restored.limit = limitOf(raw.limit, raw.plannedMs / MINUTE, raw.origin);
  return restored;
}
function settled(timer, now) {
  const next = clone(timer);
  if (next.status === "running") {
    const elapsed = Math.max(0, now - next.activeSince), current = next.modules.find((module2) => module2.id === next.activeId);
    current.actualMs += Math.min(elapsed, MAX_DURATION - sumActual(next.modules));
    next.activeSince = now;
  }
  return next;
}
function timerView(timer, now = Date.now()) {
  const value = settled(timer, now), allocatedMs = sumPlan(value.modules), plannedMs = value.schema === 2 ? value.plannedMs : allocatedMs;
  return {
    status: value.status,
    origin: value.origin ?? "paper",
    mode: value.mode ?? "modules",
    activeId: value.activeId,
    plannedMs,
    allocatedMs,
    planDeltaMs: allocatedMs - plannedMs,
    canStart: ["ready", "paused"].includes(value.status) && allocatedMs === plannedMs,
    limit: value.schema === 2 ? limitOf(value.limit, plannedMs / MINUTE, value.origin) : { minutes: plannedMs / MINUTE, kind: "legacy", label: "\u539F\u8BA1\u5212" },
    actualMs: sumActual(value.modules),
    modules: value.modules.map((module2) => ({ ...module2 }))
  };
}
function setTimerMode(timer, mode) {
  if (timer.status !== "ready") return timer;
  if (!["whole", "modules"].includes(mode)) throw new Error("\u8BF7\u9009\u62E9\u6574\u5377\u6216\u5206\u6A21\u5757\u8BA1\u65F6\u3002");
  if (timer.mode === mode) return timer;
  const next = clone(timer), total = timer.schema === 2 ? timer.plannedMs : sumPlan(timer.modules);
  if (!wholeMinutes(total / MINUTE)) throw new Error("\u8BF7\u5148\u8BBE\u7F6E\u6574\u6570\u5206\u949F\u7684\u6574\u5377\u65F6\u957F\u3002");
  next.schema = 2;
  next.mode = mode;
  next.origin ?? (next.origin = "paper");
  next.plannedMs = total;
  next.sections ?? (next.sections = timer.modules.map(({ id, name, count }) => ({ id, name, count })));
  next.limit ?? (next.limit = { minutes: total / MINUTE, kind: "suggested", label: "\u5EFA\u8BAE\u65F6\u957F" });
  next.modules = mode === "whole" ? [{ ...WHOLE_MODULE, plannedMs: total, actualMs: 0 }] : allocateTimerMinutes(total / MINUTE, next.sections);
  next.activeId = next.modules[0].id;
  return next;
}
function changeTimerPlan(timer, { minutes, moduleId }) {
  if (timer.status !== "ready") return timer;
  if (!Number.isSafeInteger(minutes) || minutes < (moduleId ? 0 : 1) || minutes > 720) throw new Error("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u6574\u6570\u5206\u949F\u3002");
  const next = clone(timer);
  if (moduleId) {
    if ((next.mode ?? "modules") !== "modules") throw new Error("\u8BF7\u5148\u5C55\u5F00\u5206\u6A21\u5757\u8BA1\u65F6\u3002");
    const module2 = next.modules.find((item) => item.id === moduleId);
    if (!module2) throw new Error("\u627E\u4E0D\u5230\u8FD9\u4E2A\u6A21\u5757\u3002");
    module2.plannedMs = minutes * MINUTE;
  } else {
    if (next.schema === 2 && next.origin === "paper" && minutes * MINUTE !== next.plannedMs) throw new Error("\u5957\u5377\u65F6\u9650\u6765\u81EA\u6240\u9009\u8BD5\u5377\uFF0C\u8BF7\u4F7F\u7528\u81EA\u5B9A\u4E49\u8BA1\u65F6\u8C03\u6574\u603B\u5206\u949F\u3002");
    if (next.schema === 2) {
      next.plannedMs = minutes * MINUTE;
      next.limit = { ...next.limit, minutes };
    }
    next.modules = (next.mode ?? "modules") === "whole" ? [{ ...next.modules[0], plannedMs: minutes * MINUTE }] : allocateTimerMinutes(minutes, next.modules, next.modules.map((module2) => module2.plannedMs));
  }
  return next;
}
function balanceTimerModules(timer) {
  if (timer.status !== "ready" || (timer.mode ?? "modules") !== "modules") return timer;
  const next = clone(timer), total = timer.schema === 2 ? timer.plannedMs : sumPlan(timer.modules);
  next.modules = allocateTimerMinutes(total / MINUTE, next.modules);
  return next;
}
function reorderTimerModules(timer, ids) {
  if (timer.status !== "ready" || (timer.mode ?? "modules") !== "modules") return timer;
  if (!Array.isArray(ids) || ids.length !== timer.modules.length || new Set(ids).size !== ids.length || ids.some((id) => !timer.modules.some((module2) => module2.id === id))) throw new Error("\u6A21\u5757\u987A\u5E8F\u65E0\u6548\u3002");
  const next = clone(timer);
  next.modules = ids.map((id) => next.modules.find((module2) => module2.id === id));
  next.activeId = next.modules[0].id;
  return next;
}
function startPracticeTimer(timer, now = Date.now()) {
  if (!["ready", "paused"].includes(timer.status)) return timer;
  if (!timerView(timer, now).canStart) throw new Error("\u6A21\u5757\u5408\u8BA1\u987B\u4E0E\u6574\u5377\u65F6\u9650\u4E00\u81F4\u3002");
  return { ...clone(timer), status: "running", startedAt: timer.startedAt ?? now, activeSince: now };
}
function pausePracticeTimer(timer, now = Date.now()) {
  return timer.status === "running" ? { ...settled(timer, now), status: "paused", activeSince: null } : timer;
}
function switchTimerModule(timer, moduleId, now = Date.now()) {
  if (timer.status === "finished" || (timer.mode ?? "modules") !== "modules" || !timer.modules.some((module2) => module2.id === moduleId)) return timer;
  return { ...settled(timer, now), activeId: moduleId };
}
function finishPracticeTimer(timer, now = Date.now()) {
  if (!["running", "paused"].includes(timer.status)) throw new Error("\u8BF7\u5148\u5F00\u59CB\u505A\u9898\u8BA1\u65F6\u3002");
  return { ...settled(timer, now), status: "finished", endedAt: now, activeSince: null };
}
function resumeEntryTimer(timer, now = Date.now()) {
  return timer?.status === "finished" && identity(timer.versionId) && timer.entrySince === null ? { ...clone(timer), entrySince: now } : timer;
}
function pauseEntryTimer(timer, now = Date.now()) {
  if (!timer || timer.entrySince === null) return timer;
  return { ...clone(timer), entrySince: null, entryMs: Math.min(MAX_DURATION, timer.entryMs + Math.max(0, now - timer.entrySince)) };
}
function bindPracticeTimer(timer, { attemptId, versionId, sections }) {
  if (timer.origin !== "custom" || timer.status !== "finished" || !identity(attemptId) || !identity(versionId)) throw new Error("\u8BF7\u7ED3\u675F\u81EA\u5B9A\u4E49\u8BA1\u65F6\u540E\u518D\u5173\u8054\u5957\u5377\u3002");
  if (timer.versionId !== null) {
    if (timer.versionId === versionId && timer.attemptId === attemptId) return timer;
    throw new Error("\u672C\u6B21\u8BA1\u65F6\u5DF2\u5173\u8054\u5957\u5377\u3002");
  }
  const next = clone(timer), targets = sectionsOf(sections);
  if (next.mode === "modules") {
    if (new Set(targets.map((section) => section.name)).size !== targets.length || targets.length !== next.modules.length || next.modules.some((module2) => !targets.some((section) => section.name === module2.name))) throw new Error("\u6240\u9009\u5957\u5377\u7684\u6A21\u5757\u4E0E\u672C\u6B21\u8BA1\u65F6\u4E0D\u4E00\u81F4\u3002");
    next.modules = next.modules.map((module2) => ({ ...module2, id: targets.find((section) => section.name === module2.name).id }));
    next.activeId = next.modules.find((module2) => module2.name === timer.modules.find((module3) => module3.id === timer.activeId).name).id;
  }
  next.sections = targets;
  next.attemptId = attemptId;
  next.versionId = versionId;
  return next;
}
function timingSummary(timer, now = Date.now()) {
  if (timer?.status !== "finished") return null;
  const final = pauseEntryTimer(timer, now), view = timerView(final, now);
  return {
    schema: timer.schema,
    ...timer.schema === 2 ? { mode: view.mode, origin: view.origin } : {},
    attemptId: timer.attemptId,
    versionId: timer.versionId,
    startedAt: timer.startedAt,
    endedAt: timer.endedAt,
    plannedMs: view.plannedMs,
    actualMs: view.actualMs,
    entryMs: final.entryMs,
    modules: view.modules.map(({ id, name, plannedMs, actualMs }) => ({ id, name, plannedMs, actualMs }))
  };
}
function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1e3));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// docs/ui-exploration/ios-v3/ui/publishers.ts
var publishers = [
  { institution: "\u56DB\u6D77", name: "\u82B1\u751F", logoSrc: "assets/publishers/sihai-peanut.svg" },
  { institution: "\u8D85\u683C", name: "\u8D85\u683C", logoSrc: "assets/publishers/chaoge-study.svg" },
  { institution: "\u7C89\u7B14", name: "\u7C89\u7B14", logoSrc: "assets/publishers/fenbi-mark.svg" },
  { institution: "\u4E0A\u5CB8\u6751", name: "\u4E0A\u5CB8\u6751", logoSrc: "assets/publishers/shangancun-mark.svg" }
];
var publisherName = (institution) => publishers.find((item) => item.institution === institution)?.name ?? institution;

// docs/ui-exploration/ios-v3/ui/timer-paper-model.ts
var visible = (text, institution) => institution === "\u56DB\u6D77" ? text.replace(/四海/g, publisherName(institution)) : text;
var compactVariant = (variant) => variant.replace(/地市级\s*\/\s*行政执法类/g, "\u5730\u5E02 / \u6267\u6CD5").replace(/副省级/g, "\u526F\u7701");
var collectionVariant = (variant) => /^\d+题版$/.test(variant.trim()) ? "" : variant;
var naturalCollator = typeof Intl !== "undefined" && typeof Intl.Collator === "function" ? new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" }) : null;
function compareNatural(a, b) {
  if (naturalCollator) return naturalCollator.compare(a, b);
  const left = a.toLowerCase().match(/\d+|\D+/g) || [];
  const right = b.toLowerCase().match(/\d+|\D+/g) || [];
  const limit = Math.min(left.length, right.length);
  for (let i = 0; i < limit; i += 1) {
    if (left[i] === right[i]) continue;
    if (/^\d+$/.test(left[i]) && /^\d+$/.test(right[i])) {
      const diff = Number(left[i]) - Number(right[i]);
      if (diff !== 0) return diff;
    }
    return left[i] < right[i] ? -1 : 1;
  }
  return left.length - right.length;
}
var issueNumber = (label) => {
  const value = label.split(" \xB7 ")[0]?.replace(/\s+/g, "") ?? "";
  const digits = value.match(/^(?:第)?(\d+)期$/);
  if (digits) return Number(digits[1]);
  const chinese = value.match(/^(?:第)?([一二三四五六七八九]|[一二三四五六七八九]?十[一二三四五六七八九]?)期$/);
  if (!chinese) return Number.MAX_SAFE_INTEGER;
  const source = "\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D";
  const [tens, units] = chinese[1].split("\u5341");
  if (units === void 0) return source.indexOf(tens) + 1;
  return (tens ? source.indexOf(tens) + 1 : 1) * 10 + (units ? source.indexOf(units) + 1 : 0);
};
var issueLabel = (period) => {
  const value = period.trim();
  const number = issueNumber(value);
  return number === Number.MAX_SAFE_INTEGER ? value : `\u7B2C${number}\u671F`;
};
function timerCollections(papers) {
  const groups = /* @__PURE__ */ new Map();
  for (const paper of papers) {
    const project = paper.project?.trim() ?? "", period = paper.period?.trim() ?? "", variant = collectionVariant(paper.variant?.trim() ?? "");
    const id = JSON.stringify([paper.institution, project, period, variant]);
    const label = visible([issueLabel(period), compactVariant(variant)].filter(Boolean).join(" \xB7 ") || project || "\u5957\u5377", paper.institution);
    const detail = visible(project && project !== label ? project : "", paper.institution);
    if (!groups.has(id)) groups.set(id, { id, label, detail, institution: paper.institution, papers: [] });
    groups.get(id)?.papers.push(paper);
  }
  return [...groups.values()].sort((a, b) => compareNatural(a.detail || "", b.detail || "") || issueNumber(a.label) - issueNumber(b.label) || compareNatural(a.label, b.label) || compareNatural(a.id, b.id));
}
function timerPaperTitle(paper, compact = false) {
  const title = visible(paper.title, paper.institution);
  const parts = title.split(/\s*·\s*/);
  const tail = parts[parts.length - 1] ?? title;
  return compact && (/^第\s*\d+\s*套$/.test(tail) || /^(?:混合组卷\d+|\d{4}国考卷)$/.test(tail)) ? tail : title;
}
function timerPaperSearchText(paper) {
  return [publisherName(paper.institution), timerPaperTitle(paper), paper.project, paper.period, paper.variant, paper.number].filter((value) => value !== void 0).join(" ").toLowerCase();
}
