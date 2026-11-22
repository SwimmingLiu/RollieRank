import { randomBytes } from "node:crypto";
import { creditError, DAY_MS } from "./tool-credits-rules.mjs";

export const ORDER_ID = /^RR[a-f0-9]{30}$/;
export const REFUND_REASONS = new Set(["0", "1", "2", "3", "4", "5"]);
const paymentTypes = new Set([0, 7]);
const paidStates = new Set([2, 3, 4]);
const firstCheckMs = 5 * 60 * 1000;
const providerLeaseMs = 30_000;

const run = (client, sql, ...params) => client.query(sql, params);
const all = async (client, sql, ...params) => (await run(client, sql, ...params)).rows;
const get = async (client, sql, ...params) => (await all(client, sql, ...params))[0];
const orderNumber = () => "RR" + randomBytes(15).toString("hex");
const missing = () => creditError(404, "找不到这笔购买。", "purchase-not-found");
const mismatch = () => creditError(502, "微信返回的交易与本地订单不一致。", "wechat-order-mismatch");

const orderColumns = `o.id, o.account_id AS "accountId", o.openid, o.offer_id AS "offerId",
  o.product_id AS "productId", o.tool, o.title, o.platform, o.cents, o.state, o.wx_order_id AS "wxOrderId",
  o.channel, o.delivered, o.created_at AS "createdAt", o.updated_at AS "updatedAt"`;

function orderView(order) {
  return {
    id: order.id, productId: order.productId, tool: order.tool, title: order.title,
    channel: order.channel === 7 ? "apple" : order.channel === 0 ? "wechat" : null,
    cents: order.cents, state: order.state, entitlement: order.operationState === "settled" ? "used"
      : order.state !== "paid" ? null : order.operationState === "reserved" ? "reserved" : "available",
    createdAt: order.createdAt, updatedAt: order.updatedAt,
  };
}

export function createToolPurchaseStore({ transact, read, lockAccounts, expire, rules, resolveAccountId, clock }) {
  async function find(client, id) {
    return get(client, `SELECT ${orderColumns}, (
      SELECT state FROM wallet_tool_operations WHERE payment_order_id = o.id
        AND (state = 'settled' OR (state = 'reserved' AND expires_at > $2))
    ) AS "operationState" FROM wallet_wechat_orders o WHERE o.id = $1`, id, clock());
  }

  async function getOrder(id, accountId) {
    return read(async (client) => {
      const order = await find(client, id);
      if (!order || (accountId && order.accountId !== accountId)) throw missing();
      return order;
    });
  }

  function list(accountId, { operator = false } = {}) {
    return read(async (client) => {
      const targetId = operator && accountId ? await resolveAccountId(client, accountId) : accountId;
      if (accountId && !targetId) return [];
      const orders = await all(client, `SELECT ${orderColumns}, (
        SELECT state FROM wallet_tool_operations WHERE payment_order_id = o.id
          AND (state = 'settled' OR (state = 'reserved' AND expires_at > $2))
      ) AS "operationState" FROM wallet_wechat_orders o WHERE ($1::text IS NULL OR o.account_id = $1)
        ORDER BY o.created_at DESC, o.id LIMIT 50`, targetId, clock());
      return orders.map(order => ({
        ...orderView(order),
        ...(operator ? { accountId: order.accountId, wxOrderId: order.wxOrderId } : {}),
      }));
    });
  }

  function create({ accountId, wechatKey, openid, offerId, product, platform, requestId, quotedCents }) {
    return transact(async (client) => {
      await lockAccounts(client, [accountId]);
      if (!(await rules(client)).purchase.directPurchase) throw creditError(403, "微信道具直购暂未开放。", "purchase-disabled");
      const account = await get(client, "SELECT wechat_key FROM wallet_accounts WHERE id = $1", accountId);
      if (account.wechat_key !== wechatKey) throw creditError(403, "请使用登录卷豆时的微信账号付款。", "purchase-account");

      const prior = await get(client, `SELECT ${orderColumns} FROM wallet_wechat_orders o
        WHERE o.account_id = $1 AND o.request_id = $2`, accountId, requestId);
      if (prior) {
        if (prior.productId !== product.productId || prior.cents !== quotedCents || prior.offerId !== offerId || prior.platform !== platform) {
          throw creditError(409, "购买请求已用于另一笔付款。", "purchase-conflict");
        }
        return find(client, prior.id);
      }
      if (quotedCents !== product.cents) throw creditError(409, "商品价格有更新，请重新确认。", "purchase-price");
      const id = orderNumber();
      const now = clock();
      await run(client, `INSERT INTO wallet_wechat_orders
        (id, account_id, request_id, openid, offer_id, product_id, tool, title, platform, cents, state, created_at, updated_at, next_check_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $11, $12)`,
      id, accountId, requestId, openid, offerId, product.productId, product.tool, product.title, platform, product.cents, now, now + firstCheckMs);
      return find(client, id);
    });
  }

  async function checkBoundPayment(client, order, trade) {
    if (!paymentTypes.has(trade.order_type) || trade.order_id !== order.id ||
        trade.order_fee !== order.cents || trade.paid_fee !== order.cents ||
        typeof trade.wx_order_id !== "string" || !trade.wx_order_id || trade.wx_order_id.length > 128 ||
        (order.wxOrderId && order.wxOrderId !== trade.wx_order_id) ||
        (order.channel !== null && order.channel !== trade.order_type)) throw mismatch();
    const prior = await get(client, "SELECT id FROM wallet_wechat_orders WHERE wx_order_id = $1", trade.wx_order_id);
    if (prior && prior.id !== order.id) throw mismatch();
  }

  async function revokePendingUse(client, orderId) {
    await run(client, `UPDATE wallet_tool_operations SET state = 'released'
      WHERE payment_order_id = $1 AND state = 'reserved'`, orderId);
  }

  function applyTrade(id, accountId, trade) {
    return transact(async (client) => {
      await lockAccounts(client, [accountId]);
      const order = await find(client, id);
      if (!order || order.accountId !== accountId) throw missing();
      if (!["pending", "paid"].includes(order.state)) return order;
      if (trade.order_id !== id || !paymentTypes.has(trade.order_type)) throw mismatch();
      const now = clock();

      if (paidStates.has(trade.status)) {
        await checkBoundPayment(client, order, trade);
        if (!Number.isInteger(trade.left_fee) || trade.left_fee < 0 || trade.left_fee > order.cents) throw mismatch();
        // A lower refundable balance can mean an external refund has started.
        const expectedChannel = order.platform === "ios" ? 7 : 0;
        const state = trade.left_fee < order.cents || trade.order_type !== expectedChannel ? "review" : "paid";
        if (state === "review") await revokePendingUse(client, id);
        const delivered = order.delivered || trade.status === 4;
        await run(client, `UPDATE wallet_wechat_orders
          SET state = $1, wx_order_id = $2, channel = $3, delivered = $4, updated_at = $5
          WHERE id = $6 AND (state, wx_order_id, channel, delivered) IS DISTINCT FROM ($1, $2, $3, $4)`,
        state, trade.wx_order_id, trade.order_type, delivered, now, id);
      } else if (trade.status === 6 && order.state === "pending") {
        await run(client, "UPDATE wallet_wechat_orders SET state = 'closed', updated_at = $1 WHERE id = $2", now, id);
      } else if (trade.status === 6 && order.state === "paid") {
        await checkBoundPayment(client, order, trade);
        await revokePendingUse(client, id);
        await run(client, "UPDATE wallet_wechat_orders SET state = 'review', updated_at = $1 WHERE id = $2", now, id);
      }
      return find(client, id);
    });
  }

  function claimDelivery(id) {
    return transact(async (client) => {
      const now = clock();
      const result = await run(client, `UPDATE wallet_wechat_orders SET delivery_claim_until = $1
        WHERE id = $2 AND state = 'paid' AND NOT delivered AND delivery_claim_until <= $3`, now + providerLeaseMs, id, now);
      return result.rowCount === 1;
    });
  }

  function markDelivered(id, accountId) {
    return transact(async (client) => {
      await lockAccounts(client, [accountId]);
      await run(client, `UPDATE wallet_wechat_orders SET delivered = true, delivery_claim_until = 0, updated_at = $1
        WHERE id = $2 AND state = 'paid' AND NOT delivered`, clock(), id);
    });
  }

  function activeRefund(id) {
    return read((client) => get(client, `SELECT id, reason, state FROM wallet_wechat_refunds
      WHERE order_id = $1 AND state IN ('pending', 'submitted')`, id));
  }

  function startRefund({ order, trade, reason, requestId, actor }) {
    return transact(async (client) => {
      await lockAccounts(client, [order.accountId]);
      const local = await find(client, order.id);
      if (!local) throw missing();
      const previous = await get(client, `SELECT id, state, reason FROM wallet_wechat_refunds
        WHERE order_id = $1 AND request_id = $2`, local.id, requestId);
      if (previous) {
        if (previous.reason !== reason) throw creditError(409, "该退款请求已保存其他原因。", "purchase-conflict");
        return { id: previous.id, state: previous.state };
      }
      if (local.state !== "paid" || !local.wxOrderId || local.channel !== 0) {
        throw creditError(409, "此订单当前无法从运营后台发起退款。", "purchase-refund");
      }
      if (local.operationState) throw creditError(409, "工具已使用或正在使用，请先核对订单。", "purchase-refund");
      await checkBoundPayment(client, local, trade);
      if (!paidStates.has(trade.status) || trade.left_fee !== local.cents) {
        throw creditError(409, "微信订单的可退金额已变化，请先对账。", "purchase-refund");
      }
      const now = clock();
      if (Number.isInteger(trade.paid_time) && trade.paid_time > 0 && now - trade.paid_time * 1000 > 365 * DAY_MS) {
        throw creditError(409, "订单已超过微信原路退款期限。", "purchase-refund");
      }
      await expire(client, local.accountId, now);
      const id = orderNumber();
      await run(client, `INSERT INTO wallet_wechat_refunds (id, order_id, request_id, reason, operator, state, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6, $6)`, id, local.id, requestId, reason, actor, now);
      await run(client, `UPDATE wallet_wechat_orders SET state = 'refunding', updated_at = $1, next_check_at = $2
        WHERE id = $3`, now, now + firstCheckMs, local.id);
      return { id, state: "pending" };
    });
  }

  function claimRefund(refundId) {
    return transact(async (client) => {
      const now = clock();
      return get(client, `UPDATE wallet_wechat_refunds SET submit_attempts = submit_attempts + 1, submit_claim_until = $1
        WHERE id = $2 AND state = 'pending' AND submit_claim_until <= $3 RETURNING submit_attempts AS attempt`,
      now + providerLeaseMs, refundId, now);
    });
  }

  function refundSubmitted(refundId, attempt) {
    return transact((client) => run(client, `UPDATE wallet_wechat_refunds SET state = 'submitted', updated_at = $1, submit_claim_until = 0
      WHERE id = $2 AND state = 'pending' AND submit_attempts = $3`, clock(), refundId, attempt));
  }

  function refundRejected(order, refundId, attempt, original) {
    return transact(async (client) => {
      await lockAccounts(client, [order.accountId]);
      const current = await find(client, order.id);
      if (current.state !== "refunding") return;
      await checkBoundPayment(client, current, original);
      const canRestore = attempt === 1 && paidStates.has(original.status) && original.left_fee === current.cents;
      const now = clock();
      const changed = await run(client, `UPDATE wallet_wechat_refunds SET state = 'failed', updated_at = $1, submit_claim_until = 0
        WHERE id = $2 AND order_id = $3 AND state = 'pending' AND submit_attempts = $4`, now, refundId, current.id, attempt);
      if (changed.rowCount) {
        await run(client, "UPDATE wallet_wechat_orders SET state = $1, updated_at = $2 WHERE id = $3",
          canRestore ? "paid" : "review", now, current.id);
      }
    });
  }

  function applyRefund(order, refund, trade, original) {
    return transact(async (client) => {
      await lockAccounts(client, [order.accountId]);
      const current = await find(client, order.id);
      if (current.state !== "refunding") return current;
      if (trade.order_id !== refund.id || trade.order_type !== 1) throw mismatch();
      if (![7, 8].includes(trade.status)) return current;
      const now = clock();
      const succeeded = trade.status === 8;
      if (succeeded && trade.refund_fee !== current.cents) throw mismatch();
      let state = "refunded";
      if (!succeeded) {
        await checkBoundPayment(client, current, original);
        state = paidStates.has(original.status) && original.left_fee === current.cents ? "paid" : "review";
      }
      const changed = await run(client, `UPDATE wallet_wechat_refunds SET state = $1, updated_at = $2
        WHERE id = $3 AND order_id = $4 AND state IN ('pending', 'submitted')`,
      succeeded ? "succeeded" : "failed", now, refund.id, current.id);
      if (changed.rowCount) await run(client, "UPDATE wallet_wechat_orders SET state = $1, updated_at = $2 WHERE id = $3", state, now, current.id);
      return find(client, current.id);
    });
  }

  function due(offerId) {
    return transact(async (client) => {
      const now = clock();
      const candidates = await all(client, `SELECT ${orderColumns} FROM wallet_wechat_orders o
        WHERE o.offer_id = $1 AND o.state IN ('pending', 'paid', 'refunding') AND o.next_check_at <= $2
        ORDER BY o.next_check_at LIMIT 20 FOR UPDATE SKIP LOCKED`, offerId, now);
      for (const order of candidates) {
        const wait = order.delivered && order.state === "paid" || order.state === "pending" && order.createdAt < now - DAY_MS
          ? DAY_MS : firstCheckMs;
        await run(client, "UPDATE wallet_wechat_orders SET next_check_at = $1 WHERE id = $2", now + wait, order.id);
      }
      return candidates;
    });
  }

  async function assertUsable(client, accountId, tool, id, { held = false } = {}) {
    const order = await find(client, id);
    if (!order || order.accountId !== accountId || order.tool !== tool) throw missing();
    if (order.state !== "paid" || (held ? order.operationState !== "reserved" : order.operationState)) {
      throw creditError(409, "这笔购买当前无法用于此工具。", "purchase-unavailable");
    }
  }

  return {
    create, getOrder, list, view: orderView, applyTrade, claimDelivery, markDelivered,
    activeRefund, startRefund, claimRefund, refundSubmitted, refundRejected, applyRefund, due, assertUsable,
  };
}
