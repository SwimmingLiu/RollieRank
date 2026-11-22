import { createHmac } from "node:crypto";

const DEFAULT_BUCKET = "rollie-rank";
const DEFAULT_DOMAIN = "https://rollie-rank-oss.swimmingliu.cn";
const DEFAULT_UP_HOST = "https://up-z0.qiniup.com";
const DEFAULT_AVATAR_PREFIX = "avatars/";
const DEFAULT_DISCUSSION_PREFIX = "discussions/";
const DEFAULT_FEEDBACK_PREFIX = "feedback/";

function urlSafeBase64(value) {
  const encoded = Buffer.isBuffer(value) ? value.toString("base64") : Buffer.from(String(value), "utf8").toString("base64");
  return encoded.replace(/\+/g, "-").replace(/\//g, "_");
}

function cleanOrigin(raw) {
  const text = String(raw || "").trim().replace(/\/+$/, "");
  if (!text) return "";
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function cleanPrefix(raw) {
  const cleaned = String(raw || "").trim().replace(/^\/+/, "");
  if (!cleaned) return "";
  return cleaned.endsWith("/") ? cleaned : cleaned + "/";
}

export function readQiniuConfig(env = process.env) {
  const ak = (env.ROLLIERANK_QINIU_AK || env.QINIU_AK || "").trim();
  const sk = (env.ROLLIERANK_QINIU_SK || env.QINIU_SK || "").trim();
  const bucket = (env.ROLLIERANK_QINIU_BUCKET || env.QINIU_BUCKET || DEFAULT_BUCKET).trim();
  const domain = cleanOrigin(env.ROLLIERANK_QINIU_DOMAIN || env.QINIU_DOMAIN || DEFAULT_DOMAIN);
  const upHost = cleanOrigin(env.ROLLIERANK_QINIU_UP_HOST || env.QINIU_UP_HOST || DEFAULT_UP_HOST);
  const avatarPrefix = cleanPrefix(env.ROLLIERANK_QINIU_AVATAR_PREFIX ?? DEFAULT_AVATAR_PREFIX);
  const discussionPrefix = cleanPrefix(env.ROLLIERANK_QINIU_DISCUSSION_PREFIX ?? DEFAULT_DISCUSSION_PREFIX);
  const feedbackPrefix = cleanPrefix(env.ROLLIERANK_QINIU_FEEDBACK_PREFIX ?? DEFAULT_FEEDBACK_PREFIX);
  return { ak, sk, bucket, domain, upHost, avatarPrefix, discussionPrefix, feedbackPrefix };
}

export function createUploadToken({ ak, sk, bucket, key, ttlSeconds = 300, nowSeconds = Math.floor(Date.now() / 1000) }) {
  const policy = JSON.stringify({
    scope: key ? `${bucket}:${key}` : bucket,
    deadline: nowSeconds + ttlSeconds,
  });
  const encodedPolicy = urlSafeBase64(policy);
  const digest = createHmac("sha1", sk).update(encodedPolicy).digest();
  return `${ak}:${urlSafeBase64(digest)}:${encodedPolicy}`;
}

export function createQiniuStorage({
  config = readQiniuConfig(process.env),
  fetchImpl = globalThis.fetch,
} = {}) {
  const { ak, sk, bucket, domain, upHost, avatarPrefix, discussionPrefix, feedbackPrefix } = config;
  const enabled = Boolean(ak && sk && bucket && domain && upHost);

  async function uploadObject({ prefix, id, bytes, mime, errorMessage = "图片上传对象存储失败，请稍后重试。" }) {
    if (!enabled) return null;
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const safePrefix = cleanPrefix(prefix);
    const key = `${safePrefix}${id}.${ext}`;
    const token = createUploadToken({ ak, sk, bucket, key });
    const form = new FormData();
    form.append("token", token);
    form.append("key", key);
    form.append("file", new Blob([bytes], { type: mime }), `${id}.${ext}`);
    let response;
    try {
      response = await fetchImpl(upHost, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw Object.assign(new Error(errorMessage), { statusCode: 502 });
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok || payload?.key !== key) {
      throw Object.assign(new Error(errorMessage), { statusCode: 502 });
    }
    return { key, url: `${domain}/${key}` };
  }

  return {
    isEnabled: () => enabled,
    uploadImage: ({ prefix = "", id, bytes, mime, errorMessage }) =>
      uploadObject({ prefix, id, bytes, mime, errorMessage }),
    uploadAvatar: ({ id, bytes, mime }) =>
      uploadObject({ prefix: avatarPrefix, id, bytes, mime, errorMessage: "头像上传对象存储失败，请稍后重试。" }),
    uploadDiscussionImage: ({ id, bytes, mime }) =>
      uploadObject({ prefix: discussionPrefix, id, bytes, mime, errorMessage: "评论图片上传对象存储失败，请稍后重试。" }),
    uploadFeedbackImage: ({ id, bytes, mime }) =>
      uploadObject({ prefix: feedbackPrefix, id, bytes, mime, errorMessage: "反馈截图上传对象存储失败，请稍后重试。" }),
  };
}

export function createQiniuAvatarStorage(options) {
  return createQiniuStorage(options);
}
