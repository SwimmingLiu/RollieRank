export const DAY_MS = 24 * 60 * 60 * 1000;
export const INVITE_CHANNEL = "wechat-group";
export const REFERRAL_CHANNEL = "share";
export const TOOL_ID = /^[a-z][a-z0-9-]{0,39}$/;
export const MAX_HOLD_MS = 30 * 60 * 1000;
export const CREDIT_SCALE = 10;

export const defaultCreditRules = {
  welcome: { newAccount: 3, existingMember: 3 },
  costs: { "answer-sheet": 0.1 },
  invite: { enabled: false, groups: false, reward: 2, monthlyLimit: 10, registerDays: 7, useDays: 7 },
  referral: { enabled: true, reward: 1, monthlyLimit: 0 },
  purchase: {
    directPurchase: false, tokenRecharge: false,
    packages: [
      { credits: 1, cents: 100 }, { credits: 5, cents: 500 }, { credits: 10, cents: 1000 },
      { credits: 30, cents: 3000 }, { credits: 60, cents: 6000 },
    ],
  },
  ads: { enabled: false, reward: 1, dailyLimit: 2 },
};

export function creditError(statusCode, message, errorId) {
  return Object.assign(new Error(message), { statusCode, errorId });
}

export function toCreditUnits(value, scale = CREDIT_SCALE) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (scale === 1) return Number.isSafeInteger(value) ? value : null;
  if (Number(value.toFixed(1)) !== value) return null;
  const scaled = value * scale;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6 || !Number.isSafeInteger(rounded)) return null;
  return rounded;
}

export function fromCreditUnits(units, scale = CREDIT_SCALE) {
  if (units === null || units === undefined) return null;
  if (scale === 1) return units;
  return Number((units / scale).toFixed(1));
}

export function validCreditAmount(value, { min = -10000, max = 10000, allowZero = true, scale = CREDIT_SCALE } = {}) {
  const units = toCreditUnits(value, scale);
  if (units === null) return false;
  if (!allowZero && units === 0) return false;
  return units >= Math.round(min * scale) && units <= Math.round(max * scale);
}

export const validId = (id) => typeof id === "string" && /^[\w-]{10,80}$/.test(id);
export const validUid = (value) => typeof value === "string" && /^[1-9]\d{4,9}$/.test(value);
export const validAccountRef = (value) => validId(value) || validUid(value);

// Business limits follow the mini-program's mainland usage day.
export function usageDay(now) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function updateCreditRules(previous, input, { groupApproved, directPurchaseReady = false, tokenRechargeReady = false }) {
  const integer = (value, min, max, label) => {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw creditError(400, `${label}须为 ${min} 到 ${max} 的整数。`);
    }
    return value;
  };
  const credit = (value, min, max, label) => {
    const units = toCreditUnits(value, CREDIT_SCALE);
    if (units === null || units < Math.round(min * CREDIT_SCALE) || units > Math.round(max * CREDIT_SCALE)) {
      throw creditError(400, `${label}须为 ${min} 到 ${max} 之间、最多 1 位小数的数值。`);
    }
    return fromCreditUnits(units, CREDIT_SCALE);
  };
  const merge = (key) => ({ ...defaultCreditRules[key], ...previous[key], ...input[key] });
  const welcome = merge("welcome");
  const invite = merge("invite");
  const referral = merge("referral");
  const purchase = merge("purchase");
  const ads = merge("ads");
  const costs = { ...previous.costs, ...input.costs };
  if (Object.keys(costs).length > 30 || Object.keys(costs).some((key) => !TOOL_ID.test(key))) {
    throw creditError(400, "工具标识有误。");
  }
  if ([invite.enabled, invite.groups, referral.enabled, purchase.directPurchase, purchase.tokenRecharge, ads.enabled].some(value => typeof value !== "boolean")) {
    throw creditError(400, "开关设置有误。");
  }
  if (!groupApproved && (input.invite?.enabled === true || input.invite?.groups === true)) {
    throw creditError(409, "微信群邀请待提审和渠道校验接入。");
  }
  if ((!directPurchaseReady && input.purchase?.directPurchase === true) ||
      (!tokenRechargeReady && input.purchase?.tokenRecharge === true) || ads.enabled) {
    throw creditError(409, "支付与广告渠道待微信开通和联调。");
  }
  if (!Array.isArray(purchase.packages) || purchase.packages.length > 20 ||
      new Set(purchase.packages.map(pack => pack?.credits)).size !== purchase.packages.length) {
    throw creditError(400, "套餐颗数必须唯一。");
  }
  const packages = purchase.packages.map(pack => {
    const credits = integer(pack?.credits, 1, 10000, "套餐颗数");
    // The published WeChat coin rate fixes the price of every package.
    if (pack.cents !== credits * 100) throw creditError(400, "卷豆充值为 1 元 1 颗。", "recharge-price");
    return { credits, cents: credits * 100 };
  }).sort((a, b) => a.credits - b.credits);
  if (purchase.tokenRecharge && !packages.length) throw creditError(400, "请设置至少一个充值档位。");
  return {
    welcome: {
      newAccount: credit(welcome.newAccount, 0, 100, "新人赠送"),
      existingMember: credit(welcome.existingMember, 0, 100, "老卷友赠送"),
    },
    costs: Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, credit(value, 0.1, 100, "用量")])),
    invite: {
      enabled: groupApproved && invite.enabled, groups: groupApproved && invite.groups,
      reward: credit(invite.reward, 0, 100, "邀请奖励"),
      monthlyLimit: integer(invite.monthlyLimit, 1, 100, "每月奖励人数"),
      registerDays: integer(invite.registerDays, 1, 30, "邀请认领天数"),
      useDays: integer(invite.useDays, 1, 30, "首次有效使用天数"),
    },
    referral: {
      enabled: referral.enabled,
      reward: credit(referral.reward, 0, 100, "分享注册奖励"),
      monthlyLimit: integer(referral.monthlyLimit, 0, 10000, "分享奖励每月上限"),
    },
    purchase: {
      directPurchase: purchase.directPurchase, tokenRecharge: purchase.tokenRecharge,
      packages,
    },
    ads: {
      enabled: ads.enabled, reward: credit(ads.reward, 0.1, 100, "广告奖励"),
      dailyLimit: integer(ads.dailyLimit, 1, 20, "广告每日领取上限"),
    },
  };
}
