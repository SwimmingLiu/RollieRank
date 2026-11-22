// 小程序答题卡识别结果汇总与草稿合并逻辑（与 src/omr-draft.js 保持同一口径）。
const OMR_LOW_CONFIDENCE = 0.25;
const OMR_TARGET_EDGE = 2048;
const OMR_DIRECT_MAX_EDGE = 2260;
const OMR_DIRECT_MAX_BYTES = 4 * 1024 * 1024;
const CHOICES = { A: true, B: true, C: true, D: true };

function normalizeChoice(value) {
  return typeof value === "string" && CHOICES[value] ? value : "";
}

function extractOmrQuestions(result, questionCount) {
  const total = Math.max(0, Number(questionCount) || 0);
  const byNumber = new Map();
  const rawList = Array.isArray(result && result.questions) ? result.questions : [];
  for (const item of rawList) {
    const number = Number(item && item.number);
    if (!Number.isInteger(number) || number < 1 || number > total) continue;
    const answer = normalizeChoice(item && item.answer);
    const confidence = Number.isFinite(Number(item && item.confidence)) ? Number(item.confidence) : 0;
    byNumber.set(number, { number, answer, confidence });
  }
  const out = [];
  for (let i = 0; i < total; i += 1) {
    const number = i + 1;
    out.push(byNumber.get(number) || { number, answer: "", confidence: 0 });
  }
  return out;
}

function summarizeOmrResult(result, { questionCount, currentAnswers = [] } = {}) {
  const questions = extractOmrQuestions(result, questionCount);
  let recognized = 0;
  let existingAnswered = 0;
  let fillBlankAdded = 0;
  let replaceConflicts = 0;
  const lowConfidence = [];

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const existing = normalizeChoice(currentAnswers[i]);
    if (existing) existingAnswered += 1;
    if (q.answer) {
      recognized += 1;
      if (q.confidence < OMR_LOW_CONFIDENCE) lowConfidence.push(q.number);
      if (!existing) fillBlankAdded += 1;
    }
    if (existing && existing !== q.answer) replaceConflicts += 1;
  }

  const warnings = Array.isArray(result && result.warnings)
    ? result.warnings.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return {
    total: questions.length,
    recognized,
    blank: questions.length - recognized,
    lowConfidence,
    lowConfidenceCount: lowConfidence.length,
    existingAnswered,
    fillBlankAdded,
    replaceConflicts,
    warnings,
    averageConfidence: Number.isFinite(Number(result && result.averageConfidence)) ? Number(result.averageConfidence) : 0,
    elapsedMs: Number.isFinite(Number(result && result.elapsedMs)) ? Number(result.elapsedMs) : 0,
    cached: Boolean(result && result.cached),
  };
}

function applyOmrResult({
  result,
  questionCount,
  currentAnswers = [],
  currentMarks = [],
  mode = "fill-blank",
} = {}) {
  const questions = extractOmrQuestions(result, questionCount);
  const replace = mode === "replace";
  const answers = new Array(questions.length).fill("");
  const marks = new Array(questions.length).fill(false);
  if (Array.isArray(currentMarks)) {
    for (let i = 0; i < questions.length; i += 1) {
      marks[i] = Boolean(currentMarks[i]);
    }
  }

  let appliedCount = 0;
  const lowConfidenceMarked = [];

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const existing = normalizeChoice(currentAnswers[i]);
    if (replace) {
      answers[i] = q.answer;
      if (q.answer) {
        appliedCount += 1;
        if (q.confidence < OMR_LOW_CONFIDENCE) {
          marks[i] = true;
          lowConfidenceMarked.push(q.number);
        }
      }
    } else if (existing) {
      answers[i] = existing;
    } else {
      answers[i] = q.answer;
      if (q.answer) {
        appliedCount += 1;
        if (q.confidence < OMR_LOW_CONFIDENCE) {
          marks[i] = true;
          lowConfidenceMarked.push(q.number);
        }
      }
    }
  }

  const firstBlankIndex = answers.findIndex((value) => !value);
  const firstFocusQuestion = lowConfidenceMarked[0]
    || (firstBlankIndex >= 0 ? firstBlankIndex + 1 : 1);

  return {
    answers,
    marks,
    appliedCount,
    lowConfidenceMarked,
    firstFocusQuestion,
  };
}

function formatOmrApplyToast({ appliedCount, lowConfidenceMarked, mode = "fill-blank" }) {
  const markedCount = Array.isArray(lowConfidenceMarked) ? lowConfidenceMarked.length : 0;
  if (!appliedCount) return "没有可填入的新答案";
  const verb = mode === "fill-blank" ? "已补录" : "已填入";
  return markedCount
    ? `${verb} ${appliedCount} 题，${markedCount} 题已标存疑`
    : `${verb} ${appliedCount} 题`;
}

module.exports = {
  OMR_LOW_CONFIDENCE,
  OMR_TARGET_EDGE,
  OMR_DIRECT_MAX_EDGE,
  OMR_DIRECT_MAX_BYTES,
  normalizeChoice,
  summarizeOmrResult,
  applyOmrResult,
  formatOmrApplyToast,
};
