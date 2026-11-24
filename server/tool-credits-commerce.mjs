import { ORDER_ID, REFUND_REASONS } from "./tool-credits-orders.mjs";
import { creditError, validAccountRef, validId } from "./tool-credits-rules.mjs";

const WECHAT_CODE = /^[\w-]{1,256}$/;
const reconcilableStates = new Set(["pending", "paid", "refunding"]);
// WeChat explicitly rejected the request. A timeout or an in-progress code is not a rejection.
const rejectedRefundCodes = new Set([268490001, 268490002, 268490003, 268490013, 268490021]);
const intervalMs = 60_000;

export function paymentPush(raw) {
  const source = raw.trim();
  if (source.startsWith("{")) {
    try { return JSON.parse(source); } catch { return null; }
  }
  if (!source.startsWith("<xml>")) return null;
  const fields = {};
  for (const key of ["Event", "OpenId", "OutTradeNo", "MchOrderId", "Env", "RetCode"]) {
    const value = new RegExp("<" + key + ">(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</" + key + ">").exec(source);
    if (value) fields[key] = (value[1] ?? value[2]).trim();
  }
  return fields;
}

export function acknowledgePaymentPush(raw, response) {
  const json = raw.trimStart().startsWith("{");
  response.writeHead(200, {
    "Content-Type": json ? "application/json; charset=utf-8" : "application/xml; charset=utf-8", "Cache-Control": "no-store",
  });
  response.end(json ? '{"ErrCode":0,"ErrMsg":"success"}' : "<xml><ErrCode>0</ErrCode><ErrMsg>success</ErrMsg></xml>");
}

export function createToolCreditsCommerce({ payment, store, requireAccount, getWechatSession, accountKey, background = true }) {
  const orders = store.purchases;
  let running = false;
  if (payment && background) {
    const timer = setInterval(() => { void poll(); }, intervalMs);
    timer.unref();
  }

  function requirePayment() {
    if (!payment) throw creditError(403, "微信道具直购暂未开放。", "purchase-disabled");
  }

  function ensureOffer(order) {
    requirePayment();
    if (payment.offerId !== order.offerId) {
      throw creditError(503, "该订单的微信支付配置暂不可用。", "purchase-offer");
    }
  }

  async function tryRefund(order, refund) {
    const claim = await orders.claimRefund(refund.id);
    if (!claim) return;
    try {
      await payment.refund(order, refund);
      await orders.refundSubmitted(refund.id, claim.attempt);
    } catch (error) {
      if (!rejectedRefundCodes.has(error.wechatCode)) throw error;
      const original = await payment.query(order);
      await orders.refundRejected(order, refund.id, claim.attempt, original);
    }
  }

  async function refresh(order) {
    if (!reconcilableStates.has(order.state)) return order;
    ensureOffer(order);
    if (order.state === "refunding") {
      const refund = await orders.activeRefund(order.id);
      if (!refund) return orders.getOrder(order.id);
      let trade;
      try {
        trade = await payment.query(order, refund.id);
      } catch (error) {
        if (refund.state !== "pending") throw error;
        // A lost response can leave an unsubmitted local record. Reuse the same refund number.
        await tryRefund(order, refund);
        return orders.getOrder(order.id);
      }
      const original = trade.status === 7 ? await payment.query(order) : null;
      return orders.applyRefund(order, refund, trade, original);
    }

    const trade = await payment.query(order);
    const confirmed = await orders.applyTrade(order.id, order.accountId, trade);
    if (confirmed.state === "paid" && !confirmed.delivered && await orders.claimDelivery(order.id)) {
      // The account already owns its entitlement. Keep retrying the separate provider acknowledgement.
      try {
        await payment.acknowledge(order);
        await orders.markDelivered(order.id, order.accountId);
      } catch { /* The next reconciliation retries the acknowledgement. */ }
    }
    return confirmed;
  }

  async function poll() {
    if (running) return;
    running = true;
    try {
      for (const order of await orders.due(payment.offerId)) {
        try { await refresh(order); } catch { /* Retain the order for its next check. */ }
      }
    } catch {
      // A provider outage or an unapplied migration must not affect unrelated wallet requests.
      console.warn("卷豆道具订单暂时无法补查。");
    } finally {
      running = false;
    }
  }

  async function handle({ route, method, input, request, send }) {
    if (route === "/purchases" && method === "GET") {
      const { id } = await requireAccount(request);
      send(200, { orders: await orders.list(id) });
      return true;
    }
    if (route === "/purchases" && method === "POST") {
      const { id } = await requireAccount(request);
      requirePayment();
      if (!(await store.purchaseSettings()).directPurchase) throw creditError(403, "微信道具直购暂未开放。", "purchase-disabled");
      const product = payment.products.find(item => item.productId === input.productId);
      if (!product) throw creditError(404, "找不到该微信道具。", "purchase-product");
      if (!validId(input.requestId) || !Number.isInteger(input.quotedCents) ||
          typeof input.code !== "string" || !WECHAT_CODE.test(input.code) ||
          !["android", "ios"].includes(input.platform)) {
        throw creditError(400, "请重新确认商品并登录微信。");
      }
      if (input.platform === "ios" && !product.ios) throw creditError(403, "该道具暂未开放 iOS 支付。", "purchase-platform");
      const { openid, sessionKey } = await getWechatSession(input.code);
      if (typeof sessionKey !== "string" || !sessionKey) {
        throw creditError(401, "微信付款会话已失效，请重试。", "purchase-session");
      }
      const order = await orders.create({
        accountId: id, wechatKey: accountKey(openid), openid, offerId: payment.offerId,
        product, platform: input.platform, requestId: input.requestId, quotedCents: input.quotedCents,
      });
      const payData = order.state === "pending" ? payment.checkout(order, sessionKey) : null;
      send(200, { order: orders.view(order), payData });
      return true;
    }

    const match = /^\/purchases\/(RR[a-f0-9]{30})(\/confirm)?$/.exec(route);
    if (match && method === (match[2] ? "POST" : "GET")) {
      const { id } = await requireAccount(request);
      const order = await orders.getOrder(match[1], id);
      send(200, { order: orders.view(match[2] ? await refresh(order) : order) });
      return true;
    }
    return false;
  }

  async function handleAdmin({ sub, method, input, query, send, session }) {
    if (sub === "tool-credits/purchases" && method === "GET") {
      const accountId = query.get("accountId");
      if (accountId && !validAccountRef(accountId)) throw creditError(400, "账号编号有误。");
      send(200, { orders: await orders.list(accountId || null, { operator: true }) });
      return true;
    }
    const match = /^tool-credits\/purchases\/(RR[a-f0-9]{30})\/(confirm|refund)$/.exec(sub);
    if (!match || method !== "POST") return false;
    const order = await orders.getOrder(match[1]);
    if (match[2] === "confirm") {
      send(200, { order: orders.view(await refresh(order)) });
      return true;
    }
    if (!validId(input.requestId) || !REFUND_REASONS.has(input.reason)) {
      throw creditError(400, "请填写退款请求编号和微信退款原因。");
    }
    ensureOffer(order);
    // The store checks the request ID and the entitlement again under the account lock.
    const trade = await payment.query(order);
    const refund = await orders.startRefund({ order, trade, reason: input.reason, requestId: input.requestId, actor: session.username });
    if (refund.state === "pending") {
      try {
        await tryRefund(order, { ...refund, reason: input.reason });
      } catch { /* A failed or lost response leaves the original request ready to be reconciled. */ }
    }
    send(200, { order: orders.view(await orders.getOrder(order.id)), refundId: refund.id });
    return true;
  }

  async function handleWechatPush(message, raw, response) {
    const deliver = message?.Event === "xpay_goods_deliver_notify";
    const refund = message?.Event === "xpay_refund_notify";
    if (!deliver && !refund) return false;
    requirePayment();
    const orderId = deliver ? message.OutTradeNo : message.MchOrderId;
    if (typeof orderId !== "string" || !ORDER_ID.test(orderId) || typeof message.OpenId !== "string") {
      throw creditError(400, "微信道具通知缺少订单信息。");
    }
    const order = await orders.getOrder(orderId);
    if (message.OpenId !== order.openid) throw creditError(403, "微信道具通知的账号不匹配。");
    // Plaintext message signatures authenticate the sender. All financial changes still use signed server queries.
    const confirmed = await refresh(order);
    if (deliver && confirmed.state === "pending") throw creditError(502, "微信尚未确认付款，请重试。");
    acknowledgePaymentPush(raw, response);
    return true;
  }

  return { handle, handleAdmin, handleWechatPush };
}
