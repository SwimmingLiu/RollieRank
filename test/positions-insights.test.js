import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { createApi } from "../server/api.mjs";
import { createPositionsService, positionId } from "../server/positions.mjs";
import { createCorrectionsService } from "../server/corrections.mjs";
import { createWechatProfileService } from "../server/wechat-profile.mjs";

const viewer = "insight-viewer-0001", peer = "insight-peer-000002", zero = "insight-zero-000003", privateGuest = "insight-private-004";
const types = ["政治理论", "常识判断", "言语理解", "数量关系", "资料分析", "图形推理", "定义判断", "类比推理", "逻辑判断", "言语理解"];
const csv = "题号,题型,答案,分值\n" + types.map((type, index) => `${index + 1},${type},A,10`).join("\n");
const answers = (correct, wrong = "B") => Array.from({ length: 10 }, (_, index) => index < correct ? "A" : wrong);

function jobs() {
  const source = { id: "insight-test", label: "测试岗位", exam: "guokao", year: 2027, region: "全国", publisher: "测试",
    sourcePage: "https://example.gov.cn/jobs", downloadUrl: "https://example.gov.cn/jobs.xlsx", retrievedAt: "2026-11-15", sha256: "a".repeat(64), count: 3 };
  return { schemaVersion: 1, source, positions: [1, 2, 3].map((number) => {
    const position = { exam: source.exam, year: source.year, region: source.region, departmentCode: "001", department: "测试部门",
      code: String(number), title: `岗位${number}`, sourceId: source.id, sourceSheet: "岗位表", sourceRow: number + 1 };
    return { ...position, id: positionId(position) };
  }) };
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-insights-http-"));
  const dataset = jobs();
  const oldToken = process.env.ROLLIERANK_REVIEW_TOKEN;
  const token = randomUUID();
  process.env.ROLLIERANK_REVIEW_TOKEN = token;
  const startApi = () => createApi({ dataDirectory: pathToFileURL(directory + "/"), featureFactories: [
    (context) => createPositionsService({ ...context, datasets: [dataset] }), createCorrectionsService,
    (context) => createWechatProfileService(context, { config: { appId: "", secret: "", phoneKey: null, qiniu: {} } }),
  ] });
  let api = await startApi();
  const server = createServer((request, response) => api(request, response, new URL(request.url, "http://localhost").pathname));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
    if (oldToken === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = oldToken;
  });
  const request = async (path, input) => {
    const headers = { "Content-Type": "application/json" };
    if (path.startsWith("admin/")) headers.Authorization = "Bearer " + token;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,
      input === undefined ? {} : { method: "POST", headers, body: JSON.stringify(input) });
    return { status: response.status, data: await response.json() };
  };
  const publish = async (title) => {
    const imported = await request("admin/import", { title, institution: "测试", project: "群体统计", period: "一期", variant: "地市", csv });
    assert.equal(imported.status, 200);
    assert.equal((await request("admin/status", { versionId: imported.data.id, status: "published" })).status, 200);
    return imported.data;
  };
  const version = await publish("群体统计 HTTP 卷");
  const submit = async (guestId, attemptId, choices, target = version) => {
    const response = await request("submit", { guestId, attemptId, versionId: target.id, answers: choices });
    assert.equal(response.status, 200); return response.data;
  };
  const participate = async (guestId, attemptIds, name = guestId) => {
    const response = await request("positions/participation", { guestId, name, attemptIds });
    assert.equal(response.status, 200);
  };
  const select = async (guestId, index) => {
    assert.equal((await request("positions/selection", { guestId, positionId: dataset.positions[index].id })).status, 200);
  };
  const query = (path, extra = {}) => "positions/" + path + "?" + new URLSearchParams({ versionId: version.id,
    guestId: viewer, scope: "nationwide", ...extra });
  return { request, publish, submit, participate, select, query, version, token, dataset, directory,
    restart: async () => { api = await startApi(); } };
}

test("formal HTTP submissions automatically rank, retry once, keep the best and preserve explicit withdrawals", async (t) => {
  const app = await fixture(t);
  const first = await app.submit(viewer, "automatic-first-attempt", answers(0, null));
  const profile = (await app.request("positions/profile?guestId=" + viewer)).data;
  assert.deepEqual(profile.participation.attemptIds, [first.id]);
  assert.match(profile.participation.name, /^卷友\d{4}$/);
  assert.equal((await app.request(app.query("leaderboard"))).data.self.value, 0);
  const request = { guestId: viewer, versionId: app.version.id, attemptId: "automatic-best-attempt", answers: answers(8), name: "资料昵称" };
  assert.equal((await app.request("submit", request)).status, 200);
  assert.equal((await app.request("submit", request)).status, 200);
  const best = (await app.request(app.query("leaderboard"))).data;
  assert.equal(best.count, 1); assert.equal(best.self.value, 8000); assert.equal(best.self.name, "资料昵称");
  assert.equal((await app.request("positions/profile?guestId=" + viewer)).data.participation.attemptIds.length, 2);
  await app.restart();
  assert.equal((await app.request(app.query("leaderboard"))).data.self.value, 8000);
  await app.request("positions/withdraw", { guestId: viewer });
  await app.restart();
  await app.submit(viewer, "automatic-after-withdraw", answers(10));
  assert.equal((await app.request(app.query("leaderboard"))).data.count, 0);
  assert.equal((await app.request("attempts/sync", { guestId: viewer })).data.attempts.length, 3);
});

test("a failed atomic submit cannot leave a ghost automatic ranking member", async (t) => {
  const app = await fixture(t);
  await mkdir(join(app.directory, "catalog.tmp"));
  const request = { guestId: viewer, versionId: app.version.id, attemptId: "automatic-disk-failure", answers: answers(10) };
  assert.notEqual((await app.request("submit", request)).status, 200);
  assert.equal((await app.request(app.query("leaderboard"))).data.count, 0);
  assert.equal((await app.request("attempts/sync", { guestId: viewer })).data.attempts.length, 0);
  await rm(join(app.directory, "catalog.tmp"), { recursive: true });
  assert.equal((await app.request("submit", request)).status, 200);
  assert.equal((await app.request(app.query("leaderboard"))).data.self.value, 10000);
});

test("real HTTP insights deduplicate complete best attempts, count blanks and separate score bands", async (t) => {
  const app = await fixture(t);
  const own = await app.submit(viewer, "insights-viewer-low", answers(5, null));
  await app.submit(viewer, "insights-viewer-best", answers(8, "D"));
  await app.submit(viewer, "insights-viewer-tied", ["B", "A", "A", "A", "A", "A", "A", "A", "A", "C"]);
  await app.submit(peer, "insights-peer-sixty", answers(6, "C"));
  await app.submit(zero, "insights-zero-blank", answers(0, null));
  await app.submit(privateGuest, "insights-private-full", answers(10));
  await app.request("positions/withdraw", { guestId: privateGuest });
  await app.participate(viewer, ["insights-viewer-low", "insights-viewer-best", "insights-viewer-tied"], "甲");
  await app.participate(peer, ["insights-peer-sixty"], "乙");
  await app.participate(zero, ["insights-zero-blank"], "丙");
  const response = await app.request(app.query("insights", { attemptId: own.id }));
  assert.equal(response.status, 200);
  const data = response.data;
  assert.equal(data.sampleCount, 3);
  assert.equal(data.participantCount, 3);
  assert.equal(data.lowSample, true);
  assert.equal(data.minSampleSize, 5);
  assert.deepEqual(data.bands.map(({ id, count }) => [id, count]), [["all", 3], ["lt60", 1], ["60-70", 1], ["70-80", 0], ["80plus", 1]]);
  assert.equal(data.questions[0].ownAnswer, "A");
  assert.equal(data.questions[0].correctAnswer, "A");
  assert.equal(data.questions[0].options.find((item) => item.answer === "A").count, 2);
  assert.equal(data.questions[0].options.find((item) => item.answer === "B").count, 0, "later tied receipt must not replace the earliest full best");
  assert.equal(data.questions[9].ownAnswer, null);
  assert.deepEqual(data.questions[9].options.map(({ answer, count }) => [answer, count]), [["A", 0], ["B", 0], ["C", 1], ["D", 1]]);
  for (const question of data.questions) {
    assert.equal(question.options.reduce((sum, item) => sum + item.count, question.blank.count), 3);
    assert.ok(Math.abs(question.options.reduce((sum, item) => sum + item.rate, question.blank.rate) - 1) < 1e-10);
  }
  assert.deepEqual(data.subjects.map((item) => item.name), ["政治理论", "常识判断", "言语理解", "数量关系", "资料分析", "判断推理"]);
  const judgment = data.subjects.find((item) => item.name === "判断推理");
  assert.equal(judgment.count, 4); assert.equal(judgment.ownRate, 0);
  assert.equal(judgment.averageRate, 1 / 3);
  assert.equal(judgment.deltaRate, -1 / 3);
  const band = (await app.request(app.query("insights", { attemptId: own.id, band: "60-70" }))).data;
  assert.equal(band.sampleCount, 1); assert.equal(band.participantCount, 3);
  assert.equal(band.questions[9].options.find((item) => item.answer === "C").rate, 1);
  const empty = (await app.request(app.query("insights", { attemptId: own.id, band: "70-80" }))).data;
  assert.equal(empty.sampleCount, 0); assert.equal(empty.lowSample, false);
  assert.equal(empty.subjects[0].averageRate, null); assert.equal(empty.subjects[0].ownRate, 1);
  assert.equal(empty.subjects[0].deltaRate, null);
  for (const item of empty.questions) {
    assert.equal(item.blank.rate, null);
    assert.ok(item.options.every((option) => option.count === 0 && option.rate === null));
  }
  for (const [guestId, attemptId, correct] of [["insights-fourth-004", "insights-fourth-score", 7], ["insights-fifth-0005", "insights-fifth-score", 9]]) {
    await app.submit(guestId, attemptId, answers(correct));
    await app.participate(guestId, [attemptId], "测试考生");
  }
  const large = (await app.request(app.query("insights", { attemptId: own.id }))).data;
  assert.equal(large.sampleCount, 5); assert.equal(large.lowSample, false);
  assert.equal(large.bands.find((item) => item.id === "70-80").count, 1);
});

test("rank percentiles handle ties and public details respect scope, opt-out and private answers", async (t) => {
  const app = await fixture(t);
  await app.submit(viewer, "insights-rank-viewer", answers(8));
  await app.submit(peer, "insights-rank-peer00", answers(8, "D"));
  await app.submit(zero, "insights-rank-zero00", answers(0, null));
  for (const [guestId, id, name] of [[viewer, "insights-rank-viewer", "甲"], [peer, "insights-rank-peer00", "乙"], [zero, "insights-rank-zero00", "丙"]])
    await app.participate(guestId, [id], name);
  await app.select(viewer, 0); await app.select(peer, 1); await app.select(zero, 0);
  const board = (await app.request(app.query("leaderboard"))).data;
  assert.deepEqual(board.rows.map((item) => item.rank), [1, 1, 3]);
  assert.ok(Math.abs(board.self.surpassedPercent - 100 / 3) < 1e-10);
  assert.equal(board.rows[2].surpassedPercent, 0);
  const peerId = board.rows.find((item) => item.name === "乙").publicId;
  const details = await app.request(app.query("public-result", { publicId: peerId }));
  assert.equal(details.status, 200);
  assert.equal(details.data.result.totalCents, 8000);
  assert.equal(details.data.result.subjects.length, 6);
  assert.equal(details.data.participantCount, 3);
  const json = JSON.stringify(details.data);
  for (const secret of [viewer, peer, "insights-rank-peer00", "answers", "correctAnswer", "createdAt", "guestId", "attemptId"])
    assert.equal(json.includes(secret), false, secret);
  const selected = (await app.request(app.query("leaderboard", { scope: "selected" }))).data;
  assert.equal(selected.count, 2);
  assert.equal(selected.self.surpassedPercent, 50);
  assert.equal((await app.request(app.query("public-result", { publicId: peerId, scope: "selected" }))).status, 404);
  assert.equal((await app.request(app.query("public-result", { publicId: peerId, scope: "position", positionId: app.dataset.positions[1].id }))).status, 200);
  await app.request("positions/withdraw", { guestId: peer });
  assert.equal((await app.request(app.query("public-result", { publicId: peerId }))).status, 404);
  assert.equal((await app.request("attempts/sync", { guestId: peer })).data.attempts.length, 1);
});

test("insight access requires a real own receipt for this version and validates every public scope", async (t) => {
  const app = await fixture(t);
  const first = await app.submit(viewer, "insights-access-own0", answers(7));
  const foreign = await app.submit(peer, "insights-access-peer", answers(5));
  const otherVersion = await app.publish("另一版本隔离卷");
  const other = await app.submit(viewer, "insights-other-version", answers(10), otherVersion);
  assert.equal((await app.request(app.query("insights", { attemptId: first.id }))).data.sampleCount, 2);
  for (const extra of [{ attemptId: foreign.id }, { attemptId: other.id }, { attemptId: "insights-missing-own" }])
    assert.equal((await app.request(app.query("insights", extra))).status, 403);
  assert.equal((await app.request(app.query("insights", { attemptId: first.id, band: "top-secret" }))).status, 400);
  assert.equal((await app.request(app.query("insights", { attemptId: first.id, scope: "invalid" }))).status, 400);
  assert.equal((await app.request(app.query("insights", { attemptId: first.id, scope: "position" }))).status, 400);
  assert.equal((await app.request(app.query("insights", { attemptId: first.id, scope: "position", positionId: "missing" }))).status, 404);
  assert.equal((await app.request(app.query("insights", { attemptId: first.id, guestId: "bad" }))).status, 400);
  assert.equal((await app.request(app.query("insights", { attemptId: first.id, versionId: "missing" }))).status, 404);
  assert.equal((await app.request(app.query("public-result", { publicId: first.id }))).status, 400);
  assert.equal((await app.request(app.query("public-result", { publicId: "public-" + "a".repeat(24) }))).status, 404);
  assert.equal((await app.request("positions/insights", {})).status, 405);
  assert.equal((await app.request("positions/public-result", {})).status, 405);
  await app.participate(viewer, [first.id], "甲");
  await app.select(viewer, 0);
  const noPositionSamples = (await app.request(app.query("insights", { attemptId: first.id, scope: "position", positionId: app.dataset.positions[2].id }))).data;
  assert.equal(noPositionSamples.sampleCount, 0);
  assert.equal(noPositionSamples.questions[0].ownAnswer, "A");
  assert.equal((await app.request("positions/profile?guestId=" + viewer)).data.positionId, app.dataset.positions[0].id);
  const sample = await app.request("sample", { versionId: app.version.id, guestId: viewer });
  assert.equal(sample.status, 200);
  assert.notEqual((await app.request(app.query("insights", { attemptId: sample.data.id }))).status, 200);
  await app.participate(viewer, [first.id, other.id], "甲");
  const originalPublicId = (await app.request(app.query("leaderboard"))).data.self.publicId;
  const otherPublicId = (await app.request(app.query("leaderboard", { versionId: otherVersion.id }))).data.self.publicId;
  assert.notEqual(originalPublicId, otherPublicId);
  assert.equal((await app.request(app.query("public-result", { versionId: otherVersion.id, publicId: originalPublicId }))).status, 404);
});

test("an approved answer correction immediately changes distributions, cohorts, ranks and public results", async (t) => {
  const app = await fixture(t);
  const first = await app.submit(viewer, "insights-correct-own0", answers(6, "B"));
  await app.submit(peer, "insights-correct-peer", answers(8));
  await app.participate(viewer, [first.id], "甲");
  await app.participate(peer, ["insights-correct-peer"], "乙");
  const before = (await app.request(app.query("insights", { attemptId: first.id }))).data;
  assert.equal(before.questions[6].correctAnswer, "A");
  assert.equal(before.bands.find((item) => item.id === "80plus").count, 1);
  const board = (await app.request(app.query("leaderboard"))).data;
  const personId = board.self.publicId;
  const feedback = await app.request("corrections/submit", { guestId: viewer, attemptId: first.id, feedbackId: "insight-correction-feedback", baseRevision: 0,
    changes: [{ question: 7, suggestedAnswer: "B", evidence: "已核对原题及机构发布订正。" }, { question: 8, suggestedAnswer: "B", evidence: "已核对原题及机构发布订正。" }] });
  assert.equal(feedback.status, 200);
  const decision = await app.request("corrections/review", { reviewToken: app.token, reviewId: "insight-correction-review", feedbackId: feedback.data.feedback.id,
    questionNumbers: [7, 8], decision: "approve", reason: "原题及机构订正确认需要更新答案。", expectedRevision: 0 });
  assert.equal(decision.status, 200);
  const after = (await app.request(app.query("insights", { attemptId: first.id }))).data;
  assert.equal(after.answerRevision, 1);
  assert.equal(after.questions[6].correctAnswer, "B");
  assert.equal(after.questions[6].ownAnswer, "B");
  assert.equal(after.bands.find((item) => item.id === "80plus").count, 1);
  const correctedBoard = (await app.request(app.query("leaderboard"))).data;
  assert.equal(correctedBoard.self.value, 8000);
  assert.equal(correctedBoard.self.rank, 1);
  assert.equal(correctedBoard.self.surpassedPercent, 50);
  const details = (await app.request(app.query("public-result", { publicId: personId }))).data;
  assert.equal(details.result.totalCents, 8000);
  assert.equal(details.result.subjects.find((item) => item.name === "判断推理").centsEarned, 3000);
  const restored = (await app.request("attempts/sync", { guestId: viewer })).data.attempts[0];
  assert.deepEqual(restored.answers, first.answers);
  assert.equal(restored.createdAt, first.createdAt);
  const beforePart = before.subjects.find((item) => item.name === "判断推理");
  const afterPart = after.subjects.find((item) => item.name === "判断推理");
  assert.equal(beforePart.ownRate, .25); assert.equal(afterPart.ownRate, .75);
  assert.equal(beforePart.deltaRate, -.25); assert.equal(afterPart.deltaRate, .25);
  // One participant gains exactly what the other loses; the mean correctly stays constant.
  assert.equal(afterPart.averageRate, beforePart.averageRate);
  const lowerBand = (await app.request(app.query("insights", { attemptId: first.id, band: "60-70" }))).data;
  assert.equal(lowerBand.questions[6].options.find((item) => item.answer === "A").rate, 1);
});

test("leaderboard and public results expose real WeChat profile avatars and synced nicknames without leaking credentials", async (t) => {
  const app = await fixture(t);
  await app.submit(viewer, "avatar-rank-viewer01", answers(9));
  const session = await app.request("miniprogram-profile/session", {});
  assert.equal(session.status, 200);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2dIAAAAASUVORK5CYII=",
    "base64",
  ).toString("base64");
  const saved = await app.request("miniprogram-profile/profile", {
    token: session.data.token,
    guestId: viewer,
    name: "刘杰",
    avatar: png,
  });
  assert.equal(saved.status, 200);
  assert.ok(saved.data.profile.avatarId);

  const board = (await app.request(app.query("leaderboard"))).data;
  assert.equal(board.rows.length, 1);
  assert.equal(board.rows[0].name, "刘杰");
  assert.equal(board.rows[0].avatarUrl, `/api/miniprogram-profile/avatar?id=${saved.data.profile.avatarId}`);
  assert.equal(board.self.avatarUrl, board.rows[0].avatarUrl);
  assert.equal(JSON.stringify(board).includes(session.data.token), false);

  const details = (await app.request(app.query("public-result", { publicId: board.rows[0].publicId }))).data;
  assert.equal(details.result.name, "刘杰");
  assert.equal(details.result.avatarUrl, board.rows[0].avatarUrl);
  assert.equal(JSON.stringify(details).includes(session.data.token), false);
});
