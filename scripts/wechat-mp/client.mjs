// 微信公众号官方 API 客户端：稳定 token、素材上传（带 sha256 去重）、草稿箱增改查、发布与菜单同步。

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const WECHAT_API = "https://api.weixin.qq.com";

export function parseEnvFile(text) {
  const result = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function resolveMpCredentials(env = process.env, fileEnv = {}) {
  const merged = { ...fileEnv, ...env };
  const appId = (
    merged.WECHAT_MP_APP_ID ||
    merged.ROLLIERANK_MP_APP_ID ||
    merged.mp_app_id ||
    merged.weixin_mp_app_id ||
    ""
  ).trim();
  const secret = (
    merged.WECHAT_MP_APP_SECRET ||
    merged.ROLLIERANK_MP_APP_SECRET ||
    merged.mp_app_secret ||
    merged.weixin_mp_app_secret ||
    ""
  ).trim();
  return { appId, secret };
}

export function explainWechatError(errcode, errmsg = "") {
  if (errcode === 40164) {
    const ipMatch = String(errmsg).match(/invalid ip\s+([0-9a-fA-F.:]+)/i);
    const ipHint = ipMatch ? `出口 IP ${ipMatch[1]}` : "当前机器出口 IP";
    return `IP 不在公众号白名单（errcode=40164）：请登录微信公众平台 → 设置与开发 → 基本配置 → IP白名单，添加 ${ipHint}。`;
  }
  if (errcode === 48001) {
    return `接口未授权（errcode=48001）：当前公众号主体/认证级别不支持该 API（个人未认证订阅号通常支持草稿箱，不支持直接调用 freepublish/menu 接口）。`;
  }
  if (errcode === 40013 || errcode === 40125) {
    return `AppID 或 AppSecret 无效（errcode=${errcode}）：请核对 .env 中的 WECHAT_MP_APP_ID 与 WECHAT_MP_APP_SECRET（注意不是小程序的 AppID）。`;
  }
  if (errcode === 45009) {
    return `今日接口调用次数达到上限（errcode=45009），明天自动恢复。`;
  }
  return `微信接口错误 errcode=${errcode} ${errmsg}`.trim();
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function mimeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

export function createWechatMpClient({
  appId,
  secret,
  fetchImpl = globalThis.fetch,
} = {}) {
  let tokenCache = { token: "", expiresAt: 0 };

  async function callJson(endpoint, payload, query = null) {
    const url = new URL(endpoint, WECHAT_API);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const response = await fetchImpl(url, {
      method: payload ? "POST" : "GET",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`微信接口 ${endpoint} 返回 HTTP ${response.status}`);
    }
    const result = await response.json();
    if (result?.errcode && result.errcode !== 0) {
      const error = new Error(explainWechatError(result.errcode, result.errmsg));
      error.errcode = result.errcode;
      error.errmsg = result.errmsg;
      throw error;
    }
    return result;
  }

  async function getAccessToken(forceRefresh = false) {
    if (!appId || !secret) {
      throw new Error("未配置微信公众号凭证：请在 .env 中填入 WECHAT_MP_APP_ID 和 WECHAT_MP_APP_SECRET。");
    }
    if (!forceRefresh && tokenCache.token && Date.now() < tokenCache.expiresAt) {
      return tokenCache.token;
    }
    const result = await callJson("/cgi-bin/stable_token", {
      grant_type: "client_credential",
      appid: appId,
      secret,
      force_refresh: forceRefresh,
    });
    if (!result?.access_token) {
      throw new Error("未能获取微信公众号 access_token。");
    }
    tokenCache = {
      token: result.access_token,
      expiresAt: Date.now() + Math.max(60, (Number(result.expires_in) || 7200) - 180) * 1000,
    };
    return tokenCache.token;
  }

  async function uploadMultipart(endpoint, filePath, extraQuery = {}) {
    const accessToken = await getAccessToken();
    const url = new URL(endpoint, WECHAT_API);
    url.searchParams.set("access_token", accessToken);
    for (const [k, v] of Object.entries(extraQuery)) {
      url.searchParams.set(k, String(v));
    }
    const bytes = fs.readFileSync(filePath);
    const form = new FormData();
    form.append("media", new Blob([bytes], { type: mimeForFile(filePath) }), path.basename(filePath));
    const response = await fetchImpl(url, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      throw new Error(`上传素材 ${endpoint} 返回 HTTP ${response.status}`);
    }
    const result = await response.json();
    if (result?.errcode && result.errcode !== 0) {
      const error = new Error(explainWechatError(result.errcode, result.errmsg));
      error.errcode = result.errcode;
      error.errmsg = result.errmsg;
      throw error;
    }
    return result;
  }

  return {
    getAccessToken,

    async uploadPermanentImage(filePath) {
      return uploadMultipart("/cgi-bin/material/add_material", filePath, { type: "image" });
    },

    async uploadContentImage(filePath) {
      return uploadMultipart("/cgi-bin/media/uploadimg", filePath);
    },

    async listDrafts({ offset = 0, count = 20, noContent = 1 } = {}) {
      const accessToken = await getAccessToken();
      return callJson(
        "/cgi-bin/draft/batchget",
        { offset, count, no_content: noContent },
        { access_token: accessToken },
      );
    },

    async addDraft(articlePayload) {
      const accessToken = await getAccessToken();
      return callJson(
        "/cgi-bin/draft/add",
        { articles: [articlePayload] },
        { access_token: accessToken },
      );
    },

    async updateDraft(mediaId, articlePayload, index = 0) {
      const accessToken = await getAccessToken();
      return callJson(
        "/cgi-bin/draft/update",
        { media_id: mediaId, index, articles: articlePayload },
        { access_token: accessToken },
      );
    },

    async submitPublish(mediaId) {
      const accessToken = await getAccessToken();
      return callJson(
        "/cgi-bin/freepublish/submit",
        { media_id: mediaId },
        { access_token: accessToken },
      );
    },

    async createMenu(menuPayload) {
      const accessToken = await getAccessToken();
      return callJson(
        "/cgi-bin/menu/create",
        menuPayload,
        { access_token: accessToken },
      );
    },
  };
}
