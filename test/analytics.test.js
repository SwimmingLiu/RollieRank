import test from "node:test";
import assert from "node:assert/strict";
import { gradeVersion } from "../src/model.js";
import { IMPORTED_PAPERS } from "../src/data/imported-papers.js";
import { PAPERS } from "../src/data/papers.js";
import { catalogAttempt } from "./analytics-catalog-fixtures.mjs";
import {
  analyticsDateBounds,
  analyticsTypeKey,
  analyzeAttempt,
  buildAnalytics,
  buildTrendGeometry,
  compareAttempts,
  classifyExamCategory,
  describeScoringRule,
  paginateTrend,
  selectPreviousAttempt,
} from "../src/analytics.js";

function attempt({ id = "a", time = 1000, institution = "机构甲", paperId = "paper", versionId = "paper:v1", weights = [50, 100, 50, 100], names = ["言语理解", "言语理解", "数量关系", "数量关系"], answers = ["A", null, "B", "A"], scoringRule, ...rest } = {}) {
  const questions = weights.map((cents, i) => ({ number: i + 1, type: names[i], typeId: `type-${names[i]}`, cents, correctAnswer: "A" }));
  return { id, createdAt: time, paperId, versionId, paperTitle: `${institution}套卷`, institution, period: "一期", versionLabel: "1.0", answers, ...rest, report: gradeVersion({ questions, scoringRule }, answers), ...(scoringRule ? { scoringRule } : {}) };
}
const signature = (value) => describeScoringRule(value).signature;

// 产品按实际题量归卷型，覆盖带泛公考标题的当前题库；分类不修改任何一道题的分值。
test("current national and public-exam mocks classify130 as city and135 as provincial", () => {
  for (const paper of [...IMPORTED_PAPERS, ...PAPERS.map(paper => ({ ...paper, questionCount: paper.answerKey.length }))]) {
    if (![130, 135].includes(paper.questionCount)) continue;
    const category = classifyExamCategory(paper);
    assert.equal(category.id, paper.questionCount === 130 ? "guokao-city" : "guokao-subprovincial", paper.id);
    assert.equal(category.label, paper.questionCount === 130 ? "地市卷（130题）" : "副省卷（135题）");
  }
  assert.equal(classifyExamCategory({ project: "2027 公考 · 行测", questionCount: 130 }).id, "guokao-city");
  assert.equal(classifyExamCategory({ project: "2027 国考", variant: "副省级", questionCount: 130 }).id, "guokao-city");
  assert.notEqual(classifyExamCategory({ project: "省考", questionCount: 130, maxCents: 10000 }).id, "guokao-city");
});

test("city growth includes different real signatures while every point keeps its own score and denominator", () => {
  const flower = catalogAttempt({ paperId: "sihai-2026-h2-p2-city-01", id: "flower", createdAt: 1 });
  const fenbi = catalogAttempt({ paperId: "fenbi-2027-guokao-01", id: "fenbi", createdAt: 2 });
  const generic = catalogAttempt({ paperId: "chaoge-2027-01", id: "generic", createdAt: 3 });
  const province = catalogAttempt({ paperId: "sihai-2026-h2-p2-province-01", id: "province", createdAt: 4 });
  assert.notEqual(signature(flower), signature(fenbi));
  const records = [flower, fenbi, generic, province];
  const model = buildAnalytics(records, { examCategory: "guokao-city", ruleSignature: signature(flower) });
  assert.equal(model.selected, null);
  assert.deepEqual(model.groups, []);
  assert.deepEqual(model.points.map(point => point.attempt.id), ["flower", "fenbi", "generic"]);
  for (const point of model.points) {
    const own = records.find(record => record.id === point.attempt.id).report;
    assert.equal(point.metrics.totalCents, own.totalCents);
    assert.equal(point.metrics.maxCents, own.maxCents);
    assert.equal(point.value, own.rate);
  }
  const subject = buildAnalytics(records, { examCategory: "guokao-city", dimension: "name:政治理论" });
  for (const point of subject.points) {
    const rows = point.attempt.report.rows.filter(row => row.type === "政治理论");
    const expected = rows.reduce((sum, row) => sum + (row.rawCents ?? row.cents), 0) / rows.reduce((sum, row) => sum + (row.rawMaxCents ?? row.maxCents), 0);
    assert.ok(Math.abs(point.value - expected) < 1e-12);
  }
  assert.deepEqual(model.categories.map(category => [category.id, category.count]), [["guokao-city", 3], ["guokao-subprovincial", 1]]);
  assert.deepEqual(buildAnalytics(records, { examCategory: "guokao-subprovincial" }).points.map(point => point.attempt.id), ["province"]);
  const empty = buildAnalytics([flower], { examCategory: "guokao-subprovincial" });
  assert.equal(empty.category.id, "guokao-subprovincial");
  assert.equal(empty.points.length, 0);
  assert.equal(empty.categories.find(category => category.id === "guokao-subprovincial").count, 0);
});

test("rule identity is stable across row order, institution IDs, labels and answer revisions", () => {
  const a = attempt({ scoringRule: { kind: "publisher", id: "publisher-a", label: "机构甲分值", source: { sha256: "a" } } });
  const b = structuredClone(a);
  b.institution = "机构乙";
  b.paperId = "other-paper";
  b.report.rows.reverse();
  b.report.rows.forEach((row) => { row.typeId = `foreign-${row.type}`; row.correctAnswer = "D"; });
  b.report.scoringRule = { source: { sha256: "b" }, label: "不同来源", id: "publisher-b", kind: "publisher" };
  assert.equal(signature(a), signature(b));
  assert.deepEqual(describeScoringRule(a).types.map((type) => type.weights), [[{ cents: 50, count: 1 }, { cents: 100, count: 1 }], [{ cents: 50, count: 1 }, { cents: 100, count: 1 }]]);
});

test("equal full marks cannot hide different per-type weights, distributions, counts or grouping", () => {
  const base = attempt();
  for (const changed of [
    attempt({ weights: [75, 75, 50, 100] }),
    attempt({ weights: [100, 50, 50, 100] }),
    attempt({ weights: [50, 50, 100, 100] }),
    attempt({ names: ["言语理解", "数量关系", "数量关系", "数量关系"] }),
    attempt({ weights: [150, 150], names: ["言语理解", "数量关系"], answers: ["A", "A"] }),
  ]) {
    assert.equal(changed.report.maxCents, base.report.maxCents);
    assert.notEqual(signature(base), signature(changed));
  }
});

test("normalization compares original integer weights rather than rounded display scores", () => {
  const rule = { kind: "reference", normalizationMaxCents: 10000, rounding: "half-up-after-total" };
  const a = attempt({ weights: [1, 2, 3, 5], scoringRule: rule });
  const b = attempt({ weights: [2, 4, 6, 10], scoringRule: rule });
  assert.equal(a.report.maxCents, 10000);
  assert.equal(b.report.maxCents, 10000);
  assert.equal(a.report.rows[0].maxCents, b.report.rows[0].maxCents);
  assert.notEqual(signature(a), signature(b));
  assert.equal(describeScoringRule(a).rawMaxCents, 11);
  assert.equal(describeScoringRule(a).scale.mode, "normalized");
  assert.equal(analyzeAttempt(a).types.find((type) => type.name === "言语理解").rate, 1 / 3);
});

test("normalization, rounding and computational extensions are part of rule identity", () => {
  const base = attempt();
  const explicit = attempt({ scoringRule: { normalizationMaxCents: 10000 } });
  const differentRounding = structuredClone(explicit);
  differentRounding.report.scoringRule.rounding = "floor-after-total";
  assert.notEqual(signature(base), signature(explicit));
  assert.notEqual(signature(explicit), signature(differentRounding));
  const futureA = attempt({ scoringRule: { penalty: { incorrect: 25, blank: 0 } } });
  const futureB = attempt({ scoringRule: { penalty: { blank: 0, incorrect: 25 } } });
  const futureC = attempt({ scoringRule: { penalty: { incorrect: 0, blank: 0 } } });
  assert.equal(signature(futureA), signature(futureB));
  assert.notEqual(signature(futureA), signature(futureC));
});

test("contradictory or incomplete scoring evidence cannot enter a compatible group", () => {
  const base = attempt({ scoringRule: { normalizationMaxCents: 10000 } });
  const changes = [
    (a) => { delete a.report.rows[0].rawMaxCents; },
    (a) => { a.report.rows[1].question = a.report.rows[0].question; },
    (a) => { a.report.scoreScale.denominator++; },
    (a) => { a.report.rows[0].maxCents++; },
    (a) => { a.report.scoringRule.normalizationMaxCents = 300; },
    (a) => { a.report.rows[0].rawMaxCents = 0; },
    (a) => { a.report.rows[0].type = ""; a.report.rows[0].typeId = ""; },
  ];
  for (const change of changes) {
    const a = structuredClone(base);
    change(a);
    assert.equal(describeScoringRule(a).valid, false);
    assert.equal(signature(a), null);
    assert.equal(buildAnalytics([a]).groups.length, 0);
    assert.equal(buildAnalytics([a]).rejected.length, 1);
  }
});

test("full type names align across institutional codes, while distinct type names remain distinct", () => {
  assert.equal(analyticsTypeKey({ type: "  言语理解  ", typeId: "a" }), analyticsTypeKey({ type: "言语理解", typeId: "b" }));
  assert.notEqual(analyticsTypeKey({ type: "言语理解" }), analyticsTypeKey({ type: "言语理解与表达" }));
  assert.notEqual(analyticsTypeKey({ typeId: "type-1" }), analyticsTypeKey({ type: "type-1" }));
  const ambiguous = attempt();
  ambiguous.report.rows[1].typeId = "different-group-with-same-name";
  assert.equal(describeScoringRule(ambiguous).valid, false);
});

test("the previous practice is the latest compatible same-paper attempt strictly before the current one", () => {
  const current = attempt({ id: "current", time: 3000 });
  const previous = attempt({ id: "previous", time: 2000, versionId: "paper:v0" });
  const candidates = [
    attempt({ id: "future", time: 4000 }),
    attempt({ id: "same-time", time: 3000 }),
    attempt({ id: "different-rule", time: 2900, weights: [75, 75, 50, 100] }),
    attempt({ id: "different-paper", time: 2990, paperId: "other" }),
    attempt({ id: "sample", time: 2995, isSample: true }),
    previous, current, attempt({ id: "older", time: 1000 }),
  ];
  assert.equal(selectPreviousAttempt(current, candidates), previous);
  assert.equal(selectPreviousAttempt(current, candidates.reverse()), previous);
  assert.equal(compareAttempts(current, candidates.find((item) => item.id === "future")), null);
  assert.equal(compareAttempts(current, candidates.find((item) => item.id === "same-time")), null);
});

test("timestamp ties are retained and deterministically resolved without treating ties as previous", () => {
  const records = [attempt({ id: "z", time: 1000 }), attempt({ id: "a", time: 1000 }), attempt({ id: "m", time: 1000 })];
  const current = attempt({ id: "current", time: 2000 });
  assert.deepEqual(buildAnalytics(records).points.map((point) => point.attempt.id), ["a", "m", "z"]);
  assert.equal(selectPreviousAttempt(current, records).id, "z");
  assert.equal(selectPreviousAttempt(records[0], records), null);
});

test("comparison reports progress, decline, ties and per-type score and accuracy without invented timing", () => {
  const previous = attempt({ id: "old", answers: ["A", "A", "B", "B"] });
  const current = attempt({ id: "new", time: 2000, answers: ["A", "B", "A", "A"] });
  const comparison = compareAttempts(current, previous);
  assert.deepEqual(comparison.metrics.map((metric) => [metric.key, metric.direction]), [["totalCents", "up"], ["rate", "up"], ["accuracy", "up"]]);
  assert.equal(comparison.metrics[0].delta, 50);
  assert.ok(Math.abs(comparison.metrics[1].delta - 1 / 6) < 1e-10);
  assert.equal(comparison.metrics[2].delta, 0.25);
  assert.equal(comparison.types.find((type) => type.name === "言语理解").metrics[1].direction, "down");
  assert.equal(comparison.types.find((type) => type.name === "数量关系").metrics[1].direction, "up");
  const tied = attempt({ id: "tie", time: 3000, answers: current.answers });
  assert.ok(compareAttempts(tied, current).metrics.every((metric) => metric.direction === "same" && metric.delta === 0));
  assert.equal(Object.hasOwn(comparison, "duration"), false);
});

test("different rules and unrelated papers cannot produce a VS comparison", () => {
  const current = attempt({ time: 2000 });
  assert.equal(compareAttempts(current, attempt({ id: "old", paperId: "other" })), null);
  assert.equal(compareAttempts(current, attempt({ id: "old", weights: [75, 75, 50, 100] })), null);
});

test("default growth keeps unequal100-point rules together without a stale signature filter", () => {
  const rule = { normalizationMaxCents: 10000 };
  const a = attempt({ id: "a", paperId: "a-paper", scoringRule: rule });
  const b = attempt({ id: "b", time: 2000, institution: "机构乙", paperId: "b-paper", scoringRule: rule });
  const incompatible = attempt({ id: "c", time: 3000, weights: [75, 75, 50, 100], scoringRule: rule });
  const model = buildAnalytics([a, b, incompatible], { ruleSignature: signature(a) });
  assert.equal(model.groups.length, 0);
  assert.equal(model.selected, null);
  assert.deepEqual(model.points.map((point) => point.attempt.id), ["a", "b", "c"]);
  assert.equal(model.sources.length, 3);
  assert.equal(buildAnalytics([a, b, incompatible], { ruleSignature: signature(incompatible) }).points.length, 3);
});

test("type trends use each type's actual weighted score and keep missing types unavailable", () => {
  const a = attempt();
  const name = analyticsTypeKey({ type: "言语理解" });
  assert.equal(buildAnalytics([a], { dimension: name }).points[0].value, 1 / 3);
  assert.equal(buildAnalytics([a], { dimension: name, metric: "accuracy" }).points[0].value, 0.5);
  const missing = buildAnalytics([a], { dimension: "name:资料分析" });
  assert.equal(missing.points[0].value, null);
  assert.equal(missing.points[0].metrics, null);
  assert.equal(missing.points[0].missingReason, "此卷未包含该题型");
  assert.equal(buildTrendGeometry(missing.points).validCount, 0);
});

test("mixed-rule category growth keeps existing type values and gaps in the same history", () => {
  const a = attempt();
  const b = attempt({ id: "b", time: 2000, names: ["资料分析", "资料分析", "数量关系", "数量关系"] });
  const model = buildAnalytics([a, b], { dimension: "name:言语理解", ruleSignature: signature(b) });
  assert.equal(model.groups.length, 0);
  assert.ok(model.types.some((type) => type.name === "言语理解"));
  assert.equal(model.points[0].value, 1 / 3);
  assert.equal(model.points[1].value, null);
  assert.equal(model.points[1].missingReason, "此卷未包含该题型");
});

test("unrecorded correctness stays unavailable while actual scores remain visible", () => {
  const a = attempt();
  delete a.report.accuracy;
  a.report.rows.forEach((row) => { delete row.status; });
  const entry = analyzeAttempt(a);
  assert.equal(entry.metrics.totalCents, a.report.totalCents);
  assert.equal(entry.metrics.accuracy, null);
  assert.equal(entry.types[0].accuracy, null);
  assert.equal(buildAnalytics([a], { metric: "accuracy" }).points[0].value, null);
});

test("source and inclusive local-date filters preserve every actual attempt", () => {
  const time = new Date(2026, 10, 14, 0).getTime();
  const nextDay = new Date(2026, 10, 15, 0).getTime();
  const records = [attempt({ id: "before", time: time - 1 }), attempt({ id: "start", time }), attempt({ id: "late", time: nextDay - 1 }), attempt({ id: "after", time: nextDay }), attempt({ id: "other", time, paperId: "other" })];
  const model = buildAnalytics(records, { sourceId: "paper", from: "2026-11-14", to: "2026-11-14" });
  assert.deepEqual(model.points.map((point) => point.attempt.id), ["start", "late"]);
  assert.equal(analyticsDateBounds("2026-11-15", "2026-11-14").valid, false);
  assert.equal(analyticsDateBounds("2026-02-30", "").valid, false);
  assert.equal(buildAnalytics(records, { from: "invalid" }).points.length, 0);
});

test("same-paper scope can include compatible answer-revision versions and never includes future results", () => {
  const records = [attempt({ id: "v0", time: 1000, versionId: "paper:v0" }), attempt({ id: "v1", time: 2000 }), attempt({ id: "future", time: 3000 }), attempt({ id: "other", time: 1500, paperId: "other" })];
  assert.deepEqual(buildAnalytics(records, { paperId: "paper", asOf: 2000 }).points.map((point) => point.attempt.id), ["v0", "v1"]);
  assert.deepEqual(buildAnalytics(records, { versionId: "paper:v0" }).points.map((point) => point.attempt.id), ["v0"]);
});

test("zero, single and long histories paginate without dropping or duplicating records", () => {
  assert.equal(buildAnalytics([]).selected, null);
  const single = buildAnalytics([attempt()]);
  assert.equal(buildTrendGeometry(single.points).segments.length, 1);
  const records = Array.from({ length: 110 }, (_, i) => attempt({ id: `record-${String(i).padStart(3, "0")}`, time: 1000 + i }));
  const points = buildAnalytics(records).points;
  assert.equal(paginateTrend(points).page, 4);
  const all = [];
  for (let page = 0; page < 5; page++) all.push(...paginateTrend(points, page).points.map((point) => point.attempt.id));
  assert.deepEqual(all, points.map((point) => point.attempt.id));
  assert.equal(paginateTrend(points, 999).page, 4);
  assert.equal(paginateTrend(points, -2).page, 0);
});

test("chart x coordinates use elapsed timestamps, retain tied timestamps and break at missing data", () => {
  const points = buildAnalytics([attempt({ id: "a", time: 1000 }), attempt({ id: "b", time: 2000 }), attempt({ id: "c", time: 11000 }), attempt({ id: "d", time: 11000 })]).points;
  const geometry = buildTrendGeometry(points);
  const [a, b, c, d] = geometry.coordinates;
  assert.ok(Math.abs((b.x - a.x) / (c.x - a.x) - 0.1) < 1e-10);
  assert.equal(c.x, d.x);
  points[1].value = null;
  assert.deepEqual(buildTrendGeometry(points).segments.map((segment) => segment.length), [1, 2]);
});

test("analysis and VS reread updated reports after a correction with no separate score cache", () => {
  const a = attempt({ id: "a", answers: ["B", "B", "B", "B"] });
  const b = attempt({ id: "b", time: 2000 });
  const records = [a, b];
  const priorSignature = signature(a);
  assert.equal(buildAnalytics(records).points[0].value, 0);
  const corrected = attempt({ id: "a", answers: ["A", "A", "A", "A"] });
  records[0] = corrected;
  assert.equal(signature(corrected), priorSignature);
  assert.equal(buildAnalytics(records).points[0].value, 1);
  assert.equal(compareAttempts(b, selectPreviousAttempt(b, records)).metrics[0].direction, "down");
});

test("real imported diagnostics retain full signatures while city growth includes every130-question record", () => {
  const records = IMPORTED_PAPERS.map((paper, i) => {
    const questions = Array.from({ length: paper.questionCount }, (_, index) => {
      const section = paper.sections.find((item) => index + 1 >= item.start && index + 1 <= item.end);
      return { number: index + 1, type: section.name, typeId: section.id, cents: section.cents, correctAnswer: paper.answerKey[index] };
    });
    return { id: paper.id, paperId: paper.id, versionId: `${paper.id}:v1`, institution: paper.institution, createdAt: i + 1, report: gradeVersion({ questions, scoringRule: paper.scoringRule }, Array(paper.questionCount).fill("A")) };
  });
  const analysis = buildAnalytics(records, { grouping: "compatible" });
  assert.equal(analysis.rejected.length, 0);
  assert.ok(analysis.groups.some((group) => new Set(group.entries.map((entry) => entry.attempt.institution)).size > 1));
  assert.ok(analysis.groups.length > 2);
  assert.equal(analysis.groups.reduce((sum, group) => sum + group.entries.length, 0), records.length);
  const city = buildAnalytics(records, { examCategory: "guokao-city" });
  assert.equal(city.points.length, records.filter(record => record.report.rows.length === 130).length);
  assert.ok(city.points.every(point => point.value === point.attempt.report.rate));
});
