// 生成微信小程序短链接（wxaurl.cn），带 Redis 24 小时缓存。
//
// 官方限制（2026 现行）：
// - 接口 POST /wxa/genwxashortlink，需要 access_token
// - 单小程序每日生成上限 1,000 万条（短期 + 永久合计），超限 45009
// - 累计永久链接上限 10 万条，超限 85400
// - 短期链接有效期 30 天；永久链接 is_permanent=true
//
// 跳转限制：wxaurl.cn 只在微信内有效，浏览器打开会提示「请在微信中打开」。
// 因此这里同时提供 URL Link / URL Scheme 作为浏览器侧的唤起方案。

const API = "https://api.weixin.qq.com";
const PATH = "/api/miniapp";
const CACHE_TTL_SECONDS = 24 * 60 * 60;
const SHORT_LINK_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// 短期链接 30 天到期，缓存 24h 后重新生成不会留死角；提前 1 天视为过期。
const SHORT_LINK_SAFE_MS = SHORT_LINK_MAX_AGE_MS - 24 * 60 * 60 * 1000;

function failure(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function configuration(env) {
  return {
    appId: env.ROLLIERANK_WECHAT_APP_ID?.trim() || "",
    secret: env.ROLLIERANK_WECHAT_APP_SECRET?.trim() || "",
    // 短链与 URL Link 应指向小程序首页；允许覆盖以便灰度到指定页面。
    landingPage: (env.ROLLIERANK_MINIPROGRAM_PAGE || "pages/home/home").trim(),
    landingQuery: (env.ROLLIERANK_MINIPROGRAM_QUERY || "").trim(),
    enabled: env.ROLLIERANK_MINIPROGRAM_LINK !== "0",
  };
}

export function createMiniappLinkService({ cache, fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const config = configuration(env);
  const ready = Boolean(config.appId && config.secret && cache && config.enabled);
  let accessToken = "";
  let accessTokenExpires = 0;
  let pendingToken;

  async function wechat(path, query, payload) {
    const url = new URL(path, API);
    if (query) url.search = new URLSearchParams(query);
    let response;
    try {
      response = await fetchImpl(url, {
        signal: AbortSignal.timeout(8000),
        ...(payload ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}),
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

  const pageTarget = () =>
    config.landingQuery
      ? `${config.landingPage}?${config.landingQuery}`
      : config.landingPage;

  async function generateShortLink() {
    const token = await getAccessToken();
    const result = await wechat(`/wxa/genwxashortlink?access_token=${encodeURIComponent(token)}`, null, {
      page_url: pageTarget(),
      page_title: "卷卷小榜 · 行测估分",
      is_permanent: false,
    });
    if (typeof result?.link !== "string" || !/^https:\/\/wxaurl\.cn\//.test(result.link)) {
      throw failure(502, "微信没有返回有效的短链接。");
    }
    return result.link;
  }

  /**
   * 小程序码（getwxacode）：个人主体也能调用，返回 JPEG 二进制。
   * 拿到 base64 后由前端展示，长按识别即可进入小程序。
   * 与短链不同，它不依赖主体类型，是个人主体唯一可用的自动入口。
   */
  async function generateQrCode() {
    const token = await getAccessToken();
    let response;
    try {
      response = await fetchImpl(
        `https://api.weixin.qq.com/wxa/getwxacode?access_token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: config.landingPage, width: 430 }),
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

  // URL Link 允许从浏览器唤起小程序，最长 30 天，Android 成功率高，iOS Safari 常被拦截。
  async function generateUrlLink() {
    const token = await getAccessToken();
    const result = await wechat("/wxa/generate_urllink?access_token=" + encodeURIComponent(token), null, {
      path: pageTarget(),
      query: "",
      is_expire: true,
      expire_type: 1,
      expire_interval: 30,
      env_version: "release",
    });
    if (typeof result?.url_link !== "string") {
      throw failure(502, "微信没有返回有效的 URL Link。");
    }
    return result.url_link;
  }

  async function cached(kind, key, seconds, producer) {
    if (!ready) return null;
    const cacheKey = `rollierank:miniapp:${kind}:${key}`;
    const hit = await cache.get(cacheKey);
    if (hit) return hit;
    const link = await producer();
    await cache.set(cacheKey, link, seconds);
    return link;
  }

  return async function handle({ pathname, method, query, send }) {
    const known = [PATH, `${PATH}/shortlink`, `${PATH}/urllink`, `${PATH}/qrcode`, `${PATH}/entry`];
    if (!known.includes(pathname)) return false;
    if (method !== "GET") {
      send(405, { error: "请使用 GET 请求。" });
      return true;
    }
    if (!ready) {
      send(503, { enabled: false, error: "小程序入口暂未配置。" });
      return true;
    }
    const target = pageTarget();
    try {
      if (pathname === `${PATH}/qrcode`) {
        const image = await cached("qrcode", target, CACHE_TTL_SECONDS, () => generateQrCode());
        send(200, { enabled: true, kind: "qrcode", target, image, mime: "image/jpeg" });
        return true;
      }
      if (pathname === `${PATH}/entry`) {
        // 聚合入口：优先短链，个人主体无权限时自动退回小程序码。
        const problems = [];
        try {
          const link = await cached("shortlink", target, CACHE_TTL_SECONDS, () => generateShortLink());
          send(200, { enabled: true, kind: "shortlink", target, link });
          return true;
        } catch (error) {
          problems.push(`shortlink: ${error.message}`);
        }
        try {
          const image = await cached("qrcode", target, CACHE_TTL_SECONDS, () => generateQrCode());
          send(200, { enabled: true, kind: "qrcode", target, image, mime: "image/jpeg", degraded: problems });
          return true;
        } catch (error) {
          problems.push(`qrcode: ${error.message}`);
          send(502, { enabled: true, error: "小程序入口暂不可用。", detail: problems });
          return true;
        }
      }
      if (pathname === `${PATH}/urllink`) {
        const link = await cached("urllink", target, CACHE_TTL_SECONDS, () => generateUrlLink());
        send(200, { enabled: true, kind: "urllink", target, link });
        return true;
      }
      const link = await cached("shortlink", target, CACHE_TTL_SECONDS, () => generateShortLink());
      send(200, {
        enabled: true,
        kind: "shortlink",
        target,
        link,
        // 短链只对微信内 UA 有效；浏览器端应使用 urllink。
        browserSupported: false,
      });
      return true;
    } catch (error) {
      send(error.statusCode ?? 502, { error: error.message ?? "生成小程序链接失败。" });
      return true;
    }
  };
}

export const MINIAPP_LINK_TTL_SECONDS = CACHE_TTL_SECONDS;
export const MINIAPP_SHORT_LINK_SAFE_MS = SHORT_LINK_SAFE_MS;
