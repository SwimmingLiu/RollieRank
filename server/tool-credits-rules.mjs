export const DAY_MS = 24 * 60 * 60 * 1000;
export const INVITE_CHANNEL = "wechat-group";
export const TOOL_ID = /^[a-z][a-z0-9-]{0,39}$/;
export const MAX_HOLD_MS = 30 * 60 * 1000;

export const defaultCreditRules = {
  welcome: { newAccount: 3, existingMember: 3 },
  costs: { "answer-sheet": 1 },
  invite: { enabled: false, groups: false, reward: 2, monthlyLimit: 10, registerDays: 7, useDays: 7 },
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
  const merge = (key) => ({ ...previous[key], ...input[key] });
  const welcome = merge("welcome");
  const invite = merge("invite");
  const purchase = merge("purchase");
  const ads = merge("ads");
  const costs = merge("costs");
  if (Object.keys(costs).length > 30 || Object.keys(costs).some((key) => !TOOL_ID.test(key))) {
    throw creditError(400, "工具标识有误。");
  }
  if ([invite.enabled, invite.groups, purchase.directPurchase, purchase.tokenRecharge, ads.enabled].some(value => typeof value !== "boolean")) {
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
      newAccount: integer(welcome.newAccount, 0, 100, "新人赠送"),
      existingMember: integer(welcome.existingMember, 0, 100, "老卷友赠送"),
    },
    costs: Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, integer(value, 1, 100, "用量")])),
    invite: {
      enabled: groupApproved && invite.enabled, groups: groupApproved && invite.groups,
      reward: integer(invite.reward, 0, 100, "邀请奖励"),
      monthlyLimit: integer(invite.monthlyLimit, 1, 100, "每月奖励人数"),
      registerDays: integer(invite.registerDays, 1, 30, "邀请认领天数"),
      useDays: integer(invite.useDays, 1, 30, "首次有效使用天数"),
    },
    purchase: {
      directPurchase: purchase.directPurchase, tokenRecharge: purchase.tokenRecharge,
      packages,
    },
    ads: {
      enabled: ads.enabled, reward: integer(ads.reward, 1, 100, "广告奖励"),
      dailyLimit: integer(ads.dailyLimit, 1, 20, "广告每日领取上限"),
    },
  };
}
