import test from "node:test";
import assert from "node:assert/strict";
import {
  parseQuestionCsv,
  gradeVersion,
  publicVersion,
  resultCsv,
} from "../src/model.js";
import { parseAnswers } from "../src/answers.js";

const csv =
  "题号,题型,答案,分值\n1,政治,A,0.5\n2,言语,B,0.8\n3,逻辑,C,0.85\n4,资料,D,1.2";
const version = () => ({
  id: "test:v1",
  title: "测试卷",
  questions: parseQuestionCsv(csv),
});

test("variable-length paper preserves fixed decimal scoring and separates accuracy from score rate", () => {
  const v = version();
  const report = gradeVersion(v, ["A", null, "C", "A"]);
  assert.equal(report.totalCents, 135);
  assert.equal(report.maxCents, 335);
  assert.equal(report.correct, 2);
  assert.equal(report.wrong, 1);
  assert.equal(report.blank, 1);
  assert.equal(report.accuracy, 0.5);
  assert.equal(report.rate, 135 / 335);
  assert.equal(gradeVersion(v, ["A", "B", "C", "D"]).totalCents, 335);
  assert.equal(gradeVersion(v, ["B", "C", "D", "A"]).totalCents, 0);
  assert.equal(gradeVersion(v, [null, null, null, null]).totalCents, 0);
});

test("CSV import rejects the whole paper for duplicate, missing, invalid or over-precision rows", () => {
  for (const input of [
    csv.replace("2,言语", "1,言语"),
    csv.replace("2,言语", "3,言语"),
    csv.replace("C,0.85", "E,0.85"),
    csv.replace("C,0.85", "C,0.851"),
    csv.replace("D,1.2", "D,0"),
    csv.replace("4,资料,D,1.2", "4,资料,D,1.2,其他"),
  ])
    assert.throws(() => parseQuestionCsv(input));
});

test("published catalog does not disclose standard answers or mutate the grading source", () => {
  const source = version();
  const catalog = publicVersion(source);
  assert.equal(catalog.questionCount, 4);
  assert.equal(catalog.maxCents, 335);
  assert.equal(JSON.stringify(catalog).includes("correctAnswer"), false);
  assert.equal(source.questions[0].correctAnswer, "A");
});

test("bulk input observes the actual paper length in both short and long papers", () => {
  assert.throws(() => parseAnswers("ABCDAB", 1, 4), /超出/);
  assert.throws(() => parseAnswers("5.A", 1, 4), /超出/);
  assert.equal(parseAnswers("299.A 300.B", 1, 300).at(-1).question, 300);
  assert.throws(() => parseAnswers("301.A", 1, 300), /超出/);
});

test("CSV export uses the submitted version and includes blanks and correct references", () => {
  const v = version();
  const text = resultCsv({
    paperTitle: "混合测试",
    versionLabel: "2.0",
    report: gradeVersion(v, ["A", null, "D", "D"]),
  });
  assert.ok(text.startsWith("\uFEFF"));
  assert.equal(text.split("\r\n").length, 5);
  assert.ok(text.includes('"混合测试","2.0","2"'));
  assert.ok(text.includes('"未答"'));
});
