import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { defaultNickname, wechatProfilesByGuest } from "./wechat-profile.mjs";
import { createQiniuStorage, readQiniuConfig } from "./qiniu-oss.mjs";

const WECHAT_API = "https://api.weixin.qq.com";
const GUEST_ID_RE = /^[\w-]{10,80}$/;
const WECHAT_CODE_RE = /^[\w-]{1,256}$/;
const TEMPLATE_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const TEMPLATE_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
const INVALID_CONTROLS_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const PNG_MAGIC = Buffer.from("89504e470d0a1a0a", "hex");
const JPEG_MAGIC = Buffer.from("ffd8ff", "hex");

const MAX_CONTENT_LEN = 1000;
const MAX_CONTACT_LEN = 100;
const MAX_REPLY_LEN = 1000;
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_NOTIFY_LOGS = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

export const FEEDBACK_CATEGORIES = Object.freeze({
  suggestion: "功能建议",
  bug: "问题报错",
  paper: "试卷缺失",
  other: "其他",
});

export const FEEDBACK_STATUSES = Object.freeze({
  pending: "待处理",
  processing: "处理中",
  replied: "已回复",
  closed: "已关闭",
});

export const MINIPROGRAM_STATES = new Set(["formal", "trial", "developer"]);

export const DEFAULT_FIELD_MAP = Object.freeze({
  categoryKey: "thing1",
  contentKey: "thing2",
  timeKey: "time3",
  userKey: "thing4",
});

const fault = (statusCode, message) => Object.assign(new Error(message), { statusCode });

function cleanText(value, label, max, required = false) {
  if (value == null || value === "") {
    if (required) throw fault(400, `请填写${label}。`);
    return "";
  }
  if (typeof value !== "string") throw fault(400, `${label}格式无效。`);
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (required && !text) throw fault(400, `请填写${label}。`);
  if (text.length > max || INVALID_CONTROLS_RE.test(text)) {
    throw fault(400, `${label}须为 ${required ? "1" : "0"}–${max} 字，且不能包含控制字符。`);
  }
  return text;
}

function validateGuestId(value) {
  if (typeof value !== "string" || !GUEST_ID_RE.test(value)) {
    throw fault(400, "本机身份凭证无效，请刷新后重试。");
  }
  return value;
}

function validateCategory(value) {
  const key = typeof value === "string" ? value.trim() : "";
  if (!Object.prototype.hasOwnProperty.call(FEEDBACK_CATEGORIES, key)) {
    throw fault(400, "请选择有效的反馈类型。");
  }
  return key;
}

function validateStatus(value) {
  const key = typeof value === "string" ? value.trim() : "";
  if (!Object.prototype.hasOwnProperty.call(FEEDBACK_STATUSES, key)) {
    throw fault(400, "反馈状态无效。");
  }
  return key;
}

function validateImage(image, index) {
  if (!image || typeof image !== "object" || Array.isArray(image)) {
    throw fault(400, "图片格式无效。");
  }
  const uri = image.dataUri;
  if (typeof uri !== "string") throw fault(400, "图片格式无效。");
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]*={0,2})$/.exec(uri);
  if (!match) throw fault(400, "截图仅支持 PNG 或 JPEG 格式。");
  const [, mime, base64] = match;
  if (!base64 || base64.length % 4 !== 0) throw fault(400, "截图编码无效，请重新选择。");
  if (base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
    throw fault(413, "单张截图不能超过 2 MB。");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length < 24 || bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64") !== base64) {
    throw fault(400, "截图内容无效，请重新选择。");
  }
  const isPng = mime === "image/png" && bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
  const isJpeg = mime === "image/jpeg" && bytes.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC);
  if (!isPng && !isJpeg) throw fault(400, "截图文件内容与格式不匹配，请重新选择。");
  return {
    dataUri: `data:${mime};base64,${base64}`,
    buffer: bytes,
    mime,
    bytes: bytes.length,
    alt: cleanText(image.alt, "截图说明", 80) || `反馈截图 ${index + 1}`,
  };
}

function normalizeClientMeta(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { platform: "miniprogram", envVersion: "", appVersion: "", page: "" };
  }
  const safe = (v, max = 64) => (typeof v === "string" ? v.replace(/[\r\n\t\u0000-\u001f]/g, "").trim().slice(0, max) : "");
  return {
    platform: safe(raw.platform, 24) || "miniprogram",
    envVersion: safe(raw.envVersion, 24),
    appVersion: safe(raw.appVersion, 32),
    page: safe(raw.page, 120),
  };
}

function maskOpenId(openid) {
  const value = String(openid || "");
  if (value.length <= 10) return value ? `${value.slice(0, 3)}***` : "";
  return `${value.slice(0, 5)}…${value.slice(-4)}`;
}

function defaultNotifyConfig(env = process.env) {
  const defaultState = MINIPROGRAM_STATES.has(env.ROLLIERANK_WECHAT_SUBSCRIBE_STATE?.trim())
    ? env.ROLLIERANK_WECHAT_SUBSCRIBE_STATE.trim()
    : env.ROLLIERANK_ENVIRONMENT === "test"
      ? "trial"
      : "formal";
  return {
    enabled: true,
    templateId: env.ROLLIERANK_WECHAT_FEEDBACK_TEMPLATE_ID?.trim() || "",
    miniprogramState: defaultState,
    page: "pages/admin/admin",
    fieldMap: { ...DEFAULT_FIELD_MAP },
    subscribers: [],
    logs: [],
  };
}

function readFeedbackData(store, env = process.env) {
  const defaults = defaultNotifyConfig(env);
  const raw = store?.features?.feedback;
  const rawNotify = raw?.notify ?? {};
  const fieldMap = {
    categoryKey: typeof rawNotify.fieldMap?.categoryKey === "string" ? rawNotify.fieldMap.categoryKey : defaults.fieldMap.categoryKey,
    contentKey: typeof rawNotify.fieldMap?.contentKey === "string" ? rawNotify.fieldMap.contentKey : defaults.fieldMap.contentKey,
    timeKey: typeof rawNotify.fieldMap?.timeKey === "string" ? rawNotify.fieldMap.timeKey : defaults.fieldMap.timeKey,
    userKey: typeof rawNotify.fieldMap?.userKey === "string" ? rawNotify.fieldMap.userKey : defaults.fieldMap.userKey,
  };
  return {
    items: Array.isArray(raw?.items) ? raw.items : [],
    notify: {
      enabled: rawNotify.enabled !== false,
      templateId: (typeof rawNotify.templateId === "string" && rawNotify.templateId.trim())
        ? rawNotify.templateId.trim()
        : defaults.templateId,
      miniprogramState: MINIPROGRAM_STATES.has(rawNotify.miniprogramState)
        ? rawNotify.miniprogramState
        : defaults.miniprogramState,
      page: (typeof rawNotify.page === "string" && rawNotify.page.trim())
        ? rawNotify.page.trim()
        : defaults.page,
      fieldMap,
      subscribers: Array.isArray(rawNotify.subscribers) ? rawNotify.subscribers : [],
      logs: Array.isArray(rawNotify.logs) ? rawNotify.logs : [],
    },
  };
}

function writableFeedbackData(store, env = process.env) {
  store.features ??= {};
  const defaults = defaultNotifyConfig(env);
  const data = (store.features.feedback ??= {
    items: [],
    notify: {
      enabled: defaults.enabled,
      templateId: "",
      miniprogramState: defaults.miniprogramState,
      page: defaults.page,
      fieldMap: { ...defaults.fieldMap },
      subscribers: [],
      logs: [],
    },
  });
  data.items ??= [];
  data.notify ??= {
    enabled: defaults.enabled,
    templateId: "",
    miniprogramState: defaults.miniprogramState,
    page: defaults.page,
    fieldMap: { ...defaults.fieldMap },
    subscribers: [],
    logs: [],
  };
  data.notify.fieldMap ??= { ...defaults.fieldMap };
  data.notify.subscribers ??= [];
  data.notify.logs ??= [];
  return data;
}

function formatShanghaiTime(ts, dateOnly = false) {
  const shifted = new Date((Number(ts) || Date.now()) + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  if (dateOnly) return `${y}-${m}-${d}`;
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export function formatSubscribeFieldValue(key, rawValue, timestamp = Date.now()) {
  const k = String(key || "").trim();
  const text = String(rawValue ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (/^time\d+$/i.test(k)) return formatShanghaiTime(timestamp, false);
  if (/^date\d+$/i.test(k)) return formatShanghaiTime(timestamp, true);
  if (/^phrase\d+$/i.test(k)) {
    const clean = text.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "");
    return (clean || "新反馈").slice(0, 5);
  }
  if (/^thing\d+$/i.test(k)) {
    const fallback = text || "用户提交了新反馈";
    return fallback.length > 20 ? `${fallback.slice(0, 19)}…` : fallback;
  }
  if (/^(?:character_string|number|letter)\d+$/i.test(k)) {
    return (text || "0").slice(0, 32);
  }
  const fallback = text || "新反馈";
  return fallback.length > 32 ? `${fallback.slice(0, 31)}…` : fallback;
}

export function buildSubscribeMessageData(fieldMap, item) {
  const data = {};
  const categoryLabel = FEEDBACK_CATEGORIES[item.category] || "用户反馈";
  const entries = [
    [fieldMap?.categoryKey, categoryLabel],
    [fieldMap?.contentKey, item.content],
    [fieldMap?.timeKey, ""],
    [fieldMap?.userKey, item.nickname || "卷友"],
  ];
  for (const [rawKey, rawVal] of entries) {
    const key = typeof rawKey === "string" ? rawKey.trim() : "";
    if (!key || !TEMPLATE_KEY_RE.test(key)) continue;
    data[key] = { value: formatSubscribeFieldValue(key, rawVal, item.createdAt) };
  }
  return data;
}

function publicFeedbackView(item) {
  return {
    id: item.id,
    category: item.category,
    categoryLabel: FEEDBACK_CATEGORIES[item.category] || "其他",
    content: item.content,
    contact: item.contact || "",
    images: (item.images || []).map((img) => ({
      url: img.url || "",
      dataUri: img.url || img.dataUri || "",
      alt: img.alt || "",
    })),
    status: item.status,
    statusLabel: FEEDBACK_STATUSES[item.status] || "待处理",
    reply: item.reply ? { text: item.reply.text, repliedAt: item.reply.repliedAt } : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function adminFeedbackView(item) {
  return {
    ...publicFeedbackView(item),
    guestId: item.guestId,
    nickname: item.nickname || defaultNickname(item.guestId),
    clientMeta: item.clientMeta || { platform: "miniprogram", envVersion: "", appVersion: "", page: "" },
    reply: item.reply ? { text: item.reply.text, operator: item.reply.operator || "admin", repliedAt: item.reply.repliedAt } : null,
    notifySummary: item.notifySummary || null,
  };
}

function summarizeFeedbackItems(items) {
  const counts = { total: items.length, pending: 0, processing: 0, replied: 0, closed: 0 };
  for (const item of items) {
    if (Object.prototype.hasOwnProperty.call(counts, item.status)) {
      counts[item.status] += 1;
    }
  }
  return counts;
}

function authorizeReviewToken(input, env = process.env) {
  const configured = env.ROLLIERANK_REVIEW_TOKEN;
  if (typeof configured !== "string" || !configured.trim()) {
    throw fault(403, "审核尚未启用，请联系维护者配置审核凭证。");
  }
  if (typeof input?.reviewToken !== "string" || input.reviewToken.length > 4096) {
    throw fault(403, "维护者凭证无效，请重新输入。");
  }
  const hash = (value) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(configured), hash(input.reviewToken))) {
    throw fault(403, "维护者凭证无效，请重新输入。");
  }
}

export function createFeedbackService({ readCatalog, mutateCatalog }, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  exchangeOpenId,
  oss,
  now = () => Date.now(),
} = {}) {
  const appId = env.ROLLIERANK_WECHAT_APP_ID?.trim() || "";
  const secret = env.ROLLIERANK_WECHAT_APP_SECRET?.trim() || "";
  const wechatReady = Boolean(appId && secret);
  const imageStorage = oss ?? createQiniuStorage({ config: readQiniuConfig(env), fetchImpl });
  let accessToken = "";
  let accessTokenExpires = 0;
  let pendingToken = null;

  async function callWechat(path, query, payload) {
    const url = new URL(path, WECHAT_API);
    if (query) url.search = new URLSearchParams(query);
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(6000),
      ...(payload
        ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
        : { method: "GET" }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  async function getAccessToken(forceRefresh = false) {
    if (!wechatReady) throw fault(503, "未配置微信小程序 AppID 或 AppSecret，暂无法发送微信提醒。");
    if (!forceRefresh && accessToken && now() < accessTokenExpires) return accessToken;
    if (forceRefresh) {
      accessToken = "";
      accessTokenExpires = 0;
    }
    pendingToken ??= (async () => {
      const result = await callWechat("/cgi-bin/stable_token", null, {
        grant_type: "client_credential",
        appid: appId,
        secret,
        force_refresh: forceRefresh,
      });
      if (!result?.access_token || !Number.isFinite(result.expires_in)) {
        throw new Error(result?.errmsg || "获取微信 access_token 失败");
      }
      accessToken = result.access_token;
      accessTokenExpires = now() + Math.max(0, result.expires_in - 120) * 1000;
      return accessToken;
    })().finally(() => { pendingToken = null; });
    return pendingToken;
  }

  async function resolveOpenId(wxCode) {
    if (typeof wxCode !== "string" || !WECHAT_CODE_RE.test(wxCode)) {
      throw fault(400, "缺少有效的微信登录凭证，请重新点击订阅。");
    }
    if (typeof exchangeOpenId === "function") {
      const openid = await exchangeOpenId(wxCode);
      if (typeof openid !== "string" || !WECHAT_CODE_RE.test(openid)) {
        throw fault(401, "微信身份校验失败，请重试。");
      }
      return openid;
    }
    if (!wechatReady) {
      throw fault(503, "未配置微信小程序密钥，暂无法绑定微信提醒。");
    }
    let result;
    try {
      result = await callWechat("/sns/jscode2session", {
        appid: appId,
        secret,
        js_code: wxCode,
        grant_type: "authorization_code",
      });
    } catch {
      throw fault(502, "暂时连不上微信，请稍后重试。");
    }
    if (result?.errcode || typeof result?.openid !== "string" || !WECHAT_CODE_RE.test(result.openid)) {
      throw fault(401, "微信登录凭证已失效，请重新点击订阅。");
    }
    return result.openid;
  }

  async function sendOneSubscribeMessage({ openid, templateId, page, miniprogramState, data }) {
    const attempt = async (forceRefresh) => {
      const token = await getAccessToken(forceRefresh);
      return await callWechat("/cgi-bin/message/subscribe/send", { access_token: token }, {
        touser: openid,
        template_id: templateId,
        page,
        miniprogram_state: miniprogramState,
        lang: "zh_CN",
        data,
      });
    };
    let result = await attempt(false);
    if (result && (result.errcode === 40001 || result.errcode === 42001)) {
      result = await attempt(true);
    }
    return result;
  }

  function buildNotifyView(store) {
    const { notify } = readFeedbackData(store, env);
    const totalQuota = notify.subscribers.reduce((sum, s) => sum + (Number(s.quota) || 0), 0);
    return {
      enabled: notify.enabled,
      wechatReady,
      templateId: notify.templateId,
      templateConfigured: Boolean(notify.templateId),
      miniprogramState: notify.miniprogramState,
      page: notify.page,
      fieldMap: notify.fieldMap,
      subscriberCount: notify.subscribers.length,
      totalQuota,
      subscribers: notify.subscribers.map((s) => ({
        id: s.id,
        openidMask: s.openidMask || maskOpenId(s.openid),
        label: s.label || "管理员",
        quota: Number(s.quota) || 0,
        totalSent: Number(s.totalSent) || 0,
        lastSubscribedAt: s.lastSubscribedAt || null,
        lastNotifiedAt: s.lastNotifiedAt || null,
        lastError: s.lastError || "",
      })),
      logs: notify.logs.slice(0, 20),
    };
  }

  async function recordSkipSummary(feedbackItem, skippedReason) {
    if (!feedbackItem?.id) return;
    await mutateCatalog((currentStore) => {
      const data = writableFeedbackData(currentStore, env);
      const saved = data.items.find((item) => item.id === feedbackItem.id);
      if (saved) {
        saved.notifySummary = {
          attempted: 0,
          sent: 0,
          failed: 0,
          skippedReason,
          lastError: "",
          at: now(),
        };
      }
    });
  }

  async function dispatchNotifications({ feedbackItem, isTest = false, targetSubscriberId = "" }) {
    const store = readCatalog();
    const { notify } = readFeedbackData(store, env);
    let skippedReason = "";
    if (!isTest && !notify.enabled) {
      skippedReason = "提醒已关闭";
    } else if (!notify.templateId) {
      skippedReason = "未配置微信订阅消息模板 ID";
    } else if (!wechatReady) {
      skippedReason = "未配置小程序 AppID / AppSecret";
    }
    if (skippedReason) {
      if (!isTest) await recordSkipSummary(feedbackItem, skippedReason);
      return { attempted: 0, sent: 0, failed: 0, skippedReason };
    }
    const candidates = notify.subscribers.filter((sub) => {
      if (!sub?.openid) return false;
      if (targetSubscriberId) return sub.id === targetSubscriberId;
      return (Number(sub.quota) || 0) > 0;
    });
    if (!candidates.length) {
      skippedReason = targetSubscriberId ? "找不到目标订阅管理员" : "当前没有可用订阅次数的管理员";
      if (!isTest) await recordSkipSummary(feedbackItem, skippedReason);
      return {
        attempted: 0,
        sent: 0,
        failed: 0,
        skippedReason,
      };
    }

    const page = notify.page || "pages/admin/admin";
    const payloadData = buildSubscribeMessageData(notify.fieldMap, feedbackItem);

    const results = [];
    for (const sub of candidates) {
      const sentAt = now();
      try {
        const res = await sendOneSubscribeMessage({
          openid: sub.openid,
          templateId: notify.templateId,
          page,
          miniprogramState: notify.miniprogramState,
          data: payloadData,
        });
        const errcode = Number(res?.errcode ?? -1);
        const ok = errcode === 0;
        let errmsg = ok ? "ok" : String(res?.errmsg || `微信返回错误(${errcode})`);
        if (errcode === 43101) {
          errmsg = "订阅次数已用完或管理员拒绝接收，请在小程序后台重新订阅";
        } else if (errcode === 47003) {
          errmsg = "模板字段格式不匹配，请检查后台模板字段映射";
        }
        results.push({ subscriberId: sub.id, subscriberLabel: sub.label || maskOpenId(sub.openid), ok, errcode, errmsg, sentAt });
      } catch (error) {
        results.push({
          subscriberId: sub.id,
          subscriberLabel: sub.label || maskOpenId(sub.openid),
          ok: false,
          errcode: -1,
          errmsg: error?.message || "微信推送请求失败",
          sentAt,
        });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.length - sent;
    const lastError = results.find((r) => !r.ok)?.errmsg || "";

    await mutateCatalog((currentStore) => {
      const data = writableFeedbackData(currentStore, env);
      for (const res of results) {
        const sub = data.notify.subscribers.find((item) => item.id === res.subscriberId);
        if (sub) {
          if (res.ok) {
            sub.quota = Math.max(0, (Number(sub.quota) || 0) - 1);
            sub.totalSent = (Number(sub.totalSent) || 0) + 1;
            sub.lastNotifiedAt = res.sentAt;
            sub.lastError = "";
          } else {
            if (res.errcode === 43101) sub.quota = 0;
            sub.lastError = res.errmsg;
          }
        }
        data.notify.logs.unshift({
          id: randomUUID(),
          feedbackId: isTest ? "test" : (feedbackItem?.id || ""),
          subscriberId: res.subscriberId,
          subscriberLabel: res.subscriberLabel,
          ok: res.ok,
          errcode: res.errcode,
          errmsg: res.errmsg,
          createdAt: res.sentAt,
        });
      }
      if (data.notify.logs.length > MAX_NOTIFY_LOGS) {
        data.notify.logs.length = MAX_NOTIFY_LOGS;
      }
      if (!isTest && feedbackItem?.id) {
        const saved = data.items.find((item) => item.id === feedbackItem.id);
        if (saved) {
          saved.notifySummary = {
            attempted: results.length,
            sent,
            failed,
            lastError,
            at: now(),
          };
        }
      }
    });

    return { attempted: results.length, sent, failed, lastError, results };
  }

  function listForAdmin(store, { status = "all", q = "", page = 1, pageSize = 30 } = {}) {
    const data = readFeedbackData(store, env);
    const keyword = String(q || "").trim().toLocaleLowerCase("zh-CN");
    const summary = summarizeFeedbackItems(data.items);
    const filtered = data.items
      .filter((item) => {
        if (status !== "all" && item.status !== status) return false;
        if (keyword) {
          const hay = [
            item.content,
            item.contact,
            item.nickname,
            item.guestId,
            FEEDBACK_CATEGORIES[item.category],
            item.reply?.text,
          ].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
          if (!hay.includes(keyword)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 30));
    const start = (safePage - 1) * safeSize;
    return {
      items: filtered.slice(start, start + safeSize).map(adminFeedbackView),
      total: filtered.length,
      page: safePage,
      pages: Math.max(1, Math.ceil(filtered.length / safeSize)),
      summary,
      notify: buildNotifyView(store),
    };
  }

  async function updateFeedback({ feedbackId, status, replyText, operator = "admin" }) {
    const id = typeof feedbackId === "string" ? feedbackId.trim() : "";
    if (!id) throw fault(400, "缺少反馈编号。");
    const hasReply = replyText !== undefined;
    const cleanedReply = hasReply ? cleanText(replyText, "回复内容", MAX_REPLY_LEN, false) : undefined;
    let nextStatus = status !== undefined && status !== "" ? validateStatus(status) : null;
    if (!nextStatus && cleanedReply) nextStatus = "replied";
    if (!nextStatus && !hasReply) throw fault(400, "请填写回复内容或选择新状态。");

    return await mutateCatalog((store) => {
      const data = writableFeedbackData(store, env);
      const item = data.items.find((entry) => entry.id === id);
      if (!item) throw fault(404, "找不到这条反馈。");
      const timestamp = now();
      if (hasReply) {
        if (cleanedReply) {
          item.reply = { text: cleanedReply, operator, repliedAt: timestamp };
        } else {
          item.reply = null;
        }
      }
      if (nextStatus) {
        item.status = nextStatus;
      }
      item.updatedAt = timestamp;
      store.audit ??= [];
      store.audit.unshift({
        id: randomUUID(),
        action: cleanedReply ? "回复用户反馈" : "更新反馈状态",
        target: `${FEEDBACK_CATEGORIES[item.category] || "反馈"} · ${FEEDBACK_STATUSES[item.status] || item.status} · ${item.content.slice(0, 30)}`,
        operator,
        createdAt: timestamp,
      });
      return adminFeedbackView(item);
    });
  }

  async function deleteFeedback({ feedbackId, operator = "admin" }) {
    const id = typeof feedbackId === "string" ? feedbackId.trim() : "";
    if (!id) throw fault(400, "缺少反馈编号。");
    return await mutateCatalog((store) => {
      const data = writableFeedbackData(store, env);
      const index = data.items.findIndex((entry) => entry.id === id);
      if (index < 0) throw fault(404, "找不到这条反馈。");
      const [removed] = data.items.splice(index, 1);
      store.audit ??= [];
      store.audit.unshift({
        id: randomUUID(),
        action: "删除用户反馈",
        target: `${FEEDBACK_CATEGORIES[removed.category] || "反馈"} · ${removed.content.slice(0, 30)}`,
        operator,
        createdAt: now(),
      });
      return { ok: true, id };
    });
  }

  async function updateNotifySettings(input, operator = "admin") {
    const enabled = input.enabled !== undefined ? Boolean(input.enabled) : undefined;
    let templateId;
    if (input.templateId !== undefined) {
      const raw = typeof input.templateId === "string" ? input.templateId.trim() : "";
      if (raw && !TEMPLATE_ID_RE.test(raw)) {
        throw fault(400, "微信订阅消息模板 ID 格式无效。");
      }
      templateId = raw;
    }
    let miniprogramState;
    if (input.miniprogramState !== undefined) {
      const raw = typeof input.miniprogramState === "string" ? input.miniprogramState.trim() : "";
      if (!MINIPROGRAM_STATES.has(raw)) throw fault(400, "跳转小程序版本无效。");
      miniprogramState = raw;
    }
    let page;
    if (input.page !== undefined) {
      const raw = typeof input.page === "string" ? input.page.trim() : "";
      if (raw.length > 160 || INVALID_CONTROLS_RE.test(raw)) throw fault(400, "跳转页面路径无效。");
      page = raw || "pages/admin/admin";
    }
    let fieldMap;
    if (input.fieldMap !== undefined) {
      if (!input.fieldMap || typeof input.fieldMap !== "object" || Array.isArray(input.fieldMap)) {
        throw fault(400, "模板字段映射格式无效。");
      }
      fieldMap = {};
      for (const field of ["categoryKey", "contentKey", "timeKey", "userKey"]) {
        const val = typeof input.fieldMap[field] === "string" ? input.fieldMap[field].trim() : "";
        if (val && !TEMPLATE_KEY_RE.test(val)) {
          throw fault(400, `模板字段名无效：${val}`);
        }
        fieldMap[field] = val;
      }
      if (!Object.values(fieldMap).some(Boolean)) {
        throw fault(400, "请至少保留一个微信订阅模板字段。");
      }
    }

    return await mutateCatalog((store) => {
      const data = writableFeedbackData(store, env);
      if (enabled !== undefined) data.notify.enabled = enabled;
      if (templateId !== undefined) data.notify.templateId = templateId;
      if (miniprogramState !== undefined) data.notify.miniprogramState = miniprogramState;
      if (page !== undefined) data.notify.page = page;
      if (fieldMap !== undefined) data.notify.fieldMap = fieldMap;
      store.audit ??= [];
      store.audit.unshift({
        id: randomUUID(),
        action: "更新反馈提醒设置",
        target: `${data.notify.enabled ? "已开启" : "已关闭"} · ${data.notify.templateId ? "已配置模板" : "未配置模板"}`,
        operator,
        createdAt: now(),
      });
      return buildNotifyView(store);
    });
  }

  async function subscribeAdmin({ wxCode, label, accepted = true }) {
    const openid = await resolveOpenId(wxCode);
    const cleanedLabel = cleanText(label, "管理员备注", 32, false) || "管理员";
    const delta = accepted ? 1 : 0;
    return await mutateCatalog((store) => {
      const data = writableFeedbackData(store, env);
      const timestamp = now();
      let subscriber = data.notify.subscribers.find((item) => item.openid === openid);
      if (!subscriber) {
        subscriber = {
          id: randomUUID(),
          openid,
          openidMask: maskOpenId(openid),
          label: cleanedLabel,
          quota: delta,
          totalSent: 0,
          lastSubscribedAt: timestamp,
          lastNotifiedAt: null,
          lastError: "",
        };
        data.notify.subscribers.unshift(subscriber);
      } else {
        if (cleanedLabel && cleanedLabel !== "管理员") subscriber.label = cleanedLabel;
        subscriber.quota = Math.max(0, (Number(subscriber.quota) || 0) + delta);
        subscriber.lastSubscribedAt = timestamp;
        if (accepted) subscriber.lastError = "";
      }
      store.audit ??= [];
      store.audit.unshift({
        id: randomUUID(),
        action: accepted ? "管理员订阅反馈提醒" : "管理员绑定提醒身份",
        target: `${subscriber.label}（${subscriber.openidMask} · 剩余 ${subscriber.quota} 次）`,
        operator: "miniprogram-admin",
        createdAt: timestamp,
      });
      return {
        subscriber: {
          id: subscriber.id,
          openidMask: subscriber.openidMask,
          label: subscriber.label,
          quota: subscriber.quota,
          totalSent: subscriber.totalSent,
          lastSubscribedAt: subscriber.lastSubscribedAt,
          lastNotifiedAt: subscriber.lastNotifiedAt,
          lastError: subscriber.lastError,
        },
        notify: buildNotifyView(store),
      };
    });
  }

  async function removeSubscriber({ subscriberId, operator = "admin" }) {
    const id = typeof subscriberId === "string" ? subscriberId.trim() : "";
    if (!id) throw fault(400, "缺少管理员订阅编号。");
    return await mutateCatalog((store) => {
      const data = writableFeedbackData(store, env);
      const index = data.notify.subscribers.findIndex((item) => item.id === id);
      if (index < 0) throw fault(404, "找不到该提醒订阅记录。");
      const [removed] = data.notify.subscribers.splice(index, 1);
      store.audit ??= [];
      store.audit.unshift({
        id: randomUUID(),
        action: "移除反馈提醒管理员",
        target: `${removed.label || "管理员"}（${removed.openidMask || maskOpenId(removed.openid)}）`,
        operator,
        createdAt: now(),
      });
      return buildNotifyView(store);
    });
  }

  async function sendTestNotification({ subscriberId = "" } = {}) {
    const testItem = {
      id: "test",
      category: "suggestion",
      content: "这是一条反馈提醒测试消息，收到即表示配置成功",
      nickname: "系统测试",
      createdAt: now(),
    };
    return await dispatchNotifications({
      feedbackItem: testItem,
      isTest: true,
      targetSubscriberId: subscriberId,
    });
  }

  async function handle({ pathname, method, query, input, send }) {
    // 1. 用户提交反馈
    if (method === "POST" && pathname === "/api/feedback") {
      const guestId = validateGuestId(input.guestId);
      const category = validateCategory(input.category);
      const content = cleanText(input.content, "反馈内容", MAX_CONTENT_LEN, true);
      const contact = cleanText(input.contact, "联系方式", MAX_CONTACT_LEN, false);
      const rawImages = input.images ?? [];
      if (!Array.isArray(rawImages) || rawImages.length > MAX_IMAGES) {
        throw fault(400, `最多上传 ${MAX_IMAGES} 张截图。`);
      }
      const images = rawImages.map((img, idx) => validateImage(img, idx));
      const totalImageBytes = images.reduce((sum, img) => sum + img.bytes, 0);
      if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) {
        throw fault(413, "截图合计不能超过 5 MB。");
      }
      const feedbackId = input.feedbackId !== undefined
        ? (() => {
            if (typeof input.feedbackId !== "string" || !GUEST_ID_RE.test(input.feedbackId)) {
              throw fault(400, "反馈编号无效，请重试。");
            }
            return input.feedbackId;
          })()
        : randomUUID();
      const clientMeta = normalizeClientMeta(input.clientMeta);
      const rawNickname = cleanText(input.nickname, "昵称", 40, false);

      // 先做幂等与限流预检，避免重复请求或被拒请求浪费对象存储上传。
      const initialData = readFeedbackData(readCatalog(), env);
      const priorItem = initialData.items.find((entry) => entry.id === feedbackId);
      if (priorItem) {
        if (priorItem.guestId !== guestId) {
          throw fault(409, "反馈编号冲突，请重新提交。");
        }
        send(200, { feedback: publicFeedbackView(priorItem), notified: { attempted: 0, sent: 0 } });
        return true;
      }
      const preCutoff = now() - RATE_LIMIT_WINDOW_MS;
      const preRecentCount = initialData.items.filter((entry) => entry.guestId === guestId && (entry.createdAt || 0) >= preCutoff).length;
      if (preRecentCount >= RATE_LIMIT_MAX) {
        throw fault(429, "提交过于频繁，请稍后再试。");
      }

      const storedImages = await Promise.all(images.map(async (img) => {
        const { buffer, dataUri, ...meta } = img;
        if (imageStorage.isEnabled()) {
          const uploaded = await imageStorage.uploadFeedbackImage({
            id: randomBytes(16).toString("hex"),
            bytes: buffer,
            mime: meta.mime,
          });
          return { ...meta, url: uploaded.url, key: uploaded.key };
        }
        return { ...meta, dataUri };
      }));

      let isReplay = false;
      const savedItem = await mutateCatalog((store) => {
        const data = writableFeedbackData(store, env);
        const existing = data.items.find((entry) => entry.id === feedbackId);
        if (existing) {
          if (existing.guestId !== guestId) {
            throw fault(409, "反馈编号冲突，请重新提交。");
          }
          isReplay = true;
          return existing;
        }
        const cutoff = now() - RATE_LIMIT_WINDOW_MS;
        const recentCount = data.items.filter((entry) => entry.guestId === guestId && (entry.createdAt || 0) >= cutoff).length;
        if (recentCount >= RATE_LIMIT_MAX) {
          throw fault(429, "提交过于频繁，请稍后再试。");
        }
        const profile = wechatProfilesByGuest(store).get(guestId);
        const nickname = profile?.name || rawNickname || defaultNickname(guestId);
        const timestamp = now();
        const item = {
          id: feedbackId,
          guestId,
          nickname,
          category,
          content,
          contact,
          images: storedImages,
          clientMeta,
          status: "pending",
          reply: null,
          notifySummary: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        data.items.unshift(item);
        return item;
      });

      let notifyResult = { attempted: 0, sent: 0, failed: 0 };
      if (!isReplay) {
        notifyResult = await dispatchNotifications({ feedbackItem: savedItem, isTest: false }).catch(() => ({
          attempted: 0,
          sent: 0,
          failed: 0,
        }));
      }

      send(200, {
        feedback: publicFeedbackView(savedItem),
        notified: { attempted: notifyResult.attempted, sent: notifyResult.sent },
      });
      return true;
    }

    // 2. 用户查看自己的反馈记录与管理员回复
    if (method === "GET" && pathname === "/api/feedback/mine") {
      const guestId = validateGuestId(query.get("guestId"));
      const data = readFeedbackData(readCatalog(), env);
      const items = data.items
        .filter((entry) => entry.guestId === guestId)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map(publicFeedbackView);
      const repliedCount = items.filter((entry) => Boolean(entry.reply?.text)).length;
      const latestReplyAt = items.reduce((max, entry) => Math.max(max, entry.reply?.repliedAt || 0), 0);
      send(200, { items, total: items.length, repliedCount, latestReplyAt });
      return true;
    }

    // 3. 待处理摘要（无需凭证，仅返回计数，不泄露反馈内容）
    if (method === "GET" && pathname === "/api/feedback/summary") {
      const data = readFeedbackData(readCatalog(), env);
      const summary = summarizeFeedbackItems(data.items);
      send(200, {
        pendingCount: summary.pending,
        total: summary.total,
        reviewEnabled: Boolean(env.ROLLIERANK_REVIEW_TOKEN?.trim()),
      });
      return true;
    }

    // 4. 小程序端维护者：仅读取微信推送订阅状态（反馈记录统一在网页管理后台查看处理）
    if (method === "POST" && pathname === "/api/feedback/admin/notify-status") {
      authorizeReviewToken(input, env);
      send(200, { ok: true, notify: buildNotifyView(readCatalog()) });
      return true;
    }

    // 5. 小程序端维护者：绑定微信并累加订阅消息次数
    if (method === "POST" && pathname === "/api/feedback/admin/subscribe") {
      authorizeReviewToken(input, env);
      const result = await subscribeAdmin({
        wxCode: input.wxCode,
        label: input.label,
        accepted: input.accepted !== false,
      });
      send(200, { ok: true, ...result });
      return true;
    }

    // 6. 小程序端维护者：发送测试微信提醒
    if (method === "POST" && pathname === "/api/feedback/admin/test-notify") {
      authorizeReviewToken(input, env);
      const result = await sendTestNotification({ subscriberId: typeof input.subscriberId === "string" ? input.subscriberId : "" });
      send(200, { ok: result.sent > 0, ...result, notify: buildNotifyView(readCatalog()) });
      return true;
    }

    return false;
  }

  handle.listForAdmin = listForAdmin;
  handle.updateFeedback = updateFeedback;
  handle.deleteFeedback = deleteFeedback;
  handle.updateNotifySettings = updateNotifySettings;
  handle.removeSubscriber = removeSubscriber;
  handle.sendTestNotification = sendTestNotification;
  handle.buildNotifyView = buildNotifyView;
  handle.summarize = (store) => summarizeFeedbackItems(readFeedbackData(store, env).items);

  return handle;
}
