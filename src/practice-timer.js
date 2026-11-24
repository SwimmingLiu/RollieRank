import { subjectName } from "./subjects.js";

const MAX_DURATION = 12 * 60 * 60 * 1000;
const MINUTE = 60000;
const duration = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_DURATION;
const wholeMinutes = value => Number.isSafeInteger(value) && value >= 1 && value <= 720;
const stamp = value => Number.isSafeInteger(value) && value > 0;
const identity = value => typeof value === "string" && value.length > 0 && value.length <= 100;
const clone = value => structuredClone(value);
const sumPlan = modules => modules.reduce((sum, module) => sum + module.plannedMs, 0);
const sumActual = modules => modules.reduce((sum, module) => sum + module.actualMs, 0);
const WHOLE_MODULE = { id: "whole", name: "整卷", count: 1 };

// 官方只规定整科时限；这些相对权重是可编辑的平台练习建议。
export const TIMER_MODULE_WEIGHTS = { "政治理论": 12, "常识判断": 8, "言语理解": 27, "数量关系": 13, "判断推理": 33, "资料分析": 27 };
export const DEFAULT_TIMER_SECTIONS = Object.keys(TIMER_MODULE_WEIGHTS).map((name, index) => ({ id: `custom-${index + 1}`, name, count: 1 }));

export function timerSectionsForQuestions(questions) {
  const sections = [];
  for (const question of questions) {
    const name = subjectName(question.type), last = sections[sections.length - 1];
    if (last?.name === name && last.end + 1 === question.number) last.end = question.number;
    else sections.push({ id: `section-${question.number}`, name, start: question.number, end: question.number });
  }
  return sections;
}

export function resolveTimerLimit(version = {}) {
  if (!wholeMinutes(version.timeLimitMinutes)) return { minutes: 120, kind: "suggested", label: "建议时长" };
  const proposed = version.timeLimitKind ?? version.timeLimitSource?.kind;
  const kind = ["official", "publisher", "suggested"].includes(proposed) ? proposed : "publisher";
  const url = version.timeLimitUrl ?? version.timeLimitSource?.url;
  return { minutes: version.timeLimitMinutes, kind, label: kind === "official" ? "考试时限" : kind === "suggested" ? "建议时长" : "套卷时限", ...(typeof url === "string" && /^https?:\/\//.test(url) ? { url } : {}) };
}

function limitOf(limit, minutes, origin) {
  const kind = origin === "custom" ? "custom" : ["official", "publisher", "suggested"].includes(limit?.kind) ? limit.kind : "suggested";
  const label = { custom: "自定义", official: "考试时限", publisher: "套卷时限", suggested: "建议时长" }[kind];
  return { minutes, kind, label, ...(typeof limit?.url === "string" && /^https?:\/\//.test(limit.url) ? { url: limit.url } : {}) };
}

function sectionsOf(sections) {
  if (!Array.isArray(sections) || !sections.length || sections.length > 20 || !sections.every(section => identity(section.id) && identity(section.name))) throw new Error("请先选择有效的计时模块。");
  if (new Set(sections.map(section => section.id)).size !== sections.length) throw new Error("计时模块不能重复。");
  return sections.map(section => ({ id: section.id, name: section.name, count: Number.isInteger(section.count) && section.count > 0 ? section.count : Number.isInteger(section.start) && Number.isInteger(section.end) && section.end >= section.start ? section.end - section.start + 1 : 1 }));
}

// 最大余数法只分配整数分钟；合计始终精确等于用户选定的整卷时限。
export function allocateTimerMinutes(totalMinutes, modules, weights) {
  if (!wholeMinutes(totalMinutes) || !Array.isArray(modules) || !modules.length) throw new Error("计划总时长应为 1–720 的整数分钟。");
  const baseWeights = modules.map((module, index) => {
    const value = weights?.[index] ?? TIMER_MODULE_WEIGHTS[subjectName(module.name)] ?? module.count ?? 1;
    return Number.isFinite(value) && value > 0 ? value : 1;
  });
  const max = Math.max(...baseWeights), relative = baseWeights.map(value => value / max);
  const sum = relative.reduce((a, b) => a + b, 0);
  const quotas = relative.map(value => totalMinutes * value / sum);
  const allocations = quotas.map(Math.floor);
  const remainder = totalMinutes - allocations.reduce((a, b) => a + b, 0);
  const order = quotas.map((quota, index) => ({ index, fraction: quota - allocations[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index++) allocations[order[index].index]++;
  return modules.map((module, index) => ({ ...module, plannedMs: allocations[index] * MINUTE, actualMs: module.actualMs ?? 0 }));
}

function newTimer({ attemptId, versionId, sections, minutes, origin, limit, mode }) {
  if (!identity(attemptId) || (versionId !== null && !identity(versionId))) throw new Error("计时凭证无效。");
  if (!wholeMinutes(minutes)) throw new Error("计划总时长应为 1–720 的整数分钟。");
  if (!["whole", "modules"].includes(mode)) throw new Error("请选择整卷或分模块计时。");
  const plans = sectionsOf(sections);
  const modules = mode === "whole" ? [{ ...WHOLE_MODULE, plannedMs: minutes * MINUTE, actualMs: 0 }] : allocateTimerMinutes(minutes, plans);
  return { schema: 2, origin, mode, attemptId, versionId, plannedMs: minutes * MINUTE, limit: limitOf(limit, minutes, origin),
    status: "ready", startedAt: null, endedAt: null, activeSince: null, activeId: modules[0].id, entrySince: null, entryMs: 0, sections: plans, modules };
}

export function createPracticeTimer({ attemptId, versionId, sections, minutes, limit, mode = "whole" }) {
  if (!identity(versionId)) throw new Error("请先选择套卷。");
  const source = limit ?? resolveTimerLimit();
  const total = minutes ?? source.minutes;
  return newTimer({ attemptId, versionId, sections, minutes: total, origin: "paper", limit: { ...source, minutes: total }, mode });
}

export function createCustomPracticeTimer({ sessionId, minutes = 120, sections = DEFAULT_TIMER_SECTIONS, mode = "whole" }) {
  return newTimer({ attemptId: sessionId, versionId: null, sections, minutes, origin: "custom", limit: { minutes, kind: "custom", label: "自定义" }, mode });
}

function validPhase(raw) {
  if (!["ready", "running", "paused", "finished"].includes(raw.status)) return false;
  if (raw.status === "ready" ? raw.startedAt !== null || raw.endedAt !== null || raw.activeSince !== null : !stamp(raw.startedAt)) return false;
  if (raw.status === "running" ? !stamp(raw.activeSince) || raw.activeSince < raw.startedAt || raw.endedAt !== null : raw.activeSince !== null) return false;
  if (raw.status === "finished" ? !stamp(raw.endedAt) || raw.endedAt < raw.startedAt : raw.endedAt !== null) return false;
  if (raw.entrySince !== null && (raw.status !== "finished" || !stamp(raw.entrySince) || raw.entrySince < raw.endedAt)) return false;
  return true;
}

export function restorePracticeTimer(raw) {
  if (!raw || typeof raw !== "object" || ![1, 2].includes(raw.schema) || !identity(raw.attemptId) || !Array.isArray(raw.modules) || !raw.modules.length || raw.modules.length > 20 ||
    !raw.modules.every(module => identity(module.id) && identity(module.name) && duration(module.plannedMs) && duration(module.actualMs) && Number.isInteger(module.count) && module.count > 0) ||
    new Set(raw.modules.map(module => module.id)).size !== raw.modules.length || !raw.modules.some(module => module.id === raw.activeId) || !duration(raw.entryMs) || sumActual(raw.modules) > MAX_DURATION || !validPhase(raw)) return null;
  if (raw.schema === 1) {
    if (!identity(raw.versionId) || sumPlan(raw.modules) < MINUTE || sumPlan(raw.modules) > MAX_DURATION) return null;
    return clone(raw);
  }
  if (!["paper", "custom"].includes(raw.origin) || (raw.origin === "paper" ? !identity(raw.versionId) : raw.versionId !== null && !identity(raw.versionId)) ||
    !["whole", "modules"].includes(raw.mode) || !duration(raw.plannedMs) || raw.plannedMs < MINUTE || raw.plannedMs % MINUTE ||
    !raw.modules.every(module => module.plannedMs % MINUTE === 0) || (raw.status !== "ready" && sumPlan(raw.modules) !== raw.plannedMs)) return null;
  try { sectionsOf(raw.sections); } catch { return null; }
  if (raw.mode === "whole" ? raw.modules.length !== 1 || raw.modules[0].id !== "whole" || raw.modules[0].name !== "整卷" || raw.modules[0].plannedMs !== raw.plannedMs :
    raw.sections.length !== raw.modules.length || raw.modules.some(module => !raw.sections.some(section => section.id === module.id && section.name === module.name))) return null;
  const restored = clone(raw);
  restored.limit = limitOf(raw.limit, raw.plannedMs / MINUTE, raw.origin);
  return restored;
}

function settled(timer, now) {
  const next = clone(timer);
  if (next.status === "running") {
    const elapsed = Math.max(0, now - next.activeSince), current = next.modules.find(module => module.id === next.activeId);
    current.actualMs += Math.min(elapsed, MAX_DURATION - sumActual(next.modules));
    next.activeSince = now;
  }
  return next;
}

export function timerView(timer, now = Date.now()) {
  const value = settled(timer, now), allocatedMs = sumPlan(value.modules), plannedMs = value.schema === 2 ? value.plannedMs : allocatedMs;
  return { status: value.status, origin: value.origin ?? "paper", mode: value.mode ?? "modules", activeId: value.activeId, plannedMs, allocatedMs, planDeltaMs: allocatedMs - plannedMs,
    canStart: ["ready", "paused"].includes(value.status) && allocatedMs === plannedMs,
    limit: value.schema === 2 ? limitOf(value.limit, plannedMs / MINUTE, value.origin) : { minutes: plannedMs / MINUTE, kind: "legacy", label: "原计划" }, actualMs: sumActual(value.modules), modules: value.modules.map(module => ({ ...module })) };
}

export function setTimerMode(timer, mode) {
  if (timer.status !== "ready") return timer;
  if (!["whole", "modules"].includes(mode)) throw new Error("请选择整卷或分模块计时。");
  if (timer.mode === mode) return timer;
  const next = clone(timer), total = timer.schema === 2 ? timer.plannedMs : sumPlan(timer.modules);
  if (!wholeMinutes(total / MINUTE)) throw new Error("请先设置整数分钟的整卷时长。");
  next.schema = 2; next.mode = mode; next.origin ??= "paper"; next.plannedMs = total;
  next.sections ??= timer.modules.map(({ id, name, count }) => ({ id, name, count }));
  next.limit ??= { minutes: total / MINUTE, kind: "suggested", label: "建议时长" };
  next.modules = mode === "whole" ? [{ ...WHOLE_MODULE, plannedMs: total, actualMs: 0 }] : allocateTimerMinutes(total / MINUTE, next.sections);
  next.activeId = next.modules[0].id;
  return next;
}

export function changeTimerPlan(timer, { minutes, moduleId }) {
  if (timer.status !== "ready") return timer;
  if (!Number.isSafeInteger(minutes) || minutes < (moduleId ? 0 : 1) || minutes > 720) throw new Error("请输入有效的整数分钟。");
  const next = clone(timer);
  if (moduleId) {
    if ((next.mode ?? "modules") !== "modules") throw new Error("请先展开分模块计时。");
    const module = next.modules.find(item => item.id === moduleId);
    if (!module) throw new Error("找不到这个模块。");
    module.plannedMs = minutes * MINUTE;
  } else {
    if (next.schema === 2 && next.origin === "paper" && minutes * MINUTE !== next.plannedMs) throw new Error("套卷时限来自所选试卷，请使用自定义计时调整总分钟。");
    if (next.schema === 2) { next.plannedMs = minutes * MINUTE; next.limit = { ...next.limit, minutes }; }
    next.modules = (next.mode ?? "modules") === "whole" ? [{ ...next.modules[0], plannedMs: minutes * MINUTE }] : allocateTimerMinutes(minutes, next.modules, next.modules.map(module => module.plannedMs));
  }
  return next;
}

export function balanceTimerModules(timer) {
  if (timer.status !== "ready" || (timer.mode ?? "modules") !== "modules") return timer;
  const next = clone(timer), total = timer.schema === 2 ? timer.plannedMs : sumPlan(timer.modules);
  next.modules = allocateTimerMinutes(total / MINUTE, next.modules);
  return next;
}

export function reorderTimerModules(timer, ids) {
  if (timer.status !== "ready" || (timer.mode ?? "modules") !== "modules") return timer;
  if (!Array.isArray(ids) || ids.length !== timer.modules.length || new Set(ids).size !== ids.length || ids.some(id => !timer.modules.some(module => module.id === id))) throw new Error("模块顺序无效。");
  const next = clone(timer);
  next.modules = ids.map(id => next.modules.find(module => module.id === id));
  next.activeId = next.modules[0].id;
  return next;
}

export function startPracticeTimer(timer, now = Date.now()) {
  if (!["ready", "paused"].includes(timer.status)) return timer;
  if (!timerView(timer, now).canStart) throw new Error("模块合计须与整卷时限一致。");
  return { ...clone(timer), status: "running", startedAt: timer.startedAt ?? now, activeSince: now };
}
export function pausePracticeTimer(timer, now = Date.now()) {
  return timer.status === "running" ? { ...settled(timer, now), status: "paused", activeSince: null } : timer;
}
export function switchTimerModule(timer, moduleId, now = Date.now()) {
  if (timer.status === "finished" || (timer.mode ?? "modules") !== "modules" || !timer.modules.some(module => module.id === moduleId)) return timer;
  return { ...settled(timer, now), activeId: moduleId };
}
export function finishPracticeTimer(timer, now = Date.now()) {
  if (!["running", "paused"].includes(timer.status)) throw new Error("请先开始做题计时。");
  return { ...settled(timer, now), status: "finished", endedAt: now, activeSince: null };
}

// 录答只累计实际录答页面停留；独立计时结束后关联套卷，才开始记录录答时长。
export function resumeEntryTimer(timer, now = Date.now()) {
  return timer?.status === "finished" && identity(timer.versionId) && timer.entrySince === null ? { ...clone(timer), entrySince: now } : timer;
}
export function pauseEntryTimer(timer, now = Date.now()) {
  if (!timer || timer.entrySince === null) return timer;
  return { ...clone(timer), entrySince: null, entryMs: Math.min(MAX_DURATION, timer.entryMs + Math.max(0, now - timer.entrySince)) };
}

export function bindPracticeTimer(timer, { attemptId, versionId, sections }) {
  if (timer.origin !== "custom" || timer.status !== "finished" || !identity(attemptId) || !identity(versionId)) throw new Error("请结束自定义计时后再关联套卷。");
  if (timer.versionId !== null) {
    if (timer.versionId === versionId && timer.attemptId === attemptId) return timer;
    throw new Error("本次计时已关联套卷。");
  }
  const next = clone(timer), targets = sectionsOf(sections);
  if (next.mode === "modules") {
    if (new Set(targets.map(section => section.name)).size !== targets.length || targets.length !== next.modules.length || next.modules.some(module => !targets.some(section => section.name === module.name))) throw new Error("所选套卷的模块与本次计时不一致。");
    next.modules = next.modules.map(module => ({ ...module, id: targets.find(section => section.name === module.name).id }));
    next.activeId = next.modules.find(module => module.name === timer.modules.find(module => module.id === timer.activeId).name).id;
  }
  next.sections = targets; next.attemptId = attemptId; next.versionId = versionId;
  return next;
}

export function timingSummary(timer, now = Date.now()) {
  if (timer?.status !== "finished") return null;
  const final = pauseEntryTimer(timer, now), view = timerView(final, now);
  return { schema: timer.schema, ...(timer.schema === 2 ? { mode: view.mode, origin: view.origin } : {}), attemptId: timer.attemptId, versionId: timer.versionId, startedAt: timer.startedAt, endedAt: timer.endedAt,
    plannedMs: view.plannedMs, actualMs: view.actualMs, entryMs: final.entryMs, modules: view.modules.map(({ id, name, plannedMs, actualMs }) => ({ id, name, plannedMs, actualMs })) };
}

export function validateTimingSummary(raw, { versionId, attemptId, sections, timeLimitMinutes } = {}) {
  const legacy = raw?.schema === 1;
  if (!raw || typeof raw !== "object" || (!legacy && raw.schema !== 2) || !identity(raw.attemptId) ||
    (!identity(raw.versionId) && !(raw.schema === 2 && raw.origin === "custom" && raw.versionId === null && !versionId)) ||
    (versionId && raw.versionId !== versionId) || (attemptId && raw.attemptId !== attemptId) || !stamp(raw.startedAt) || !stamp(raw.endedAt) || raw.endedAt < raw.startedAt ||
    !duration(raw.plannedMs) || raw.plannedMs < MINUTE || !duration(raw.actualMs) || raw.actualMs > raw.endedAt - raw.startedAt || !duration(raw.entryMs) ||
    !Array.isArray(raw.modules) || !raw.modules.length || raw.modules.length > 20 || !raw.modules.every(module => identity(module.id) && identity(module.name) && duration(module.plannedMs) && duration(module.actualMs)) ||
    new Set(raw.modules.map(module => module.id)).size !== raw.modules.length || sumPlan(raw.modules) !== raw.plannedMs || sumActual(raw.modules) !== raw.actualMs) throw new Error("做题用时记录无效，请检查后重试。");
  if (!legacy) {
    if (!["whole", "modules"].includes(raw.mode) || !["paper", "custom"].includes(raw.origin) || raw.plannedMs % MINUTE || raw.modules.some(module => module.plannedMs % MINUTE)) throw new Error("计时计划须使用整数分钟。");
    if (raw.origin === "paper" && wholeMinutes(timeLimitMinutes) && raw.plannedMs !== timeLimitMinutes * MINUTE) throw new Error("做题计划与所选套卷时限不一致。");
    if (raw.mode === "whole" && (raw.modules.length !== 1 || raw.modules[0].id !== "whole" || raw.modules[0].name !== "整卷")) throw new Error("整卷计时不能归入单个题型。");
  }
  if (sections && (legacy || raw.mode === "modules")) {
    const correct = sections.length === raw.modules.length && (legacy ? sections.every((section, index) => section.id === raw.modules[index].id && section.name === raw.modules[index].name) : sections.every(section => raw.modules.some(module => section.id === module.id && section.name === module.name)));
    if (!correct) throw new Error("做题模块与当前套卷不一致。");
  }
  return { schema: raw.schema, ...(!legacy ? { mode: raw.mode, origin: raw.origin } : {}), attemptId: raw.attemptId, versionId: raw.versionId, startedAt: raw.startedAt, endedAt: raw.endedAt,
    plannedMs: raw.plannedMs, actualMs: raw.actualMs, entryMs: raw.entryMs, modules: raw.modules.map(({ id, name, plannedMs, actualMs }) => ({ id, name, plannedMs, actualMs })) };
}

export function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
