import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const WECHAT_API = "https://api.weixin.qq.com";
const WECHAT_CODE = /^[\w-]{1,256}$/;
const OPENID_TTL_MS = 90 * 60 * 1000;
const MEDIA_SIG_TTL_MS = 15 * 60 * 1000;

export const WECHAT_RISK_LABELS = Object.freeze({
  100: "正常",
  10001: "广告",
  20001: "时政",
  20002: "色情",
  20003: "辱骂",
  20006: "违法犯罪",
  20008: "欺诈",
  20012: "低俗",
  20013: "版权",
  21000: "其他风险",
});

export function labelName(code) {
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) return "";
  return WECHAT_RISK_LABELS[numeric] ?? `风险(${numeric})`;
}

export function normalizeKeywords(input) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\n,，;；]+/)
      : [];
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const cleaned = item.trim();
    if (!cleaned || cleaned.length > 40) continue;
    const key = cleaned.toLocaleLowerCase("zh-CN");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= 200) break;
  }
  return result;
}

export function matchKeywords(text, keywords) {
  if (typeof text !== "string" || !text.trim() || !Array.isArray(keywords) || !keywords.length) return [];
  const normalized = text.toLocaleLowerCase("zh-CN");
  const compact = normalized.replace(/[\s\u200b-\u200d\ufeff]+/g, "");
  const matched = [];
  for (const keyword of keywords) {
    if (typeof keyword !== "string" || !keyword.trim()) continue;
    const lower = keyword.trim().toLocaleLowerCase("zh-CN");
    if (normalized.includes(lower) || compact.includes(lower.replace(/\s+/g, ""))) {
      matched.push(keyword.trim());
    }
  }
  return matched;
}

export function wechatConfig(env = process.env) {
  const appId = env.ROLLIERANK_WECHAT_APP_ID?.trim() || "";
  const secret = env.ROLLIERANK_WECHAT_APP_SECRET?.trim() || "";
  const flag = env.ROLLIERANK_WECHAT_SEC_CHECK?.trim();
  const enabled = Boolean(appId && secret && flag !== "0");
  const msgToken = env.ROLLIERANK_WECHAT_MSG_TOKEN?.trim() || "";
  const publicBaseUrl = (env.ROLLIERANK_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  const mediaSecret = (env.ROLLIERANK_WECHAT_MEDIA_SECRET || secret || env.ROLLIERANK_REVIEW_TOKEN || "").trim();
  return { appId, secret, enabled, msgToken, publicBaseUrl, mediaSecret };
}

function safeEqualText(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

function xmlTag(xml, name) {
  const pattern = new RegExp(`<${name}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${name}>`, "i");
  const match = xml.match(pattern);
  return match ? (match[1] ?? match[2] ?? "").trim() : "";
}

export function parseWechatCallbackBody(rawBody) {
  const trimmed = String(rawBody ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      if (!json || typeof json !== "object") return null;
      return {
        event: json.Event || json.event || "",
        traceId: json.trace_id || json.TraceId || "",
        suggest: json.result?.suggest || "",
        label: Number(json.result?.label ?? 0) || 0,
        detail: Array.isArray(json.detail) ? json.detail : [],
        raw: json,
      };
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("<")) {
    const event = xmlTag(trimmed, "Event");
    const traceId = xmlTag(trimmed, "trace_id");
    const resultBlock = trimmed.match(/<result>([\s\S]*?)<\/result>/i)?.[1] ?? trimmed;
    const suggest = xmlTag(resultBlock, "suggest");
    const label = Number(xmlTag(resultBlock, "label") || 0) || 0;
    const detail = [];
    for (const block of trimmed.matchAll(/<detail>([\s\S]*?)<\/detail>/gi)) {
      const inner = block[1];
      const itemSuggest = xmlTag(inner, "suggest");
      const itemLabel = Number(xmlTag(inner, "label") || 0) || 0;
      const itemStrategy = xmlTag(inner, "strategy");
      const itemKeyword = xmlTag(inner, "keyword");
      if (itemSuggest || itemLabel || itemStrategy || itemKeyword) {
        detail.push({ suggest: itemSuggest, label: itemLabel, strategy: itemStrategy, keyword: itemKeyword });
      }
    }
    return { event, traceId, suggest, label, detail };
  }
  return null;
}

export function createWechatModeration({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  const config = wechatConfig(env);
  let accessToken = "";
  let accessTokenExpires = 0;
  let pendingToken = null;
  const openIdCache = new Map();

  function purgeExpiredOpenIds() {
    const current = now();
    for (const [key, entry] of openIdCache) {
      if (entry.expiresAt <= current) openIdCache.delete(key);
    }
  }

  async function callWechat(path, query, payload) {
    const url = new URL(path, WECHAT_API);
    if (query) url.search = new URLSearchParams(query);
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(8000),
      ...(payload
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(payload),
          }
        : {}),
    });
    if (!response.ok) throw new Error(`微信安全接口返回 ${response.status}`);
    return response.json();
  }

  async function getAccessToken() {
    if (!config.enabled) return "";
    if (now() < accessTokenExpires && accessToken) return accessToken;
    pendingToken ??= (async () => {
      const result = await callWechat("/cgi-bin/stable_token", null, {
        grant_type: "client_credential",
        appid: config.appId,
        secret: config.secret,
        force_refresh: false,
      });
      if (!result?.access_token || !Number.isFinite(result.expires_in)) {
        throw new Error(result?.errmsg || "无法获取微信 access_token");
      }
      accessToken = result.access_token;
      accessTokenExpires = now() + Math.max(0, result.expires_in - 120) * 1000;
      return accessToken;
    })().finally(() => {
      pendingToken = null;
    });
    return pendingToken;
  }

  async function resolveOpenId({ openid, wxCode, guestId } = {}) {
    if (!config.enabled) return "";
    purgeExpiredOpenIds();
    if (typeof openid === "string" && WECHAT_CODE.test(openid)) {
      if (guestId) openIdCache.set(guestId, { openid, expiresAt: now() + OPENID_TTL_MS });
      return openid;
    }
    if (typeof wxCode === "string" && WECHAT_CODE.test(wxCode)) {
      try {
        const result = await callWechat("/sns/jscode2session", {
          appid: config.appId,
          secret: config.secret,
          js_code: wxCode,
          grant_type: "authorization_code",
        });
        if (!result?.errcode && typeof result?.openid === "string" && WECHAT_CODE.test(result.openid)) {
          if (guestId) openIdCache.set(guestId, { openid: result.openid, expiresAt: now() + OPENID_TTL_MS });
          return result.openid;
        }
      } catch {
        // 换取失败时降级使用缓存或交由人工审核，不阻断正常请求。
      }
    }
    if (guestId) {
      const cached = openIdCache.get(guestId);
      if (cached && cached.expiresAt > now()) return cached.openid;
    }
    return "";
  }

  async function checkText({ content, openid, scene = 2, nickname = "" }) {
    if (!config.enabled || !openid) return { skipped: true, suggest: "pass", label: "", labels: [] };
    const text = String(content ?? "").trim();
    if (!text) return { skipped: true, suggest: "pass", label: "", labels: [] };
    try {
      const token = await getAccessToken();
      const payload = {
        content: text.slice(0, 2500),
        version: 2,
        scene,
        openid,
        ...(nickname ? { nickname: String(nickname).slice(0, 32) } : {}),
      };
      const result = await callWechat("/wxa/msg_sec_check", { access_token: token }, payload);
      if (result?.errcode && result.errcode !== 0) {
        return {
          suggest: "review",
          label: "微信文本检测异常",
          labels: [],
          traceId: result.trace_id || "",
          degraded: true,
          errcode: result.errcode,
        };
      }
      const suggest = ["pass", "review", "risky"].includes(result?.result?.suggest)
        ? result.result.suggest
        : "pass";
      const code = Number(result?.result?.label ?? 100);
      const detailLabels = Array.isArray(result?.detail)
        ? [...new Set(result.detail
            .filter((item) => item?.suggest && item.suggest !== "pass")
            .map((item) => labelName(item.label))
            .filter(Boolean))]
        : [];
      const primary = code && code !== 100 ? labelName(code) : detailLabels[0] || "";
      const labels = [...new Set([primary, ...detailLabels].filter(Boolean))];
      return {
        suggest,
        label: primary,
        labels,
        traceId: result?.trace_id || "",
      };
    } catch {
      return {
        suggest: "review",
        label: "微信文本检测超时",
        labels: [],
        degraded: true,
      };
    }
  }

  async function checkImageSync({ bytes, mime = "image/png" }) {
    if (!config.enabled) return { skipped: true, suggest: "pass", label: "" };
    if (!Buffer.isBuffer(bytes) || !bytes.length) return { suggest: "review", label: "图片内容无效", degraded: true };
    // 微信同步 img_sec_check 上限为 1 MB，超出时交由异步检测或人工复核。
    if (bytes.length > 1024 * 1024) {
      return { suggest: "review", label: "图片超过同步检测大小限制", degraded: true };
    }
    try {
      const token = await getAccessToken();
      const ext = mime === "image/jpeg" ? "jpg" : "png";
      const form = new FormData();
      form.append("media", new Blob([bytes], { type: mime }), `check.${ext}`);
      const url = new URL("/wxa/img_sec_check", WECHAT_API);
      url.search = new URLSearchParams({ access_token: token });
      const response = await fetchImpl(url, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        return { suggest: "review", label: "微信图片检测异常", degraded: true };
      }
      const result = await response.json().catch(() => null);
      if (result?.errcode === 0) {
        return { suggest: "pass", label: "" };
      }
      if (result?.errcode === 87014) {
        return { suggest: "risky", label: "违规图片", errcode: 87014 };
      }
      return {
        suggest: "review",
        label: "微信图片检测异常",
        degraded: true,
        errcode: result?.errcode,
      };
    } catch {
      return { suggest: "review", label: "微信图片检测超时", degraded: true };
    }
  }

  async function checkMediaAsync({ mediaUrl, mediaType = 2, openid, scene = 2 }) {
    if (!config.enabled || !openid || !mediaUrl) return { skipped: true };
    try {
      const token = await getAccessToken();
      const result = await callWechat("/wxa/media_check_async", { access_token: token }, {
        media_url: mediaUrl,
        media_type: mediaType,
        version: 2,
        scene,
        openid,
      });
      if (result?.errcode && result.errcode !== 0) {
        return {
          error: true,
          errcode: result.errcode,
          message: result.errmsg || "微信多媒体检测提交失败",
        };
      }
      if (!result?.trace_id) {
        return { error: true, message: "微信未返回媒体检测 trace_id" };
      }
      return { traceId: result.trace_id };
    } catch {
      return { error: true, message: "微信多媒体检测请求失败" };
    }
  }

  function mediaSignature(parts) {
    if (!config.mediaSecret) return "";
    return createHmac("sha256", config.mediaSecret).update(parts.join("|")).digest("hex");
  }

  function buildMediaUrl({ targetType, targetId, kind, index = 0, ttlMs = MEDIA_SIG_TTL_MS }) {
    if (!config.publicBaseUrl || !config.mediaSecret) return "";
    const exp = String(now() + ttlMs);
    const sig = mediaSignature([targetType, targetId, kind, String(index), exp]);
    const path = targetType === "avatar" ? "/api/miniprogram-profile/sec-avatar" : "/api/discussions/media";
    const url = new URL(path, config.publicBaseUrl + "/");
    url.searchParams.set("id", targetId);
    url.searchParams.set("kind", kind);
    url.searchParams.set("index", String(index));
    url.searchParams.set("exp", exp);
    url.searchParams.set("sig", sig);
    return url.href;
  }

  function verifyMediaUrl({ targetType, targetId, kind, index = 0, exp, sig }) {
    if (!config.mediaSecret || !targetId || !kind || !exp || !sig) return false;
    const expires = Number(exp);
    if (!Number.isSafeInteger(expires) || expires < now()) return false;
    const expected = mediaSignature([targetType, targetId, kind, String(index), String(exp)]);
    return safeEqualText(expected, String(sig));
  }

  function verifyCallbackSignature({ signature, timestamp, nonce }) {
    if (!config.msgToken) return false;
    if (!signature || !timestamp || !nonce) return false;
    const digest = createHash("sha1")
      .update([config.msgToken, String(timestamp), String(nonce)].sort().join(""))
      .digest("hex");
    return safeEqualText(digest, String(signature).toLowerCase());
  }

  return {
    config,
    isEnabled: () => config.enabled,
    isMediaCallbackReady: () => Boolean(config.enabled && config.publicBaseUrl && config.mediaSecret),
    isCallbackTokenConfigured: () => Boolean(config.msgToken),
    resolveOpenId,
    checkText,
    checkImageSync,
    checkMediaAsync,
    buildMediaUrl,
    verifyMediaUrl,
    verifyCallbackSignature,
    parseCallbackBody: parseWechatCallbackBody,
  };
}
