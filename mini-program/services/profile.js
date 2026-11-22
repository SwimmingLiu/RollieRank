const { API_BASE, IS_TEST_ENVIRONMENT, storageKey } = require("../config.js");
const { request } = require("./api.js");
const storage = require("../utils/storage.js");

const TOKEN = storageKey("rr:profile-token");
const credential = /^[a-f0-9]{48}$/;
let pendingSession;

function getToken() {
  const saved = wx.getStorageSync(TOKEN);
  if (typeof saved === "string" && credential.test(saved)) return Promise.resolve(saved);
  pendingSession ??= request("miniprogram-profile/session", {}).then(({ token }) => {
    if (typeof token !== "string" || !credential.test(token)) throw new Error("暂时无法保存资料，请重试。");
    wx.setStorageSync(TOKEN, token);
    return token;
  }).finally(() => { pendingSession = undefined; });
  return pendingSession;
}

function avatarUrl(id = storage.avatarId(), url = storage.avatarUrl()) {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
  return id ? API_BASE + "/api/miniprogram-profile/avatar?id=" + id : "";
}

function authorAvatarUrl(author) {
  const raw = typeof author?.avatarUrl === "string" ? author.avatarUrl.trim() : "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/api/")) return API_BASE + raw;
  return "";
}

async function quietWxCode() {
  // 验收包使用本地资料服务，省去正式 AppID 的内容审核登录。
  if (IS_TEST_ENVIRONMENT) return "";
  try {
    const res = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
    return typeof res?.code === "string" ? res.code : "";
  } catch {
    return "";
  }
}

async function write(patch) {
  const needsCheck = patch.name !== undefined || patch.avatar !== undefined;
  const wxCode = needsCheck && !patch.wxCode ? await quietWxCode() : "";
  const { profile } = await request("miniprogram-profile/profile", {
    token: await getToken(),
    guestId: storage.guestId(),
    ...patch,
    ...(wxCode ? { wxCode } : {}),
  });
  if (profile.name) storage.setName(profile.name);
  storage.setAvatarId(profile.avatarId || "");
  storage.setAvatarUrl(profile.avatarUrl || "");
  return profile;
}

async function saveAvatar(filePath) {
  const { tempFilePath } = await new Promise((resolve, reject) => wx.compressImage({
    src: filePath, quality: 75, compressedWidth: 192, compressedHeight: 192, success: resolve, fail: reject,
  }));
  const { data } = await new Promise((resolve, reject) => wx.getFileSystemManager().readFile({
    filePath: tempFilePath, encoding: "base64", success: resolve, fail: reject,
  }));
  return write({ avatar: data });
}

async function savePhone(phoneCode) {
  const { code } = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
  return write({ phoneCode, code });
}

async function read() {
  const token = wx.getStorageSync(TOKEN);
  if (typeof token !== "string" || !credential.test(token)) return null;
  const { profile } = await request("miniprogram-profile/profile", {
    token,
    guestId: storage.guestId(),
  });
  if (profile?.name) storage.setName(profile.name);
  if (profile) {
    storage.setAvatarId(profile.avatarId || "");
    storage.setAvatarUrl(profile.avatarUrl || "");
  }
  return profile;
}

function savedToken() {
  const saved = wx.getStorageSync(TOKEN);
  return typeof saved === "string" && credential.test(saved) ? saved : "";
}

module.exports = {
  avatarUrl, authorAvatarUrl, read, saveAvatar, savePhone, saveName: name => write({ name }), savedToken,
  capabilities: () => request("miniprogram-profile/capabilities"),
};
