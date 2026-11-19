import { initialState, loadState, recordAttempt, syncAttemptSnapshots } from "../../../src/prototype-state.js";
import { subjectAttempt, subjectResponse } from "../../../src/subjects.js";

const validId = value => typeof value === "string" && /^[\w-]{10,80}$/.test(value);
const scopeKey = scope => [scope.institution, scope.period, scope.paper].join("|");

// Preview collection keys are existing saved identities, not an inferred examination year.
export function versionForScope(versions, scope) {
  if (scope.versionId) return versions.find(version => version.id === scope.versionId);
  const candidates = versions.filter(version => version.institution === scope.institution && version.number === Number(scope.paper) && version.status !== "draft");
  const matches = candidates.filter(version => {
    if (scope.institution !== "四海") return Number(scope.period) === 1;
    if (Number(scope.period) === 1) return version.period === "一期";
    if (Number(scope.period) === 102) return version.period === "二期" && /副省/.test(version.variant);
    return Number(scope.period) === 2 && version.period === "二期" && !/副省/.test(version.variant);
  });
  return matches.sort((a, b) => Number(b.status === "published") - Number(a.status === "published") ||
    String(b.versionLabel).localeCompare(String(a.versionLabel), "en", { numeric: true }))[0];
}

export function scopeForVersion(version) {
  return { institution: version.institution, period: version.institution === "四海"
    ? version.period === "一期" ? 1 : /副省/.test(version.variant) ? 102 : 2 : 1,
    paper: version.number, versionId: version.id };
}

export function iosScore(attempt) {
  // 旧成绩快照也按完整判断推理汇总，不能平均四类百分比或漏掉任一类。
  const report = subjectAttempt(attempt).report;
  return { cents: report.totalCents, maxCents: report.maxCents, correct: report.correct,
    wrong: report.wrong, blank: report.blank, rate: report.rate,
    rows: report.rows.map(row => ({ n: row.question, answer: row.answer ?? "", ref: row.correctAnswer,
      type: row.type, cents: row.cents, status: row.status })),
    types: report.breakdown.map(type => ({ name: type.name, rate: type.centsEarned / type.maxCents,
      earned: type.centsEarned, max: type.maxCents })) };
}

export function createIOSServiceClient({ storage, storageName, getUIState, persistUI, launchIdentity, fetchImpl = globalThis.fetch }) {
  const key = storageName + ":service:v1";
  const proxyStorage = { getItem: () => storage.getItem(key) };
  let versions = [], status = "loading", failure = "", rootState = initialState(), pending = {};
  try {
    const prior = JSON.parse(storage.getItem(key) || "null");
    pending = Object.fromEntries(Object.entries(prior?.iosPending ?? {}).filter(([, id]) => validId(id)));
    rootState = loadState(proxyStorage, []).state;
  } catch { /* Keep existing authored UI history intact when service metadata cannot be restored. */ }

  if (validId(launchIdentity?.guestId)) {
    if (rootState.guestId !== launchIdentity.guestId) {
      rootState = { ...initialState(), guestId: launchIdentity.guestId };
      pending = {};
    }
    if (launchIdentity.name) {
      rootState.profile = { id: rootState.guestId, name: launchIdentity.name };
    }
  }

  const persist = () => {
    try { storage.setItem(key, JSON.stringify({ ...rootState, iosPending: pending })); }
    catch { throw new Error("本机保存不可用，请保持页面打开并备份练习记录。"); }
  };
  const api = async (path, input) => {
    let response;
    try {
      response = await fetchImpl("/api/" + path, { method: input === undefined ? "GET" : "POST",
        ...(input === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
        signal: AbortSignal.timeout(path === "positions/import/finish" ? 75000 : 15000) });
    } catch { throw new Error("练习服务暂时不可用，录入内容仍在本机，请稍后重试。"); }
    let result;
    try { result = await response.json(); } catch { throw new Error("练习服务返回了无效内容，请稍后重试。"); }
    if (!response.ok) throw Object.assign(new Error(result.error || "操作未完成，请重试。"), { statusCode: response.status });
    // 新旧快照使用同一主板块名称，提交仍只传原始题号、凭证和本人选项。
    return subjectResponse(result);
  };
  const currentAttempt = () => rootState.attempts.find(attempt => attempt.id === getUIState().activeAttemptId);
  const currentVersion = () => {
    const attempt = currentAttempt();
    const ui = getUIState(), draft = ui.history.find(record => record.id === ui.activeAttemptId);
    return versionForScope(versions, attempt ? { versionId: attempt.versionId } : draft?.versionId ? { versionId: draft.versionId } : ui);
  };
  const mergeHistory = () => {
    const ui = getUIState();
    for (const attempt of rootState.attempts) {
      const version = versions.find(item => item.id === attempt.versionId);
      const scope = version ? scopeForVersion(version) : scopeForVersion({ ...attempt, number: Number(attempt.paperNumber) || 1 });
      const index = ui.history.findIndex(record => record.id === attempt.id);
      const record = { ...(index >= 0 ? ui.history[index] : scope), id: attempt.id,
        versionId: attempt.versionId, answers: attempt.answers.map(answer => answer ?? ""),
        complete: true, updatedAt: attempt.createdAt, serviceBacked: true };
      if (index >= 0) ui.history[index] = record;
      else ui.history.push(record);
    }
    // Current drafts stay in front; server timestamps preserve the chronology of actual submissions.
    ui.history.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    persistUI();
  };
  const refreshCatalog = async () => {
    try {
      const result = await api("catalog");
      if (!Array.isArray(result.versions) || !result.versions.every(version => typeof version.id === "string" &&
        Number.isInteger(version.questionCount) && Array.isArray(version.questions)))
        throw new Error("套卷目录格式无效，请重新读取。");
      versions = result.versions; status = "ready"; failure = "";
      return versions;
    } catch (error) { status = "error"; failure = error.message; throw error; }
  };
  const syncAttempts = async () => {
    const result = await api("attempts/sync", { guestId: rootState.guestId });
    if (!Array.isArray(result.attempts)) throw new Error("成绩同步内容无效，请重试。");
    // Restore only known snapshots; new receipts can also recover a lost response to an idempotent submit.
    for (const raw of result.attempts) {
      if (rootState.attempts.some(attempt => attempt.id === raw.id)) continue;
      const check = loadState({ getItem: () => JSON.stringify({ ...initialState(), guestId: rootState.guestId,
        attempts: [raw] }) }, versions);
      if (check.state.attempts.length) rootState.attempts.push(check.state.attempts[0]);
    }
    syncAttemptSnapshots(rootState, result.attempts); persist(); mergeHistory();
    return result;
  };
  const prepareDraft = () => {
    const ui = getUIState(), version = currentVersion();
    if (!version) return null;
    const sourceKey = (ui.activeAttemptId || scopeKey(ui)) + ":" + version.id;
    const id = validId(ui.activeAttemptId) ? ui.activeAttemptId : (pending[sourceKey] ??= crypto.randomUUID());
    // 复查标记与已结束的计时绑定本次凭证；重试不会改成另一份用时记录。
    const timing = ui.submittedTiming?.[id];
    const draft = { id, versionId: version.id, answers: ui.answers.map(answer => answer || null),
      marks: Array.isArray(ui.reviewMarks?.[id]) ? [...ui.reviewMarks[id]] : [], ...(timing ? { timing: structuredClone(timing) } : {}) };
    rootState.drafts[version.id] = draft; persist();
    return draft;
  };
  const submit = async () => {
    if (!versions.length) await refreshCatalog();
    const ui = getUIState(), version = currentVersion();
    if (!version) throw new Error("这份旧记录尚未匹配到已发布套卷，请重新选择套卷后练习。");
    if (ui.answers.length !== version.questionCount) throw new Error(`当前套卷为 ${version.questionCount} 题，请先核对并补齐答题卡。`);
    const draft = prepareDraft();
    const attempt = await api("submit", { guestId: rootState.guestId, attemptId: draft.id,
      versionId: version.id, name: rootState.profile?.name || "卷友", answers: draft.answers, ...(draft.timing ? { timing: draft.timing } : {}) });
    if (!attempt?.report || attempt.id !== draft.id || attempt.versionId !== version.id)
      throw new Error("提交结果无法确认，原答案保留，请重试。");
    recordAttempt(rootState, attempt); persist();
    return attempt;
  };
  const initialize = async () => {
    try { await refreshCatalog(); await syncAttempts(); }
    catch (error) { failure = error.message; }
    return status === "ready";
  };
  return { api, persist, initialize, refreshCatalog, syncAttempts, prepareDraft, submit,
    state: () => rootState, catalog: () => versions, currentAttempt, currentVersion, mergeHistory,
    forRecord: record => rootState.attempts.find(attempt => attempt.id === record?.id),
    scoreForRecord: record => { const attempt = rootState.attempts.find(item => item.id === record?.id); return attempt ? iosScore(attempt) : null; },
    status: () => ({ status, error: failure }), storageKey: key };
}
