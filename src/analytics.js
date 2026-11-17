import { subjectId, subjectName } from "./subjects.js";

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const text = (value) => typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/gu, " ") : "";
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const ratio = (value) => finite(value) && value >= 0 && value <= 1;
const timestamp = (value) => finite(value) && !Number.isNaN(new Date(value).getTime());
const close = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b)) * 1e-9;

// 产品按实际题量组织国考及公考模拟练习；归类不改变来源分值，也不是官方卷型全集。
const examCategories = [
  { id: "guokao-city", label: "地市卷（130题）" },
  { id: "guokao-subprovincial", label: "副省卷（135题）" },
];
export function classifyExamCategory(input) {
  const report = input?.report ?? input;
  const questionCount = Array.isArray(report?.rows) ? report.rows.length : input?.questionCount;
  const maximum = report?.maxCents;
  const project = text(input?.project);
  const metadata = [project, input?.variant, input?.paperTitle, input?.title].map(text).join(" ");
  const knownCatalog = [input?.paperId, input?.versionId, input?.id].some(value => /^(?:sihai|chaoge|fenbi|shangancun)-/.test(text(value)));
  const nationalMock = knownCatalog || /国考|公考|中央机关|副省|地市|行政执法/.test(metadata);
  const provincialExam = /省考/.test(project) && !/国考/.test(project);
  if (!provincialExam && nationalMock && (!positiveInteger(maximum) || maximum === 10000)) {
    if (questionCount === 130) return examCategories[0];
    if (questionCount === 135) return examCategories[1];
  }
  // 非标准题量或满分独立成格式，避免把自定义10分卷和100分卷当成同一得分尺度。
  const countLabel = positiveInteger(questionCount) ? `${questionCount}题` : "题量待补";
  const maxLabel = positiveInteger(maximum) ? ` · ${Number((maximum / 100).toFixed(2))}分` : "";
  return { id: `custom-${questionCount || "unmeasured"}-${maximum || "unmeasured"}`, label: `其他练习（${countLabel}${maxLabel}）` };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, canonical(value[key])]));
  return value;
}

function displayCode(signature) {
  let hash = 2166136261;
  for (let i = 0; i < signature.length; i++) hash = Math.imul(hash ^ signature.charCodeAt(i), 16777619);
  return `R-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

export function analyticsTypeKey(row) {
  const name = subjectName(text(row?.type));
  const id = text(row?.typeId);
  return name ? `name:${name}` : id ? `id:${id}` : null;
}

/** Complete signatures validate same-paper compatibility; growth uses each record's own metrics. */
export function describeScoringRule(input) {
  const report = input?.report ?? input;
  const invalid = (reason) => ({ valid: false, signature: null, reason });
  if (!Array.isArray(report?.rows) || !report.rows.length) return invalid("缺少逐题评分记录");
  const scoringRule = report.scoringRule ?? input?.scoringRule ?? {};
  if (!scoringRule || typeof scoringRule !== "object" || Array.isArray(scoringRule)) return invalid("评分规则格式不完整");
  const groups = new Map();
  const numbers = new Set();
  let rawMaxCents = 0;
  let displayedMaxCents = 0;
  for (const row of report.rows) {
    const weight = row?.rawMaxCents ?? row?.maxCents;
    const key = analyticsTypeKey(row);
    if (!positiveInteger(weight) || !finite(row?.maxCents) || row.maxCents <= 0)
      return invalid("缺少可验证的原始整数权重");
    if (!key) return invalid("缺少题型分组");
    if (!positiveInteger(row.question) || numbers.has(row.question)) return invalid("题号缺失或重复");
    numbers.add(row.question);
    rawMaxCents += weight;
    displayedMaxCents += row.maxCents;
    // 判断推理保留全部题号权重，用于同卷历史兼容校验，不改变实际总分。
    const typeId = subjectId(text(row.typeId), text(row.type));
    if (!groups.has(key)) groups.set(key, { key, name: subjectName(text(row.type)) || typeId, typeId, count: 0, rawMaxCents: 0, weights: new Map(), questionWeights: [] });
    const group = groups.get(key);
    if (group.typeId !== typeId) return invalid("同名题型对应多个分组，无法确认兼容性");
    group.count++;
    group.rawMaxCents += weight;
    group.weights.set(weight, (group.weights.get(weight) ?? 0) + 1);
    group.questionWeights.push({ question: row.question, cents: weight });
  }
  const maxCents = report.maxCents ?? displayedMaxCents;
  if (!positiveInteger(rawMaxCents) || !positiveInteger(maxCents) || !close(displayedMaxCents, maxCents)) return invalid("报告满分与逐题权重不一致");
  const normalization = scoringRule.normalizationMaxCents;
  const scoreScale = report.scoreScale;
  if (normalization !== undefined && (!positiveInteger(normalization) || normalization !== maxCents)) return invalid("折算满分与报告不一致");
  if (scoreScale !== undefined && (!scoreScale || !positiveInteger(scoreScale.numerator) || !positiveInteger(scoreScale.denominator) || scoreScale.numerator !== maxCents || scoreScale.denominator !== rawMaxCents))
    return invalid("折算比例与原始权重不一致");
  const normalized = normalization !== undefined || scoreScale !== undefined;
  if (!normalized && rawMaxCents !== maxCents) return invalid("缺少折算规则");
  if (report.rows.some((row) => !close(row.maxCents, (row.rawMaxCents ?? row.maxCents) * maxCents / rawMaxCents))) return invalid("逐题分值与折算比例不一致");
  const descriptive = new Set(["id", "label", "source", "sources", "note", "kind", "normalizationMaxCents", "rounding"]);
  const extensions = Object.fromEntries(Object.entries(scoringRule).filter(([key]) => !descriptive.has(key)));
  if (scoringRule.kind && !["publisher", "reference"].includes(scoringRule.kind)) extensions.kind = scoringRule.kind;
  const types = [...groups.values()].sort((a, b) => compareText(a.key, b.key)).map(({ typeId, ...group }) => ({
    ...group,
    weights: [...group.weights].sort(([a], [b]) => a - b).map(([cents, count]) => ({ cents, count })),
    questionWeights: [...group.questionWeights].sort((a, b) => a.question - b.question),
    maxCents: group.rawMaxCents * maxCents / rawMaxCents,
  }));
  const scale = { mode: normalized ? "normalized" : "raw", numerator: maxCents, denominator: rawMaxCents, rounding: text(scoringRule.rounding) || "half-up-after-total", extensions: canonical(extensions) };
  const signature = "rollierank-score:1:" + JSON.stringify(canonical({
    questionCount: report.rows.length,
    rawMaxCents,
    maxCents,
    scale,
    types: types.map(({ key, count, weights, questionWeights }) => ({ key, count, weights, weightSequence: questionWeights.map(({ cents }) => cents) })),
  }));
  return { valid: true, signature, code: displayCode(signature), questionCount: report.rows.length, rawMaxCents, maxCents, scale, types };
}

function rowMetrics(rows, maxCents) {
  const centsAvailable = rows.every((row) => finite(row.cents) && row.cents >= 0 && row.cents <= row.maxCents);
  const totalCents = centsAvailable ? rows.reduce((sum, row) => sum + row.cents, 0) : null;
  const rawAvailable = rows.every((row) => finite(row.rawCents ?? row.cents) && (row.rawCents ?? row.cents) >= 0 && (row.rawCents ?? row.cents) <= (row.rawMaxCents ?? row.maxCents));
  const rawTotal = rawAvailable ? rows.reduce((sum, row) => sum + (row.rawCents ?? row.cents), 0) : null;
  const rawMax = rows.reduce((sum, row) => sum + (row.rawMaxCents ?? row.maxCents), 0);
  const statusesAvailable = rows.every((row) => ["correct", "wrong", "blank"].includes(row.status));
  const correct = statusesAvailable ? rows.filter((row) => row.status === "correct").length : null;
  // Some old normalized reports omit rawCents; displayed values still retain the exact unrounded ratio.
  const allRaw = rows.every((row) => row.rawMaxCents === undefined || finite(row.rawCents));
  return { totalCents, maxCents, rate: rawAvailable && allRaw ? rawTotal / rawMax : centsAvailable ? totalCents / maxCents : null, accuracy: correct === null ? null : correct / rows.length, correct, count: rows.length };
}

export function analyzeAttempt(attempt) {
  if (!attempt || attempt.isSample || !text(attempt.id) || !timestamp(attempt.createdAt)) return null;
  const rule = describeScoringRule(attempt);
  if (!rule.valid || !finite(attempt.report.totalCents) || attempt.report.totalCents < 0 || attempt.report.totalCents > rule.maxCents) return null;
  const metrics = rowMetrics(attempt.report.rows, rule.maxCents);
  metrics.totalCents = attempt.report.totalCents;
  if (ratio(attempt.report.rate)) metrics.rate = attempt.report.rate;
  if (ratio(attempt.report.accuracy)) metrics.accuracy = attempt.report.accuracy;
  const types = rule.types.map((type) => ({ ...type, ...rowMetrics(attempt.report.rows.filter((row) => analyticsTypeKey(row) === type.key), type.maxCents) }));
  return { attempt, rule, metrics, types, examCategory: classifyExamCategory(attempt), sourceId: attempt.paperId || attempt.versionId || attempt.id };
}

export function compareAttemptOrder(a, b) {
  return a.createdAt - b.createdAt || compareText(a.id, b.id);
}

function samePaper(a, b) {
  return a.paperId && b.paperId ? a.paperId === b.paperId : Boolean(a.versionId && a.versionId === b.versionId);
}

export function selectPreviousAttempt(current, attempts) {
  const currentEntry = analyzeAttempt(current);
  if (!currentEntry) return null;
  return attempts.filter((candidate) => candidate && candidate.id !== current.id && samePaper(current, candidate) && candidate.createdAt < current.createdAt)
    .filter((candidate) => analyzeAttempt(candidate)?.rule.signature === currentEntry.rule.signature)
    .sort(compareAttemptOrder).at(-1) ?? null;
}

function difference(key, before, after) {
  const delta = finite(before) && finite(after) ? after - before : null;
  const direction = delta === null ? "unavailable" : Math.abs(delta) < 1e-10 ? "same" : delta > 0 ? "up" : "down";
  return { key, before, after, delta: direction === "same" ? 0 : delta, direction };
}

export function compareAttempts(current, previous) {
  const after = analyzeAttempt(current);
  const before = analyzeAttempt(previous);
  if (!after || !before || current.id === previous.id || !samePaper(current, previous) || previous.createdAt >= current.createdAt || after.rule.signature !== before.rule.signature) return null;
  return {
    current, previous,
    metrics: ["totalCents", "rate", "accuracy"].map((key) => difference(key, before.metrics[key], after.metrics[key])),
    types: after.types.map((type) => {
      const prior = before.types.find((item) => item.key === type.key);
      return { key: type.key, name: type.name, before: prior, after: type, metrics: ["totalCents", "rate", "accuracy", "correct"].map((key) => difference(key, prior?.[key], type[key])) };
    }),
  };
}

/** Local date bounds include the entire end date. Invalid bounds are reported, never silently widened. */
export function analyticsDateBounds(from = "", to = "") {
  const parse = (value, nextDay = false) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return NaN;
    if (nextDay) date.setDate(date.getDate() + 1);
    return date.getTime();
  };
  const start = from ? parse(from) : -Infinity;
  const end = to ? parse(to, true) : Infinity;
  return { start, end, valid: !Number.isNaN(start) && !Number.isNaN(end) && start < end };
}

export function buildAnalytics(attempts, { paperId, versionId, examCategory, grouping = "category", ruleSignature, dimension = "total", metric = "rate", sourceId = "all", from = "", to = "", asOf = Infinity } = {}) {
  const scoped = attempts.filter((attempt) => attempt && !attempt.isSample && attempt.createdAt <= asOf && (paperId ? attempt.paperId === paperId : !versionId || attempt.versionId === versionId || attempt.practiceVersionId === versionId));
  const allEntries = scoped.map(analyzeAttempt).filter(Boolean).sort((a, b) => compareAttemptOrder(a.attempt, b.attempt));
  // 两个标准卷型始终可选，零记录也不回跳；自定义格式只在确有记录时出现。
  const categoryMap = new Map(examCategories.map(category => [category.id, { ...category, count: 0, latestAt: 0 }]));
  for (const entry of allEntries) {
    const category = categoryMap.get(entry.examCategory.id) ?? { ...entry.examCategory, count: 0, latestAt: 0 };
    category.count++; category.latestAt = entry.attempt.createdAt; categoryMap.set(category.id, category);
  }
  const categories = [...categoryMap.values()];
  const categorized = grouping === "category" || Boolean(examCategory);
  const category = categorized ? (examCategory ? categories.find(item => item.id === examCategory) : [...categories].sort((a, b) => b.latestAt - a.latestAt)[0]) ?? null : null;
  const entries = categorized ? allEntries.filter(entry => entry.examCategory.id === category?.id) : allEntries;
  const map = new Map();
  // 只有同卷兼容计算生成签名组；成长模型不提供可被误当作整类标准的首份权重。
  for (const entry of categorized ? [] : entries) {
    const key = entry.rule.signature;
    if (!map.has(key)) map.set(key, { signature: key, rule: entry.rule, entries: [] });
    map.get(key).entries.push(entry);
  }
  const groups = [...map.values()].sort((a, b) => compareAttemptOrder(b.entries.at(-1).attempt, a.entries.at(-1).attempt) || compareText(a.signature, b.signature));
  const selected = groups.find((group) => group.signature === ruleSignature) ?? groups[0] ?? null;
  // 成长按卷型纳入全部记录，每条指标继续取自身快照；完整签名只服务同卷兼容对比与校验。
  const trendEntries = categorized ? entries : selected?.entries ?? [];
  const types = [...new Map(entries.flatMap((entry) => entry.types.map(({ key, name }) => [key, { key, name }]))).values()].sort((a, b) => compareText(a.key, b.key));
  const sourceMap = new Map();
  for (const entry of trendEntries) sourceMap.set(entry.sourceId, { id: entry.sourceId, title: entry.attempt.paperTitle, institution: entry.attempt.institution });
  const sources = [...sourceMap.values()].sort((a, b) => compareText(a.id, b.id));
  const bounds = analyticsDateBounds(from, to);
  const points = trendEntries.filter(({ attempt, sourceId: source }) => bounds.valid && (sourceId === "all" || source === sourceId) && attempt.createdAt >= bounds.start && attempt.createdAt < bounds.end).map((entry, index) => {
    const values = dimension === "total" ? entry.metrics : entry.types.find((type) => type.key === dimension);
    const value = values?.[metric];
    return { attempt: entry.attempt, ordinal: index + 1, metrics: values ?? null, value: finite(value) ? value : null, missingReason: !values ? "此卷未包含该题型" : !finite(value) ? "该指标未记录" : null };
  });
  return { categories, category, grouping: categorized ? "category" : "compatible", groups, selected, types, sources, points, bounds, rejected: scoped.filter((attempt) => !analyzeAttempt(attempt)).map((attempt) => ({ attempt, reason: describeScoringRule(attempt).reason ?? "成绩或提交时间不完整" })), dimension, metric };
}

export function paginateTrend(points, page = "latest", pageSize = 24) {
  const size = positiveInteger(pageSize) ? pageSize : 24;
  const pageCount = Math.max(1, Math.ceil(points.length / size));
  const selectedPage = page === "latest" ? pageCount - 1 : Math.max(0, Math.min(pageCount - 1, Number.isInteger(page) ? page : 0));
  const start = selectedPage * size;
  return { points: points.slice(start, start + size), page: selectedPage, pageCount, start, end: Math.min(points.length, start + size), total: points.length };
}

export function buildTrendGeometry(points, { width = 720, height = 240, metric = "rate" } = {}) {
  const left = 54, right = 24, top = 24, bottom = 42;
  const valid = points.filter((point) => finite(point.value));
  const ceiling = metric === "totalCents" ? Math.max(100, ...points.map((point) => point.metrics?.maxCents ?? point.value ?? 0)) : 1;
  const minTime = points[0]?.attempt.createdAt ?? 0;
  const maxTime = points.at(-1)?.attempt.createdAt ?? minTime;
  const x = (time) => left + (maxTime === minTime ? 0.5 : (time - minTime) / (maxTime - minTime)) * (width - left - right);
  const y = (value) => top + (1 - value / ceiling) * (height - top - bottom);
  const coordinates = points.map((point, index) => ({ ...point, index, x: x(point.attempt.createdAt), y: point.value === null ? null : y(point.value) }));
  const segments = [];
  let segment = [];
  for (const point of coordinates) {
    if (point.y === null) { if (segment.length) segments.push(segment); segment = []; }
    else segment.push(point);
  }
  if (segment.length) segments.push(segment);
  return { width, height, left, right, top, bottom, ceiling, coordinates, segments, validCount: valid.length, ticks: [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({ value: fraction * ceiling, y: y(fraction * ceiling) })) };
}
