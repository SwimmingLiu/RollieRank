import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jpeg = require("jpeg-js");

const fault = (statusCode, message, detail) =>
  Object.assign(new Error(message), { statusCode, ...(detail ? { detail } : {}) });

export const OMR_IMAGE_LIMIT = 12 * 1024 * 1024;

// 拍照答题卡只有 JPEG 是刚需；PNG 由调用方先转码，避免把完整解码器塞进服务端。
export function decodeImage(bytes) {
  if (!bytes?.length) throw fault(400, "没有收到图片内容。");
  if (bytes.length > OMR_IMAGE_LIMIT) throw fault(413, "图片不能超过 12 MB，请压缩后重试。");
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isJpeg) throw fault(415, "目前只支持 JPEG 答题卡照片。");
  let decoded;
  try {
    decoded = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 512 });
  } catch (error) {
    throw fault(422, "图片无法解码，请换一张清晰的照片。", error.message);
  }
  const { width, height, data } = decoded;
  if (!width || !height) throw fault(422, "图片尺寸无效。");
  return { width, height, data };
}

// 灰度与饱和度一次算好：铅笔涂黑是“暗 + 低饱和”，印刷选项标签是“较暗 + 有彩度”。
export function toPlanes(image) {
  const { width: W, height: H, data } = image;
  const gray = new Uint8Array(W * H);
  const sat = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    gray[i] = (r * 299 + g * 587 + b * 114) / 1000;
    sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  // 蓝色答题区检测要看 R−B 通道差，原图字节一并带上，避免二次解码。
  return { width: W, height: H, gray, sat, data };
}

export async function readImageFile(path) {
  return decodeImage(await readFile(path));
}
