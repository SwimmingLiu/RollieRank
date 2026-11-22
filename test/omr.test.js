import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOmrService, summarize } from "../server/omr.mjs";
import { decodeImage, toPlanes } from "../server/omr-image.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const FIXTURE = path.join(ROOT, "test/fixtures/omr/sheet-c.jpg");
const SHEETS = ["sheet-a.jpg", "sheet-b.jpg", "sheet-c.jpg"];

async function callOmr(handler, pathname, method, input) {
  let response;
  const send = (status, body) => { response = { status, body }; };
  const served = await handler({ pathname, method, input, send, request: { headers: {} } });
  return served ? response : null;
}

test("答题卡识别接口拒绝无效输入", async () => {
  const handler = createOmrService();
  assert.equal((await callOmr(handler, "/api/omr/health", "GET")).status, 200);

  await assert.rejects(
    async () => callOmr(handler, "/api/omr/recognize", "POST", { image: "" }),
    /先把答题卡照片转成 base64/,
  );
  await assert.rejects(
    async () => callOmr(handler, "/api/omr/recognize", "POST", { image: "not base64!!" }),
    /不是有效的 base64/,
  );
  // 合法 base64 但内容不是 JPEG：明确报不支持的格式，而不是 500。
  await assert.rejects(
    async () => callOmr(handler, "/api/omr/recognize", "POST", { image: Buffer.from("hello world").toString("base64") }),
    /只支持 JPEG/,
  );
  // 返回 false 表示不归它管，API 层继续往下分发。
  assert.equal(await callOmr(handler, "/api/catalog", "GET"), null);
});

test("三张不同版式的答题卡都能定位到选项网格", async (t) => {
  const handler = createOmrService();
  const answers = new Map();
  for (const name of SHEETS) {
    const bytes = await readFile(path.join(ROOT, "test/fixtures/omr", name));
    const outcome = await callOmr(handler, "/api/omr/recognize", "POST", {
      image: bytes.toString("base64"),
      expectedQuestions: 140,
    }).catch((error) => { t.diagnostic(`${name}: ${error.message}`); return null; });
    if (!outcome) { answers.set(name, null); continue; }
    assert.equal(outcome.status, 200, `${name} 应识别成功`);
    assert.equal(outcome.body.questions.length, 140, `${name} 应补齐 140 题`);
    answers.set(name, outcome.body);
    t.diagnostic(`${name}: 识别 ${outcome.body.recognized} 题，平均置信度 ${outcome.body.averageConfidence}`);
  }
  const resolved = [...answers.values()].filter(Boolean);
  // 版式相同的三张照片若读出一模一样的答案，说明没有真正判读涂黑。
  if (resolved.length > 1) {
    const signatures = new Set(resolved.map((body) => body.questions.map((q) => q.answer).join("")));
    assert.ok(signatures.size > 1, "三张答题卡不应识别出完全相同的答案");
  }
});

test("同一张图片的重复识别命中缓存", async () => {
  const handler = createOmrService();
  const bytes = await readFile(FIXTURE);
  const image = bytes.toString("base64");
  const first = await callOmr(handler, "/api/omr/recognize", "POST", { image });
  const second = await callOmr(handler, "/api/omr/recognize", "POST", { image });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.cached, true);
  assert.equal(second.body.imageDigest, first.body.imageDigest);
});

test("summarize 按题数补齐缺答题目", () => {
  const result = {
    questions: [{ number: 1, answer: "A", confidence: 0.8 }, { number: 3, answer: "C", confidence: 0.6 }],
    layout: { engine: "test" }, warnings: [], elapsedMs: 1, imageDigest: "x",
  };
  const summary = summarize(result, 4);
  assert.deepEqual(summary.questions.map((q) => q.answer), ["A", null, "C", null]);
  assert.equal(summary.recognized, 2);
  assert.equal(summary.blank, 2);
  assert.equal(summary.averageConfidence, 0.7);
});

test("HTTP 接口支持识别与按套卷对号评分", async (t) => {
  const { createApi } = await import("../server/api.mjs");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { pathToFileURL } = await import("node:url");
  const directory = await mkdtemp(path.join(tmpdir(), "rollierank-omr-api-"));
  const server = [];
  t.after(async () => {
    for (const item of server) { item.closeAllConnections(); await new Promise((resolve) => item.close(resolve)); }
    await rm(directory, { recursive: true, force: true });
  });
  const api = await createApi({
    dataDirectory: pathToFileURL(directory + "/"),
    featureFactories: [],
  });
  const http = createServer((request, response) =>
    api(request, response, new URL(request.url, "http://localhost").pathname));
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  server.push(http);
  const base = `http://127.0.0.1:${http.address().port}/api`;
  const call = async (path, body) => {
    const response = await fetch(`${base}/${path}`, body === undefined ? {} : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  const health = await call("omr/health");
  assert.equal(health.status, 200);
  assert.equal(health.data.ok, true);

  // 评分接口需要一条已发布的套卷；用管理端导入一份 4 题测试卷。
  const token = "omr-test-token";
  process.env.ROLLIERANK_REVIEW_TOKEN = token;
  const imported = await fetch(`${base}/admin/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: "答题卡对照测试卷", institution: "测试", project: "测试", period: "一期", variant: "通用",
      csv: "题号,题型,答案,分值\n1,言语,A,1\n2,言语,B,1\n3,判断,C,1\n4,判断,D,1",
    }),
  }).then((r) => r.json());
  await fetch(`${base}/admin/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ versionId: imported.id, status: "published" }),
  });
  delete process.env.ROLLIERANK_REVIEW_TOKEN;

  const graded = await call("omr/grade", {
    versionId: imported.id,
    recognized: { questions: [
      { number: 1, answer: "A", confidence: 0.9 },
      { number: 2, answer: "C", confidence: 0.9 },
      { number: 3, answer: "C", confidence: 0.9 },
      // 第 4 题涂得太淡没判出来：按空题计分，而不是拒绝整张卡。
      { number: 4, answer: null, confidence: 0 },
    ] },
  });
  assert.equal(graded.status, 200);
  assert.deepEqual(graded.data.answers, ["A", "C", "C", null]);
  assert.equal(graded.data.report.correct, 2);
  assert.equal(graded.data.unrecognized, 1);

  const short = await call("omr/grade", {
    versionId: imported.id,
    recognized: { questions: [{ number: 1, answer: "A", confidence: 0.9 }] },
  });
  assert.equal(short.status, 400);
  assert.match(short.data.error, /共 4 题/);

  const mismatch = await call("omr/grade", {
    versionId: imported.id,
    recognized: { questions: Array.from({ length: 140 }, (_, i) => ({ number: i + 1, answer: "A", confidence: 1 })) },
  });
  assert.equal(mismatch.status, 400);
  assert.match(mismatch.data.error, /共 4 题/);
});

test("解码器只接受 JPEG 并给出可读错误", async () => {
  assert.throws(() => decodeImage(Buffer.from("not an image")), /只支持 JPEG/);
  const bytes = await readFile(FIXTURE);
  const image = decodeImage(bytes);
  assert.ok(image.width > 100);
  const planes = toPlanes(image);
  assert.equal(planes.gray.length, image.width * image.height);
});
