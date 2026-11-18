// 服务端接口封装：统一超时、错误文案与凭证。
const { API_BASE } = require("../config");
const storage = require("./storage");

function request(path, payload, timeout = 15000) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/api/${path}`,
      method: payload === undefined ? "GET" : "POST",
      header: payload === undefined ? {} : { "Content-Type": "application/json" },
      data: payload,
      timeout,
      success(res) {
        const data = res.data && typeof res.data === "object" ? res.data : null;
        if (res.statusCode >= 200 && res.statusCode < 300 && data) resolve(data);
        else reject(Object.assign(new Error((data && data.error) || "操作未完成，请重试。"), { statusCode: res.statusCode }));
      },
      fail() {
        reject(new Error("练习服务暂时不可用，录入内容仍在本机，请稍后重试。"));
      },
    });
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
  return request("submit", {
    guestId: storage.guestId(),
    attemptId,
    versionId: version.id,
    name: storage.name(),
    answers,
    ...(timing ? { timing } : {}),
  });
}

async function sync(attemptIds) {
  const result = await request("attempts/sync", {
    guestId: storage.guestId(),
    ...(attemptIds ? { attemptIds } : {}),
  });
  return Array.isArray(result.attempts) ? result.attempts : [];
}

async function remove(attemptIds) {
  return request("attempts/delete", { guestId: storage.guestId(), attemptIds });
}

module.exports = { request, catalog, versionForScope, submit, sync, remove, resetCatalogCache() { catalogCache.versions = null; } };
