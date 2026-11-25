// 卷豆账号、余额、明细与邀请接口封装（按当前环境隔离本机 token）。
const { request } = require("./api.js");
const profile = require("./profile.js");
const storage = require("../utils/storage.js");
const format = require("../utils/format.js");
const { IS_TEST_ENVIRONMENT } = require("../config.js");

const DEFAULT_PACKAGES = [1, 5, 10, 30, 60].map(credits => ({ credits, cents: credits * 100 }));

const TOOL_LABEL = {
  "answer-sheet": "答题卡扫描",
  "photo-review": "拍照批改",
};

const SOURCE_LABEL = {
  welcome: "首次赠送",
  manual: "人工调整",
  tool: "工具使用",
  invite: "邀请奖励",
  purchase: "微信充值",
  refund: "微信充值退款",
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

async function authedRequest(path, payload, timeout = 15000, required = true, expectedToken) {
  const headers = authHeader(required);
  if (expectedToken !== undefined && headers.Authorization !== `Bearer ${expectedToken}`) {
    throw new Error("卷豆账号已切换，请重新操作。");
  }
  try {
    return await request(path, payload, timeout, headers);
  } catch (error) {
    // A failed wx.login exchange for payment does not expire the wallet's Bearer session.
    if (error?.statusCode === 401 && error.errorId === "login" && headers.Authorization === `Bearer ${storage.toolCreditToken()}`) {
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
    return {
      credits: creditsCount,
      cents,
      yuanText: `¥${yuan}`,
      featured: false,
    };
  });
  // Keep the full-width card and complete two-column rows when there is an odd number of packages.
  if (formatted.length % 2 === 1 && formatted.length >= 3) {
    const idx = formatted.findIndex(item => item.credits === 10);
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

function formatCredit(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const rounded = Math.round(num * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function scannableCount(balance, cost) {
  const safeBalance = Math.round((Number(balance) || 0) * 10);
  const safeCost = Math.round((Number(cost) || 0) * 10);
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
    amountText: positive ? `+${formatCredit(amount)}` : formatCredit(amount),
    balanceAfter: entry?.balanceAfter ?? null,
    balanceText: typeof entry?.balanceAfter === "number" ? `余额 ${formatCredit(entry.balanceAfter)} 颗` : "",
    timeText: format.dateTime(entry?.createdAt),
    createdAt: entry?.createdAt || 0,
  };
}

async function capabilities() {
  const data = await request("tool-credits/capabilities");
  const packages = Array.isArray(data?.purchase?.packages) ? data.purchase.packages.filter(item =>
    Number.isInteger(item?.credits) && item.credits > 0 && item.cents === item.credits * 100) : [];
  return {
    login: Boolean(data?.login),
    invite: Boolean(data?.invite),
    purchase: {
      directPurchase: Boolean(data?.purchase?.directPurchase),
      tokenRecharge: Boolean(data?.purchase?.tokenRecharge && packages.length),
      tokenRechargeIos: Boolean(data?.purchase?.tokenRechargeIos),
      packages: formatPackages(packages),
    },
    ads: Boolean(data?.ads),
  };
}

function rechargeDevice(purchase) {
  const device = wx.getDeviceInfo?.() || wx.getSystemInfoSync?.() || {};
  const platform = String(device.platform || "").toLowerCase();
  const simulatesApple = platform === "devtools" && /iphone|ipad|\bios\b/i.test(`${device.model} ${device.system}`);
  if (IS_TEST_ENVIRONMENT && (platform === "ios" || simulatesApple)) return { testGuide: "ios" };
  if (platform === "devtools") return { testGuide: "preview" };
  if (platform === "ios" && !purchase.tokenRechargeIos) {
    return { message: "iOS 暂未开放卷豆充值。" };
  }
  if (typeof wx.requestVirtualPayment !== "function") return { message: "当前微信版本无法充值，请更新后重试。" };
  if (platform === "ios") return { platform: "ios" };
  if (["android", "ohos", "harmonyos", "windows"].includes(platform)) return { platform: "android" };
  return { message: "当前设备暂时无法充值。" };
}

async function createRecharge({ credits, cents, requestId }, platform) {
  const token = storage.toolCreditToken();
  const code = await wxLoginCode();
  return authedRequest("tool-credits/recharges", { credits, quotedCents: cents, requestId, platform, code }, 15_000, true, token);
}

async function paidRecharge() {
  const data = await authedRequest("tool-credits/recharges");
  return Array.isArray(data.orders) ? data.orders.find(order => order.state === "paid" && /^RC[a-f0-9]{30}$/.test(order.id)) : null;
}

async function confirmRecharge(id) {
  const token = storage.toolCreditToken();
  const path = `tool-credits/recharges/${encodeURIComponent(id)}/confirm`;
  const result = await authedRequest(path, {}, 30_000);
  if (!result.order?.needsWechatCode) return result.order;
  if (token !== storage.toolCreditToken()) throw new Error("卷豆账号已切换，请重新操作。");
  return (await authedRequest(path, { code: await wxLoginCode() }, 30_000, true, token)).order;
}

function describeRechargeFailure(errCode, errMsg) {
  const code = Number(errCode);
  if (code === -2) return { title: "已取消支付", message: "支付已取消。", detail: "" };
  let title = "未能调起支付";
  let message = "未能调起微信支付，请稍后重试。";
  if (code === -4) {
    title = "支付暂受限制";
    message = "当前支付被微信风控拦截，请稍后再试。";
  } else if (code === 1001 || code === -15001) {
    title = "支付参数异常";
    message = "微信支付参数有误，请稍后重试。";
  } else if (code === -15002) {
    title = "订单已失效";
    message = "这笔订单号已失效，请重新点击充值。";
  } else if (code === -15006 || code === -15011) {
    title = "签名校验失败";
    message = "微信支付签名校验失败，请检查后台配置。";
  } else if (code === -15009) {
    title = "代币暂未发布";
    message = IS_TEST_ENVIRONMENT
      ? "当前测试环境的卷豆代币尚未发布，请核对微信虚拟支付后台配置。"
      : "当前充值服务暂未就绪，请稍后再试。";
  }
  const detail = IS_TEST_ENVIRONMENT
    ? [
        Number.isFinite(code) ? `errCode=${code}` : "",
        typeof errMsg === "string" && errMsg.trim() ? errMsg.trim() : "",
      ].filter(Boolean).join(" ")
    : "";
  return { title, message, detail };
}

function formatRechargeFailure(errCode, errMsg) {
  const { message, detail } = describeRechargeFailure(errCode, errMsg);
  return detail ? `${message}（${detail}）` : message;
}

function payRecharge(payData, order) {
  const { mode, signData, paySig, signature } = payData;
  let sign;
  try { sign = JSON.parse(signData); } catch { /* Rejected by the checkout validation below. */ }
  // Confirm the checkout targets this order and environment before handing off to the native cashier.
  if (mode !== "short_series_coin" || sign?.env !== (IS_TEST_ENVIRONMENT ? 1 : 0) ||
      sign.outTradeNo !== order.id || sign.buyQuantity !== order.credits || sign.currencyType !== "CNY" ||
      typeof paySig !== "string" || !paySig || typeof signature !== "string" || !signature) {
    throw Object.assign(new Error("充值订单校验失败，请重试。"), { errorId: "recharge-signature" });
  }
  return new Promise(resolve => {
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    wx.requestVirtualPayment({
      mode, signData, paySig, signature,
      success: () => finish({ status: "paid", errCode: 0, errMsg: "" }),
      fail: (err = {}) => {
        const rawCode = err.errCode ?? err.errno;
        const code = rawCode === undefined || rawCode === null || rawCode === "" ? NaN : Number(rawCode);
        const errMsg = typeof err.errMsg === "string" ? err.errMsg.trim() : "";
        if (code === -2) finish({ status: "cancelled", errCode: -2, errMsg });
        else finish({ status: "failed", errCode: Number.isFinite(code) ? code : null, errMsg });
      },
      complete: () => finish({ status: "unknown", errCode: null, errMsg: "" }),
    });
  });
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
  const token = storage.toolCreditToken();
  const data = await authedRequest(`tool-credits/wallet${query}`, undefined, 15000, true);
  if (token !== storage.toolCreditToken()) throw new Error("卷豆账号已切换，请重新读取。");
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
  const parsed = Number(data.cost);
  return {
    tool: data.tool || tool,
    cost: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : 0.1,
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
  rechargeDevice,
  createRecharge,
  paidRecharge,
  confirmRecharge,
  payRecharge,
  describeRechargeFailure,
  formatRechargeFailure,
  hasSession,
  accountId,
  uid,
  formatPackages,
  DEFAULT_PACKAGES,
  legacyBindCandidate,
  formatCredit,
  scannableCount,
  shortAccountId,
  formatRecord,
  TOOL_LABEL,
  SOURCE_LABEL,
};
