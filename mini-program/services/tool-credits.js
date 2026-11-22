// 卷豆账号、余额、明细与邀请接口封装（按当前环境隔离本机 token）。
const { request } = require("./api.js");
const profile = require("./profile.js");
const storage = require("../utils/storage.js");
const format = require("../utils/format.js");

const DEFAULT_PACKAGES = [
  { credits: 1, cents: 100 },
  { credits: 5, cents: 400 },
  { credits: 10, cents: 600 },
  { credits: 30, cents: 1500 },
  { credits: 60, cents: 2700 },
];

const TOOL_LABEL = {
  "answer-sheet": "答题卡扫描",
  "photo-review": "拍照批改",
};

const SOURCE_LABEL = {
  welcome: "首次赠送",
  manual: "人工调整",
  tool: "工具使用",
  invite: "邀请奖励",
};

function wxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res && typeof res.code === "string" && res.code) {
          resolve(res.code);
        } else {
          reject(new Error("未能获取微信登录凭证，请重试。"));
        }
      },
      fail() {
        reject(new Error("微信登录调用失败，请稍后重试。"));
      },
    });
  });
}

function authHeader(required = true) {
  const token = storage.toolCreditToken();
  if (!token) {
    if (required) throw Object.assign(new Error("请先登录微信账号。"), { statusCode: 401, errorId: "login" });
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

async function authedRequest(path, payload, timeout = 15000, required = true) {
  const headers = authHeader(required);
  try {
    return await request(path, payload, timeout, headers);
  } catch (error) {
    if (error && error.statusCode === 401) {
      storage.clearToolCreditSession();
    }
    throw error;
  }
}

function hasSession() {
  return Boolean(storage.toolCreditToken());
}

function accountId() {
  return storage.toolCreditAccountId();
}

function uid() {
  return storage.toolCreditUid();
}

function formatPackages(list) {
  const source = Array.isArray(list) && list.length ? list : DEFAULT_PACKAGES;
  const formatted = source.map((item) => {
    const creditsCount = Number(item?.credits) || 0;
    const cents = Number(item?.cents) || 0;
    const yuan = (cents / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    const unit = creditsCount > 0 ? (cents / 100 / creditsCount).toFixed(2) : "0.00";
    return {
      credits: creditsCount,
      cents,
      yuanText: `¥${yuan}`,
      unitText: `¥${unit}/颗`,
      recommended: creditsCount === 10,
      featured: false,
    };
  });
  // 奇数档位时把主推档置顶跨两列，保证下方 2×N 网格完全对称无残缺空洞。
  if (formatted.length % 2 === 1 && formatted.length >= 3) {
    const idx = formatted.findIndex((item) => item.recommended);
    const featuredIdx = idx >= 0 ? idx : 0;
    const [featured] = formatted.splice(featuredIdx, 1);
    featured.featured = true;
    formatted.unshift(featured);
  }
  return formatted;
}

function legacyBindCandidate() {
  const profileToken = profile.savedToken();
  const attempts = storage.history();
  const attempt = attempts.find(item => item && typeof item.id === "string" && /^[\w-]{10,80}$/.test(item.id));
  const attemptId = attempt ? attempt.id : "";
  return {
    eligible: Boolean(profileToken || attemptId),
    profileToken,
    attemptId,
  };
}

function scannableCount(balance, cost) {
  const safeBalance = Number(balance) || 0;
  const safeCost = Number(cost) || 0;
  if (safeBalance <= 0 || safeCost <= 0) return 0;
  return Math.floor(safeBalance / safeCost);
}

function shortAccountId(id) {
  const text = String(id || "").trim();
  if (text.length <= 18) return text;
  return `${text.slice(0, 8)}…${text.slice(-6)}`;
}

function formatRecord(entry) {
  const amount = Number(entry?.amount) || 0;
  const positive = amount >= 0;
  const source = String(entry?.source || "");
  const fallbackTitle = source === "manual"
    ? (positive ? "人工补发" : "人工扣回")
    : (SOURCE_LABEL[source] || "卷豆变动");
  const title = String(entry?.reason || "").trim() || fallbackTitle;
  const tool = entry?.tool ? (TOOL_LABEL[entry.tool] || entry.tool) : "";
  return {
    id: entry.id,
    source,
    sourceLabel: SOURCE_LABEL[source] || "明细",
    title,
    tool,
    amount,
    positive,
    amountText: positive ? `+${amount}` : `${amount}`,
    balanceAfter: entry?.balanceAfter ?? null,
    balanceText: typeof entry?.balanceAfter === "number" ? `余额 ${entry.balanceAfter} 颗` : "",
    timeText: format.dateTime(entry?.createdAt),
    createdAt: entry?.createdAt || 0,
  };
}

async function capabilities() {
  const data = await request("tool-credits/capabilities");
  return {
    login: Boolean(data?.login),
    invite: Boolean(data?.invite),
    purchase: {
      directPurchase: Boolean(data?.purchase?.directPurchase),
      tokenRecharge: Boolean(data?.purchase?.tokenRecharge),
      packages: formatPackages(data?.purchase?.packages),
    },
    ads: Boolean(data?.ads),
  };
}

async function login({ bindLegacy = false, profileToken, attemptId, inviteClaim } = {}) {
  const code = await wxLoginCode();
  const payload = {
    code,
    visitorId: storage.guestId(),
  };
  if (bindLegacy) {
    payload.bindLegacy = true;
    const candidate = legacyBindCandidate();
    const resolvedProfileToken = profileToken !== undefined ? profileToken : candidate.profileToken;
    const resolvedAttemptId = attemptId !== undefined ? attemptId : candidate.attemptId;
    if (resolvedProfileToken) payload.profileToken = resolvedProfileToken;
    if (resolvedAttemptId) payload.attemptId = resolvedAttemptId;
  }
  const claim = inviteClaim !== undefined ? inviteClaim : storage.inviteClaim();
  if (claim) payload.inviteClaim = claim;

  const result = await request("tool-credits/login", payload);
  storage.setToolCreditToken(result.token);
  storage.setToolCreditAccountId(result.accountId);
  if (result.uid) storage.setToolCreditUid(result.uid);
  if (claim && result.created) storage.setInviteClaim("");
  return result;
}

async function wallet(before = 0) {
  const query = Number.isSafeInteger(before) && before > 0 ? `?before=${before}` : "";
  const data = await authedRequest(`tool-credits/wallet${query}`, undefined, 15000, true);
  if (data?.accountId) storage.setToolCreditAccountId(data.accountId);
  if (data?.uid) storage.setToolCreditUid(data.uid);
  return {
    accountId: data.accountId,
    uid: Number(data.uid) || storage.toolCreditUid() || 0,
    balance: Number(data.balance) || 0,
    held: Number(data.held) || 0,
    records: Array.isArray(data.records) ? data.records.map(formatRecord) : [],
    nextBefore: data.nextBefore ?? null,
  };
}

async function quote(tool = "answer-sheet") {
  const data = await authedRequest(`tool-credits/quote?tool=${encodeURIComponent(tool)}`, undefined, 15000, false);
  return {
    tool: data.tool || tool,
    cost: Number(data.cost) || 1,
  };
}

async function logout() {
  const token = storage.toolCreditToken();
  try {
    if (token) {
      await request("tool-credits/logout", {}, 10000, { Authorization: `Bearer ${token}` });
    }
  } catch {
    // 即使服务端注销网络异常，仍清除本机登录态，避免用户卡在过期会话。
  } finally {
    storage.clearToolCreditSession();
  }
  return { ok: true };
}

async function makeInvite() {
  return authedRequest("tool-credits/invite/code", {}, 15000, true);
}

async function visitInvite({ code, scene, proof }) {
  const data = await request("tool-credits/invite/visit", {
    code,
    visitorId: storage.guestId(),
    scene,
    proof,
  });
  if (data?.accepted && data.claim) {
    storage.setInviteClaim(data.claim);
  }
  return data;
}

module.exports = {
  capabilities,
  login,
  wallet,
  quote,
  logout,
  makeInvite,
  visitInvite,
  hasSession,
  accountId,
  uid,
  formatPackages,
  DEFAULT_PACKAGES,
  legacyBindCandidate,
  scannableCount,
  shortAccountId,
  formatRecord,
  TOOL_LABEL,
  SOURCE_LABEL,
};
