import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import { once } from "node:events";
import { IMPORTED_PAPERS } from "../src/data/imported-papers.js";
import { PAPERS } from "../src/data/papers.js";
import { gradeVersion, publicVersion, validateQuestions } from "../src/model.js";
import { initialState, loadState, recordAttempt, saveState } from "../src/prototype-state.js";
import { reportView } from "../src/views-practice.js";
import { createApi } from "../server/api.mjs";
import { demoEntries } from "../src/leaderboard.js";

function versionOf(paper) {
  return {
    id: `${paper.id}:v1`, paperId: paper.id, title: paper.title,
    institution: paper.institution, project: paper.project, period: paper.period,
    variant: paper.variant, versionLabel: "1.0", status: "published",
    scoringRule: paper.scoringRule,
    questions: [...paper.answerKey].map((correctAnswer, i) => {
      const section = paper.sections.find((s) => i + 1 >= s.start && i + 1 <= s.end);
      return { number: i + 1, type: section.name, typeId: section.id,
        correctAnswer, cents: section.cents };
    }),
  };
}

test("new source-linked catalog keeps all 62 paper identities and separates 450 appendix answers", () => {
  assert.equal(IMPORTED_PAPERS.length, 50);
  assert.equal(new Set([...PAPERS, ...IMPORTED_PAPERS].map((p) => p.id)).size, 62);
  assert.equal(IMPORTED_PAPERS.reduce((n, p) => n + p.answerKey.length, 1560), 8095);
  assert.equal(IMPORTED_PAPERS.flatMap((p) => p.supplements).reduce((n, s) => n + s.answerKey.length, 0), 450);
  assert.deepEqual(IMPORTED_PAPERS.filter((p) => p.institution === "超格").map((p) => p.questionCount),
    [130, 130, 130, 130, 130, 130, 120, 120, 120, 120]);
  assert.deepEqual(IMPORTED_PAPERS.filter((p) => p.institution === "上岸村").map((p) => p.questionCount),
    [130, 130, 135, 135, 135, 130, 130, 130, 130, 130]);
  for (const paper of IMPORTED_PAPERS) {
    assert.match(paper.answerKey, new RegExp(`^[ABCD]{${paper.questionCount}}$`));
    assert.match(paper.sources.answers.sha256, /^[a-f0-9]{64}$/);
    assert.match(paper.sources.booklet.sha256, /^[a-f0-9]{64}$/);
    validateQuestions(versionOf(paper).questions);
  }
});

test("guokao 130-question city and 135-question province papers use exact 100-point classic weights without normalization", () => {
  const city = versionOf(IMPORTED_PAPERS.find((p) => p.id === "sihai-2026-h2-p2-city-01"));
  const province = versionOf(IMPORTED_PAPERS.find((p) => p.id === "sihai-2026-h2-p2-province-01"));
  const chaoge = versionOf(IMPORTED_PAPERS.find((p) => p.id === "chaoge-2027-02"));
  assert.equal(city.questions.length, 130);
  assert.equal(province.questions.length, 135);
  assert.equal(city.questions[95].type, "类比推理");
  assert.equal(city.questions[95].cents, 80);
  assert.equal(city.questions[100].type, "逻辑判断");
  assert.equal(city.questions[100].cents, 85);
  assert.equal(chaoge.questions[100].type, "逻辑判断");
  assert.equal(chaoge.questions[100].cents, 85);
  assert.equal(province.questions[65].cents, 80);
  assert.equal(province.questions[80].type, "图形推理");
  assert.equal(province.questions[95].type, "定义判断");
  assert.equal(province.questions[95].cents, 80);
  assert.equal(province.questions[100].type, "类比推理");
  assert.equal(province.questions[100].cents, 50);
  for (const paper of IMPORTED_PAPERS) {
    const v = versionOf(paper);
    assert.equal(v.scoringRule.kind, "reference", paper.id);
    assert.equal(v.scoringRule.normalizationMaxCents, undefined, paper.id);
    assert.equal(v.questions.reduce((n, q) => n + q.cents, 0), 10000, paper.id);
    const report = gradeVersion(v, [...paper.answerKey]);
    assert.equal(report.scoreScale, undefined, paper.id);
  }
});

test("every imported paper grades full, wrong and blank submissions with its own question count", () => {
  for (const paper of IMPORTED_PAPERS) {
    const version = versionOf(paper);
    const perfect = gradeVersion(version, [...paper.answerKey]);
    assert.equal(perfect.totalCents, 10000, paper.id);
    assert.equal(perfect.correct, paper.questionCount, paper.id);
    assert.equal(gradeVersion(version, Array(paper.questionCount).fill(null)).totalCents, 0);
    const wrong = [...paper.answerKey].map((a) => a === "A" ? "B" : "A");
    assert.equal(gradeVersion(version, wrong).totalCents, 0);
  }
});

test("reference scores round once and retain the exact same result after storage restoration", () => {
  const version = {
    id: "reference-precision:v1", paperId: "reference-precision", title: "折算测试卷",
    institution: "测试", project: "测试", period: "一期", variant: "测试", versionLabel: "1.0",
    scoringRule: { kind: "reference", label: "平台国考参考估分", normalizationMaxCents: 10000 },
    questions: [50, 80, 100].map((cents, i) => ({ number: i + 1, type: "测试",
      typeId: "test", cents, correctAnswer: "A" })),
  };
  const answers = ["A", "A", null];
  const report = gradeVersion(version, answers);
  assert.equal(report.totalCents, 5652);
  assert.equal(report.maxCents, 10000);
  assert.equal(report.rows[0].rawMaxCents, 50);
  const attempt = { id: "reference-attempt-123", versionId: version.id, paperId: version.paperId,
    paperTitle: version.title, institution: version.institution, project: version.project,
    period: version.period, variant: version.variant, versionLabel: version.versionLabel,
    createdAt: 123456789, answers, report, scoringRule: version.scoringRule };
  const storage = new Map();
  const adapter = { getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value) };
  const state = initialState();
  recordAttempt(state, attempt);
  saveState(adapter, state);
  const restored = loadState(adapter, [publicVersion(version)]);
  assert.equal(restored.warning, false);
  assert.equal(restored.state.attempts[0].report.totalCents, 5652);
  assert.deepEqual(restored.state.attempts[0].report, report);
  const html = reportView({ attempt, state: { attempts: [attempt] } });
  assert.ok(html.includes("平台国考参考估分"));
  assert.ok(html.includes("56.52"));
});

test("reference demonstration scores use the same attainable rounded totals as submitted papers", () => {
  const version = { id: "reference-demo:v1", scoringRule: { normalizationMaxCents: 10000 },
    questions: Array.from({ length: 3 }, (_, i) => ({ number: i + 1, typeId: "test",
      type: "测试", cents: 100, correctAnswer: "A" })) };
  const attainable = new Set([gradeVersion(version, ["A", "A", null]).totalCents,
    gradeVersion(version, ["A", "A", "A"]).totalCents]);
  for (const demo of demoEntries(version)) assert.ok(attainable.has(demo.totalCents));
});

test("upgrading an existing catalog adds new papers without changing past versions, receipts or audit", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-catalog-upgrade-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "catalog.json");
  const prior = { versions: [{ id: "custom-old:v1", title: "保留原卷", status: "offline" }],
    receipts: { "guest:attempt": { id: "old-attempt", report: { totalCents: 7250 } } },
    audit: [{ id: "old-audit", action: "下线套卷" }] };
  await writeFile(path, JSON.stringify(prior));
  const dataDirectory = pathToFileURL(directory + "/");
  await createApi({ dataDirectory });
  const upgraded = JSON.parse(await readFile(path));
  assert.deepEqual(upgraded.versions[0], prior.versions[0]);
  assert.deepEqual(upgraded.receipts, prior.receipts);
  assert.deepEqual(upgraded.audit, prior.audit);
  assert.equal(upgraded.versions.length, 63);
  await createApi({ dataDirectory });
  assert.deepEqual(JSON.parse(await readFile(path)), upgraded);
});

test("catalog and submit API expose all new paper types without leaking keys and allow partial submissions", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-import-api-"));
  const api = await createApi({ dataDirectory: pathToFileURL(directory + "/") });
  const server = createServer((req, res) => api(req, res, new URL(req.url, "http://localhost").pathname));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); server.close();
    await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const catalog = await (await fetch(base + "catalog")).json();
  assert.equal(catalog.versions.length, 62);
  const text = JSON.stringify(catalog);
  assert.equal(text.includes("correctAnswer"), false);
  assert.equal(text.includes("answerKey"), false);
  assert.equal(text.includes("supplements"), false);
  for (const id of ["chaoge-2027-07", "shangancun-2027-03", "sihai-2026-h2-p2-province-01"]) {
    const paper = IMPORTED_PAPERS.find((p) => p.id === id);
    const response = await fetch(base + "submit", { method: "POST",
      body: JSON.stringify({ versionId: `${id}:v1`, guestId: "guest-import-123456789",
        attemptId: `attempt-${id}`, answers: [...paper.answerKey].map((a, i) => i % 2 ? null : a) }) });
    assert.equal(response.status, 200);
    const attempt = await response.json();
    assert.equal(attempt.report.maxCents, 10000);
    assert.equal(attempt.report.blank, Math.floor(paper.questionCount / 2));
    assert.ok(attempt.report.totalCents > 0 && attempt.report.totalCents < 10000);
  }
  const referenceId = "chaoge-2027-07:v1";
  for (const status of ["offline", "published"]) {
    const response = await fetch(base + "admin/status", { method: "POST",
      body: JSON.stringify({ versionId: referenceId, status }) });
    assert.equal(response.status, 200, await response.text());
  }
  const prior = catalog.versions.find((v) => v.id === referenceId);
  const csv = "题号,题型,答案,分值\n" + prior.questions.map((q) =>
    `${q.number},${q.type},A,${q.cents / 100}`).join("\n");
  const revisionResponse = await fetch(base + "admin/import", { method: "POST",
    body: JSON.stringify({ ...prior, revisionOf: referenceId, csv }) });
  assert.equal(revisionResponse.status, 200);
  const revision = await revisionResponse.json();
  assert.equal(revision.maxCents, 10000);
  assert.equal(revision.scoringRule.kind, "reference");
});
