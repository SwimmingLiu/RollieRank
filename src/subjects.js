// 用户维度统一为判断推理；原始题目、题号及其分值仍由评分模型持有。
export const JUDGMENT_ID = "judgment";
const judgmentNames = new Set(["判断推理", "逻辑判断", "类比推理", "图形推理", "定义判断"]);
export const isJudgmentSection = name => judgmentNames.has(name);
export const subjectName = name => isJudgmentSection(name) ? "判断推理" : name;
export const subjectId = (id, name) => isJudgmentSection(name) ? JUDGMENT_ID : id;

export function subjectDimensions(questions) {
  return [...new Map(questions.map(question => {
    const id = subjectId(question.typeId, question.type);
    return [id, { id, name: subjectName(question.type) }];
  })).values()];
}

export function resolveSubjectDimension(questions, requested = "total") {
  const question = questions.find(item => item.typeId === requested);
  return question ? subjectId(question.typeId, question.type) : requested;
}

export function subjectBreakdown(parts, rows = [], scoreScale) {
  const groups = new Map();
  for (const part of parts) {
    const id = subjectId(part.id, part.name);
    if (!isJudgmentSection(part.name)) { groups.set(id, { ...part }); continue; }
    let group = groups.get(id);
    if (!group) {
      group = { ...part, id, name: "判断推理", count: 0, correct: 0, answered: 0, centsEarned: 0, maxCents: 0 };
      groups.set(id, group);
    }
    for (const key of ["count", "correct", "answered", "centsEarned", "maxCents"]) group[key] += part[key] ?? 0;
  }
  const judgment = groups.get(JUDGMENT_ID);
  const judgmentRows = rows.filter(row => isJudgmentSection(row.type));
  if (judgment && judgmentRows.length) {
    const scale = scoreScale ? scoreScale.numerator / scoreScale.denominator : 1;
    const rawAvailable = judgmentRows.every(row => row.rawCents !== undefined || row.rawMaxCents === undefined || ["correct", "wrong", "blank"].includes(row.status));
    if (rawAvailable) {
      // 折算卷在完整板块内先加原始整数，避免分型浮点相加让同分产生不同排名。
      judgment.centsEarned = judgmentRows.reduce((sum, row) => sum + (row.rawCents ?? (row.rawMaxCents === undefined ? row.cents : row.status === "correct" ? row.rawMaxCents : 0)), 0) * scale;
      judgment.maxCents = judgmentRows.reduce((sum, row) => sum + (row.rawMaxCents ?? row.maxCents), 0) * scale;
    }
  }
  return [...groups.values()];
}

export function subjectVersion(version) {
  // 审核列表也使用versions键，但仅含版本元数据，不包含可归类的题目。
  if (!Array.isArray(version.questions)) return version;
  return { ...version, questions: version.questions.map(question => ({ ...question,
    typeId: subjectId(question.typeId, question.type), type: subjectName(question.type) })) };
}

export function subjectAttempt(attempt) {
  if (!attempt?.report?.rows || !attempt.report.breakdown) return attempt;
  return { ...attempt, report: { ...attempt.report,
    rows: attempt.report.rows.map(row => ({ ...row, typeId: subjectId(row.typeId, row.type), type: subjectName(row.type) })),
    breakdown: subjectBreakdown(attempt.report.breakdown, attempt.report.rows, attempt.report.scoreScale) } };
}

// 界面只归一公开元数据和成绩副本，服务端原始题型及历史作答不被回写。
export function subjectResponse(result) {
  if (Array.isArray(result?.versions)) return { ...result, versions: result.versions.map(subjectVersion) };
  if (Array.isArray(result?.attempts)) return { ...result, attempts: result.attempts.map(subjectAttempt) };
  return result?.report ? subjectAttempt(result) : result;
}

export function primarySectionScores(sections) {
  const result = new Map();
  for (const section of sections) {
    const name = subjectName(section.name);
    const group = result.get(name) ?? { name, earnedCents: 0, maxCents: 0 };
    group.earnedCents += section.earnedCents;
    group.maxCents += section.maxCents;
    result.set(name, group);
  }
  return [...result.values()];
}
