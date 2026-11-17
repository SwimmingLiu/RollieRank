import { CHOICES, gradeVersion, validateQuestions } from "./model.js";
import { loadDrafts } from "./storage.js";
import { validateTimingSummary } from "./practice-timer.js";

export const STATE_KEY = "rollierank:prototype:v2";
export const makeId = () => globalThis.crypto.randomUUID();
export const newDraft = (version) => ({
  id: makeId(),
  versionId: version.id,
  answers: Array(version.questionCount).fill(null),
  current: 1,
  autoNext: true,
  marks: [],
  updatedAt: Date.now(),
});

export function initialState() {
  return {
    version: 2,
    guestId: makeId(),
    drafts: {},
    attempts: [],
    profile: null,
    filters: {
      institution: "四海",
      project: "2026 下半年 · 国考行测",
      period: "一期",
      variant: "地市级 / 行政执法类",
      status: "all",
    },
  };
}

function restoreAttempt(raw) {
  if (!raw || typeof raw !== "object" || raw.isSample) return null;
  const fields = [
    "id",
    "versionId",
    "paperId",
    "paperTitle",
    "institution",
    "project",
    "period",
    "variant",
    "versionLabel",
  ];
  if (
    !fields.every(
      (key) =>
        typeof raw[key] === "string" &&
        raw[key].length > 0 &&
        raw[key].length <= 200,
    ) ||
    !Number.isFinite(raw.createdAt) ||
    !Array.isArray(raw.answers) ||
    !Array.isArray(raw.report?.rows)
  )
    return null;
  try {
    const questions = raw.report.rows.map((q) => ({
      number: q.question,
      type: q.type,
      typeId: q.typeId,
      correctAnswer: q.correctAnswer,
      // 折算卷的显示分值可能是小数；恢复时使用快照原始整数权重，避免刷新后总分变化。
      cents: q.rawMaxCents ?? q.maxCents,
    }));
    validateQuestions(questions);
    const scoringRule = raw.scoringRule ?? raw.report.scoringRule;
    const report = gradeVersion({ questions, scoringRule }, raw.answers);
    // 旧恢复流程只复制成绩；计时独立校验，损坏的可选用时不能抹掉有效历史成绩。
    let timing;
    if (raw.timing) {
      try { timing = validateTimingSummary(raw.timing, { versionId: raw.versionId, attemptId: raw.id }); }
      catch { timing = undefined; }
    }
    if (
      report.totalCents !== raw.report.totalCents ||
      report.maxCents !== raw.report.maxCents
    )
      return null;
    return {
      ...Object.fromEntries(fields.map((key) => [key, raw[key]])),
      createdAt: raw.createdAt,
      answers: [...raw.answers],
      report,
      ...(timing ? { timing } : {}),
      ...(scoringRule ? { scoringRule: structuredClone(scoringRule) } : {}),
      // 旧恢复逻辑只认成绩字段；订正凭据随新快照保留，刷新后仍可解释分数变化。
      ...(Number.isInteger(raw.answerRevision) ? { answerRevision: raw.answerRevision } : {}),
      ...(raw.correctionSummary && typeof raw.correctionSummary === "object"
        ? { correctionSummary: structuredClone(raw.correctionSummary) } : {}),
      ...(Array.isArray(raw.correctionHistory) ? { correctionHistory: structuredClone(raw.correctionHistory) } : {}),
      ownerId: typeof raw.ownerId === "string" ? raw.ownerId : null,
      participate: raw.participate === true && typeof raw.ownerId === "string",
      isSample: false,
    };
  } catch {
    return null;
  }
}

export function loadState(storage, catalog) {
  const fresh = initialState();
  try {
    const text = storage.getItem(STATE_KEY);
    if (text) {
      const data = JSON.parse(text);
      if (
        !data ||
        data.version !== 2 ||
        typeof data.guestId !== "string" ||
        !/^[\w-]{10,80}$/.test(data.guestId) ||
        !Array.isArray(data.attempts) ||
        !data.drafts ||
        typeof data.drafts !== "object"
      )
        throw new Error("记录格式无法识别");
      fresh.guestId = data.guestId;
      fresh.attempts = data.attempts.map(restoreAttempt).filter(Boolean);
      let warning = fresh.attempts.length !== data.attempts.length;
      fresh.profile =
        data.profile && typeof data.profile.name === "string"
          ? { id: fresh.guestId, name: data.profile.name.slice(0, 16) }
          : null;
      for (const key of Object.keys(fresh.filters))
        if (typeof data.filters?.[key] === "string")
          fresh.filters[key] = data.filters[key];
      for (const [id, draft] of Object.entries(data.drafts)) {
        const version = catalog.find((v) => v.id === id);
        if (
          !version ||
          !draft ||
          !Array.isArray(draft.answers) ||
          draft.answers.length !== version.questionCount
        ) {
          warning = true;
          continue;
        }
        fresh.drafts[id] = {
          ...newDraft(version),
          id: typeof draft.id === "string" ? draft.id : makeId(),
          answers: draft.answers.map((a) => (CHOICES.includes(a) ? a : null)),
          current: Number.isInteger(draft.current)
            ? Math.min(version.questionCount, Math.max(1, draft.current))
            : 1,
          autoNext: draft.autoNext !== false,
          marks: Array.isArray(draft.marks)
            ? draft.marks.filter(
                (n) =>
                  Number.isInteger(n) && n >= 1 && n <= version.questionCount,
              )
            : [],
          updatedAt: Number.isFinite(draft.updatedAt)
            ? draft.updatedAt
            : Date.now(),
        };
      }
      return { state: fresh, warning };
    }
    // 旧 H5 每卷只有一份可变草稿；仅迁移答案，避免把旧报告误作新提交历史。
    const legacy = loadDrafts(
      storage,
      catalog.map((v) => v.paperId),
    );
    for (const version of catalog) {
      const draft = legacy.drafts[version.paperId];
      if (
        version.questionCount === 130 &&
        (version.versionLabel === "1.0" || version.id.endsWith(":v1")) &&
        draft?.answers.some(Boolean)
      )
        fresh.drafts[version.id] = {
          ...newDraft(version),
          answers: draft.answers,
          current: draft.current,
          autoNext: draft.autoNext,
          updatedAt: draft.updatedAt ?? Date.now(),
        };
    }
    return { state: fresh, warning: legacy.warning };
  } catch {
    return { state: fresh, warning: true };
  }
}

export function saveState(storage, state) {
  storage.setItem(STATE_KEY, JSON.stringify(state));
}

export function recordAttempt(state, attempt, { participate = false } = {}) {
  if (state.attempts.some((item) => item.id === attempt.id)) return false;
  state.attempts.unshift({
    ...structuredClone(attempt),
    ownerId: state.profile?.id ?? null,
    participate: Boolean(state.profile && participate),
  });
  if (state.drafts[attempt.versionId]?.id === attempt.id)
    delete state.drafts[attempt.versionId];
  return true;
}

// 同步只更新已有答卷的服务端评分，保留本机认领和参与选择，也不删除尚未同步的备份记录。
export function syncAttemptSnapshots(state, attempts) {
  const incoming = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  let changed = false;
  state.attempts = state.attempts.map((prior) => {
    const next = incoming.get(prior.id);
    if (!next || next.versionId !== prior.versionId) return prior;
    const validated = restoreAttempt({ ...next, ownerId: prior.ownerId,
      participate: prior.participate });
    if (!validated) return prior;
    if (JSON.stringify(validated) === JSON.stringify(prior)) return prior;
    changed = true;
    return validated;
  });
  return changed;
}
