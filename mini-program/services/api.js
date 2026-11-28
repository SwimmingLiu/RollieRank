// 服务端接口封装：统一超时、错误文案与凭证。
const { API_BASE, IS_TEST_ENVIRONMENT } = require("../config.js");
const storage = require("../utils/storage.js");
let testReady;

function messageFor(error) {
  const text = String((error && (error.errMsg || error.message)) || "");
  // 真机上最常见的三类失败要分开说：域名没加入白名单、超时、网络不通。
  if (/url not in domain list|domain list/i.test(text)) return "接口域名未加入小程序的合法域名，请在微信公众平台添加后重试。";
  if (/timeout/i.test(text)) return "网络较慢，请求超时了，请稍后重试。";
  return "练习服务暂时不可用，录入内容仍在本机，请稍后重试。";
}

function send(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: resolve,
      fail(error) {
        reject(new Error(messageFor(error)));
      },
    });
  });
}

function responseHeader(response, name) {
  return Object.entries(response.header || {}).find(([key]) => key.toLowerCase() === name)?.[1];
}

function verifyTestResponse(response) {
  if (responseHeader(response, "x-rollierank-environment") !== "test") {
    testReady = undefined;
    throw new Error("测试接口校验失败，请联系维护者。");
  }
}

async function request(path, payload, timeout = 15000, extraHeader = {}) {
  const writing = payload !== undefined;
  if (IS_TEST_ENVIRONMENT && writing) {
    // 测试客户端先用只读目录确认环境，避免配置错时把记录写到生产。
    testReady ??= send({ url: `${API_BASE}/api/catalog`, method: "GET", timeout: 10000 })
      .then(response => {
        verifyTestResponse(response);
        if (response.statusCode !== 200) throw new Error("测试套卷目录暂不可用，请重试。");
      }).catch(error => { testReady = undefined; throw error; });
    await testReady;
  }
  const hasAuthHeader = Object.keys(extraHeader || {}).some(k => k.toLowerCase() === "authorization");
  const isAdminPath = /^admin(?:\/|$)/i.test(String(path || ""));
  const hasStorage = typeof wx !== "undefined" && typeof wx.getStorageSync === "function";
  const creditToken = !hasAuthHeader && !isAdminPath && hasStorage ? storage.toolCreditToken() : "";
  const header = {
    ...(writing ? { "Content-Type": "application/json" } : {}),
    ...(creditToken ? { Authorization: `Bearer ${creditToken}` } : {}),
    ...extraHeader,
  };
  const response = await send({ url: `${API_BASE}/api/${path}`, method: payload === undefined ? "GET" : "POST", header, data: payload, timeout });
  if (IS_TEST_ENVIRONMENT) {
    verifyTestResponse(response);
    if (path === "catalog" && !writing && response.statusCode === 200) testReady ??= Promise.resolve();
  }
  const data = response.data && typeof response.data === "object" ? response.data : null;
  if (response.statusCode >= 200 && response.statusCode < 300 && data) return data;
  throw Object.assign(new Error((data && data.error) || "操作未完成，请重试。"), {
    statusCode: response.statusCode,
    errorId: data && data.errorId ? data.errorId : "",
  });
}

const catalogCache = { versions: null, at: 0 };

async function catalog(force) {
  if (!force && catalogCache.versions && Date.now() - catalogCache.at < 5 * 60 * 1000) return catalogCache.versions;
  const result = await request("catalog");
  if (!Array.isArray(result.versions)) throw new Error("套卷目录格式无效，请重新读取。");
  catalogCache.versions = result.versions;
  catalogCache.at = Date.now();
  return result.versions;
}

function versionForScope(versions, scope) {
  if (scope.versionId) return versions.find(v => v.id === scope.versionId) || null;
  return versions.find(v => v.paperId === scope.paperId && v.status !== "draft") || null;
}

async function submit({ version, answers, attemptId, timing }) {
  const token = storage.toolCreditToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return request("submit", {
    guestId: storage.guestId(),
    attemptId,
    versionId: version.id,
    name: storage.name(),
    answers,
    ...(timing ? { timing } : {}),
  }, 15000, headers);
}

async function sync(attemptIds) {
  const result = await request("attempts/sync", {
    guestId: storage.guestId(),
    ...(attemptIds ? { attemptIds } : {}),
  });
  const list = Array.isArray(result.attempts) ? result.attempts : [];
  Object.defineProperty(list, "scope", { value: result.scope || "guest", enumerable: false });
  return list;
}

async function remove(attemptIds) {
  return request("attempts/delete", { guestId: storage.guestId(), attemptIds });
}

async function recognizeAnswerSheet({ image, expectedQuestions, quotedCost, operationId }) {
  const token = storage.toolCreditToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return request("omr/recognize", {
    image,
    ...(Number.isInteger(expectedQuestions) ? { expectedQuestions } : {}),
    ...(quotedCost !== undefined && quotedCost !== null ? { quotedCost } : {}),
    ...(operationId ? { operationId } : {}),
  }, 45000, headers);
}

module.exports = { request, catalog, versionForScope, submit, sync, remove, recognizeAnswerSheet, resetCatalogCache() { catalogCache.versions = null; } };
