import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { createApi } from "../server/api.mjs";
import { createCorrectionsService } from "../server/corrections.mjs";
import { initialState, recordAttempt, syncAttemptSnapshots, loadState, saveState } from "../src/prototype-state.js";

test("real API correction, future submission, restart and old-client synchronization", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-corrections-api-"));
  const token = randomUUID();
  const configured = process.env.ROLLIERANK_REVIEW_TOKEN;
  process.env.ROLLIERANK_REVIEW_TOKEN = token;
  const servers = [];
  t.after(async () => {
    for (const server of servers) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    await rm(directory, { recursive: true, force: true });
    if (configured === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = configured;
  });
  const start = async () => {
    const api = await createApi({ dataDirectory: pathToFileURL(directory + "/"), featureFactories: [createCorrectionsService] });
    const server = createServer((request, response) => api(request, response, new URL(request.url, "http://localhost").pathname));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    servers.push(server);
    return async (path, input) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,
        input === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return { status: response.status, data: await response.json() };
    };
  };
  const request = await start();
  const imported = (await request("admin/import", { title: "纠错 HTTP 测试卷", institution: "测试",
    project: "测试", period: "一期", variant: "通用", csv: "题号,题型,答案,分值\n1,言语,A,0.5\n2,言语,B,0.8\n3,判断,C,0.85\n4,判断,D,1.2" })).data;
  assert.equal((await request("admin/status", { versionId: imported.id, status: "published" })).status, 200);
  const local = initialState();
  local.profile = { id: local.guestId, name: "本机练习者" };
  const first = (await request("submit", { versionId: imported.id, guestId: local.guestId,
    attemptId: "http-attempt-0001", answers: ["B", "A", "C", null] })).data;
  recordAttempt(local, first, { participate: true });
  const otherGuest = "http-candidate-0002";
  const other = (await request("submit", { versionId: imported.id, guestId: otherGuest,
    attemptId: "http-attempt-0002", answers: ["A", "B", "C", "D"] })).data;
  const feedback = (await request("corrections/submit", { guestId: local.guestId, attemptId: first.id,
    feedbackId: "http-feedback-0001", baseRevision: 0,
    changes: [{ question: 1, suggestedAnswer: "B", evidence: "按原题第 1 页核对。" },
      { question: 2, suggestedAnswer: "A", evidence: "按参考解析第 2 页核对。" }] })).data.feedback;
  assert.equal(feedback.status, "pending");
  assert.equal((await request("corrections/preview", { guestId: local.guestId, feedbackId: feedback.id })).data.projected.totalCents, 215);
  assert.equal((await request("attempts/sync", { guestId: local.guestId })).data.attempts[0].report.totalCents, 85);
  const input = { reviewToken: token, reviewId: "http-review-000001", feedbackId: feedback.id,
    questionNumbers: [1, 2], decision: "approve", reason: "原题及参考解析确认这两题需要订正。", expectedRevision: 0 };
  assert.equal((await request("corrections/review", { ...input, reviewToken: "wrong" })).status, 403);
  assert.equal((await request("corrections/review", input)).status, 200);
  const synced = await request("attempts/sync", { guestId: local.guestId, attemptIds: [first.id] });
  assert.equal(synced.data.attempts.length, 1);
  assert.equal(syncAttemptSnapshots(local, synced.data.attempts), true);
  const corrected = local.attempts[0];
  assert.equal(corrected.report.totalCents, 215);
  assert.equal(corrected.ownerId, local.guestId);
  assert.equal(corrected.participate, true);
  assert.deepEqual(corrected.answers, first.answers);
  assert.equal(corrected.createdAt, first.createdAt);
  assert.equal(corrected.answerRevision, 1);
  assert.equal(corrected.correctionHistory[0].before.totalCents, 85);
  const storageValues = new Map();
  const storage = { getItem: (key) => storageValues.get(key) ?? null, setItem: (key, value) => storageValues.set(key, value) };
  saveState(storage, local);
  const catalog = (await request("catalog")).data.versions;
  const restored = loadState(storage, catalog);
  assert.equal(restored.warning, false);
  assert.equal(restored.state.attempts[0].report.totalCents, 215);
  assert.equal(restored.state.attempts[0].answerRevision, 1);
  assert.equal(restored.state.attempts[0].correctionHistory.length, 1);
  const second = (await request("attempts/sync", { guestId: otherGuest })).data.attempts[0];
  assert.equal(second.id, other.id);
  assert.equal(second.report.totalCents, 205);
  assert.equal((await request("corrections/list", { guestId: otherGuest })).data.notifications[0].deltaCents, -130);
  assert.equal((await request("attempts/sync", { guestId: "unknown-candidate-001" })).data.attempts.length, 0);
  const future = (await request("submit", { versionId: imported.id, guestId: otherGuest,
    attemptId: "http-attempt-0003", answers: ["B", "A", "C", "D"] })).data;
  assert.equal(future.report.totalCents, 335);
  assert.equal(future.answerRevision, 1);
  const restarted = await start();
  const feedbackAfterRestart = (await restarted("corrections/list", { guestId: local.guestId })).data;
  assert.equal(feedbackAfterRestart.feedbacks[0].status, "approved");
  assert.equal(feedbackAfterRestart.notifications.length, 1);
  assert.equal((await restarted("corrections/review", input)).data.replayed, true);
  assert.equal((await restarted("attempts/sync", { guestId: local.guestId })).data.attempts[0].correctionHistory.length, 1);
  const disk = await readFile(join(directory, "catalog.json"), "utf8");
  assert.equal(disk.includes(token), false);
  for (const path of ["catalog", "admin", "corrections/summary"]) assert.equal(JSON.stringify((await request(path)).data).includes(token), false);
});

test("real catalog persistence failure rolls back answers, reports and audit before retry", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-corrections-rollback-"));
  const configured = process.env.ROLLIERANK_REVIEW_TOKEN;
  const token = randomUUID();
  process.env.ROLLIERANK_REVIEW_TOKEN = token;
  const api = await createApi({ dataDirectory: pathToFileURL(directory + "/"), featureFactories: [createCorrectionsService] });
  const server = createServer((request, response) => api(request, response, new URL(request.url, "http://localhost").pathname));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
    if (configured === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = configured; });
  const request = async (path, input) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,
      input === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return { status: response.status, data: await response.json() };
  };
  const version = (await request("catalog")).data.versions[0];
  const guestId = "rollback-candidate-01";
  const receipt = (await request("submit", { guestId, versionId: version.id,
    attemptId: "rollback-attempt-001", answers: version.questions.map(() => "A") })).data;
  const originalAnswer = receipt.report.rows[0].correctAnswer;
  const suggestedAnswer = originalAnswer === "B" ? "C" : "B";
  const feedbackId = "rollback-feedback-001";
  await request("corrections/submit", { guestId, attemptId: receipt.id, feedbackId, baseRevision: 0,
    changes: [{ question: 1, suggestedAnswer, evidence: "验收用核对依据。" }] });
  const before = await readFile(join(directory, "catalog.json"), "utf8");
  await mkdir(join(directory, "catalog.tmp"));
  const input = { reviewToken: token, feedbackId, reviewId: "rollback-review-001", questionNumbers: [1],
    decision: "approve", reason: "核对后批准。", expectedRevision: 0 };
  assert.equal((await request("corrections/review", input)).status, 400);
  assert.equal(await readFile(join(directory, "catalog.json"), "utf8"), before);
  assert.equal((await request("attempts/sync", { guestId })).data.attempts[0].report.rows[0].correctAnswer, originalAnswer);
  assert.equal((await request("corrections/list", { guestId })).data.feedbacks[0].status, "pending");
  assert.equal((await request("corrections/admin", { reviewToken: token })).data.reviews.length, 0);
  await rm(join(directory, "catalog.tmp"), { recursive: true });
  assert.equal((await request("corrections/review", input)).status, 200);
  const fresh = (await request("attempts/sync", { guestId })).data.attempts[0];
  assert.equal(fresh.report.rows[0].correctAnswer, suggestedAnswer);
  assert.equal(fresh.correctionHistory.length, 1);
});
