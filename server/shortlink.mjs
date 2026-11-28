// 自有短链：短地址 → 小程序码入口。
//
// 为什么不自建微信短链（wxaurl.cn）：
// - genwxashortlink 个人主体无权限，返回 43104
// - generate_urllink / generatescheme 需要 scheme 权限，返回 85407
// - wxaurl.cn 的 token 由微信服务端签发并绑定 appid，外部无法生成
//
// 所以这里做的是「自有短链」：自己的短地址 + 个人主体可用的 getwxacodeunlimit 小程序码。
// 实测 getwxacodeunlimit 可用，关键参数是 check_path:false
// （默认会校验页面已发布上线，未发布时报 41030 invalid page）。
//
// 短链解决三件微信短链本来也不做的事：短、可归因、已发出的链可改落地页。

import { randomBytes as nodeRandomBytes } from "node:crypto";

const PATH = "/api/links";
const PUBLIC_PREFIX = "/s/";
const CACHE_TTL_SECONDS = 24 * 60 * 60;
// 去掉 o/0、l/1 这类易混字符，避免短码被手抄错。
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 7;
const MAX_LINKS = 500;
// 每次点击都会重写整份 catalog.json，明细只留最近若干条，累计数另用 clicks 字段记。
const MAX_CLICKS_PER_LINK = 50;

function failure(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function configuration(env) {
  return {
    appId: env.ROLLIERANK_WECHAT_APP_ID?.trim() || "",
    secret: env.ROLLIERANK_WECHAT_APP_SECRET?.trim() || "",
    defaultPage: (env.ROLLIERANK_MINIPROGRAM_PAGE || "pages/home/home").trim(),
    defaultEnv: (env.ROLLIERANK_MINIPROGRAM_ENV || "release").trim(),
    siteOrigin: (env.ROLLIERANK_SITE_ORIGIN || "https://rank.swimmingliu.cn").trim().replace(/\/+$/, ""),
    enabled: env.ROLLIERANK_SHORTLINK !== "0",
    // 写操作（创建、列表）需要口令；查看单条与小程序码保持公开，落地页要用。
    writeToken: (env.ROLLIERANK_SHORTLINK_TOKEN || env.ROLLIERANK_REVIEW_TOKEN || "").trim(),
  };
}

/** 常量时间比较，避免按字节提前返回泄露口令长度。 */
function tokenMatches(actual, expected) {
  if (!expected || typeof actual !== "string" || actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** 用加密随机数生成短码，避免可预测的递增 ID 被枚举。 */
export function createCode(randomBytes, length = CODE_LENGTH) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** 只接受小程序内部路径，拒绝协议头与跨域 URL，避免被当成开放重定向使用。 */
export function normalizeTarget(raw, fallbackPage) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return fallbackPage;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) {
    throw failure(400, "落地页只接受小程序内部路径，例如 pages/home/home。");
  }
  const page = value.replace(/^\/+/, "");
  if (!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(page)) {
    throw failure(400, "落地页路径格式不正确。");
  }
  return page;
}

export function createShortLinkService({
  cache,
  readCatalog,
  mutateCatalog,
  fetchImpl = globalThis.fetch,
  env = process.env,
  randomBytes = nodeRandomBytes,
  now = () => Date.now(),
} = {}) {
  const config = configuration(env);
  const ready = Boolean(config.appId && config.secret && cache && config.enabled && typeof mutateCatalog === "function");
  let accessToken = "";
  let accessTokenExpires = 0;
  let pendingToken;

  async function wechat(path, query, payload) {
    const url = new URL(path, "https://api.weixin.qq.com");
    if (query) url.search = new URLSearchParams(query);
    let response;
    try {
      response = await fetchImpl(url, {
        signal: AbortSignal.timeout(8000),
        ...(payload
          ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
          : {}),
      });
    } catch {
      throw failure(502, "暂时连不上微信，请稍后重试。");
    }
    if (!response.ok) throw failure(502, `微信接口返回 ${response.status}。`);
    const result = await response.json();
    if (result?.errcode) {
      const error = failure(502, `微信接口错误 ${result.errcode}：${result.errmsg ?? ""}`.trim());
      error.errcode = result.errcode;
      throw error;
    }
    return result;
  }

  async function getAccessToken() {
    if (Date.now() < accessTokenExpires) return accessToken;
    pendingToken ??= (async () => {
      const result = await wechat("/cgi-bin/stable_token", null, {
        grant_type: "client_credential",
        appid: config.appId,
        secret: config.secret,
        force_refresh: false,
      });
      if (!result?.access_token || !Number.isFinite(result.expires_in)) {
        throw failure(502, "暂时无法获取微信 access_token。");
      }
      accessToken = result.access_token;
      accessTokenExpires = Date.now() + Math.max(0, result.expires_in - 120) * 1000;
      return accessToken;
    })().finally(() => { pendingToken = undefined; });
    return pendingToken;
  }

  /**
   * 无限量小程序码。check_path:false 是个人主体拿到码的关键：
   * 默认会校验页面已发布到线上版，未发布时报 41030 invalid page。
   */
  async function generateQrCode(page, envVersion) {
    const token = await getAccessToken();
    let response;
    try {
      response = await fetchImpl(
        `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scene: "from=shortlink",
            page,
            width: 430,
            check_path: false,
            env_version: envVersion,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch {
      throw failure(502, "暂时连不上微信，请稍后重试。");
    }
    if (!response.ok) throw failure(502, `微信接口返回 ${response.status}。`);
    const buffer = Buffer.from(await response.arrayBuffer());
    // 出错时微信返回 JSON，成功时返回图片二进制。
    if (buffer.subarray(0, 1).toString() === "{") {
      let detail = {};
      try { detail = JSON.parse(buffer.toString("utf8")); } catch { /* 保持空对象 */ }
      const error = failure(502, `微信接口错误 ${detail.errcode ?? "未知"}：${detail.errmsg ?? ""}`.trim());
      error.errcode = detail.errcode;
      throw error;
    }
    if (buffer.length < 1024) throw failure(502, "微信没有返回有效的小程序码。");
    return buffer.toString("base64");
  }

  // 短链存放在已持久化的 features 分类下：顶层字段不会被 persist() 写盘。
  const linksOf = (catalog) => (Array.isArray(catalog?.features?.shortLinks) ? catalog.features.shortLinks : []);

  function findLink(code) {
    return linksOf(readCatalog()).find((item) => item.code === code) || null;
  }

  /**
   * 记录一次点击。统计失败不影响进入小程序，短链是辅助能力不是主链路。
   * mutateCatalog 会自行落盘，这里不 await：点击统计不该拖慢落地页。
   */
  function recordClick(code, meta) {
    try {
      Promise.resolve(mutateCatalog((catalog) => {
        const link = linksOf(catalog).find((item) => item.code === code);
        if (!link) return catalog;
        link.clicks = (link.clicks || 0) + 1;
        link.lastClickAt = now();
        const clicks = Array.isArray(link.clickLog) ? link.clickLog : [];
        clicks.push({ at: now(), ...meta });
        link.clickLog = clicks.slice(-MAX_CLICKS_PER_LINK);
        return catalog;
      })).catch(() => {});
    } catch {
      // 忽略：点击统计不应阻塞访问。
    }
  }

  function publicUrl(code) {
    return `${config.siteOrigin}${PUBLIC_PREFIX}${code}`;
  }

  const publicView = (link) => ({
    enabled: true,
    code: link.code,
    page: link.page,
    title: link.title || "",
    channel: link.channel || "",
    clicks: link.clicks || 0,
    url: publicUrl(link.code),
    // 小程序里「…→复制链接」得到的 #小程序:// 口令，微信内粘贴可点开直达。空表示还没录。
    weappLink: link.weappLink || "",
  });

  /**
   * #小程序:// 口令格式校验。
   * 形如 #小程序://卷卷小榜/pages/home/home/AbCdEf123，只能由微信生成，
   * 我们只负责存和展示，所以这里只做浅校验：必须以 #小程序:// 开头且足够长。
   */
  function normalizeWeappLink(raw) {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return "";
    if (!/^#小程序:\/\/.+/.test(value)) {
      throw failure(400, "口令必须以 #小程序:// 开头，请在小程序里点右上角「…→复制链接」获取。");
    }
    if (value.length > 300) throw failure(400, "口令过长，请重新复制。");
    return value;
  }

  return async function handle({ pathname, method, query, input, request, send }) {
    if (pathname !== PATH && !pathname.startsWith(`${PATH}/`)) return false;

    if (!ready) {
      send(503, { enabled: false, error: "短链服务暂未配置。" });
      return true;
    }

    if (method !== "GET" && method !== "POST") {
      send(405, { error: "不支持的请求方法。" });
      return true;
    }

    // 创建与列表会写盘、能换取微信小程序码，必须带口令；单条查询与小程序码保持公开。
    const isWrite = (pathname === PATH);
    if (isWrite) {
      if (!config.writeToken) {
        send(503, { enabled: true, error: "短链管理未配置口令，写接口已关闭。" });
        return true;
      }
      const provided = request?.headers?.["x-rollierank-token"] || "";
      if (!tokenMatches(provided, config.writeToken)) {
        send(401, { enabled: true, error: "缺少或错误的管理口令。" });
        return true;
      }
    }

    try {
      // 创建：POST /api/links { page?, title?, channel? }
      if (pathname === PATH && method === "POST") {
        const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
        const page = normalizeTarget(body.page, config.defaultPage);
        if (linksOf(readCatalog()).length >= MAX_LINKS) {
          throw failure(409, "短链数量已达上限，请先清理旧链。");
        }
        let code = createCode(randomBytes);
        // 极小概率碰撞，重试几次；仍冲突则报错而不是覆盖既有短链。
        for (let attempt = 0; attempt < 5 && findLink(code); attempt += 1) code = createCode(randomBytes);
        if (findLink(code)) throw failure(500, "短码生成失败，请重试。");
        const link = {
          code,
          page,
          title: typeof body.title === "string" ? body.title.trim().slice(0, 60) : "",
          channel: typeof body.channel === "string" ? body.channel.trim().slice(0, 40) : "",
          weappLink: normalizeWeappLink(body.weappLink),
          createdAt: now(),
          clicks: 0,
        };
        // 必须就地修改 features：持久化层只写它自己持有的那份 features 引用，
        // 返回一个新建对象不会被写盘。
        await mutateCatalog((catalog) => {
          catalog.features ??= {};
          if (!Array.isArray(catalog.features.shortLinks)) catalog.features.shortLinks = [];
          catalog.features.shortLinks.push(link);
          return catalog;
        });
        send(201, publicView(link));
        return true;
      }

      // 列表：GET /api/links
      if (pathname === PATH && method === "GET") {
        const links = linksOf(readCatalog()).map(publicView);
        send(200, { enabled: true, count: links.length, links });
        return true;
      }

      // 详情 / 小程序码：GET /api/links/<code>[/qrcode]
      if (pathname.startsWith(`${PATH}/`)) {
        const [code, action] = pathname.slice(PATH.length + 1).split("/");
        const link = code ? findLink(code) : null;
        if (!link) {
          send(404, { error: "短链不存在或已删除。" });
          return true;
        }
        // 补录口令：POST /api/links/<code>/weapp  { weappLink }
        // 微信的 #小程序:// 口令只能在小程序里复制，所以先建链、后补口令。
        if (action === "weapp") {
          if (method !== "POST") {
            send(405, { error: "补录口令请用 POST。" });
            return true;
          }
          if (!config.writeToken) {
            send(503, { enabled: true, error: "短链管理未配置口令，写接口已关闭。" });
            return true;
          }
          if (!tokenMatches(request?.headers?.["x-rollierank-token"] || "", config.writeToken)) {
            send(401, { enabled: true, error: "缺少或错误的管理口令。" });
            return true;
          }
          const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
          const weappLink = normalizeWeappLink(body.weappLink);
          await mutateCatalog((catalog) => {
            const target = linksOf(catalog).find((item) => item.code === code);
            if (target) target.weappLink = weappLink;
            return catalog;
          });
          send(200, publicView({ ...link, weappLink }));
          return true;
        }
        if (action === "qrcode") {
          const cacheKey = `rollierank:shortlink:qr:${link.code}:${link.page}`;
          let image = await cache.get(cacheKey);
          if (!image) {
            image = await generateQrCode(link.page, config.defaultEnv);
            await cache.set(cacheKey, image, CACHE_TTL_SECONDS);
          }
          send(200, { enabled: true, code: link.code, page: link.page, image, mime: "image/jpeg" });
          return true;
        }
        if (action) {
          send(404, { error: "未知的短链操作。" });
          return true;
        }
        if (link.expiresAt && now() > link.expiresAt) {
          send(410, { enabled: true, error: "短链已过期。" });
          return true;
        }
        // visit=1 由短链落地页调用，用来记一次真实点击。
        if (query.get("visit") === "1") recordClick(code, { ref: (query.get("ref") || "").slice(0, 40) });
        send(200, publicView(link));
        return true;
      }

      send(404, { error: "未知的短链接口。" });
      return true;
    } catch (error) {
      send(error.statusCode ?? 502, { enabled: true, error: error.message ?? "短链操作失败。" });
      return true;
    }
  };
}

export const SHORTLINK_PREFIX = PUBLIC_PREFIX;
export const SHORTLINK_API = PATH;
export const SHORTLINK_CODE_LENGTH = CODE_LENGTH;
export const SHORTLINK_ALPHABET = ALPHABET;
export const SHORTLINK_CACHE_TTL_SECONDS = CACHE_TTL_SECONDS;
