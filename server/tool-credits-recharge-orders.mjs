import { randomBytes } from "node:crypto";
import { creditError, DAY_MS } from "./tool-credits-rules.mjs";

const rechargeId = /^RC[a-f0-9]{30}$/;
const checkInterval = 5 * 60_000;
const initialCheckDelay = 60_000;
const paymentStates = new Set([2, 3, 4, 7]);
const columns = `o.id, o.account_id AS "accountId", o.app_id AS "appId", o.openid, o.offer_id AS "offerId",
  o.env, o.platform, o.credits, o.cents, o.state, o.wx_order_id AS "wechatOrderId", o.debit_signature AS "debitSignature",
  o.lot_id AS "lotId", o.issue, o.trade_updated_at AS "tradeUpdatedAt", o.created_at AS "createdAt", o.updated_at AS "updatedAt"`;
const run = (client, sql, ...args) => client.query(sql, args);
const all = async (...args) => (await run(...args)).rows;
const get = async (...args) => (await all(...args))[0];
const mismatch = () => creditError(502, "微信充值交易与本地订单不一致。", "recharge-order-mismatch");

export { rechargeId };

export function rechargeView(order, operator = false) {
  const { id, credits, cents, platform, state, createdAt, updatedAt } = order;
  return {
    id, credits, cents, platform, state, createdAt, updatedAt,
    needsWechatCode: ["pending", "paid"].includes(state) && !order.debitSignature,
    ...(operator ? { accountId: order.accountId, wechatOrderId: order.wechatOrderId, env: order.env, issue: order.issue } : {}),
  };
}

function cashState(order, trade) {
  const { status, env_type: env } = trade;
  if (trade.order_id !== order.id || (trade.openid && trade.openid !== order.openid) ||
      (env && env !== order.env + 1)) throw mismatch();
  if (status === 0 || status === 1) return "pending";
  if (status === 6) return "closed";
  const channel = order.platform === "ios" ? 7 : 0;
  if (env !== order.env + 1 || trade.order_type !== channel || trade.order_fee !== order.cents ||
      trade.paid_fee !== order.cents || !Number.isSafeInteger(trade.left_fee) ||
      trade.left_fee < 0 || trade.left_fee > order.cents || typeof trade.wx_order_id !== "string" ||
      !trade.wx_order_id.trim() || trade.wx_order_id.length > 128 ||
      (order.wechatOrderId && order.wechatOrderId !== trade.wx_order_id)) throw mismatch();
  if (status === 8 && trade.left_fee === 0) return "refunded";
  if (status === 8) return "review";
  if (status === 5 || trade.left_fee !== order.cents) return "refund_pending";
  if (paymentStates.has(status)) return "paid";
  throw mismatch();
}

export function createCoinRechargeStore({ transact, read, lockAccounts, rules, resolveAccountId, grant, record, clock }) {
  async function find(client, id, accountId = null) {
    const row = await get(client, `SELECT ${columns} FROM wallet_coin_recharges o
      WHERE o.id = $1 AND ($2::text IS NULL OR o.account_id = $2)`, id, accountId);
    if (!row) throw creditError(404, "找不到这笔卷豆充值。", "recharge-not-found");
    return row;
  }

  function create({ accountId, wechatKey, openid, appId, offerId, env, platform, requestId, credits, cents, signDebit }) {
    return transact(async client => {
      await lockAccounts(client, [accountId]);
      const owner = await get(client, "SELECT wechat_key FROM wallet_accounts WHERE id = $1", accountId);
      if (owner.wechat_key !== wechatKey) throw creditError(403, "请用当前卷豆账号付款。", "recharge-account");
      const purchase = (await rules(client)).purchase;
      if (!purchase.tokenRecharge) throw creditError(403, "卷豆充值暂未开放。", "recharge-disabled");
      const prior = await get(client, `SELECT ${columns} FROM wallet_coin_recharges o
        WHERE o.account_id = $1 AND o.request_id = $2`, accountId, requestId);
      if (prior) {
        if (prior.appId !== appId || prior.offerId !== offerId || prior.env !== env || prior.openid !== openid ||
            prior.platform !== platform || prior.credits !== credits || prior.cents !== cents) {
          throw creditError(409, "这笔充值的账号或档位已有记录。", "recharge-conflict");
        }
        return ["paid", "pending"].includes(prior.state) ? authorize(client, prior, signDebit(prior)) : prior;
      }
      const pack = purchase.packages.find(item => item.credits === credits);
      if (!pack || pack.cents !== cents || cents !== credits * 100) {
        throw creditError(409, "充值档位有更新，请重新确认。", "recharge-quote");
      }
      const id = "RC" + randomBytes(15).toString("hex");
      const now = clock();
      const signature = signDebit({ id, openid, credits });
      return get(client, `INSERT INTO wallet_coin_recharges AS o
        (id, account_id, request_id, app_id, openid, offer_id, env, platform, credits, cents, debit_signature,
          created_at, updated_at, next_check_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13) RETURNING ${columns}`,
      id, accountId, requestId, appId, openid, offerId, env, platform, credits, cents, signature, now, now + initialCheckDelay);
    });
  }

  async function authorize(client, order, signature) {
    return (await get(client, `UPDATE wallet_coin_recharges o SET debit_signature = $2
      WHERE id = $1 AND state IN ('paid', 'pending') RETURNING ${columns}`, order.id, signature)) ?? find(client, order.id);
  }

  function invalidateSignature(order) {
    return transact(client => run(client, `UPDATE wallet_coin_recharges SET debit_signature = NULL
      WHERE id = $1 AND debit_signature = $2`, order.id, order.debitSignature));
  }

  async function freezeLot(client, lotId) {
    if (lotId === null) return;
    await run(client, "UPDATE wallet_credit_lots SET frozen = true WHERE id = $1", lotId);
    // A reserved tool result cannot later consume credits withdrawn by a confirmed refund.
    await run(client, `WITH released AS (
      UPDATE wallet_tool_operations o SET state = 'released' WHERE o.state = 'reserved' AND EXISTS (
        SELECT 1 FROM wallet_tool_holds h WHERE h.operation_id = o.id AND h.lot_id = $1) RETURNING id
    ) DELETE FROM wallet_tool_holds h USING released r WHERE h.operation_id = r.id`, lotId);
  }

  async function applyTrade(order, trade, { debited = false } = {}) {
    return transact(async client => {
      await lockAccounts(client, [order.accountId]);
      order = await find(client, order.id, order.accountId);
      if (["closed", "refunded"].includes(order.state) || order.issue === "refund-shortfall") return order;
      const observed = cashState(order, trade);
      const tradeUpdatedAt = Number.isSafeInteger(trade.update_time) && trade.update_time > 0 ? trade.update_time : 0;
      if (observed === "pending" || (tradeUpdatedAt && tradeUpdatedAt < order.tradeUpdatedAt)) return order;

      let { lotId } = order;
      let state = observed;
      let issue = null;
      if (observed === "paid") {
        // A paid snapshot from before the refund must not thaw a lot while refund processing is underway.
        const sameSecondFailure = trade.status === 7 && tradeUpdatedAt && tradeUpdatedAt === order.tradeUpdatedAt;
        if (order.state === "review" || (order.state === "refund_pending" &&
            (!order.tradeUpdatedAt || (tradeUpdatedAt <= order.tradeUpdatedAt && !sameSecondFailure)))) return order;
        if (lotId === null && debited) {
          lotId = await grant(client, { id: order.accountId, amount: order.credits,
            source: "purchase", ref: order.id, reason: "微信充值" });
        }
        if (lotId !== null) {
          state = "credited";
          if (order.state === "refund_pending") await run(client, "UPDATE wallet_credit_lots SET frozen = false WHERE id = $1", lotId);
        }
      } else if (observed === "refund_pending" || observed === "review") {
        await freezeLot(client, lotId);
        if (observed === "review" || (trade.left_fee > 0 && trade.left_fee < order.cents)) issue = "partial-refund";
      } else if (observed === "refunded" && lotId !== null) {
        await freezeLot(client, lotId);
        const { remaining } = await get(client, "SELECT remaining FROM wallet_credit_lots WHERE id = $1", lotId);
        if (remaining) {
          await record(client, { id: order.accountId, amount: -remaining, source: "refund", ref: order.id, reason: "微信充值退款" });
          await run(client, "UPDATE wallet_credit_lots SET remaining = 0 WHERE id = $1", lotId);
        }
        if (remaining < order.credits) {
          state = "review";
          issue = "refund-shortfall";
        }
      } else if (observed === "closed" && order.wechatOrderId) {
        await freezeLot(client, lotId);
        state = "review";
        issue = "paid-order-closed";
      }
      try {
        const wechatOrderId = observed === "closed" ? order.wechatOrderId : trade.wx_order_id;
        return await get(client, `UPDATE wallet_coin_recharges o SET state = $2, wx_order_id = $3,
          lot_id = $4, issue = $5, trade_updated_at = GREATEST(trade_updated_at, $6), updated_at = $7,
          next_check_at = CASE WHEN $2 = 'credited' AND o.state <> 'credited' THEN $7::bigint + $8::bigint ELSE next_check_at END,
          debit_signature = CASE WHEN $2 IN ('pending', 'paid', 'refund_pending') THEN debit_signature END
          WHERE id = $1 RETURNING ${columns}`, order.id, state, wechatOrderId, lotId, issue, tradeUpdatedAt, clock(), DAY_MS);
      } catch (error) {
        if (error.constraint === "wallet_coin_recharges_wx_order") throw mismatch();
        throw error;
      }
    });
  }

  function list(accountRef = null, operator = false) {
    return read(async client => {
      const accountId = operator && accountRef ? await resolveAccountId(client, accountRef) : accountRef;
      if (accountRef && !accountId) return [];
      const rows = await all(client, `SELECT ${columns} FROM wallet_coin_recharges o
        WHERE ($1::text IS NULL OR o.account_id = $1) ORDER BY o.created_at DESC, o.id DESC LIMIT 50`, accountId);
      return rows.map(row => rechargeView(row, operator));
    });
  }

  function due({ appId, offerId, env }) {
    const now = clock();
    // Recheck completed payments during the provider's refund window in case a refund push is lost.
    return transact(client => all(client, `WITH batch AS (
      SELECT id FROM wallet_coin_recharges WHERE app_id = $1 AND offer_id = $2 AND env = $3 AND next_check_at <= $4
      AND ((state = 'pending' AND created_at >= $5) OR (state = 'paid' AND debit_signature IS NOT NULL)
        OR (state = 'credited' AND created_at >= $6) OR state = 'refund_pending')
      ORDER BY next_check_at LIMIT 12 FOR UPDATE SKIP LOCKED
    ) UPDATE wallet_coin_recharges o SET next_check_at = CASE WHEN o.state = 'credited' THEN $7::bigint ELSE $8::bigint END
      FROM batch WHERE o.id = batch.id RETURNING ${columns}`,
    appId, offerId, env, now, now - 7 * DAY_MS, now - 366 * DAY_MS, now + DAY_MS, now + checkInterval));
  }

  return {
    create, applyTrade, list, due, invalidateSignature,
    find: (id, accountId) => read(client => find(client, id, accountId)),
    authorize: (order, signature) => transact(client => authorize(client, order, signature)),
  };
}
