import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOmrService, summarize } from "../server/omr.mjs";
import { decodeImage, readExifOrientation, toPlanes } from "../server/omr-image.mjs";

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

test("HTTP 识别接口允许超过 1 MB 的真实照片请求体", async (t) => {
  const { createApi } = await import("../server/api.mjs");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { pathToFileURL } = await import("node:url");
  const directory = await mkdtemp(path.join(tmpdir(), "rollierank-omr-large-"));
  const servers = [];
  t.after(async () => {
    for (const item of servers) { item.closeAllConnections(); await new Promise((resolve) => item.close(resolve)); }
    await rm(directory, { recursive: true, force: true });
  });
  const api = await createApi({ dataDirectory: pathToFileURL(directory + "/"), featureFactories: [] });
  const http = createServer((request, response) =>
    api(request, response, new URL(request.url, "http://localhost").pathname));
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  servers.push(http);

  // 超过 1 MB 的 JPEG（附尾随注释字节，保持合法 JPEG 与 >1.4 MB JSON 载荷）不应被通用 1 MB 限额拦截。
  const raw = await readFile(path.join(ROOT, "test/fixtures/omr/sheet-b.jpg"));
  const padded = Buffer.concat([raw, Buffer.alloc(700 * 1024, 0)]);
  const payload = JSON.stringify({ image: padded.toString("base64"), expectedQuestions: 130 });
  assert.ok(Buffer.byteLength(payload) > 1.4 * 1024 * 1024);
  const response = await fetch(`http://127.0.0.1:${http.address().port}/api/omr/recognize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.questions.length, 130);
  assert.ok(data.recognized >= 100);
});

test("Web 与小程序答题卡草稿合并口径一致（补空题、整份替换、低置信度存疑）", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const webOmr = await import("../src/omr-draft.js");
  const mpOmr = require("../mini-program/utils/omr.js");

  const result = {
    questions: [
      { number: 1, answer: "A", confidence: 0.9 },
      { number: 2, answer: "B", confidence: 0.18 },
      { number: 3, answer: null, confidence: 0 },
      { number: 4, answer: "D", confidence: 0.24 },
      { number: 5, answer: "C", confidence: 0.8 },
    ],
    warnings: ["部分区域反光"],
    averageConfidence: 0.53,
    elapsedMs: 420,
  };
  const currentAnswers = ["C", "", "", "", ""];

  const webSummary = webOmr.summarizeOmrResult(result, { questionCount: 5, currentAnswers });
  const mpSummary = mpOmr.summarizeOmrResult(result, { questionCount: 5, currentAnswers });
  assert.deepEqual(webSummary, mpSummary);
  assert.equal(webSummary.recognized, 4);
  assert.equal(webSummary.blank, 1);
  assert.deepEqual(webSummary.lowConfidence, [2, 4]);
  assert.equal(webSummary.existingAnswered, 1);
  assert.equal(webSummary.fillBlankAdded, 3);
  assert.equal(webSummary.replaceConflicts, 1);

  const webFill = webOmr.applyOmrResult({ result, questionCount: 5, currentAnswers, currentMarks: [1], mode: "fill-blank" });
  const mpFill = mpOmr.applyOmrResult({ result, questionCount: 5, currentAnswers, currentMarks: [true, false, false, false, false], mode: "fill-blank" });
  assert.deepEqual(webFill.answers, ["C", "B", "", "D", "C"]);
  assert.deepEqual(mpFill.answers, webFill.answers);
  assert.deepEqual(webFill.marks, [1, 2, 4]);
  assert.deepEqual(mpFill.marks, [true, true, false, true, false]);
  assert.equal(webFill.appliedCount, 3);
  assert.equal(mpFill.appliedCount, 3);
  assert.equal(webFill.firstFocusQuestion, 2);
  assert.equal(mpFill.firstFocusQuestion, 2);

  const webReplace = webOmr.applyOmrResult({ result, questionCount: 5, currentAnswers, currentMarks: [3], mode: "replace" });
  const mpReplace = mpOmr.applyOmrResult({ result, questionCount: 5, currentAnswers, currentMarks: [false, false, true, false, false], mode: "replace" });
  assert.deepEqual(webReplace.answers, ["A", "B", "", "D", "C"]);
  assert.deepEqual(mpReplace.answers, webReplace.answers);
  assert.deepEqual(webReplace.marks, [2, 3, 4]);
  assert.deepEqual(mpReplace.marks, [false, true, true, true, false]);
  assert.equal(webOmr.formatOmrApplyToast({ appliedCount: 3, lowConfidenceMarked: [2, 4], mode: "fill-blank" }), "已补录 3 题，2 题已标存疑");
  assert.equal(mpOmr.formatOmrApplyToast({ appliedCount: 4, lowConfidenceMarked: [], mode: "replace" }), "已填入 4 题");
});

test("小程序录答案页正确接线答题卡识别入口与离屏画布", async () => {
  const wxml = await readFile(path.join(ROOT, "mini-program/pages/practice/practice.wxml"), "utf8");
  const wxss = await readFile(path.join(ROOT, "mini-program/pages/practice/practice.wxss"), "utf8");
  const js = await readFile(path.join(ROOT, "mini-program/pages/practice/practice.js"), "utf8");
  assert.match(wxml, /bindtap="openScan"/);
  assert.match(wxml, /bindtap="chooseScanImage"/);
  assert.match(wxml, /bindtap="applyScanResult"/);
  assert.match(wxml, /id="omr-canvas"/);
  assert.match(wxss, /\.practice__omr-canvas\s*\{[^}]*left:\s*-9999px/);
  assert.match(js, /recognizeAnswerSheet/);
});

test("非答题卡图片（纯白、书页文字、随机杂斑、键盘网格、蓝底条纹、二维码）全部返回 422 拒绝而非硬凑答案", async () => {
  const { createRequire } = await import("node:module");
  const jpeg = createRequire(import.meta.url)("jpeg-js");
  const handler = createOmrService({ maxCache: 2 });

  const makeJpeg = (w, h, fn) => {
    const data = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [r, g, b] = fn(x, y);
        const p = (y * w + x) * 4;
        data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
      }
    }
    return jpeg.encode({ width: w, height: h, data }, 85).data;
  };

  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const bookBlocks = [];
  for (let row = 0; row < 45; row++) {
    const y = 120 + row * 34;
    let x = 100;
    while (x < 1150) {
      const w = 15 + Math.floor(rand() * 35);
      const h = 10 + Math.floor(rand() * 8);
      if (rand() < 0.7) bookBlocks.push([x, y, x + w, y + h]);
      x += w + 8 + Math.floor(rand() * 20);
    }
  }
  const clutter = Array.from({ length: 450 }, () => {
    const cx = 80 + rand() * 1120;
    const cy = 100 + rand() * 1500;
    const w = 16 + rand() * 26;
    const h = 8 + rand() * 14;
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
  });

  const negatives = [
    ["纯白图", makeJpeg(500, 700, () => [248, 248, 248])],
    ["小程序二维码", await readFile(path.join(ROOT, "assets/miniprogram-qrcode.jpg"))],
    ["书页/试卷文字", makeJpeg(1280, 1710, (x, y) => {
      for (const b of bookBlocks) if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return [45, 45, 45];
      return [232, 232, 228];
    })],
    ["随机桌面杂斑", makeJpeg(1280, 1710, (x, y) => {
      for (const b of clutter) if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return [50, 50, 50];
      return [220, 220, 218];
    })],
    ["规则键盘网格", makeJpeg(1280, 1710, (x, y) => {
      const gx = x % 48;
      const gy = y % 36;
      return gx >= 10 && gx <= 36 && gy >= 8 && gy <= 24 ? [40, 42, 45] : [210, 212, 215];
    })],
    ["蓝白条纹点阵", makeJpeg(1280, 1710, (x, y) => {
      const bg = Math.floor(y / 120) % 2 === 0 ? [185, 205, 230] : [235, 235, 235];
      return x % 55 > 12 && x % 55 < 34 && y % 41 > 10 && y % 41 < 22 ? [50, 50, 50] : bg;
    })],
  ];

  for (const [label, buf] of negatives) {
    await assert.rejects(
      async () => callOmr(handler, "/api/omr/recognize", "POST", { image: buf.toString("base64"), expectedQuestions: 140 }),
      (error) => error.statusCode === 422 && /没有找到|有效填涂/.test(error.message),
      `${label} 不应识别为答题卡`,
    );
  }
});

test("支持 EXIF 方向自动转正、满屏近拍行式卡与阴影光照下的真实答题卡", async () => {
  const { createRequire } = await import("node:module");
  const jpeg = createRequire(import.meta.url)("jpeg-js");
  const handler = createOmrService({ maxCache: 4 });

  const rawA = await readFile(path.join(ROOT, "test/fixtures/omr/sheet-a.jpg"));
  const rawB = await readFile(path.join(ROOT, "test/fixtures/omr/sheet-b.jpg"));
  const keyA = JSON.parse(await readFile(path.join(ROOT, "test/fixtures/omr/sheet-a.answers.json"), "utf8")).answers;
  const keyB = JSON.parse(await readFile(path.join(ROOT, "test/fixtures/omr/sheet-b.answers.json"), "utf8")).answers;

  // 1) EXIF Orientation=6 自动转正：把正图逆时针转 90° 并写入 EXIF=6，识别应直接命中正向且无需二次猜旋转。
  const imgA = decodeImage(rawA);
  const ccw = new Uint8ClampedArray(imgA.width * imgA.height * 4);
  for (let y = 0; y < imgA.height; y++) {
    for (let x = 0; x < imgA.width; x++) {
      const si = (y * imgA.width + x) * 4;
      const di = ((imgA.width - 1 - x) * imgA.height + y) * 4;
      ccw[di] = imgA.data[si]; ccw[di + 1] = imgA.data[si + 1]; ccw[di + 2] = imgA.data[si + 2]; ccw[di + 3] = 255;
    }
  }
  const encodedCcw = jpeg.encode({ width: imgA.height, height: imgA.width, data: ccw }, 88).data;
  const exifApp1 = Buffer.from([
    0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
  const exifJpeg = Buffer.concat([encodedCcw.subarray(0, 2), exifApp1, encodedCcw.subarray(2)]);
  assert.equal(readExifOrientation(exifJpeg), 6);
  const resExif = await callOmr(handler, "/api/omr/recognize", "POST", { image: exifJpeg.toString("base64"), expectedQuestions: 140 });
  assert.equal(resExif.status, 200);
  const okA = resExif.body.questions.filter((q) => keyA[String(q.number)] && q.answer === keyA[String(q.number)]).length;
  assert.ok(okA >= 125, `EXIF 旋转样张预期至少答对 125 题，实际 ${okA}`);

  // 2) 满屏近拍的行式卡（裁出 sheet-b 答题卡主体并放大到 1920px，模拟四角入镜构图）
  const imgB = decodeImage(rawB);
  const cx0 = 280, cy0 = 720, cw = 1000, ch = 1199;
  const scale = 1920 / ch;
  const ow = Math.round(cw * scale), oh = 1920;
  const fullFrame = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    const sy = cy0 + Math.min(ch - 1, Math.floor(y / scale));
    for (let x = 0; x < ow; x++) {
      const sx = cx0 + Math.min(cw - 1, Math.floor(x / scale));
      const si = (sy * imgB.width + sx) * 4;
      const di = (y * ow + x) * 4;
      fullFrame[di] = imgB.data[si]; fullFrame[di + 1] = imgB.data[si + 1]; fullFrame[di + 2] = imgB.data[si + 2]; fullFrame[di + 3] = 255;
    }
  }
  const ffJpeg = jpeg.encode({ width: ow, height: oh, data: fullFrame }, 88).data;
  const resFF = await callOmr(handler, "/api/omr/recognize", "POST", { image: ffJpeg.toString("base64"), expectedQuestions: 140 });
  assert.equal(resFF.status, 200);
  const okFF = resFF.body.questions.filter((q) => keyB[String(q.number)] && q.answer === keyB[String(q.number)]).length;
  const wrongFF = resFF.body.questions.filter((q) => q.answer && q.answer !== keyB[String(q.number)]).length;
  assert.ok(okFF >= 130 && wrongFF <= 2, `满屏行式卡预期 >=130 对且 <=2 错，实际 ok=${okFF}, wrong=${wrongFF}`);

  // 3) 左侧 52% 强阴影梯度下的行式卡
  const shadowed = new Uint8ClampedArray(imgB.width * imgB.height * 4);
  for (let y = 0; y < imgB.height; y++) {
    for (let x = 0; x < imgB.width; x++) {
      const f = 0.52 + 0.48 * (x / imgB.width);
      const p = (y * imgB.width + x) * 4;
      shadowed[p] = Math.round(imgB.data[p] * f);
      shadowed[p + 1] = Math.round(imgB.data[p + 1] * f);
      shadowed[p + 2] = Math.round(imgB.data[p + 2] * f);
      shadowed[p + 3] = 255;
    }
  }
  const shJpeg = jpeg.encode({ width: imgB.width, height: imgB.height, data: shadowed }, 88).data;
  const resSh = await callOmr(handler, "/api/omr/recognize", "POST", { image: shJpeg.toString("base64"), expectedQuestions: 140 });
  assert.equal(resSh.status, 200);
  const okSh = resSh.body.questions.filter((q) => keyB[String(q.number)] && q.answer === keyB[String(q.number)]).length;
  assert.ok(okSh >= 130, `阴影行式卡预期 >=130 对，实际 ${okSh}`);
});
