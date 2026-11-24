import { createHash } from "node:crypto";
import { OMR_IMAGE_LIMIT, decodeImage, toPlanes } from "./omr-image.mjs";
import { detectSheet, recognizeSheet } from "./omr-recognize.mjs";

const fault = (statusCode, message) => Object.assign(new Error(message), { statusCode });

export const OMR_MAX_QUESTIONS = 300;

// 拍照答题卡的识别结果只保留答案与置信度；debug 记录是可复现的定位证据，不含任何身份信息。
export function answerList(result, expected) {
  const questions = result.questions.map(({ number, answer, confidence }) => ({ number, answer, confidence }));
  if (!Number.isInteger(expected) || expected < 1 || expected > OMR_MAX_QUESTIONS) return questions;
  const byNumber = new Map(questions.map((q) => [q.number, q]));
  return Array.from({ length: expected }, (_, i) => byNumber.get(i + 1) ?? { number: i + 1, answer: null, confidence: 0 });
}

export function summarize(result, expected) {
  const questions = answerList(result, expected);
  const answered = questions.filter((q) => q.answer).length;
  const confidences = questions.filter((q) => q.answer).map((q) => q.confidence);
  const average = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  return {
    questions,
    recognized: answered,
    blank: questions.length - answered,
    averageConfidence: Number(average.toFixed(3)),
    layout: result.layout,
    warnings: result.warnings ?? [],
    elapsedMs: result.elapsedMs,
    imageDigest: result.imageDigest,
    ...(result.cached === undefined ? {} : { cached: result.cached }),
  };
}

// 识别过程可能超过浏览器默认等待；服务端按图片摘要缓存结果，重试同一张图不会重复计算。
export function createOmrService({ maxCache = 40 } = {}) {
  const cache = new Map();
  const remember = (key, value) => {
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > maxCache) cache.delete(cache.keys().next().value);
  };

  const recognize = (bytes, options = {}) => {
    const digest = createHash("sha256").update(bytes).digest("hex");
    const cached = cache.get(digest);
    if (cached) return { ...structuredClone(cached), cached: true };
    const started = Date.now();
    const image = decodeImage(bytes);
    const planes = toPlanes(image);
    const sheet = detectSheet(planes);
    if (!sheet.found)
      throw fault(422, "没有找到答题卡的选项框。请正对整张答题卡拍摄，保证四角完整入镜、光线均匀。");
    const result = recognizeSheet(planes, sheet, { debug: options.debug === true });
    if (result.sheetValid === false)
      throw fault(422, result.rejectionReason || "没有找到答题卡的选项框。请正对整张答题卡拍摄，保证四角完整入镜、光线均匀。");
    result.imageDigest = digest;
    result.elapsedMs = Date.now() - started;
    result.cached = false;
    remember(digest, result);
    return { ...structuredClone(result), cached: false };
  };

  return async function handle({ pathname, method, input, send, request }) {
    if (!pathname.startsWith("/api/omr/")) return false;
    if (method === "POST" && pathname === "/api/omr/recognize") {
      const base64 = input?.image;
      if (typeof base64 !== "string" || !base64)
        throw fault(400, "请先把答题卡照片转成 base64 再上传。");
      // 允许 data URL 前缀，浏览器直接贴 canvas 输出时不必先剥壳。
      const payload = base64.replace(/^data:image\/jpeg;base64,/, "").replace(/^data:image\/jpg;base64,/, "");
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload))
        throw fault(400, "图片内容不是有效的 base64。");
      const bytes = Buffer.from(payload, "base64");
      if (bytes.length > OMR_IMAGE_LIMIT) throw fault(413, "图片不能超过 12 MB。");
      const message = {};
      const result = summarize(recognize(bytes, input), input?.expectedQuestions);
      send(200, { ...message, ...result });
      return true;
    }
    if (method === "POST" && pathname === "/api/omr/recognize-url") {
      if (typeof input?.url !== "string" || !/^https?:\/\//.test(input.url))
        throw fault(400, "请提供 http(s) 图片地址。");
      const response = await fetch(input.url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw fault(422, `图片下载失败（HTTP ${response.status}）。`);
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > OMR_IMAGE_LIMIT) throw fault(413, "图片不能超过 12 MB。");
      const bytes = Buffer.from(await response.arrayBuffer());
      const result = summarize(recognize(bytes, input), input?.expectedQuestions);
      send(200, result);
      return true;
    }
    if (method === "GET" && pathname === "/api/omr/health") {
      send(200, { ok: true, imageLimit: OMR_IMAGE_LIMIT, maxQuestions: OMR_MAX_QUESTIONS });
      return true;
    }
    return false;
  };
}
