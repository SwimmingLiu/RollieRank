const { API_BASE } = require("../config.js");
const { request } = require("./api.js");
const storage = require("../utils/storage.js");

const TOKEN = "rr:profile-token";
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

function avatarUrl(id = storage.avatarId()) {
  return id ? API_BASE + "/api/miniprogram-profile/avatar?id=" + id : "";
}

async function write(patch) {
  const { profile } = await request("miniprogram-profile/profile", { token: await getToken(), ...patch });
  if (profile.name) storage.setName(profile.name);
  storage.setAvatarId(profile.avatarId);
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
  const { profile } = await request("miniprogram-profile/profile", { token });
  return profile;
}

module.exports = {
  avatarUrl, read, saveAvatar, savePhone, saveName: name => write({ name }),
  capabilities: () => request("miniprogram-profile/capabilities"),
};
