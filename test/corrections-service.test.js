import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCorrectionsService } from "../server/corrections.mjs";
import { gradeVersion } from "../src/model.js";

const guest = "candidate-00000001";
const other = "candidate-00000002";
const token = "isolated-test-maintainer-credential";
const makeVersion = (id = "paper:v1", reference = false) => ({
  id, title: "行为测试卷", paperId: "paper", versionLabel: "1.0", status: "published",
  ...(reference ? { scoringRule: { kind: "reference", normalizationMaxCents: 10000 } } : {}),
  questions: ["A", "B", "C", "D"].map((correctAnswer, index) => ({ number: index + 1,
    correctAnswer, typeId: index < 2 ? "verbal" : "logic", type: index < 2 ? "言语" : "逻辑", cents: [50, 80, 85, 120][index] })),
});

async function fixture(t, { reference = false, seed = null } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-corrections-"));
  let store = seed ?? { versions: [makeVersion("paper:v1", reference), makeVersion("other:v1")], receipts: {}, audit: [], features: { discussions: { untouched: true } } };
  let queue = Promise.resolve();
  let failNext = false;
  let beforePersist = null;
  let writes = 0;
  const mutateCatalog = (operation) => {
    const task = queue.catch(() => {}).then(async () => {
      const before = structuredClone(store);
      try {
        const result = operation(store);
        assert.equal(result instanceof Promise, false, "catalog callbacks stay synchronous");
        if (beforePersist) await beforePersist();
        if (failNext) {
          failNext = false;
          throw Object.assign(new Error("simulated storage failure"), { code: "ENOSPC" });
        }
        await writeFile(join(directory, "catalog.tmp"), JSON.stringify(store));
        await rename(join(directory, "catalog.tmp"), join(directory, "catalog.json"));
        writes++;
        return result;
      } catch (error) {
        store = before;
        throw error;
      }
    });
    queue = task;
    return task;
  };
  const service = createCorrectionsService({ readCatalog: () => store, mutateCatalog, dataDirectory: directory });
  const request = async (path, input, method = input ? "POST" : "GET") => {
    let output;
    const handled = await service({ pathname: `/api/corrections/${path}`, method, input,
      send: (status, data) => { output = { status, data }; } });
    return handled ? output.data : false;
  };
  // 公共提交和同步的契约驱动夹具；公共路由的接线验证由协调任务负责。
  const submitAttempt = (guestId, attemptId, answers, versionId = "paper:v1") => mutateCatalog((state) => {
    const version = state.versions.find((item) => item.id === versionId);
    const attempt = { id: attemptId, versionId, paperTitle: version.title, versionLabel: version.versionLabel,
      answers: [...answers], report: gradeVersion(version, answers), createdAt: 1794600000000,
      answerRevision: version.answerRevision ?? 0, isSample: false, participate: true };
    state.receipts[`${guestId}:${attemptId}`] = attempt;
    return structuredClone(attempt);
  });
  const sync = async (guestId) => {
    await queue.catch(() => {});
    return structuredClone(Object.entries(store.receipts).filter(([key]) => key.startsWith(`${guestId}:`)).map(([, value]) => value));
  };
  t.after(async () => { await queue.catch(() => {}); await rm(directory, { recursive: true, force: true }); });
  return { request, submitAttempt, sync, read: () => structuredClone(store),
    persisted: async () => JSON.parse(await readFile(join(directory, "catalog.json"), "utf8")),
    fail: () => { failNext = true; }, beforePersist: (callback) => { beforePersist = callback; }, writes: () => writes };
}

const feedbackInput = (suffix = "001", changes = [
  { question: 1, suggestedAnswer: "B", evidence: "题本第 1 页的条件与选项 B 相符。" },
  { question: 2, suggestedAnswer: "A", evidence: "参考解析第 2 页列出的结论为 A。" },
]) => ({ guestId: guest, attemptId: "attempt-00000001", feedbackId: `feedback-00000${suffix}`, baseRevision: 0, changes });
const reviewInput = (feedbackId, extra = {}) => ({ reviewToken: token, reviewId: "review-000000001", feedbackId,
  questionNumbers: [1, 2], decision: "approve", reason: "按原题及参考解析逐题核对后订正。", expectedRevision: 0, ...extra });
const rejects = (operation, statusCode) => assert.rejects(operation, (error) => error.statusCode === statusCode);

test("feedback persists, retries safely, stays private and never changes official grades", async (t) => {
  const f = await fixture(t);
  const original = await f.submitAttempt(guest, "attempt-00000001", ["B", "A", "C", null]);
  await f.submitAttempt(other, "attempt-00000002", ["A", "B", "C", "D"]);
  const input = feedbackInput();
  const result = await f.request("submit", input);
  assert.equal(result.feedback.status, "pending");
  assert.equal(result.feedback.items.length, 2);
  assert.equal("guestId" in result.feedback, false);
  assert.deepEqual((await f.persisted()).features.corrections.feedbacks[0].items, f.read().features.corrections.feedbacks[0].items);
  assert.deepEqual(f.read().receipts[`${guest}:${original.id}`], original);
  assert.equal(f.read().versions[0].questions[0].correctAnswer, "A");
  assert.equal((await f.request("submit", input)).replayed, true);
  assert.equal(f.read().features.corrections.feedbacks.length, 1);
  await rejects(f.request("submit", { ...input, changes: [{ ...input.changes[0], evidence: "不同的核对依据" }] }), 409);
  const preview = await f.request("preview", { guestId: guest, feedbackId: input.feedbackId });
  assert.equal(preview.hypothetical, true);
  assert.equal(preview.official.totalCents, 85);
  assert.equal(preview.projected.totalCents, 215);
  assert.equal(preview.deltaCents, 130);
  assert.deepEqual((await f.sync(guest))[0], original);
  assert.equal((await f.request("list", { guestId: other })).feedbacks.length, 0);
  await rejects(f.request("preview", { guestId: other, feedbackId: input.feedbackId }), 404);
  const restored = await fixture(t, { seed: await f.persisted() });
  assert.equal((await restored.request("list", { guestId: guest })).feedbacks[0].id, input.feedbackId);
  assert.deepEqual((await f.request("summary")), { pendingCount: 1, pendingQuestionCount: 2, reviewEnabled: Boolean(process.env.ROLLIERANK_REVIEW_TOKEN?.trim()) });
});

test("credentials are required for admin/review, including when deployment is unconfigured", async (t) => {
  const f = await fixture(t);
  await f.submitAttempt(guest, "attempt-00000001", ["B", "A", "C", null]);
  const feedback = (await f.request("submit", feedbackInput())).feedback;
  const before = f.read();
  const oldToken = process.env.ROLLIERANK_REVIEW_TOKEN;
  t.after(() => { if (oldToken === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = oldToken; });
  delete process.env.ROLLIERANK_REVIEW_TOKEN;
  await rejects(f.request("review", reviewInput(feedback.id)), 403);
  await rejects(f.request("admin", { reviewToken: token }), 403);
  process.env.ROLLIERANK_REVIEW_TOKEN = token;
  await rejects(f.request("review", { ...reviewInput(feedback.id), reviewToken: "wrong" }), 403);
  await rejects(f.request("admin", {}), 403);
  assert.deepEqual(f.read(), before);
  const admin = await f.request("admin", { reviewToken: token });
  assert.equal(admin.pendingCount, 1);
  assert.equal(JSON.stringify(admin).includes(token), false);
});

test("batch approval recalculates all same-version receipts, preserves original submissions and notifies owners", async (t) => {
  const oldToken = process.env.ROLLIERANK_REVIEW_TOKEN;
  process.env.ROLLIERANK_REVIEW_TOKEN = token;
  t.after(() => { if (oldToken === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = oldToken; });
  const f = await fixture(t, { reference: true });
  const first = await f.submitAttempt(guest, "attempt-00000001", ["B", "A", "C", null]);
  const second = await f.submitAttempt(other, "attempt-00000002", ["A", "B", "C", "D"]);
  const untouched = await f.submitAttempt(other, "attempt-00000003", ["A", "B", "C", "D"], "other:v1");
  const feedback = (await f.request("submit", feedbackInput())).feedback;
  const input = reviewInput(feedback.id);
  const result = await f.request("review", input);
  assert.equal(result.feedback.status, "approved");
  assert.equal(result.review.affectedAttempts, 2);
  const store = f.read();
  assert.equal(store.versions[0].answerRevision, 1);
  assert.deepEqual(store.versions[0].questions.map((q) => q.correctAnswer), ["B", "A", "C", "D"]);
  for (const [person, before] of [[guest, first], [other, second]]) {
    const receipt = store.receipts[`${person}:${before.id}`];
    assert.deepEqual(receipt.answers, before.answers);
    assert.equal(receipt.createdAt, before.createdAt);
    assert.equal(receipt.participate, true);
    assert.deepEqual(receipt.report, gradeVersion(store.versions[0], before.answers));
    assert.equal(receipt.answerRevision, 1);
    assert.equal(receipt.correctionHistory.length, 1);
    const notices = (await f.request("list", { guestId: person })).notifications;
    assert.equal(notices.length, 1);
    assert.equal(notices[0].attemptId, before.id);
    assert.equal(notices[0].before.totalCents, before.report.totalCents);
    assert.equal(notices[0].after.totalCents, receipt.report.totalCents);
    assert.equal(JSON.stringify(notices).includes("receiptKey"), false);
  }
  assert.deepEqual(store.receipts[`${other}:${untouched.id}`], untouched);
  assert.deepEqual(store.features.discussions, { untouched: true });
  assert.equal(store.audit.length, 1);
  assert.equal(JSON.stringify(store).includes(token), false);
  assert.deepEqual(await f.persisted(), store);
  const sync = await f.sync(guest);
  assert.equal(sync[0].report.totalCents, gradeVersion(store.versions[0], first.answers).totalCents);
  assert.notEqual(sync[0].report.totalCents, first.report.totalCents);
  const future = await f.submitAttempt(guest, "attempt-00000004", ["B", "A", "C", "D"]);
  assert.equal(future.report.totalCents, 10000);
  assert.equal(future.answerRevision, 1);
  assert.equal((await f.request("review", input)).replayed, true);
  assert.equal(f.read().features.corrections.revisions.length, 1);
  assert.equal(f.read().receipts[`${guest}:${first.id}`].correctionHistory.length, 1);
  await rejects(f.request("review", { ...input, reviewId: "review-000000002" }), 409);
  await rejects(f.request("review", { ...input, decision: "reject" }), 409);
  await rejects(f.request("preview", { guestId: guest, feedbackId: feedback.id }), 409);
});

test("rejection supports selected questions and records reasons without changing answers or scores", async (t) => {
  const oldToken = process.env.ROLLIERANK_REVIEW_TOKEN;
  process.env.ROLLIERANK_REVIEW_TOKEN = token;
  t.after(() => { if (oldToken === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = oldToken; });
  const f = await fixture(t);
  await f.submitAttempt(guest, "attempt-00000001", ["B", "A", "C", null]);
  const feedback = (await f.request("submit", feedbackInput())).feedback;
  const before = f.read();
  const result = await f.request("review", reviewInput(feedback.id, { questionNumbers: [1], decision: "reject", reason: "核对后原参考答案成立。" }));
  assert.equal(result.feedback.status, "partial");
  assert.equal(result.feedback.items[0].reason, "核对后原参考答案成立。");
  assert.equal(result.review.affectedAttempts, 0);
  assert.deepEqual(f.read().versions, before.versions);
  assert.deepEqual(f.read().receipts, before.receipts);
  assert.equal((await f.request("summary")).pendingQuestionCount, 1);
  await f.request("review", reviewInput(feedback.id, { questionNumbers: [2], reviewId: "review-000000002", expectedRevision: 0 }));
  assert.equal((await f.request("list", { guestId: guest })).feedbacks[0].status, "mixed");
});

test("concurrent approvals serialize, reject obsolete bases, and allow unrelated pending questions", async (t) => {
  const oldToken = process.env.ROLLIERANK_REVIEW_TOKEN;
  process.env.ROLLIERANK_REVIEW_TOKEN = token;
  t.after(() => { if (oldToken === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = oldToken; });
  const f = await fixture(t);
  await f.submitAttempt(guest, "attempt-00000001", ["B", "A", "C", null]);
  const first = (await f.request("submit", feedbackInput())).feedback;
  const competing = (await f.request("submit", feedbackInput("002"))).feedback;
  const calls = await Promise.allSettled([
    f.request("review", reviewInput(first.id, { questionNumbers: [1] })),
    f.request("review", reviewInput(competing.id, { reviewId: "review-000000002", questionNumbers: [1] })),
  ]);
  assert.equal(calls.filter((call) => call.status === "fulfilled").length, 1);
  assert.equal(calls.find((call) => call.status === "rejected").reason.statusCode, 409);
  const listed = (await f.request("list", { guestId: guest })).feedbacks.find((feedback) => feedback.id === competing.id);
  assert.equal(listed.items[0].stale, true);
  await rejects(f.request("review", reviewInput(competing.id, { reviewId: "review-000000003", questionNumbers: [1], expectedRevision: 1 })), 409);
  // 第二题没有被上一笔审核修改，刷新预期修订号后仍可处理。
  await f.request("review", reviewInput(first.id, { reviewId: "review-000000004", questionNumbers: [2], expectedRevision: 1 }));
  assert.equal(f.read().versions[0].answerRevision, 2);
  await rejects(f.request("submit", feedbackInput("003")), 409);
});

test("failed writes roll back feedback and the complete review transaction; reads wait for rollback", async (t) => {
  const oldToken = process.env.ROLLIERANK_REVIEW_TOKEN;
  process.env.ROLLIERANK_REVIEW_TOKEN = token;
  t.after(() => { if (oldToken === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = oldToken; });
  const f = await fixture(t);
  await f.submitAttempt(guest, "attempt-00000001", ["B", "A", "C", null]);
  const initial = f.read();
  f.fail();
  await assert.rejects(f.request("submit", feedbackInput()), { code: "ENOSPC" });
  assert.deepEqual(f.read(), initial);
  const feedback = (await f.request("submit", feedbackInput())).feedback;
  const before = f.read();
  let release;
  let entered;
  const persisted = new Promise((resolve) => { release = resolve; });
  const atPersist = new Promise((resolve) => { entered = resolve; });
  f.beforePersist(() => { entered(); return persisted; });
  f.fail();
  const rejected = assert.rejects(f.request("review", reviewInput(feedback.id)), { code: "ENOSPC" });
  await atPersist;
  let finished = false;
  const read = f.request("list", { guestId: guest }).then((result) => { finished = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finished, false);
  release();
  await rejected;
  assert.equal((await read).feedbacks[0].status, "pending");
  assert.deepEqual(f.read(), before);
  assert.deepEqual(await f.persisted(), before);
  f.beforePersist(null);
  const retried = await f.request("review", reviewInput(feedback.id));
  assert.equal(retried.replayed, false);
  assert.equal(f.read().features.corrections.revisions.length, 1);
});

test("boundary validation rejects foreign attempts, duplicate or invalid questions, and empty evidence", async (t) => {
  const f = await fixture(t);
  await f.submitAttempt(guest, "attempt-00000001", ["B", "A", "C", null]);
  const input = feedbackInput();
  await rejects(f.request("submit", { ...input, guestId: other }), 404);
  await rejects(f.request("submit", { ...input, changes: [input.changes[0], input.changes[0]] }), 400);
  for (const change of [{ question: 5, suggestedAnswer: "B", evidence: "来源" },
    { question: 1, suggestedAnswer: "A", evidence: "来源" },
    { question: 1, suggestedAnswer: "E", evidence: "来源" },
    { question: 1, suggestedAnswer: "B", evidence: " " }])
    await rejects(f.request("submit", { ...input, changes: [change] }), 400);
  assert.equal(await f.request("unrelated"), false);
  assert.equal(f.read().features.corrections, undefined);
});

test("unchanged totals still receive updated references and an auditable correction notice", async (t) => {
  const oldToken = process.env.ROLLIERANK_REVIEW_TOKEN;
  process.env.ROLLIERANK_REVIEW_TOKEN = token;
  t.after(() => { if (oldToken === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = oldToken; });
  const f = await fixture(t);
  await f.submitAttempt(guest, "attempt-00000001", ["B", "A", "C", null]);
  const unaffectedScore = await f.submitAttempt(other, "attempt-00000002", [null, null, "C", null]);
  const feedback = (await f.request("submit", feedbackInput())).feedback;
  await f.request("review", reviewInput(feedback.id));
  const receipt = (await f.sync(other))[0];
  assert.equal(receipt.report.totalCents, unaffectedScore.report.totalCents);
  assert.equal(receipt.report.rows[0].correctAnswer, "B");
  assert.equal(receipt.report.rows[1].correctAnswer, "A");
  assert.equal(receipt.answerRevision, 1);
  assert.equal(receipt.correctionHistory[0].deltaCents, 0);
  const notices = (await f.request("list", { guestId: other })).notifications;
  assert.equal(notices.length, 1);
  assert.equal(notices[0].deltaCents, 0);
});
