import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jpeg = require("jpeg-js");

const fault = (statusCode, message, detail) =>
  Object.assign(new Error(message), { statusCode, ...(detail ? { detail } : {}) });

export const OMR_IMAGE_LIMIT = 12 * 1024 * 1024;

// 读取 JPEG EXIF Orientation（1–8）：手机直传原图常把旋转写在 EXIF 里而非像素矩阵中，
// 忽略它会导致竖拍照片按横图进入识别引擎。
export function readExifOrientation(bytes) {
  if (!bytes || bytes.length < 14 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break; // EOI / SOS
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const segLen = (bytes[offset] << 8) | bytes[offset + 1];
    if (segLen < 2 || offset + segLen > bytes.length) break;
    if (marker === 0xe1 && segLen >= 16) {
      const start = offset + 2;
      // "Exif\0\0"
      if (
        bytes[start] === 0x45 && bytes[start + 1] === 0x78 &&
        bytes[start + 2] === 0x69 && bytes[start + 3] === 0x66 &&
        bytes[start + 4] === 0x00 && bytes[start + 5] === 0x00
      ) {
        const tiff = start + 6;
        if (tiff + 8 > offset + segLen) return 1;
        const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
        const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
        if (!little && !big) return 1;
        const u16 = (p) => (little ? bytes[p] | (bytes[p + 1] << 8) : (bytes[p] << 8) | bytes[p + 1]);
        const u32 = (p) =>
          (little
            ? (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24)) >>> 0
            : ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0);
        if (u16(tiff + 2) !== 0x002a) return 1;
        const ifdOffset = tiff + u32(tiff + 4);
        if (ifdOffset + 2 > offset + segLen) return 1;
        const entries = u16(ifdOffset);
        for (let i = 0; i < entries; i++) {
          const entry = ifdOffset + 2 + i * 12;
          if (entry + 12 > offset + segLen) break;
          if (u16(entry) === 0x0112) {
            const val = u16(entry + 8);
            return val >= 1 && val <= 8 ? val : 1;
          }
        }
        return 1;
      }
    }
    offset += segLen;
  }
  return 1;
}

function applyOrientation({ width: W, height: H, data }, orientation) {
  if (!orientation || orientation === 1) return { width: W, height: H, data };
  const swapped = orientation >= 5 && orientation <= 8;
  const outW = swapped ? H : W;
  const outH = swapped ? W : H;
  const out = new Uint8Array(outW * outH * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let dx = x;
      let dy = y;
      switch (orientation) {
        case 2: dx = W - 1 - x; dy = y; break;
        case 3: dx = W - 1 - x; dy = H - 1 - y; break;
        case 4: dx = x; dy = H - 1 - y; break;
        case 5: dx = y; dy = x; break;
        case 6: dx = H - 1 - y; dy = x; break;
        case 7: dx = H - 1 - y; dy = W - 1 - x; break;
        case 8: dx = y; dy = W - 1 - x; break;
        default: break;
      }
      const si = (y * W + x) * 4;
      const di = (dy * outW + dx) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { width: outW, height: outH, data: out };
}

// 拍照答题卡只有 JPEG 是刚需；PNG 由调用方先转码，避免把完整解码器塞进服务端。
export function decodeImage(bytes) {
  if (!bytes?.length) throw fault(400, "没有收到图片内容。");
  if (bytes.length > OMR_IMAGE_LIMIT) throw fault(413, "图片不能超过 12 MB，请压缩后重试。");
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isJpeg) throw fault(415, "目前只支持 JPEG 答题卡照片。");
  const orientation = readExifOrientation(bytes);
  let decoded;
  try {
    decoded = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 512 });
  } catch (error) {
    throw fault(422, "图片无法解码，请换一张清晰的照片。", error.message);
  }
  const { width, height, data } = decoded;
  if (!width || !height) throw fault(422, "图片尺寸无效。");
  return applyOrientation({ width, height, data }, orientation);
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
