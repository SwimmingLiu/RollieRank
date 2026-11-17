import test from "node:test";
import assert from "node:assert/strict";
import { gradeVersion, resultCsv } from "../src/model.js";
import { analyzeAttempt, compareAttempts, describeScoringRule } from "../src/analytics.js";
import { subjectAttempt, subjectBreakdown, subjectDimensions, subjectVersion, subjectResponse } from "../src/subjects.js";

const questions = ["图形推理", "定义判断", "类比推理", "逻辑判断"].map((type, index) => ({
  number: index + 1, typeId: `original-${index}`, type, cents: [100, 300, 50, 150][index], correctAnswer: "A",
}));
const version = { id: "subject-test:v1", questions };
const attempt = (id, answers, createdAt = 1000) => ({ id, createdAt, paperId: "subject-test", versionId: version.id,
  answers, report: gradeVersion(version, answers) });

test("all four judgment types share one subject without changing original questions, weights or scores", () => {
  const original = structuredClone(version);
  const graded = attempt("first", ["A", "B", "A", null]);
  const view = subjectAttempt(graded);
  assert.deepEqual(subjectDimensions(questions), [{ id: "judgment", name: "判断推理" }]);
  assert.deepEqual(view.report.breakdown, [{ id: "judgment", name: "判断推理", count: 4, correct: 2, answered: 3, centsEarned: 150, maxCents: 600 }]);
  assert.equal(view.report.totalCents, 150);
  assert.equal(view.report.rate, .25);
  assert.equal(view.report.accuracy, .5);
  assert.deepEqual(view.answers, graded.answers);
  assert.ok(view.report.rows.every(row => row.type === "判断推理" && row.typeId === "judgment"));
  assert.deepEqual(subjectVersion(version).questions.map(q => q.cents), [100, 300, 50, 150]);
  assert.equal(graded.report.breakdown.length, 4);
  assert.deepEqual(version, original);
});

test("old raw-type and current grouped snapshots remain compatible and calculate a weighted full-subject trend", () => {
  const raw = attempt("first", ["A", "B", "A", null]);
  const current = subjectAttempt(attempt("second", ["B", "A", "B", null], 2000));
  const first = analyzeAttempt(raw), second = analyzeAttempt(current);
  assert.equal(first.rule.signature, second.rule.signature);
  assert.equal(first.types.length, 1);
  assert.equal(first.types[0].name, "判断推理");
  assert.equal(first.types[0].rate, .25);
  assert.equal(second.types[0].rate, .5);
  const comparison = compareAttempts(current, raw);
  assert.equal(comparison.types.length, 1);
  assert.equal(comparison.types[0].after.correct, 1);
  assert.equal(comparison.types[0].metrics.find(metric => metric.key === "rate").delta, .25);
  const changed = { ...raw, report: gradeVersion({ questions: questions.map((q, i) => ({ ...q, cents: [300, 100, 50, 150][i] })) }, raw.answers) };
  assert.notEqual(describeScoringRule(changed).signature, first.rule.signature, "equal subject full marks must not hide different per-question weights");
});

test("already grouped and split judgment parts combine once, while unrelated custom subjects stay separate", () => {
  const parts = [
    { id: "grouped", name: "判断推理", count: 1, correct: 1, answered: 1, centsEarned: 50, maxCents: 50 },
    { id: "sub", name: "逻辑判断", count: 1, correct: 0, answered: 1, centsEarned: 0, maxCents: 150 },
    { id: "custom", name: "自定义判断", count: 1, correct: 1, answered: 1, centsEarned: 100, maxCents: 100 },
  ];
  const grouped = subjectBreakdown(parts);
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped[0], { id: "judgment", name: "判断推理", count: 2, correct: 1, answered: 2, centsEarned: 50, maxCents: 200 });
  assert.deepEqual(grouped[1], parts[2]);
});

test("user-facing exported rows use the same subject names and retain exact option and score values", () => {
  const current = subjectAttempt(attempt("export", ["A", "B", "A", null]));
  const csv = resultCsv(current);
  assert.equal(csv.split("判断推理").length - 1, 4);
  assert.ok(!csv.includes("图形推理") && !csv.includes("逻辑判断"));
  assert.equal(csv.split("\r\n").length, 5);
  assert.ok(csv.includes('"1","1"'));
});

test("review version metadata passes through without requiring unpublished question data", () => {
  const metadata = { id: version.id, title: "审核版本", pendingCount: 1 };
  const response = subjectResponse({ versions: [metadata] });
  assert.deepEqual(response.versions, [metadata]);
});

test("normalized judgment totals are computed once from original weights, including legacy snapshots without rawCents", () => {
  const paper = { questions, scoringRule: { kind: "reference", normalizationMaxCents: 10000 } };
  const raw = { report: gradeVersion(paper, ["A", "B", "A", null]) };
  const grouped = subjectAttempt(raw).report.breakdown[0];
  assert.equal(grouped.centsEarned, 150 * 10000 / 600);
  assert.equal(grouped.maxCents, 10000);
  for (const row of raw.report.rows) delete row.rawCents;
  assert.equal(subjectAttempt(raw).report.breakdown[0].centsEarned, 2500);
});
