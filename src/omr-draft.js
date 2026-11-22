// 答题卡识别结果与练习草稿的汇总、合并和存疑标记逻辑（手机 Web 与测试共用）。
export const OMR_LOW_CONFIDENCE = 0.25;
export const OMR_TARGET_EDGE = 2048;
export const OMR_DIRECT_MAX_EDGE = 2260;
export const OMR_DIRECT_MAX_BYTES = 4 * 1024 * 1024;

const CHOICES = new Set(["A", "B", "C", "D"]);

export function normalizeChoice(value) {
  return typeof value === "string" && CHOICES.has(value) ? value : "";
}

export function extractOmrQuestions(result, questionCount) {
  const total = Math.max(0, Number(questionCount) || 0);
  const byNumber = new Map();
  const rawList = Array.isArray(result?.questions) ? result.questions : [];
  for (const item of rawList) {
    const number = Number(item?.number);
    if (!Number.isInteger(number) || number < 1 || number > total) continue;
    const answer = normalizeChoice(item?.answer);
    const confidence = Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : 0;
    byNumber.set(number, { number, answer, confidence });
  }
  return Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    return byNumber.get(number) ?? { number, answer: "", confidence: 0 };
  });
}

export function summarizeOmrResult(result, { questionCount, currentAnswers = [] } = {}) {
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

  const warnings = Array.isArray(result?.warnings)
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
    averageConfidence: Number.isFinite(Number(result?.averageConfidence)) ? Number(result.averageConfidence) : 0,
    elapsedMs: Number.isFinite(Number(result?.elapsedMs)) ? Number(result.elapsedMs) : 0,
    cached: Boolean(result?.cached),
  };
}

export function applyOmrResult({
  result,
  questionCount,
  currentAnswers = [],
  currentMarks = [],
  mode = "fill-blank",
} = {}) {
  const questions = extractOmrQuestions(result, questionCount);
  const replace = mode === "replace";
  const answers = new Array(questions.length).fill("");
  const markSet = new Set(
    Array.isArray(currentMarks)
      ? currentMarks.filter((n) => Number.isInteger(n) && n >= 1 && n <= questions.length)
      : [],
  );

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
          markSet.add(q.number);
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
          markSet.add(q.number);
          lowConfidenceMarked.push(q.number);
        }
      }
    }
  }

  const firstBlankIndex = answers.findIndex((value) => !value);
  const firstFocusQuestion = lowConfidenceMarked[0]
    ?? (firstBlankIndex >= 0 ? firstBlankIndex + 1 : 1);

  return {
    answers,
    marks: [...markSet].sort((a, b) => a - b),
    appliedCount,
    lowConfidenceMarked,
    firstFocusQuestion,
  };
}

export function formatOmrApplyToast({ appliedCount, lowConfidenceMarked, mode = "fill-blank" }) {
  const markedCount = Array.isArray(lowConfidenceMarked) ? lowConfidenceMarked.length : 0;
  if (!appliedCount) return "没有可填入的新答案";
  const verb = mode === "fill-blank" ? "已补录" : "已填入";
  return markedCount
    ? `${verb} ${appliedCount} 题，${markedCount} 题已标存疑`
    : `${verb} ${appliedCount} 题`;
}
