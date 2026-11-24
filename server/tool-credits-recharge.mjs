import { acknowledgePaymentPush } from "./tool-credits-commerce.mjs";
import { rechargeId, rechargeView } from "./tool-credits-recharge-orders.mjs";
import { creditError, validAccountRef, validId } from "./tool-credits-rules.mjs";

const WECHAT_CODE = /^[\w-]{1,256}$/;
const debitId = /^RD[a-f0-9]{30}$/;
const rechargeRoute = /^(RC[a-f0-9]{30})(\/confirm)?$/;
const missingWechatOrder = 268490002;
const staleWechatSession = 268490009;

export function createToolCreditsRecharge({ payment, orders, requireAccount, getWechatSession, accountKey }) {
  let polling = false;
  if (payment) setInterval(() => { void poll(); }, 60_000).unref();

  function ensurePayment(order) {
    if (!order && !payment) throw creditError(403, "卷豆充值暂未开放。", "recharge-disabled");
    if (order && (!payment || payment.appId !== order.appId || payment.offerId !== order.offerId || payment.env !== order.env)) {
      throw creditError(503, "这笔充值的微信支付配置暂不可用。", "recharge-environment");
    }
  }

  async function sessionFor(code) {
    if (typeof code !== "string" || !WECHAT_CODE.test(code)) throw creditError(400, "请重新登录微信后确认充值。");
    const session = await getWechatSession(code);
    if (typeof session.sessionKey !== "string" || !session.sessionKey) {
      throw creditError(401, "微信付款会话已失效，请重试。", "recharge-session");
    }
    return session;
  }

  async function refresh(order) {
    if (["closed", "refunded"].includes(order.state)) return order;
    ensurePayment(order);
    let trade;
    try {
      trade = await payment.query(order);
    } catch (error) {
      // Cancelled checkouts may have never created a WeChat order. Keep the original ID for later recovery.
      if (order.state === "pending" && error.wechatCode === missingWechatOrder) return order;
      throw error;
    }
    order = await orders.applyTrade(order, trade);
    if (order.state !== "paid" || !order.debitSignature) return order;
    try {
      // The immutable debit order ID also recovers a successful debit whose response was lost.
      await payment.debit(order);
    } catch (error) {
      if (error.wechatCode !== staleWechatSession) throw error;
      await orders.invalidateSignature(order);
      return orders.find(order.id, order.accountId);
    }
    return orders.applyTrade(order, await payment.query(order), { debited: true });
  }

  async function poll() {
    if (polling) return;
    polling = true;
    try {
      for (const order of await orders.due(payment)) {
        try { await refresh(order); } catch { /* The query remains scheduled after a transport or provider error. */ }
      }
    } catch {
      console.warn("卷豆充值订单暂时无法补查。");
    } finally {
      polling = false;
    }
  }

  async function handle({ route, method, input, request, send }) {
    if (route === "/recharges" && method === "GET") {
      const { id } = await requireAccount(request);
      send(200, { orders: await orders.list(id) });
      return true;
    }
    if (route === "/recharges" && method === "POST") {
      const { id } = await requireAccount(request);
      ensurePayment();
      const { credits, quotedCents, requestId, platform, code } = input;
      if (!validId(requestId) || !Number.isInteger(credits) || credits < 1 || credits > 10000 ||
          !Number.isInteger(quotedCents) || !["android", "ios"].includes(platform)) {
        throw creditError(400, "请重新选择充值档位。");
      }
      if (platform === "ios" && !payment.ios) throw creditError(403, "当前环境暂未开放 iOS 充值。", "recharge-platform");
      const { openid, sessionKey } = await sessionFor(code);
      const order = await orders.create({
        accountId: id, wechatKey: accountKey(openid), openid,
        appId: payment.appId, offerId: payment.offerId, env: payment.env,
        platform, requestId, credits, cents: quotedCents,
        signDebit: (pending) => payment.signDebit(pending, sessionKey),
      });
      send(200, { order: rechargeView(order), payData: order.state === "pending" ? payment.checkout(order, sessionKey) : null });
      return true;
    }

    if (!route.startsWith("/recharges/")) return false;
    const match = rechargeRoute.exec(route.slice("/recharges/".length));
    if (!match || method !== (match[2] ? "POST" : "GET")) return false;
    const { id } = await requireAccount(request);
    let order = await orders.find(match[1], id);
    if (method === "POST" && ["pending", "paid", "refund_pending"].includes(order.state)) {
      if (input.code !== undefined && ["pending", "paid"].includes(order.state)) {
        ensurePayment(order);
        const { openid, sessionKey } = await sessionFor(input.code);
        if (openid !== order.openid) throw creditError(403, "请用付款的微信账号确认充值。", "recharge-account");
        order = await orders.authorize(order, payment.signDebit(order, sessionKey));
      }
      order = await refresh(order);
    }
    send(200, { order: rechargeView(order) });
    return true;
  }

  async function handleAdmin({ sub, method, query, send }) {
    if (sub === "tool-credits/recharges" && method === "GET") {
      const accountId = query.get("accountId");
      if (accountId && !validAccountRef(accountId)) throw creditError(400, "账号编号有误。");
      send(200, { orders: await orders.list(accountId || null, true) });
      return true;
    }
    if (method !== "POST" || !sub.startsWith("tool-credits/recharges/")) return false;
    const match = rechargeRoute.exec(sub.slice("tool-credits/recharges/".length));
    if (!match?.[2]) return false;
    send(200, { order: rechargeView(await refresh(await orders.find(match[1])), true) });
    return true;
  }

  async function handleWechatPush(message, raw, response) {
    const coin = message?.Event === "xpay_coin_pay_notify";
    const refund = message?.Event === "xpay_refund_notify";
    if (!coin && !refund) return false;
    let id = coin ? message.OutTradeNo : message.MchOrderId;
    if (typeof id !== "string") return false;
    const debit = coin && debitId.test(id);
    if (debit) id = "RC" + id.slice(2);
    if (!rechargeId.test(id)) return false;
    const order = await orders.find(id);
    const validEnvironment = message.Env === order.env || message.Env === String(order.env);
    if (order.openid !== message.OpenId || ((coin || message.Env != null) && !validEnvironment)) {
      throw creditError(403, "微信充值通知的账号或环境不匹配。", "recharge-notification");
    }
    // Notifications are wake-ups. The signed cash query and idempotent debit determine the ledger update.
    const checked = debit ? order : await refresh(order);
    if (checked.state === "pending" || (refund && [0, "0"].includes(message.RetCode) && checked.state === "credited")) {
      throw creditError(502, "微信暂未确认这笔交易，请重试。", "recharge-pending");
    }
    acknowledgePaymentPush(raw, response);
    return true;
  }

  return { handle, handleAdmin, handleWechatPush };
}
