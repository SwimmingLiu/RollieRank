// 全站分享归因与专属小程序码工具：支持分享卡片参数与小程序码 scene 两种入口。
const storage = require("./storage.js");
const credits = require("../services/tool-credits.js");

const REF_CODE_RE = /^[a-zA-Z0-9]{5,16}$/;
let cachedQrPath = "";
let cachedQrCode = "";
let pendingQrPromise = null;

function parseSceneReferral(rawScene) {
  if (typeof rawScene !== "string" || !rawScene.trim()) return "";
  let decoded = rawScene.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep raw scene if already decoded or malformed.
  }
  const parts = decoded.split("&");
  for (let i = 0; i < parts.length; i += 1) {
    const pair = parts[i].split("=");
    const key = String(pair[0] || "").trim();
    const value = String(pair[1] || "").trim();
    if ((key === "r" || key === "ref") && REF_CODE_RE.test(value)) {
      return value;
    }
  }
  return "";
}

function extractReferral(options) {
  if (!options || typeof options !== "object") return "";
  const query = options.query && typeof options.query === "object" ? options.query : options;
  const direct = typeof query.ref === "string" ? query.ref.trim() : "";
  if (REF_CODE_RE.test(direct)) return direct;
  return parseSceneReferral(query.scene || options.scene || "");
}

function ownReferralCode() {
  if (!credits.hasSession()) return "";
  const code = storage.referralCode();
  if (code) return code;
  const uid = storage.toolCreditUid();
  return uid >= 10000 ? String(uid) : "";
}

function captureReferral(options) {
  const code = extractReferral(options);
  if (!code) return "";
  const own = ownReferralCode();
  if (own && code === own) return "";
  const uid = storage.toolCreditUid();
  if (uid && code === String(uid)) return "";
  if (!storage.pendingReferral()) {
    storage.setPendingReferral(code);
  }
  return storage.pendingReferral();
}

function withReferralPath(path) {
  const base = String(path || "/pages/home/home");
  const code = ownReferralCode();
  if (!code) return base;
  if (/[?&]ref=/.test(base)) return base;
  const sep = base.indexOf("?") >= 0 ? "&" : "?";
  return `${base}${sep}ref=${encodeURIComponent(code)}`;
}

function withReferralQuery(query) {
  const raw = String(query || "").replace(/^\?/, "");
  const code = ownReferralCode();
  if (!code) return raw;
  if (/(?:^|&)ref=/.test(raw)) return raw;
  return raw ? `${raw}&ref=${encodeURIComponent(code)}` : `ref=${encodeURIComponent(code)}`;
}

function cachedReferralState() {
  const meta = storage.referralMeta();
  const enabled = Boolean(meta && meta.enabled && meta.reward > 0);
  const reward = enabled ? meta.reward : 0;
  return {
    enabled,
    reward,
    rewardText: enabled ? credits.formatCredit(reward) : "",
    monthlyLimit: meta ? meta.monthlyLimit : 0,
    signedIn: credits.hasSession(),
    code: ownReferralCode(),
  };
}

async function syncReferral() {
  try {
    await credits.capabilities();
  } catch {
    // Offline or network issue: keep last cached capabilities.
  }
  if (credits.hasSession() && !storage.referralCode()) {
    try {
      await credits.referralInfo();
    } catch {
      // Ignore quietly; uid fallback remains valid until code is fetched.
    }
  }
  return cachedReferralState();
}

async function loadPersonalQrFile() {
  if (!credits.hasSession()) return "";
  const knownCode = storage.referralCode();
  if (cachedQrPath && knownCode && cachedQrCode === knownCode) {
    return cachedQrPath;
  }
  if (pendingQrPromise) return pendingQrPromise;
  pendingQrPromise = (async () => {
    try {
      const data = await credits.referralQrCode();
      if (!data?.image || !data?.code) return "";
      const fs = typeof wx.getFileSystemManager === "function" ? wx.getFileSystemManager() : null;
      const userDir = wx.env && wx.env.USER_DATA_PATH;
      if (!fs || !userDir) return "";
      const filePath = `${userDir}/rr-ref-qr-${data.code}.jpg`;
      await new Promise((resolve, reject) => {
        fs.writeFile({
          filePath,
          data: data.image,
          encoding: "base64",
          success: resolve,
          fail: reject,
        });
      });
      cachedQrCode = data.code;
      cachedQrPath = filePath;
      return filePath;
    } catch {
      return "";
    } finally {
      pendingQrPromise = null;
    }
  })();
  return pendingQrPromise;
}

module.exports = {
  extractReferral,
  captureReferral,
  ownReferralCode,
  withReferralPath,
  withReferralQuery,
  cachedReferralState,
  syncReferral,
  loadPersonalQrFile,
};
