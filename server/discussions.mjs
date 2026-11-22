import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { inflateSync } from "node:zlib";
import { DISCUSSION_LIMITS, normalizeDiscussionLink } from "../src/features/discussions.js";
import { createWechatModeration, labelName, matchKeywords, normalizeKeywords } from "./wechat-moderation.mjs";
import { avatarUrlForProfile, defaultNickname, isDefaultNickname, wechatProfilesByGuest } from "./wechat-profile.mjs";
import { createQiniuStorage } from "./qiniu-oss.mjs";

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const token = (value) => typeof value === "string" && /^[\w-]{10,80}$/.test(value);
const invalidControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const VALID_MODES = new Set(["auto", "manual"]);
const VALID_ADMIN_FILTERS = new Set(["all", "queue", "pending", "flagged", "approved", "rejected"]);
const MAX_BLOCKED_LOG = 200;

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
  return {
    dataUri: `data:image/png;base64,${normalized.toString("base64")}`,
    buffer: normalized,
    mime: "image/png",
    width,
    height,
    bytes: normalized.length,
  };
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

function authorizeAdmin(request, input) {
  const configured = process.env.ROLLIERANK_REVIEW_TOKEN;
  if (typeof configured !== "string" || !configured.trim())
    fail("审核尚未启用，请联系维护者配置审核凭证。", 403);
  const header = request?.headers?.authorization ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const provided = typeof input?.reviewToken === "string" && input.reviewToken ? input.reviewToken : bearer;
  if (typeof provided !== "string" || !provided || provided.length > 4096)
    fail("维护者凭证无效，请重新输入。", 403);
  const hash = (value) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(configured), hash(provided)))
    fail("维护者凭证无效，请重新输入。", 403);
}

const DEFAULT_SETTINGS = Object.freeze({ mode: "auto", blockedKeywords: [] });

function readSettings(store) {
  const raw = store.features?.discussions?.settings;
  return {
    mode: VALID_MODES.has(raw?.mode) ? raw.mode : DEFAULT_SETTINGS.mode,
    blockedKeywords: normalizeKeywords(raw?.blockedKeywords),
  };
}

function writableDiscussions(store) {
  store.features ??= {};
  const section = (store.features.discussions ??= { comments: [] });
  section.comments ??= [];
  return section;
}

function commentStatus(comment) {
  const status = comment?.moderation?.status;
  return ["approved", "pending", "flagged", "rejected"].includes(status) ? status : "approved";
}

function isVisibleToViewer(comment, viewerId) {
  const status = commentStatus(comment);
  if (status === "approved") return true;
  if (comment.guestId === viewerId && (status === "pending" || status === "flagged")) return true;
  return false;
}

function isInReviewQueue(comment) {
  const status = commentStatus(comment);
  return status === "pending" || status === "flagged" || (Array.isArray(comment.reports) && comment.reports.length > 0 && status !== "rejected");
}

// Engagement stays server-side and is projected for the viewer without publishing identity capabilities.
const parentOf = (comment) => comment.parentId ?? null;
const rootOf = (comment) => comment.rootId ?? comment.id;
function resolveAuthor(comment, profilesByGuest) {
  const base = comment.author ?? { name: defaultNickname(comment.guestId), avatarSeed: "" };
  const profile = profilesByGuest?.get(comment.guestId);
  const profileName = typeof profile?.name === "string" ? profile.name.trim() : "";
  const baseName = typeof base.name === "string" ? base.name.trim() : "";
  const name = !isDefaultNickname(profileName)
    ? profileName
    : !isDefaultNickname(baseName)
      ? baseName
      : defaultNickname(comment.guestId);
  const avatarUrl = avatarUrlForProfile(profile) || (typeof base.avatarUrl === "string" ? base.avatarUrl : "");
  return {
    ...base,
    name,
    ...(avatarUrl ? { avatarUrl } : {}),
  };
}
function resolveReplyTo(comment, allComments, profilesByGuest) {
  if (!comment.replyTo) return null;
  const target = Array.isArray(allComments) ? allComments.find(item => item.id === comment.replyTo.id) : null;
  if (!target) return comment.replyTo;
  return { ...comment.replyTo, name: resolveAuthor(target, profilesByGuest).name };
}
function projectDiscussionImages(images) {
  return (Array.isArray(images) ? images : []).map((img) => ({
    ...img,
    dataUri: img.url || img.dataUri || "",
  }));
}

function publicComment(comment, viewerId, visibleComments, profilesByGuest) {
  const { guestId, clientId, bodyHash, likedBy, moderation, reports, ...publicFields } = comment;
  const likes = [...new Set(Array.isArray(likedBy) ? likedBy : [])];
  const status = commentStatus(comment);
  const projected = {
    ...publicFields,
    images: projectDiscussionImages(comment.images),
    author: resolveAuthor(comment, profilesByGuest),
    parentId: parentOf(comment),
    rootId: rootOf(comment),
    replyTo: resolveReplyTo(comment, visibleComments, profilesByGuest),
    likeCount: likes.length,
    likedByMe: likes.includes(viewerId),
    replyCount: parentOf(comment) ? 0 : visibleComments.filter(item => parentOf(item) && rootOf(item) === comment.id).length,
  };
  if (status !== "approved") {
    projected.moderationStatus = status;
  }
  return structuredClone(projected);
}

function paperTitleMap(store) {
  const titles = new Map();
  for (const version of store.versions ?? []) {
    if (version?.paperId && version?.title && !titles.has(version.paperId)) {
      titles.set(version.paperId, version.title);
    }
  }
  return titles;
}

function adminCommentView(comment, titles, profilesByGuest) {
  const status = commentStatus(comment);
  const mod = comment.moderation ?? { status: "approved", source: "auto", reason: "", labels: [], traces: [] };
  const reports = Array.isArray(comment.reports) ? comment.reports : [];
  return structuredClone({
    id: comment.id,
    paperId: comment.paperId,
    paperTitle: titles.get(comment.paperId) ?? comment.paperId,
    versionId: comment.versionId,
    versionLabel: comment.versionLabel ?? "",
    parentId: parentOf(comment),
    rootId: rootOf(comment),
    replyTo: comment.replyTo ?? null,
    author: resolveAuthor(comment, profilesByGuest),
    text: comment.text ?? "",
    links: comment.links ?? [],
    images: comment.images ?? [],
    audio: comment.audio ?? null,
    likeCount: Array.isArray(comment.likedBy) ? new Set(comment.likedBy).size : 0,
    createdAt: comment.createdAt,
    moderation: {
      status,
      source: mod.source ?? "auto",
      reason: mod.reason ?? "",
      label: mod.label ?? "",
      labels: Array.isArray(mod.labels) ? mod.labels : [],
      traces: Array.isArray(mod.traces) ? mod.traces : [],
      reviewedAt: mod.reviewedAt ?? null,
    },
    reportCount: reports.length,
    reports: reports.map(({ reason, createdAt }) => ({ reason, createdAt })),
  });
}

function moderationSummary(store, moderation) {
  const comments = store.features?.discussions?.comments ?? [];
  const blockedLog = store.features?.discussions?.blockedLog ?? [];
  const settings = readSettings(store);
  let pendingCount = 0;
  let flaggedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let reportedCount = 0;
  for (const comment of comments) {
    const status = commentStatus(comment);
    if (status === "pending") pendingCount += 1;
    else if (status === "flagged") flaggedCount += 1;
    else if (status === "rejected") rejectedCount += 1;
    else approvedCount += 1;
    if (Array.isArray(comment.reports) && comment.reports.length > 0 && status !== "rejected") {
      reportedCount += 1;
    }
  }
  const queueCount = comments.filter(isInReviewQueue).length;
  return {
    reviewEnabled: Boolean(process.env.ROLLIERANK_REVIEW_TOKEN?.trim()),
    totalCount: comments.length,
    queueCount,
    pendingCount,
    flaggedCount,
    approvedCount,
    rejectedCount,
    reportedCount,
    blockedCount: blockedLog.length,
    mode: settings.mode,
    keywordCount: settings.blockedKeywords.length,
    wechatSecEnabled: moderation.isEnabled(),
    mediaCallbackReady: moderation.isMediaCallbackReady(),
    callbackTokenConfigured: moderation.isCallbackTokenConfigured(),
  };
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

function appendAudit(store, action, target) {
  store.audit ??= [];
  store.audit.unshift({ id: randomUUID(), action, target, createdAt: Date.now() });
}

function recordBlockedAttempt(store, entry) {
  const section = writableDiscussions(store);
  section.blockedLog ??= [];
  section.blockedLog.unshift({ id: randomUUID(), ...entry, createdAt: Date.now() });
  if (section.blockedLog.length > MAX_BLOCKED_LOG) {
    section.blockedLog.length = MAX_BLOCKED_LOG;
  }
}

export function createDiscussionsService(
  { readCatalog, mutateCatalog, moderation = createWechatModeration() },
  { oss } = {},
) {
  const imageStorage = oss ?? createQiniuStorage();
  async function applyMediaCheckResult(payload) {
    if (!payload?.traceId) return false;
    const suggest = ["pass", "review", "risky"].includes(payload.suggest) ? payload.suggest : "review";
    const label = payload.label && payload.label !== 100 ? labelName(payload.label) : "";
    let matched = false;
    await mutateCatalog((store) => {
      const comments = store.features?.discussions?.comments ?? [];
      for (const comment of comments) {
        const traces = comment.moderation?.traces;
        if (!Array.isArray(traces)) continue;
        const trace = traces.find((item) => item.traceId === payload.traceId);
        if (!trace) continue;
        matched = true;
        trace.status = suggest;
        trace.label = label;
        trace.checkedAt = Date.now();
        // 已由管理员人工裁决的评论不再被延迟回调覆盖。
        if (comment.moderation.source === "manual") break;
        const allTraces = traces;
        const risky = allTraces.find((item) => item.status === "risky");
        const review = allTraces.find((item) => item.status === "review");
        const pending = allTraces.some((item) => item.status === "pending");
        const labels = [...new Set([
          ...(comment.moderation.labels ?? []),
          ...allTraces.map((item) => item.label).filter(Boolean),
        ])];
        comment.moderation.labels = labels;
        if (risky) {
          comment.moderation.status = "rejected";
          comment.moderation.source = "wechat";
          comment.moderation.label = risky.label || "违规媒体";
          comment.moderation.reason = `微信媒体检测（含图片文字）拦截：${risky.label || "疑似违规"}`;
          comment.moderation.reviewedAt = Date.now();
        } else if (review) {
          comment.moderation.status = "flagged";
          comment.moderation.source = "wechat";
          comment.moderation.label = review.label || "疑似违规";
          comment.moderation.reason = `微信媒体检测（含图片文字）建议复核：${review.label || "需人工确认"}`;
        } else if (!pending) {
          if (comment.moderation.requireManualApproval) {
            comment.moderation.status = "pending";
            comment.moderation.reason = "微信媒体检测通过，等待管理员审核公开";
          } else if (comment.moderation.status === "pending") {
            comment.moderation.status = "approved";
            comment.moderation.source = "wechat";
            comment.moderation.reason = "微信内容安全检测通过";
            comment.moderation.reviewedAt = Date.now();
          }
        }
        break;
      }
    });
    return matched;
  }

  async function handle({ request, response, pathname, method, input, query, send }) {
    const handledPaths = [
      "/api/discussions",
      "/api/discussions/replies",
      "/api/discussions/like",
      "/api/discussions/report",
      "/api/discussions/media",
      "/api/discussions/admin/summary",
      "/api/discussions/admin/list",
      "/api/discussions/admin/review",
      "/api/discussions/admin/settings",
    ];
    if (!handledPaths.includes(pathname)) return false;

    if (pathname === "/api/discussions/media") {
      if (method !== "GET") { send(405, { error: "此接口仅支持 GET。" }); return true; }
      const id = query.get("id") || "";
      const kind = query.get("kind") || "";
      const index = Number(query.get("index") ?? 0);
      const exp = query.get("exp") || "";
      const sig = query.get("sig") || "";
      if (!moderation.verifyMediaUrl({ targetType: "comment", targetId: id, kind, index, exp, sig })) {
        send(403, { error: "媒体校验链接已失效。" });
        return true;
      }
      const store = await readCatalog();
      const comment = (store.features?.discussions?.comments ?? []).find((item) => item.id === id);
      if (!comment) { send(404, { error: "找不到对应媒体。" }); return true; }
      let dataUri = "";
      let mime = "";
      if (kind === "image" && Number.isInteger(index) && comment.images?.[index]) {
        const image = comment.images[index];
        if (image.url && !image.dataUri) {
          response.writeHead(302, { Location: image.url, "Cache-Control": "private, no-store" });
          response.end();
          return true;
        }
        if (!image.dataUri) {
          send(404, { error: "找不到对应媒体。" });
          return true;
        }
        dataUri = image.dataUri;
        mime = "image/png";
      } else if (kind === "audio" && comment.audio?.dataUri) {
        dataUri = comment.audio.dataUri;
        mime = "audio/wav";
      } else {
        send(404, { error: "找不到对应媒体。" });
        return true;
      }
      const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
      const bytes = Buffer.from(base64, "base64");
      response.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": bytes.length,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(bytes);
      return true;
    }

    if (pathname === "/api/discussions/admin/summary") {
      if (method !== "GET") { send(405, { error: "此接口仅支持 GET。" }); return true; }
      const store = await readCatalog();
      send(200, moderationSummary(store, moderation));
      return true;
    }

    if (pathname === "/api/discussions/admin/list") {
      if (method !== "POST") { send(405, { error: "此接口仅支持 POST。" }); return true; }
      authorizeAdmin(request, input);
      const store = await readCatalog();
      const titles = paperTitleMap(store);
      const filter = VALID_ADMIN_FILTERS.has(input.status) ? input.status : "queue";
      const paperId = typeof input.paperId === "string" && input.paperId.trim() ? input.paperId.trim() : "";
      const keyword = typeof input.query === "string" ? input.query.trim().toLocaleLowerCase("zh-CN") : "";
      const page = Number.isInteger(input.page) && input.page >= 1 ? input.page : 1;
      const pageSize = Number.isInteger(input.pageSize) && input.pageSize >= 1 && input.pageSize <= 100 ? input.pageSize : 20;
      const all = store.features?.discussions?.comments ?? [];
      const filtered = all.filter((comment) => {
        const status = commentStatus(comment);
        if (filter === "queue" && !isInReviewQueue(comment)) return false;
        if (filter !== "all" && filter !== "queue" && status !== filter) return false;
        if (paperId && comment.paperId !== paperId) return false;
        if (keyword) {
          const hay = [
            comment.text,
            comment.author?.name,
            titles.get(comment.paperId),
            comment.paperId,
            comment.moderation?.reason,
            ...(comment.links ?? []),
          ].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
          if (!hay.includes(keyword)) return false;
        }
        return true;
      });
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const current = Math.min(page, pages);
      const slice = filtered.slice((current - 1) * pageSize, current * pageSize);
      const papers = [...new Map(all.map((comment) => [comment.paperId, {
        paperId: comment.paperId,
        title: titles.get(comment.paperId) ?? comment.paperId,
      }])).values()];
      const profilesByGuest = wechatProfilesByGuest(store);
      send(200, {
        summary: moderationSummary(store, moderation),
        settings: readSettings(store),
        comments: slice.map((comment) => adminCommentView(comment, titles, profilesByGuest)),
        blockedLog: structuredClone((store.features?.discussions?.blockedLog ?? []).slice(0, 30)),
        papers,
        total: filtered.length,
        page: current,
        pageSize,
        pages,
      });
      return true;
    }

    if (pathname === "/api/discussions/admin/review") {
      if (method !== "POST") { send(405, { error: "此接口仅支持 POST。" }); return true; }
      authorizeAdmin(request, input);
      const action = input.action;
      if (!["approve", "reject", "delete"].includes(action)) fail("请选择通过、屏蔽或删除操作。");
      const rawIds = Array.isArray(input.commentIds) ? input.commentIds : (input.commentId ? [input.commentId] : []);
      if (!rawIds.length || rawIds.length > 100 || !rawIds.every(token)) fail("请选择有效的评论。");
      const reason = cleanText(input.reason, "审核理由", 500, false);
      const idSet = new Set(rawIds);
      const result = await mutateCatalog((store) => {
        const section = writableDiscussions(store);
        const titles = paperTitleMap(store);
        const targets = section.comments.filter((item) => idSet.has(item.id));
        if (!targets.length) fail("找不到要操作的评论。", 404);
        const now = Date.now();
        if (action === "delete") {
          const removedRoots = new Set(targets.filter((item) => !parentOf(item)).map((item) => item.id));
          section.comments = section.comments.filter((item) => !idSet.has(item.id) && !removedRoots.has(rootOf(item)));
          appendAudit(store, "删除评论", `${targets.length} 条评论${reason ? `（${reason}）` : ""}`);
          return { deleted: targets.length, summary: moderationSummary(store, moderation) };
        }
        const profilesByGuest = wechatProfilesByGuest(store);
        const updated = [];
        for (const comment of targets) {
          const prev = comment.moderation ?? {};
          const nextStatus = action === "approve" ? "approved" : "rejected";
          comment.moderation = {
            ...prev,
            status: nextStatus,
            source: "manual",
            reason: reason || (action === "approve" ? "管理员人工审核通过" : "管理员屏蔽违规评论"),
            labels: Array.isArray(prev.labels) ? prev.labels : [],
            traces: Array.isArray(prev.traces) ? prev.traces : [],
            reviewedAt: now,
            requireManualApproval: false,
          };
          if (action === "approve" && Array.isArray(comment.reports)) {
            comment.reports = [];
          }
          updated.push(adminCommentView(comment, titles, profilesByGuest));
        }
        appendAudit(
          store,
          action === "approve" ? "审核通过评论" : "屏蔽评论",
          `${targets.length} 条评论${reason ? `（${reason}）` : ""}`,
        );
        return { updated, summary: moderationSummary(store, moderation) };
      });
      send(200, result);
      return true;
    }

    if (pathname === "/api/discussions/admin/settings") {
      if (method !== "POST") { send(405, { error: "此接口仅支持 POST。" }); return true; }
      authorizeAdmin(request, input);
      if (input.mode !== undefined && !VALID_MODES.has(input.mode)) fail("审核模式仅支持 auto 或 manual。");
      const result = await mutateCatalog((store) => {
        const section = writableDiscussions(store);
        const current = readSettings(store);
        const next = {
          mode: input.mode ?? current.mode,
          blockedKeywords: input.blockedKeywords !== undefined
            ? normalizeKeywords(input.blockedKeywords)
            : current.blockedKeywords,
        };
        section.settings = next;
        appendAudit(
          store,
          "更新评论审核配置",
          `模式：${next.mode === "manual" ? "先审后发" : "自动机审"} · 敏感词 ${next.blockedKeywords.length} 个`,
        );
        return { settings: next, summary: moderationSummary(store, moderation) };
      });
      send(200, result);
      return true;
    }

    const allowed = pathname.endsWith("/replies") ? ["GET"] : (pathname.endsWith("/like") || pathname.endsWith("/report")) ? ["POST"] : ["GET", "POST"];
    if (!allowed.includes(method)) { send(405, { error: "此评论操作不支持该请求方法。" }); return true; }

    if (method === "GET") {
      const scope = Object.fromEntries(["paperId", "guestId", "attemptId"].map(key => [key, query.get(key)]));
      const store = await readCatalog();
      findReceipt(store, scope);
      const visible = paperComments(store, scope.paperId).filter((comment) => isVisibleToViewer(comment, scope.guestId));
      const profilesByGuest = wechatProfilesByGuest(store);
      if (pathname.endsWith("/replies")) {
        const root = targetComment(visible, query.get("rootId"));
        if (parentOf(root)) fail("请从主评论展开回复。");
        const replies = visible.filter(comment => parentOf(comment) && rootOf(comment) === root.id).reverse();
        const { page, nextCursor } = commentPage(replies, query.get("before"));
        send(200, { paperId: scope.paperId, rootId: root.id, comments: page.map(comment => publicComment(comment, scope.guestId, visible, profilesByGuest)), total: replies.length, nextCursor });
      } else {
        const roots = visible.filter(comment => !parentOf(comment));
        const { page, nextCursor } = commentPage(roots, query.get("before"));
        send(200, { paperId: scope.paperId, comments: page.map(comment => publicComment(comment, scope.guestId, visible, profilesByGuest)),
          total: visible.length, rootTotal: roots.length, nextCursor });
      }
      return true;
    }

    const initial = await readCatalog();
    findReceipt(initial, input);
    if (pathname === "/api/discussions" && initial.features?.users?.[input.guestId]?.muted) {
      const muteReason = initial.features.users[input.guestId].muteReason;
      fail(muteReason ? `账号已被禁言：${muteReason}` : "您的账号暂不可发表评论，请联系管理员。", 403);
    }
    if (pathname.endsWith("/like")) {
      if (typeof input.liked !== "boolean") fail("请选择点赞或取消点赞。");
      // Set membership is idempotent under retries and the catalog transaction serializes simultaneous voters.
      const result = await mutateCatalog(store => {
        findReceipt(store, input);
        const visible = paperComments(store, input.paperId).filter((comment) => isVisibleToViewer(comment, input.guestId));
        const profilesByGuest = wechatProfilesByGuest(store);
        const comment = targetComment(visible, input.commentId);
        const likes = new Set(Array.isArray(comment.likedBy) ? comment.likedBy : []);
        if (input.liked) likes.add(input.guestId); else likes.delete(input.guestId);
        comment.likedBy = [...likes];
        return { comment: publicComment(comment, input.guestId, visible, profilesByGuest), total: visible.length };
      });
      send(200, result); return true;
    }

    if (pathname.endsWith("/report")) {
      const reason = cleanText(input.reason, "举报说明", 200, true);
      const result = await mutateCatalog((store) => {
        findReceipt(store, input);
        const visible = paperComments(store, input.paperId).filter((comment) => isVisibleToViewer(comment, input.guestId));
        const comment = targetComment(visible, input.commentId);
        comment.reports ??= [];
        const existing = comment.reports.find((item) => item.guestId === input.guestId);
        if (!existing) {
          comment.reports.push({ guestId: input.guestId, reason, createdAt: Date.now() });
        }
        return { reported: true, reportCount: comment.reports.length };
      });
      send(200, result);
      return true;
    }

    const parentId = input.parentId ?? null;
    if (parentId !== null && !token(parentId)) fail("回复目标无效，请重新选择评论。");
    const parsed = parseComment(input), body = { ...parsed, parentId };
    const legacyHash = parentId === null ? createHash("sha256").update(JSON.stringify(parsed)).digest("hex") : null;
    const bodyHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");

    // 幂等重放先检查，避免重放请求重复触发微信内容安全接口。
    const prior = initial.features?.discussions?.comments?.find(comment => comment.guestId === input.guestId && comment.clientId === input.clientId);
    if (prior) {
      if (prior.paperId !== input.paperId || prior.bodyHash !== bodyHash && prior.bodyHash !== legacyHash) {
        fail("这条评论已提交，请刷新讨论后再发表新内容。", 409);
      }
      const visible = paperComments(initial, input.paperId).filter((comment) => isVisibleToViewer(comment, input.guestId));
      const profilesByGuest = wechatProfilesByGuest(initial);
      send(200, {
        comment: publicComment(prior, input.guestId, visible, profilesByGuest),
        replayed: true,
        total: visible.length,
        ...(parentOf(prior) && visible.some((item) => item.id === rootOf(prior))
          ? { rootComment: publicComment(targetComment(visible, rootOf(prior)), input.guestId, visible, profilesByGuest) }
          : {}),
      });
      return true;
    }

    // 第 1 层：自定义敏感词预检（本地零成本）。
    const settings = readSettings(initial);
    const combinedText = [
      body.nickname,
      body.text,
      ...body.links,
      ...body.images.map((item) => item.alt),
      body.audio?.name ?? "",
    ].filter(Boolean).join("\n");
    const matchedKeywords = matchKeywords(combinedText, settings.blockedKeywords);
    if (matchedKeywords.length) {
      await mutateCatalog((store) => {
        recordBlockedAttempt(store, {
          paperId: input.paperId,
          nickname: body.nickname,
          text: body.text.slice(0, 200),
          source: "keyword",
          reason: `命中敏感词：${matchedKeywords.join("、")}`,
        });
      });
      fail("评论包含不允许发布的内容，请修改后重试。", 422);
    }

    // 第 2 层：微信小程序文本安全检测（msgSecCheck，免费）。
    let openid = "";
    let moderationRecord = null;
    if (moderation.isEnabled()) {
      openid = await moderation.resolveOpenId({
        openid: input.openid,
        wxCode: input.wxCode,
        guestId: input.guestId,
      });
      if (openid && combinedText.trim()) {
        const textCheck = await moderation.checkText({
          content: combinedText,
          openid,
          scene: 2,
          nickname: body.nickname,
        });
        if (textCheck.suggest === "risky") {
          const reason = `微信文本检测拦截：${textCheck.label || "违规内容"}`;
          await mutateCatalog((store) => {
            recordBlockedAttempt(store, {
              paperId: input.paperId,
              nickname: body.nickname,
              text: body.text.slice(0, 200),
              source: "wechat",
              label: textCheck.label || "",
              reason,
            });
          });
          fail("评论内容未通过安全检测，请修改后重试。", 422);
        }
        if (textCheck.suggest === "review") {
          moderationRecord = {
            status: "flagged",
            source: "wechat",
            label: textCheck.label || "待复核",
            labels: textCheck.labels ?? [],
            reason: textCheck.degraded
              ? `微信文本检测暂不可用，转人工复核（${textCheck.label || "超时"}）`
              : `微信文本检测建议复核：${textCheck.label || "疑似风险"}`,
            traces: [],
            reviewedAt: null,
            requireManualApproval: settings.mode === "manual",
          };
        } else {
          moderationRecord = {
            status: settings.mode === "manual" ? "pending" : "approved",
            source: "wechat",
            label: "",
            labels: [],
            reason: settings.mode === "manual" ? "已通过微信文本检测，等待管理员审核公开" : "微信文本检测通过",
            traces: [],
            reviewedAt: settings.mode === "manual" ? null : Date.now(),
            requireManualApproval: settings.mode === "manual",
          };
        }
      }
    }

    if (!moderationRecord && settings.mode === "manual") {
      moderationRecord = {
        status: "pending",
        source: "auto",
        label: "",
        labels: [],
        reason: "当前已开启先审后发，等待管理员审核",
        traces: [],
        reviewedAt: null,
        requireManualApproval: true,
      };
    }

    const hasMedia = body.images.length > 0 || Boolean(body.audio);
    const shouldCheckMedia = Boolean(hasMedia && moderation.isMediaCallbackReady() && openid);
    if (shouldCheckMedia) {
      moderationRecord ??= {
        status: "pending",
        source: "wechat",
        label: "",
        labels: [],
        reason: "媒体内容（含图片文字）正在安全检测中",
        traces: [],
        reviewedAt: null,
        requireManualApproval: settings.mode === "manual",
      };
      if (moderationRecord.status === "approved") {
        moderationRecord.status = "pending";
        moderationRecord.reason = "媒体内容（含图片文字）正在安全检测中";
        moderationRecord.reviewedAt = null;
      }
    }

    const storedImages = await Promise.all(body.images.map(async (img) => {
      const { buffer, mime, dataUri, ...meta } = img;
      if (imageStorage.isEnabled()) {
        const uploaded = await imageStorage.uploadDiscussionImage({
          id: randomBytes(16).toString("hex"),
          bytes: buffer,
          mime: mime || "image/png",
        });
        return { ...meta, url: uploaded.url, key: uploaded.key };
      }
      return { ...meta, dataUri };
    }));

    let createdId = "";
    const result = await mutateCatalog(store => {
      const receipt = findReceipt(store, input);
      const allPaper = paperComments(store, input.paperId);
      const profilesByGuest = wechatProfilesByGuest(store);
      const existing = store.features?.discussions?.comments?.find(comment => comment.guestId === input.guestId && comment.clientId === input.clientId);
      if (existing) {
        if (existing.paperId !== input.paperId || existing.bodyHash !== bodyHash && existing.bodyHash !== legacyHash) fail("这条评论已提交，请刷新讨论后再发表新内容。", 409);
        const visible = allPaper.filter((comment) => isVisibleToViewer(comment, input.guestId));
        return { comment: publicComment(existing, input.guestId, visible, profilesByGuest), replayed: true, total: visible.length,
          ...(parentOf(existing) && visible.some((item) => item.id === rootOf(existing))
            ? { rootComment: publicComment(targetComment(visible, rootOf(existing)), input.guestId, visible, profilesByGuest) }
            : {}) };
      }
      const visibleBefore = allPaper.filter((comment) => isVisibleToViewer(comment, input.guestId));
      const parent = parentId ? targetComment(visibleBefore, parentId) : null;
      const section = writableDiscussions(store);
      const id = randomUUID();
      createdId = id;
      const authorProfile = profilesByGuest.get(input.guestId);
      const profileName = typeof authorProfile?.name === "string" ? authorProfile.name.trim() : "";
      const authorName = !isDefaultNickname(profileName)
        ? profileName
        : !isDefaultNickname(body.nickname)
          ? body.nickname
          : defaultNickname(input.guestId);
      const authorAvatarUrl = avatarUrlForProfile(authorProfile);
      const comment = {
        id, paperId: input.paperId, versionId: receipt.versionId,
        versionLabel: receipt.versionLabel ?? "", guestId: input.guestId, clientId: input.clientId, bodyHash,
        parentId, rootId: parent ? rootOf(parent) : id, replyTo: parent ? { id: parent.id, name: resolveAuthor(parent, profilesByGuest).name } : null,
        author: {
          name: authorName,
          avatarSeed: createHash("sha256").update(input.guestId).digest("hex").slice(0, 16),
          ...(authorAvatarUrl ? { avatarUrl: authorAvatarUrl } : {}),
        },
        text: body.text, links: body.links, images: storedImages, audio: body.audio, createdAt: Date.now(),
        ...(moderationRecord ? { moderation: moderationRecord } : {}),
      };
      section.comments.unshift(comment);
      const visibleAfter = paperComments(store, input.paperId).filter((item) => isVisibleToViewer(item, input.guestId));
      return { comment: publicComment(comment, input.guestId, visibleAfter, profilesByGuest), replayed: false, total: visibleAfter.length,
        ...(parent ? { rootComment: publicComment(targetComment(visibleAfter, rootOf(parent)), input.guestId, visibleAfter, profilesByGuest) } : {}) };
    });

    // 第 3 层：提交微信图片/语音异步安全检测（含图片内文字 OCR 检测）。
    if (!result.replayed && shouldCheckMedia && createdId) {
      const jobs = [];
      for (let index = 0; index < body.images.length; index++) {
        const mediaUrl = moderation.buildMediaUrl({ targetType: "comment", targetId: createdId, kind: "image", index });
        if (mediaUrl) jobs.push({ kind: "image", index, mediaType: 2, mediaUrl });
      }
      if (body.audio) {
        const mediaUrl = moderation.buildMediaUrl({ targetType: "comment", targetId: createdId, kind: "audio", index: 0 });
        if (mediaUrl) jobs.push({ kind: "audio", index: 0, mediaType: 1, mediaUrl });
      }
      if (jobs.length) {
        const settled = await Promise.all(jobs.map(async (job) => {
          const check = await moderation.checkMediaAsync({
            mediaUrl: job.mediaUrl,
            mediaType: job.mediaType,
            openid,
            scene: 2,
          });
          return { ...job, check };
        }));
        await mutateCatalog((store) => {
          const comment = (store.features?.discussions?.comments ?? []).find((item) => item.id === createdId);
          if (!comment || !comment.moderation) return;
          const traces = [];
          let failed = false;
          for (const item of settled) {
            if (item.check?.traceId) {
              traces.push({
                traceId: item.check.traceId,
                kind: item.kind,
                index: item.index,
                status: "pending",
                label: "",
                checkedAt: null,
              });
            } else {
              failed = true;
            }
          }
          comment.moderation.traces = traces;
          if (failed) {
            comment.moderation.status = "flagged";
            comment.moderation.reason = "微信媒体检测提交失败，转人工复核";
          }
        });
      }
    }

    send(result.replayed ? 200 : 201, result);
    return true;
  }

  handle.applyMediaCheckResult = applyMediaCheckResult;
  return handle;
}
