import { createHash, randomUUID } from "node:crypto";
import { inflateSync } from "node:zlib";
import { DISCUSSION_LIMITS, normalizeDiscussionLink } from "../src/features/discussions.js";

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const token = (value) => typeof value === "string" && /^[\w-]{10,80}$/.test(value);
const invalidControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function decodeDataUri(uri, mime, limit) {
  const prefix = `data:${mime};base64,`;
  if (typeof uri !== "string" || !uri.startsWith(prefix)) fail(`附件应为 ${mime} 格式。`);
  if (uri.length > prefix.length + Math.ceil(limit / 3) * 4) fail("附件超过大小限制。", 413);
  const base64 = uri.slice(prefix.length);
  if (!base64 || base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
    fail("附件编码无效，请重新选择文件。");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > limit) fail("附件超过大小限制。", 413);
  if (bytes.toString("base64") !== base64) fail("附件编码无效，请重新选择文件。");
  return bytes;
}

function validatePng(uri) {
  const bytes = decodeDataUri(uri, "image/png", DISCUSSION_LIMITS.imageBytes);
  if (bytes.length < 57 || !bytes.subarray(0, 8).equals(pngSignature)) fail("图片内容不是有效的 PNG。");
  let offset = 8, width, height, channels, ended = false, idatEnded = false;
  const kept = [pngSignature], compressed = [];
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    if (size > bytes.length - offset - 12) fail("图片数据不完整。");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    if (!/^[A-Za-z]{4}$/.test(type) || crc32(bytes.subarray(offset + 4, offset + 8 + size)) !== bytes.readUInt32BE(offset + 8 + size))
      fail("图片校验失败，请重新选择文件。");
    if (offset === 8 && type !== "IHDR") fail("图片缺少尺寸信息。");
    if (type === "IHDR") {
      if (offset !== 8 || size !== 13) fail("图片头无效。");
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (!width || !height || width > DISCUSSION_LIMITS.imageEdge || height > DISCUSSION_LIMITS.imageEdge || width * height > DISCUSSION_LIMITS.imagePixels)
        fail("图片尺寸过大，请缩小后重试。", 413);
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[10] || data[11] || data[12])
        fail("请将图片转换为普通 PNG 后重试。");
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") {
      if (!width || idatEnded) fail("图片数据顺序无效。");
      compressed.push(data);
    } else if (type === "IEND") {
      if (size || !compressed.length || offset + 12 !== bytes.length) fail("图片结尾无效。");
      ended = true;
    } else {
      if (compressed.length) idatEnded = true;
      if (!(bytes[offset + 4] & 32) || ["acTL", "fcTL", "fdAT"].includes(type)) fail("请使用静态 PNG 图片。");
    }
    if (["IHDR", "IDAT", "IEND"].includes(type)) kept.push(bytes.subarray(offset, offset + size + 12));
    offset += size + 12;
    if (ended) break;
  }
  if (!ended) fail("图片数据不完整。");
  const stride = width * channels + 1;
  const expected = stride * height;
  try {
    const input = Buffer.concat(compressed);
    const result = inflateSync(input, { maxOutputLength: expected, info: true });
    if (result.buffer.length !== expected || result.engine.bytesWritten !== input.length) fail("图片像素数据无效。");
    for (let row = 0; row < height; row++) if (result.buffer[row * stride] > 4) fail("图片像素数据无效。");
  } catch (error) {
    if (error.statusCode) throw error;
    fail("图片无法解码，请重新选择文件。");
  }
  const normalized = Buffer.concat(kept);
  return { dataUri: `data:image/png;base64,${normalized.toString("base64")}`, width, height, bytes: normalized.length };
}

function validateWav(uri) {
  const bytes = decodeDataUri(uri, "audio/wav", DISCUSSION_LIMITS.audioBytes);
  if (bytes.length <= 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 16) !== "WAVEfmt " ||
      bytes.readUInt32LE(4) !== bytes.length - 8 || bytes.readUInt32LE(16) !== 16 || bytes.readUInt16LE(20) !== 1 ||
      bytes.readUInt16LE(22) !== 1 || bytes.readUInt32LE(24) !== DISCUSSION_LIMITS.audioRate ||
      bytes.readUInt32LE(28) !== DISCUSSION_LIMITS.audioRate * 2 || bytes.readUInt16LE(32) !== 2 || bytes.readUInt16LE(34) !== 16 ||
      bytes.toString("ascii", 36, 40) !== "data" || bytes.readUInt32LE(40) !== bytes.length - 44 || (bytes.length - 44) % 2)
    fail("音频应为单声道 16 kHz PCM WAV，请重新选择文件。");
  const duration = (bytes.length - 44) / (DISCUSSION_LIMITS.audioRate * 2);
  if (duration > DISCUSSION_LIMITS.audioSeconds) fail("语音不能超过 60 秒。", 413);
  return { dataUri: uri, duration, bytes: bytes.length };
}

function cleanText(value, label, max, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string") fail(`${label}格式无效。`);
  const text = value.replace(/\r\n?/g, "\n").trim();
  if ((required && !text) || text.length > max || invalidControls.test(text)) fail(`${label}应为 ${required ? "1" : "0"}–${max} 字。`);
  return text;
}

function parseComment(input) {
  if (!token(input.clientId)) fail("评论标识无效，请重新打开讨论区。");
  const nickname = cleanText(input.nickname, "昵称", DISCUSSION_LIMITS.nickname, true);
  if (/[\r\n\t]/.test(nickname)) fail("昵称不能包含换行或制表符。");
  const text = cleanText(input.text, "评论", DISCUSSION_LIMITS.text);
  const links = input.links ?? [];
  const images = input.images ?? [];
  if (!Array.isArray(links) || links.length > DISCUSSION_LIMITS.links) fail("每条评论最多添加 3 个链接。");
  if (!Array.isArray(images) || images.length > DISCUSSION_LIMITS.images) fail("每条评论最多添加 3 张图片。");
  const normalizedLinks = [...new Set(links.map((link) => {
    try { return normalizeDiscussionLink(link); } catch { fail("链接仅支持完整的 HTTP 或 HTTPS 地址，且不能包含账号密码。"); }
  }))];
  const normalizedImages = images.map((image, index) => {
    if (!image || typeof image !== "object" || Array.isArray(image)) fail("图片格式无效。");
    return { ...validatePng(image.dataUri), alt: cleanText(image.alt, "图片说明", 120) || `讨论配图 ${index + 1}` };
  });
  let audio = null;
  if (input.audio != null) {
    if (typeof input.audio !== "object" || Array.isArray(input.audio)) fail("音频格式无效。");
    audio = { ...validateWav(input.audio.dataUri), name: cleanText(input.audio.name, "语音说明", 120) || "讨论语音" };
  }
  const total = normalizedImages.reduce((sum, image) => sum + image.bytes, 0) + (audio?.bytes ?? 0);
  if (total > DISCUSSION_LIMITS.totalBytes) fail("附件合计不能超过 5 MiB。", 413);
  if (!text && !normalizedLinks.length && !normalizedImages.length && !audio) fail("请填写评论或添加附件。");
  return { nickname, text, links: normalizedLinks, images: normalizedImages, audio };
}

function findReceipt(store, input) {
  if (!token(input.guestId) || !token(input.attemptId) || typeof input.paperId !== "string" || !input.paperId || input.paperId.length > 200 || input.paperId === "sample-preview")
    fail("请从已提交试卷的成绩报告进入讨论区。", 403);
  const receipt = store.receipts?.[`${input.guestId}:${input.attemptId}`];
  if (!receipt || receipt.isSample || receipt.id !== input.attemptId || receipt.paperId !== input.paperId)
    fail("找不到这份试卷的提交凭证，请返回真实成绩报告。", 403);
  return receipt;
}

// Engagement stays server-side and is projected for the viewer without publishing identity capabilities.
const parentOf = (comment) => comment.parentId ?? null;
const rootOf = (comment) => comment.rootId ?? comment.id;
function publicComment(comment, viewerId, comments) {
  const { guestId, clientId, bodyHash, likedBy, ...publicFields } = comment;
  const likes = [...new Set(Array.isArray(likedBy) ? likedBy : [])];
  return structuredClone({ ...publicFields, parentId: parentOf(comment), rootId: rootOf(comment),
    replyTo: comment.replyTo ?? null, likeCount: likes.length, likedByMe: likes.includes(viewerId),
    replyCount: parentOf(comment) ? 0 : comments.filter(item => parentOf(item) && rootOf(item) === comment.id).length });
}
function paperComments(store, paperId) {
  return (store.features?.discussions?.comments ?? []).filter(comment => comment.paperId === paperId);
}
function targetComment(comments, id) {
  if (!token(id)) fail("评论不存在，请刷新后重试。", 404);
  const comment = comments.find(item => item.id === id);
  if (!comment) fail("评论不存在，请刷新后重试。", 404);
  return comment;
}
function commentPage(comments, cursor) {
  const index = cursor ? comments.findIndex(comment => comment.id === cursor) : -1;
  if (cursor && index < 0) fail("评论分页位置已失效，请刷新讨论。");
  const start = cursor ? index + 1 : 0, page = comments.slice(start, start + DISCUSSION_LIMITS.pageSize);
  return { page, nextCursor: start + page.length < comments.length ? page.at(-1).id : null };
}

export function createDiscussionsService({ readCatalog, mutateCatalog }) {
  return async function handle({ pathname, method, input, query, send }) {
    if (!["/api/discussions", "/api/discussions/replies", "/api/discussions/like"].includes(pathname)) return false;
    const allowed = pathname.endsWith("/replies") ? ["GET"] : pathname.endsWith("/like") ? ["POST"] : ["GET", "POST"];
    if (!allowed.includes(method)) { send(405, { error: "此评论操作不支持该请求方法。" }); return true; }
    if (method === "GET") {
      const scope = Object.fromEntries(["paperId", "guestId", "attemptId"].map(key => [key, query.get(key)]));
      const store = await readCatalog();
      findReceipt(store, scope);
      const comments = paperComments(store, scope.paperId);
      if (pathname.endsWith("/replies")) {
        const root = targetComment(comments, query.get("rootId"));
        if (parentOf(root)) fail("请从主评论展开回复。");
        const replies = comments.filter(comment => parentOf(comment) && rootOf(comment) === root.id).reverse();
        const { page, nextCursor } = commentPage(replies, query.get("before"));
        send(200, { paperId: scope.paperId, rootId: root.id, comments: page.map(comment => publicComment(comment, scope.guestId, comments)), total: replies.length, nextCursor });
      } else {
        const roots = comments.filter(comment => !parentOf(comment));
        const { page, nextCursor } = commentPage(roots, query.get("before"));
        send(200, { paperId: scope.paperId, comments: page.map(comment => publicComment(comment, scope.guestId, comments)),
          total: comments.length, rootTotal: roots.length, nextCursor });
      }
      return true;
    }
    const initial = await readCatalog();
    findReceipt(initial, input);
    if (pathname.endsWith("/like")) {
      if (typeof input.liked !== "boolean") fail("请选择点赞或取消点赞。");
      // Set membership is idempotent under retries and the catalog transaction serializes simultaneous voters.
      const result = await mutateCatalog(store => {
        findReceipt(store, input);
        const comments = paperComments(store, input.paperId), comment = targetComment(comments, input.commentId);
        const likes = new Set(Array.isArray(comment.likedBy) ? comment.likedBy : []);
        if (input.liked) likes.add(input.guestId); else likes.delete(input.guestId);
        comment.likedBy = [...likes];
        return { comment: publicComment(comment, input.guestId, comments), total: comments.length };
      });
      send(200, result); return true;
    }
    const parentId = input.parentId ?? null;
    if (parentId !== null && !token(parentId)) fail("回复目标无效，请重新选择评论。");
    const parsed = parseComment(input), body = { ...parsed, parentId };
    const legacyHash = parentId === null ? createHash("sha256").update(JSON.stringify(parsed)).digest("hex") : null;
    const bodyHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const result = await mutateCatalog(store => {
      const receipt = findReceipt(store, input), comments = paperComments(store, input.paperId);
      const existing = store.features?.discussions?.comments?.find(comment => comment.guestId === input.guestId && comment.clientId === input.clientId);
      if (existing) {
        if (existing.paperId !== input.paperId || existing.bodyHash !== bodyHash && existing.bodyHash !== legacyHash) fail("这条评论已提交，请刷新讨论后再发表新内容。", 409);
        return { comment: publicComment(existing, input.guestId, comments), replayed: true, total: comments.length,
          ...(parentOf(existing) ? { rootComment: publicComment(targetComment(comments, rootOf(existing)), input.guestId, comments) } : {}) };
      }
      const parent = parentId ? targetComment(comments, parentId) : null;
      store.features ??= {};
      store.features.discussions ??= { comments: [] };
      const id = randomUUID();
      const comment = {
        id, paperId: input.paperId, versionId: receipt.versionId,
        versionLabel: receipt.versionLabel ?? "", guestId: input.guestId, clientId: input.clientId, bodyHash,
        parentId, rootId: parent ? rootOf(parent) : id, replyTo: parent ? { id: parent.id, name: parent.author.name } : null,
        author: { name: body.nickname, avatarSeed: createHash("sha256").update(input.guestId).digest("hex").slice(0, 16) },
        text: body.text, links: body.links, images: body.images, audio: body.audio, createdAt: Date.now(),
      };
      store.features.discussions.comments.unshift(comment);
      const current = paperComments(store, input.paperId);
      return { comment: publicComment(comment, input.guestId, current), replayed: false, total: current.length,
        ...(parent ? { rootComment: publicComment(targetComment(current, rootOf(parent)), input.guestId, current) } : {}) };
    });
    send(result.replayed ? 200 : 201, result);
    return true;
  };
}
