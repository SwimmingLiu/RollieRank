export const CHOICES = ["A", "B", "C", "D"];
export const numericScore = (cents) => Number((cents / 100).toFixed(2));

// 总分仅在整数权重汇总后舍入；评分、发布试算和演示榜共用此规则，避免同卷出现不同口径。
export function roundedScoreRatio(value, denominator, numerator = denominator) {
  const product = value * numerator;
  return Math.floor(product / denominator) + Number((product % denominator) * 2 >= denominator);
}

export function validateQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 300)
    throw new Error("每套卷需要 1–300 道题。");
  const errors = [];
  const typeNames = new Map();
  questions.forEach((q, index) => {
    const row = index + 2;
    if (q.number !== index + 1)
      errors.push(`第 ${row} 行：题号应为 ${index + 1}，题号必须连续且唯一。`);
    if (!CHOICES.includes(q.correctAnswer))
      errors.push(`第 ${row} 行：答案必须为 A、B、C、D。`);
    if (
      typeof q.typeId !== "string" ||
      !q.typeId.trim() ||
      typeof q.type !== "string" ||
      !q.type.trim() ||
      q.type.length > 40
    )
      errors.push(`第 ${row} 行：请填写 1–40 字的题型名称。`);
    if (!Number.isInteger(q.cents) || q.cents < 1 || q.cents > 10000)
      errors.push(`第 ${row} 行：分值应在 0.01–100 之间，最多两位小数。`);
    if (typeNames.has(q.typeId) && typeNames.get(q.typeId) !== q.type)
      errors.push(`第 ${row} 行：同一题型编码的名称必须一致。`);
    typeNames.set(q.typeId, q.type);
  });
  if (errors.length) throw new Error(errors.slice(0, 12).join("\n"));
  return questions;
}

export function parseQuestionCsv(text) {
  const lines = String(text)
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error("请保留表头，并至少导入一道题。");
  const split = (line) =>
    line.split(/,|\t/).map((cell) => cell.trim().replace(/^"(.*)"$/, "$1"));
  const headers = split(lines[0]);
  const expected = ["题号", "题型", "答案", "分值"];
  if (!expected.every((value, i) => headers[i] === value))
    throw new Error("表头应为：题号,题型,答案,分值。");
  const typeIds = new Map();
  const questions = lines.slice(1).map((line, index) => {
    const cells = split(line);
    if (cells.length !== 4)
      throw new Error(`第 ${index + 2} 行：应有 4 列，题型名称不能包含逗号。`);
    const [number, type, correctAnswer, score] = cells;
    if (!/^\d+(\.\d{1,2})?$/.test(score))
      throw new Error(`第 ${index + 2} 行：分值应为正数，最多两位小数。`);
    if (!typeIds.has(type)) typeIds.set(type, `type-${typeIds.size + 1}`);
    return {
      number: Number(number),
      type,
      typeId: typeIds.get(type),
      correctAnswer: correctAnswer.toUpperCase(),
      cents: Math.round(Number(score) * 100),
    };
  });
  return validateQuestions(questions);
}

export function publicVersion(version) {
  const { questions, ...metadata } = version;
  // 不同题量的参考卷按整数权重折算满分；公开展示分值与计分所用的原始权重分开，避免逐题舍入误差。
  const rawMaxCents = questions.reduce((n, q) => n + q.cents, 0);
  const maxCents = version.scoringRule?.normalizationMaxCents ?? rawMaxCents;
  return {
    ...metadata,
    questionCount: questions.length,
    maxCents,
    ...(maxCents !== rawMaxCents ? { rawMaxCents } : {}),
    questions: questions.map(({ correctAnswer, ...q }) => ({
      ...q,
      ...(maxCents !== rawMaxCents
        ? { scoreCents: (q.cents * maxCents) / rawMaxCents }
        : {}),
    })),
  };
}

export function gradeVersion(version, answers) {
  // 只支持已定义的百分制参考折算；未知配置不能悄悄改变总分，历史无折算规则的答卷保持原算法。
  const normalization = version.scoringRule?.normalizationMaxCents;
  if (normalization !== undefined && normalization !== 10000)
    throw new Error("参考计分的折算满分须为 100 分。");
  if (
    !Array.isArray(answers) ||
    answers.length !== version.questions.length ||
    !answers.every((a) => a === null || CHOICES.includes(a))
  )
    throw new Error(`需要 ${version.questions.length} 个 A–D 选项或空值。`);
  const rows = version.questions.map((q, i) => {
    const answer = answers[i];
    const status =
      answer === null
        ? "blank"
        : answer === q.correctAnswer
          ? "correct"
          : "wrong";
    return {
      question: q.number,
      type: q.type,
      typeId: q.typeId,
      answer,
      correctAnswer: q.correctAnswer,
      status,
      maxCents: q.cents,
      cents: status === "correct" ? q.cents : 0,
    };
  });
  const breakdown = [];
  for (const q of rows) {
    let type = breakdown.find((item) => item.id === q.typeId);
    if (!type) {
      type = {
        id: q.typeId,
        name: q.type,
        count: 0,
        correct: 0,
        answered: 0,
        centsEarned: 0,
        maxCents: 0,
      };
      breakdown.push(type);
    }
    type.count++;
    type.correct += Number(q.status === "correct");
    type.answered += Number(q.status !== "blank");
    type.centsEarned += q.cents;
    type.maxCents += q.maxCents;
  }
  const totalCents = rows.reduce((n, q) => n + q.cents, 0);
  const maxCents = rows.reduce((n, q) => n + q.maxCents, 0);
  const correct = rows.filter((q) => q.status === "correct").length;
  const target = normalization ?? maxCents;
  if (target !== maxCents) {
    for (const q of rows) {
      q.rawCents = q.cents;
      q.rawMaxCents = q.maxCents;
      q.cents = (q.rawCents * target) / maxCents;
      q.maxCents = (q.rawMaxCents * target) / maxCents;
    }
    for (const type of breakdown) {
      type.centsEarned = (type.centsEarned * target) / maxCents;
      type.maxCents = (type.maxCents * target) / maxCents;
    }
  }
  const normalizedTotal = roundedScoreRatio(totalCents, maxCents, target);
  return {
    rows,
    breakdown,
    totalCents: normalizedTotal,
    maxCents: target,
    correct,
    wrong: rows.filter((q) => q.status === "wrong").length,
    blank: rows.filter((q) => q.status === "blank").length,
    rate: totalCents / maxCents,
    accuracy: correct / rows.length,
    ...(version.scoringRule ? { scoringRule: structuredClone(version.scoringRule) } : {}),
    ...(target !== maxCents
      ? { scoreScale: { numerator: target, denominator: maxCents }, rawTotalCents: totalCents }
      : {}),
  };
}

export function resultCsv(attempt) {
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [
    [
      "套卷",
      "版本",
      "题号",
      "题型",
      "我的答案",
      "参考答案",
      "结果",
      "分值",
      "得分",
    ],
    ...attempt.report.rows.map((q) => [
      attempt.paperTitle,
      attempt.versionLabel,
      q.question,
      q.type,
      q.answer,
      q.correctAnswer,
      { correct: "正确", wrong: "错误", blank: "未答" }[q.status],
      numericScore(q.maxCents),
      numericScore(q.cents),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n");
}
