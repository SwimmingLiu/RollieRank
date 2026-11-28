import { createHash, randomBytes, randomUUID } from "node:crypto";
import { postgresTransactionLock } from "./tool-credits-postgres.mjs";
import { createToolPurchaseStore, ORDER_ID } from "./tool-credits-orders.mjs";
import { createCoinRechargeStore } from "./tool-credits-recharge-orders.mjs";
import {
  CREDIT_SCALE, creditError, DAY_MS, defaultCreditRules, fromCreditUnits, INVITE_CHANNEL, MAX_HOLD_MS,
  REFERRAL_CHANNEL, toCreditUnits, TOOL_ID, updateCreditRules, usageDay, validId, validUid,
} from "./tool-credits-rules.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const sessionToken = /^[a-f0-9]{64}$/;
const inviteCode = /^[a-zA-Z0-9_-]{16}$/;
const shareCode = /^[a-zA-Z0-9]{5,16}$/;
const SHARE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const claimToken = /^[a-f0-9]{48}$/;
const operationRef = /^[\w:.-]{1,180}$/;
const SESSION_MS = 30 * DAY_MS;

function generateShareCode(length = 8) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += SHARE_ALPHABET[bytes[i] % SHARE_ALPHABET.length];
  return out;
}

function monthStartMs(now) {
  return Date.parse(`${usageDay(now).slice(0, 7)}-01T00:00:00+08:00`);
}

function normalizeRules(raw) {
  const base = structuredClone(defaultCreditRules);
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    welcome: { ...base.welcome, ...(raw.welcome || {}) },
    costs: raw.costs && typeof raw.costs === "object" ? { ...raw.costs } : base.costs,
    invite: { ...base.invite, ...(raw.invite || {}) },
    referral: { ...base.referral, ...(raw.referral || {}) },
    purchase: { ...base.purchase, ...(raw.purchase || {}) },
    ads: { ...base.ads, ...(raw.ads || {}) },
  };
}

const all = async (client, sql, ...params) => (await client.query(sql, params)).rows;
const get = async (client, sql, ...params) => (await all(client, sql, ...params))[0];
const run = (client, sql, ...params) => client.query(sql, params);

export function createToolCreditStore({ database, groupApproved, directPurchaseReady = false, tokenRechargeReady = false, clock = Date.now }) {
  let uidColumnState = { checkedAt: 0, present: false };
  let frozenColumnPresent = false;
  let creditScale = 1;

  async function hasColumn(client, table, column) {
    const row = await get(client, `SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`, table, column);
    return Boolean(row?.ok);
  }

  async function hasAccountUid(client) {
    if (uidColumnState.present) return true;
    const now = Date.now();
    if (uidColumnState.checkedAt && now - uidColumnState.checkedAt < 15_000) return false;
    uidColumnState = { checkedAt: now, present: await hasColumn(client, "wallet_accounts", "uid") };
    return uidColumnState.present;
  }

  async function hasFrozenLots(client) {
    // Keep pre-migration wallets usable and pick up the refund column as soon as the migration commits.
    frozenColumnPresent ||= await hasColumn(client, "wallet_credit_lots", "frozen");
    return frozenColumnPresent;
  }

  async function scaleFor(client) {
    if (creditScale === CREDIT_SCALE) return creditScale;
    if (await hasColumn(client, "wallet_rules", "credit_scale")) creditScale = CREDIT_SCALE;
    return creditScale;
  }

  function toUnits(value, scale) {
    const units = toCreditUnits(value, scale);
    if (units === null) {
      if (scale === 1 && toCreditUnits(value, CREDIT_SCALE) !== null) {
        throw creditError(503, "请先完成卷豆数据库迁移。", "wallet-migration-required");
      }
      throw creditError(400, "卷豆数值无效。");
    }
    return units;
  }

  function publicOperation(operation) {
    if (!operation) return operation;
    const { costUnits, ...rest } = operation;
    return rest;
  }

  async function transact(operation, options) {
    if (!database) throw creditError(503, "卷豆 PostgreSQL 尚未配置。", "wallet-unavailable");
    try {
      return await database.transaction(operation, options);
    } catch (error) {
      if (error.statusCode) throw error;
      console.error("卷豆数据库异常:", error?.code || error?.message || "unknown");
      throw Object.assign(creditError(503, "卷豆服务暂不可用，请稍后重试。", "wallet-unavailable"), { cause: error });
    }
  }
  const read = (operation) => transact(operation, { readOnly: true });
  const lock = (client, key) => postgresTransactionLock(client, `rollierank:wallet:${database.schema}:${key}`);

  async function lockAccounts(client, ids) {
    // 同一账号的余额写入串行化。邀请同时涉及两人时按相同顺序锁定。
    const rows = await all(client, "SELECT id FROM wallet_accounts WHERE id = ANY($1::text[]) ORDER BY id FOR NO KEY UPDATE", ids);
    if (rows.length !== new Set(ids).size) throw creditError(404, "找不到该微信账号。");
  }

  async function rules(client) {
    const row = await get(client, "SELECT value FROM wallet_rules WHERE id = 1");
    return normalizeRules(row?.value);
  }

  async function account(token) {
    if (typeof token !== "string" || !sessionToken.test(token)) return null;
    return read(async (client) => (await get(client, `SELECT account_id AS id, guest_id AS "guestId"
      FROM wallet_sessions WHERE token_hash = $1 AND expires_at > $2`, hash(token), clock())) ?? null);
  }

  async function balances(client, ids, now = clock()) {
    // Refund processing freezes the original purchase lot alongside normal tool holds.
    const scale = await scaleFor(client);
    const frozen = await hasFrozenLots(client) ?
      "COALESCE((SELECT SUM(remaining) FROM wallet_credit_lots WHERE account_id = a.id AND frozen), 0) +" : "";
    const rows = await all(client, `SELECT a.id,
      COALESCE((SELECT SUM(remaining) FROM wallet_credit_lots WHERE account_id = a.id), 0) AS total,
      ${frozen}
      COALESCE((SELECT SUM(h.amount) FROM wallet_tool_holds h JOIN wallet_tool_operations o ON o.id = h.operation_id
        WHERE o.account_id = a.id AND o.state = 'reserved' AND o.expires_at > $2), 0) AS held
      FROM wallet_accounts a WHERE a.id = ANY($1::text[])`, ids, now);
    return new Map(rows.map(({ id, total, held }) => [id, {
      balance: fromCreditUnits(total - held, scale),
      held: fromCreditUnits(held, scale),
    }]));
  }

  async function balance(client, id) {
    return (await balances(client, [id])).get(id);
  }

  async function record(client, { id, amountUnits, source, ref, reason, tool = null, actor = null, createdAt = clock() }) {
    const row = await get(client, `INSERT INTO wallet_ledger
      (account_id, source, amount, balance_after, reference, reason, tool, operator, created_at)
      VALUES ($1, $2, $3::integer, CASE WHEN $1::text IS NOT NULL THEN
        COALESCE((SELECT SUM(remaining) FROM wallet_credit_lots WHERE account_id = $1), 0) + $3::integer END, $4, $5, $6, $7, $8)
      RETURNING id`, id, source, amountUnits, ref, reason, tool, actor, createdAt);
    return row.id;
  }

  async function grant(client, entry) {
    const ledgerId = await record(client, entry);
    if (entry.amountUnits > 0) {
      await run(client, "INSERT INTO wallet_credit_lots (id, account_id, remaining) VALUES ($1, $2, $3)", ledgerId, entry.id, entry.amountUnits);
    }
    return ledgerId;
  }

  async function allocate(client, accountId, amountUnits) {
    const spendable = await hasFrozenLots(client) ? "AND NOT l.frozen" : "";
    const lots = await all(client, `SELECT l.id, l.remaining -
      COALESCE((SELECT SUM(h.amount) FROM wallet_tool_holds h WHERE h.lot_id = l.id), 0) AS available
      FROM wallet_credit_lots l JOIN wallet_ledger e ON e.id = l.id WHERE l.account_id = $1 AND l.remaining > 0 ${spendable}
      ORDER BY (e.source = 'purchase'), l.id`, accountId);
    const allocations = [];
    for (const lot of lots) {
      if (!lot.available) continue;
      const take = Math.min(lot.available, amountUnits);
      allocations.push({ lotId: lot.id, amount: take });
      amountUnits -= take;
      if (!amountUnits) return allocations;
    }
    throw creditError(402, "可用卷豆不足。", "balance");
  }

  function expire(client, id, now) {
    return run(client, `WITH expired AS (
      UPDATE wallet_tool_operations SET state = 'expired'
      WHERE account_id = $1 AND state = 'reserved' AND expires_at <= $2 RETURNING id
    ) DELETE FROM wallet_tool_holds h USING expired e WHERE h.operation_id = e.id`, id, now);
  }

  function inviteEnabled(config) {
    return Boolean(groupApproved && config.invite.enabled && config.invite.groups);
  }

  function referralEnabled(config) {
    return Boolean(config.referral?.enabled && Number(config.referral?.reward) > 0);
  }

  async function ensureShareCode(client, accountId) {
    const prior = await get(client, "SELECT code FROM wallet_invite_codes WHERE account_id = $1 AND channel = $2", accountId, REFERRAL_CHANNEL);
    if (prior?.code) return prior.code;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateShareCode(8);
      const inserted = await run(
        client,
        "INSERT INTO wallet_invite_codes (code, account_id, channel) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        code, accountId, REFERRAL_CHANNEL,
      );
      if (inserted.rowCount) return code;
      const raced = await get(client, "SELECT code FROM wallet_invite_codes WHERE account_id = $1 AND channel = $2", accountId, REFERRAL_CHANNEL);
      if (raced?.code) return raced.code;
    }
    throw creditError(500, "专属分享码生成失败，请重试。");
  }

  async function login({ wechatKey, legacyGuestId, expectedLegacyAccountId, visitorId, inviteClaim, referralCode }) {
    const token = randomBytes(32).toString("hex");
    return transact(async (client) => {
      await lock(client, "identity:" + wechatKey);
      const now = clock();
      const config = await rules(client);
      const hasUid = await hasAccountUid(client);
      const existing = hasUid
        ? await get(client, "SELECT id, uid FROM wallet_accounts WHERE wechat_key = $1", wechatKey)
        : await get(client, "SELECT id FROM wallet_accounts WHERE wechat_key = $1", wechatKey);
      const id = existing?.id ?? randomUUID();
      let uid = existing?.uid ?? null;
      const created = !existing;
      let referralRewarded = false;
      if (created) {
        if (hasUid) {
          const inserted = await get(client, "INSERT INTO wallet_accounts (id, wechat_key, created_at, legacy_member) VALUES ($1, $2, $3, $4) RETURNING uid",
            id, wechatKey, now, Boolean(legacyGuestId));
          uid = inserted?.uid ?? null;
        } else {
          await run(client, "INSERT INTO wallet_accounts (id, wechat_key, created_at, legacy_member) VALUES ($1, $2, $3, $4)",
            id, wechatKey, now, Boolean(legacyGuestId));
        }
        const scale = await scaleFor(client);
        const amountUnits = toUnits(legacyGuestId ? config.welcome.existingMember : config.welcome.newAccount, scale);
        await grant(client, { id, amountUnits, source: "welcome", ref: id, reason: "首次登录赠送" });
        let claimedGroupInvite = false;
        if (inviteEnabled(config) && visitorId && typeof inviteClaim === "string" && claimToken.test(inviteClaim)) {
          const visit = await get(client, `SELECT v.entered_at, c.account_id FROM wallet_invite_visits v
            JOIN wallet_invite_codes c ON c.code = v.code WHERE v.claim = $1 AND v.wechat_key = $2 AND v.visitor_id = $3
            AND v.claimed_by IS NULL AND c.channel = $4`, inviteClaim, wechatKey, visitorId, INVITE_CHANNEL);
          if (visit && visit.account_id !== id && visit.entered_at + config.invite.registerDays * DAY_MS > now) {
            await run(client, "UPDATE wallet_invite_visits SET claimed_by = $1 WHERE claim = $2", id, inviteClaim);
            await run(client, `INSERT INTO wallet_invitations (account_id, inviter_id, reward, monthly_limit, expires_at)
              VALUES ($1, $2, $3, $4, $5)`, id, visit.account_id, toUnits(config.invite.reward, scale), config.invite.monthlyLimit, now + config.invite.useDays * DAY_MS);
            claimedGroupInvite = true;
          }
        }
        const cleanRef = typeof referralCode === "string" ? referralCode.trim() : "";
        if (!claimedGroupInvite && referralEnabled(config) && shareCode.test(cleanRef) && validId(visitorId)) {
          let inviter = await get(
            client,
            "SELECT account_id FROM wallet_invite_codes WHERE code = $1 AND channel = $2",
            cleanRef, REFERRAL_CHANNEL,
          );
          if (!inviter && hasUid && validUid(cleanRef)) {
            const byUid = await get(client, "SELECT id AS account_id FROM wallet_accounts WHERE uid = $1", Number(cleanRef));
            if (byUid?.account_id) inviter = byUid;
          }
          const inviterId = inviter?.account_id;
          if (inviterId && inviterId !== id) {
            await lock(client, "share-device:" + visitorId);
            const seenDeviceKey = "seen-device:" + visitorId;
            const shareDeviceKey = "share-device:" + visitorId;
            const reusedDevice = await get(
              client,
              `SELECT 1 AS ok FROM wallet_account_devices WHERE guest_id = $1
               UNION ALL
               SELECT 1 AS ok FROM wallet_sessions WHERE guest_id = $1
               UNION ALL
               SELECT 1 AS ok FROM wallet_first_use_events WHERE reference IN ($2, $3)
               LIMIT 1`,
              visitorId, seenDeviceKey, shareDeviceKey,
            );
            if (!reusedDevice?.ok) {
              await lockAccounts(client, [id, inviterId]);
              const limit = Number(config.referral.monthlyLimit) || 0;
              let withinLimit = true;
              if (limit > 0) {
                const { total } = await get(
                  client,
                  `SELECT COUNT(*)::integer AS total FROM wallet_ledger
                   WHERE account_id = $1 AND source = 'invite' AND reference LIKE 'share:%' AND created_at >= $2`,
                  inviterId, monthStartMs(now),
                );
                withinLimit = Number(total) < limit;
              }
              const rewardUnits = toUnits(config.referral.reward, scale);
              if (rewardUnits > 0 && withinLimit) {
                const accountClaim = await run(
                  client,
                  "INSERT INTO wallet_first_use_events (reference) VALUES ($1) ON CONFLICT DO NOTHING",
                  "share-account:" + id,
                );
                const deviceClaim = accountClaim.rowCount
                  ? await run(
                    client,
                    "INSERT INTO wallet_first_use_events (reference) VALUES ($1) ON CONFLICT DO NOTHING",
                    shareDeviceKey,
                  )
                  : { rowCount: 0 };
                if (accountClaim.rowCount && deviceClaim.rowCount) {
                  await grant(client, {
                    id: inviterId,
                    amountUnits: rewardUnits,
                    source: "invite",
                    ref: "share:" + id,
                    reason: "好友通过分享注册",
                    createdAt: now,
                  });
                  referralRewarded = true;
                }
              }
            }
          }
        }
      }
      if (legacyGuestId) {
        if (expectedLegacyAccountId && expectedLegacyAccountId !== id) {
          throw creditError(409, "这份本机资料已绑定其他微信账号。");
        }
        await run(client, "INSERT INTO wallet_account_devices (guest_id, account_id) VALUES ($1, $2) ON CONFLICT (guest_id) DO NOTHING",
          legacyGuestId, id);
        const owner = await get(client, "SELECT account_id FROM wallet_account_devices WHERE guest_id = $1", legacyGuestId);
        if (owner.account_id !== id) throw creditError(409, "这份本机资料已绑定其他微信账号。");
        if (!created) await run(client, "UPDATE wallet_accounts SET legacy_member = true WHERE id = $1", id);
      }
      if (validId(visitorId)) {
        await run(
          client,
          "INSERT INTO wallet_first_use_events (reference) VALUES ($1) ON CONFLICT DO NOTHING",
          "seen-device:" + visitorId,
        );
      }
      await run(client, "DELETE FROM wallet_sessions WHERE expires_at <= $1", now);
      await run(client, "INSERT INTO wallet_sessions (token_hash, account_id, guest_id, expires_at) VALUES ($1, $2, $3, $4)",
        hash(token), id, visitorId ?? null, now + SESSION_MS);
      return { token, accountId: id, uid, created, referralRewarded, ...(await balance(client, id)) };
    });
  }

  async function ledger(client, accountId, limit, before = 0, withZero = true, hasUid = true) {
    const scale = await scaleFor(client);
    const rows = !hasUid
      ? await all(client, `SELECT l.id, l.account_id AS "accountId", NULL::integer AS "accountUid", l.source, l.amount, l.balance_after AS "balanceAfter",
          l.reference, l.reason, l.tool, l.operator, l.created_at AS "createdAt" FROM wallet_ledger l
          WHERE ($1::text IS NULL OR l.account_id = $1) AND ($2::bigint = 0 OR l.id < $2)
          AND ($3::boolean OR l.amount != 0) ORDER BY l.id DESC LIMIT $4`, accountId, before, withZero, limit)
      : await all(client, `SELECT l.id, l.account_id AS "accountId", a.uid AS "accountUid", l.source, l.amount, l.balance_after AS "balanceAfter",
          l.reference, l.reason, l.tool, l.operator, l.created_at AS "createdAt" FROM wallet_ledger l
          LEFT JOIN wallet_accounts a ON a.id = l.account_id
          WHERE ($1::text IS NULL OR l.account_id = $1) AND ($2::bigint = 0 OR l.id < $2)
          AND ($3::boolean OR l.amount != 0) ORDER BY l.id DESC LIMIT $4`, accountId, before, withZero, limit);
    return rows.map(row => ({
      ...row,
      amount: fromCreditUnits(row.amount, scale),
      balanceAfter: fromCreditUnits(row.balanceAfter, scale),
    }));
  }

  function linkedDevices(accountId) {
    if (!database || !validId(accountId)) return Promise.resolve([]);
    return read(async (client) => {
      const rows = await all(client, "SELECT guest_id FROM wallet_account_devices WHERE account_id = $1", accountId);
      return rows.map(row => row.guest_id).filter(validId);
    });
  }

  function wallet(id, before) {
    return read(async (client) => {
      const hasUid = await hasAccountUid(client);
      const accountRow = hasUid ? await get(client, "SELECT uid FROM wallet_accounts WHERE id = $1", id) : null;
      const rows = await ledger(client, id, 31, before, false, hasUid);
      return {
        accountId: id, uid: accountRow?.uid ?? null, ...(await balance(client, id)),
        records: rows.slice(0, 30).map(({ accountId, accountUid, operator, reference, ...entry }) => ({
          ...entry,
          reason: entry.source === "manual" ? (entry.amount > 0 ? "人工补发" : "人工扣回") : entry.reason,
        })),
        nextBefore: rows.length === 31 ? rows[29].id : null,
      };
    });
  }

  async function resolveAccountId(client, accountRef, hasUid) {
    if (!accountRef) return "";
    if (validUid(accountRef)) {
      if (!hasUid) return "";
      const row = await get(client, "SELECT id FROM wallet_accounts WHERE uid = $1", Number(accountRef));
      return row?.id ?? "";
    }
    return accountRef;
  }

  function adminView(query) {
    return read(async (client) => {
      const hasUid = await hasAccountUid(client);
      const hasQuery = Boolean(query);
      const resolvedId = hasQuery ? await resolveAccountId(client, query, hasUid) : "";
      const accounts = hasQuery && !resolvedId
        ? []
        : await all(client, hasUid
          ? `SELECT id, uid, created_at AS "createdAt", legacy_member::integer AS "legacyMember"
            FROM wallet_accounts WHERE ($1::text = '' OR id = $1) ORDER BY created_at DESC, id LIMIT 50`
          : `SELECT id, NULL::integer AS uid, created_at AS "createdAt", legacy_member::integer AS "legacyMember"
            FROM wallet_accounts WHERE ($1::text = '' OR id = $1) ORDER BY created_at DESC, id LIMIT 50`, resolvedId);
      const byId = await balances(client, accounts.map(row => row.id));
      return {
        rules: await rules(client),
        directPurchaseReady,
        tokenRechargeReady: tokenRechargeReady && await hasFrozenLots(client),
        groupApproved,
        accounts: accounts.map(row => ({ ...row, ...byId.get(row.id) })),
        records: hasQuery && !resolvedId ? [] : await ledger(client, resolvedId || null, 50, 0, true, hasUid),
      };
    });
  }

  function adjust({ accountId, amount, reason, requestId, actor }) {
    return transact(async (client) => {
      await lock(client, "adjustment:" + requestId);
      const scale = await scaleFor(client);
      const amountUnits = toUnits(amount, scale);
      const hasUid = await hasAccountUid(client);
      const targetId = validUid(accountId) ? await resolveAccountId(client, accountId, hasUid) : accountId;
      if (!targetId) throw creditError(404, "找不到该微信账号。");
      await lockAccounts(client, [targetId]);
      await expire(client, targetId, clock());
      const prior = await get(client, "SELECT account_id, amount, reason FROM wallet_ledger WHERE source = 'manual' AND reference = $1", requestId);
      if (prior) {
        if (prior.account_id !== targetId || prior.amount !== amountUnits || prior.reason !== reason) {
          throw creditError(409, "该补发记录已存在，请刷新后重试。");
        }
      } else {
        const entry = { id: targetId, amountUnits, source: "manual", ref: requestId, reason, actor };
        if (amountUnits > 0) {
          await grant(client, entry);
        } else {
          const allocations = await allocate(client, targetId, -amountUnits);
          await record(client, entry);
          for (const item of allocations) {
            await run(client, "UPDATE wallet_credit_lots SET remaining = remaining - $1 WHERE id = $2", item.amount, item.lotId);
          }
        }
      }
      return { accountId: targetId, ...(await balance(client, targetId)) };
    });
  }

  function setRules(patch, actor) {
    return transact(async (client) => {
      await lock(client, "rules");
      const value = updateCreditRules(await rules(client), patch, { groupApproved, directPurchaseReady,
        tokenRechargeReady: tokenRechargeReady && await hasFrozenLots(client) });
      await run(client, `INSERT INTO wallet_rules (id, value) VALUES (1, $1)
        ON CONFLICT (id) DO UPDATE SET value = excluded.value`, value);
      await record(client, { id: null, amountUnits: 0, source: "rules", ref: randomUUID(), reason: "更新卷豆规则", actor });
      return value;
    });
  }

  async function quote(client, tool) {
    if (typeof tool !== "string" || !TOOL_ID.test(tool)) throw creditError(400, "工具标识有误。");
    const { costs } = await rules(client);
    if (!Object.hasOwn(costs, tool)) throw creditError(404, "该工具尚未配置用量。");
    return costs[tool];
  }

  function validateKey({ accountId, tool, operationId }) {
    if (!validId(accountId) || typeof tool !== "string" || !TOOL_ID.test(tool) ||
        typeof operationId !== "string" || !operationRef.test(operationId)) {
      throw creditError(400, "工具操作凭证有误。");
    }
  }

  async function findOperation(client, { accountId, tool, operationId }, now = clock()) {
    const scale = await scaleFor(client);
    const row = await get(client, `SELECT id, CASE WHEN state = 'reserved' AND expires_at <= $4 THEN 'expired' ELSE state END AS state,
      cost, expires_at AS "expiresAt", delivery_ref AS "deliveryRef", payment_order_id AS "paymentOrderId"
      FROM wallet_tool_operations WHERE account_id = $1 AND tool = $2 AND operation_id = $3`, accountId, tool, operationId, now);
    if (!row) return row;
    if (row.paymentOrderId === null) delete row.paymentOrderId;
    return { ...row, costUnits: row.cost, cost: fromCreditUnits(row.cost, scale) };
  }

  function mutateOperation(key, fn) {
    validateKey(key);
    return transact(async (client) => {
      await lockAccounts(client, [key.accountId]);
      const now = clock();
      await expire(client, key.accountId, now);
      return fn(client, await findOperation(client, key, now), now);
    });
  }

  function reserve(key, { quotedCost, holdMs = 5 * 60 * 1000, paymentOrderId } = {}) {
    if (!Number.isInteger(holdMs) || holdMs < 1_000 || holdMs > MAX_HOLD_MS) throw creditError(400, "占用时长有误。");
    if (paymentOrderId !== undefined && (typeof paymentOrderId !== "string" || !ORDER_ID.test(paymentOrderId))) {
      throw creditError(400, "道具购买单号有误。");
    }
    return mutateOperation(key, async (client, existing, now) => {
      if (existing) {
        if (paymentOrderId !== existing.paymentOrderId) throw creditError(409, "工具操作的付款来源已确认。", "purchase-conflict");
        return { ...publicOperation(existing), created: false };
      }
      const scale = await scaleFor(client);
      const { accountId, tool, operationId } = key;
      const cost = paymentOrderId ? 0 : await quote(client, tool);
      const costUnits = paymentOrderId ? 0 : toUnits(cost, scale);
      if (paymentOrderId) {
        await purchases.assertUsable(client, accountId, tool, paymentOrderId);
      } else if (toCreditUnits(quotedCost, scale) !== costUnits) {
        throw creditError(409, "工具用量有更新，请重新确认。", "quote");
      }
      const allocations = costUnits ? await allocate(client, accountId, costUnits) : [];
      const id = randomUUID();
      const expiresAt = now + holdMs;
      await run(client, `INSERT INTO wallet_tool_operations
        (id, account_id, tool, operation_id, state, cost, created_at, expires_at, payment_order_id)
        VALUES ($1, $2, $3, $4, 'reserved', $5, $6, $7, $8)`, id, accountId, tool, operationId, costUnits, now, expiresAt, paymentOrderId ?? null);
      for (const item of allocations) {
        await run(client, "INSERT INTO wallet_tool_holds (operation_id, lot_id, amount) VALUES ($1, $2, $3)", id, item.lotId, item.amount);
      }
      return { id, state: "reserved", cost: fromCreditUnits(costUnits, scale), expiresAt, deliveryRef: null, created: true, ...(paymentOrderId ? { paymentOrderId } : {}) };
    });
  }

  function settle(key, deliveryRef) {
    if (typeof deliveryRef !== "string" || !operationRef.test(deliveryRef)) throw creditError(400, "请提供已保存的交付凭证。");
    return mutateOperation(key, async (client, operation, now) => {
      if (!operation) throw creditError(404, "找不到这笔工具操作。");
      if (operation.state === "settled" && operation.deliveryRef !== deliveryRef) {
        throw creditError(409, "这笔工具操作已有交付凭证。");
      }
      if (operation.state !== "reserved") return publicOperation(operation);
      const { accountId, tool } = key;
      if (await get(client, "SELECT 1 FROM wallet_tool_operations WHERE account_id = $1 AND tool = $2 AND delivery_ref = $3", accountId, tool, deliveryRef)) {
        throw creditError(409, "该交付凭证已结算。");
      }
      if (operation.paymentOrderId) {
        await purchases.assertUsable(client, accountId, tool, operation.paymentOrderId, { held: true });
      } else {
        await record(client, { id: accountId, amountUnits: -operation.costUnits, source: "tool", tool, ref: operation.id, reason: "使用工具" });
        await run(client, `UPDATE wallet_credit_lots l SET remaining = l.remaining - h.amount
          FROM wallet_tool_holds h WHERE l.id = h.lot_id AND h.operation_id = $1`, operation.id);
        await run(client, "DELETE FROM wallet_tool_holds WHERE operation_id = $1", operation.id);
      }
      await run(client, "UPDATE wallet_tool_operations SET state = 'settled', delivery_ref = $1, settled_at = $2 WHERE id = $3", deliveryRef, now, operation.id);
      return publicOperation({ ...operation, state: "settled", deliveryRef });
    });
  }

  function release(key) {
    return mutateOperation(key, async (client, operation) => {
      if (!operation) throw creditError(404, "找不到这笔工具操作。");
      if (operation.state !== "reserved") return publicOperation(operation);
      await run(client, "DELETE FROM wallet_tool_holds WHERE operation_id = $1", operation.id);
      await run(client, "UPDATE wallet_tool_operations SET state = 'released' WHERE id = $1", operation.id);
      return publicOperation({ ...operation, state: "released" });
    });
  }

  function referralInfo(id) {
    return transact(async (client) => {
      const now = clock();
      const config = await rules(client);
      const scale = await scaleFor(client);
      await lockAccounts(client, [id]);
      const code = await ensureShareCode(client, id);
      const stats = await get(
        client,
        `SELECT COUNT(*)::integer AS total_count,
                COALESCE(SUM(amount), 0)::integer AS total_units,
                COUNT(*) FILTER (WHERE created_at >= $2)::integer AS month_count
         FROM wallet_ledger
         WHERE account_id = $1 AND source = 'invite' AND reference LIKE 'share:%'`,
        id, monthStartMs(now),
      );
      return {
        enabled: referralEnabled(config),
        reward: config.referral.reward,
        monthlyLimit: config.referral.monthlyLimit,
        code,
        rewardedCount: Number(stats?.total_count || 0),
        rewardedTotal: fromCreditUnits(Number(stats?.total_units || 0), scale),
        monthCount: Number(stats?.month_count || 0),
      };
    });
  }

  function makeInvite(id) {
    return transact(async (client) => {
      const config = await rules(client);
      if (!inviteEnabled(config)) throw creditError(403, "当前渠道未开放邀请奖励。");
      await lockAccounts(client, [id]);
      const { reward, useDays, monthlyLimit } = config.invite;
      const prior = await get(client, "SELECT code FROM wallet_invite_codes WHERE account_id = $1 AND channel = $2", id, INVITE_CHANNEL);
      const code = prior?.code ?? randomBytes(12).toString("base64url");
      if (!prior) await run(client, "INSERT INTO wallet_invite_codes (code, account_id, channel) VALUES ($1, $2, $3)", code, id, INVITE_CHANNEL);
      return { code, reward, useDays, monthlyLimit };
    });
  }

  function enterInvite({ code, visitorId, wechatKey, proofKey }) {
    if (!validId(visitorId) || typeof code !== "string" || !inviteCode.test(code)) return null;
    return transact(async (client) => {
      await lock(client, "identity:" + wechatKey);
      await lock(client, "invite-proof:" + proofKey);
      const config = await rules(client);
      if (!inviteEnabled(config) || await get(client, "SELECT 1 FROM wallet_accounts WHERE wechat_key = $1", wechatKey) ||
          !await get(client, "SELECT 1 FROM wallet_invite_codes WHERE code = $1 AND channel = $2", code, INVITE_CHANNEL)) return null;
      const now = clock();
      const cutoff = now - config.invite.registerDays * DAY_MS;
      const seenProof = await get(client, `SELECT v.* FROM wallet_invite_visit_proofs p JOIN wallet_invite_visits v ON v.claim = p.claim
        WHERE p.proof_key = $1`, proofKey);
      if (seenProof) {
        return seenProof.wechat_key === wechatKey && seenProof.visitor_id === visitorId &&
          seenProof.entered_at > cutoff && !seenProof.claimed_by ? seenProof.claim : null;
      }
      const first = await get(client, `SELECT claim, visitor_id FROM wallet_invite_visits
        WHERE wechat_key = $1 AND entered_at > $2 AND claimed_by IS NULL ORDER BY entered_at, claim LIMIT 1`, wechatKey, cutoff);
      if (first && first.visitor_id !== visitorId) return null;
      const claim = first?.claim ?? randomBytes(24).toString("hex");
      if (!first) {
        await run(client, `INSERT INTO wallet_invite_visits (claim, wechat_key, visitor_id, code, entered_at)
          VALUES ($1, $2, $3, $4, $5)`, claim, wechatKey, visitorId, code, now);
      }
      await run(client, "INSERT INTO wallet_invite_visit_proofs (proof_key, claim) VALUES ($1, $2)", proofKey, claim);
      return claim;
    });
  }

  async function firstUse(client, id, reference, createdAt) {
    const invite = await get(client, "SELECT * FROM wallet_invitations WHERE account_id = $1", id);
    if (!invite) return;
    await lockAccounts(client, [id, invite.inviter_id]);
    const account = await get(client, "SELECT first_use_at FROM wallet_accounts WHERE id = $1", id);
    if (account.first_use_at != null) return;
    const event = await run(client, "INSERT INTO wallet_first_use_events (reference) VALUES ($1) ON CONFLICT DO NOTHING", reference);
    if (!event.rowCount) return;
    await run(client, "UPDATE wallet_accounts SET first_use_at = $1 WHERE id = $2", createdAt, id);
    if (invite.expires_at <= createdAt || !invite.reward) return;
    const month = usageDay(createdAt).slice(0, 7);
    const { total } = await get(client, `SELECT COUNT(*) AS total FROM wallet_invitations
      WHERE inviter_id = $1 AND reward_month = $2`, invite.inviter_id, month);
    if (total >= invite.monthly_limit) return;
    await run(client, "UPDATE wallet_invitations SET reward_month = $1 WHERE account_id = $2", month, id);
    await grant(client, { id: invite.inviter_id, amountUnits: invite.reward, source: "invite", ref: id, reason: "邀请新卷友", createdAt });
  }

  function recordToolUse(key) {
    validateKey(key);
    return transact(async (client) => {
      const operation = await findOperation(client, key);
      if (operation?.state !== "settled") throw creditError(409, "该工具操作尚未结算。");
      await firstUse(client, key.accountId, "tool:" + operation.id, clock());
    });
  }

  const purchases = createToolPurchaseStore({ transact, read, lockAccounts, expire, rules, resolveAccountId, clock });
  const recharges = createCoinRechargeStore({
    transact, read, lockAccounts, rules, grant, record, scaleFor, clock,
    resolveAccountId: async (client, accountRef) => resolveAccountId(client, accountRef, await hasAccountUid(client)),
  });
  return {
    purchases, recharges,
    account, wallet, linkedDevices, login, adminView, adjust, setRules, reserve, settle, release, recordToolUse, makeInvite, enterInvite, referralInfo,
    quote: (tool) => read((client) => quote(client, tool)),
    operation: (key) => {
      validateKey(key);
      return read(async (client) => publicOperation(await findOperation(client, key)) ?? null);
    },
    inviteEnabled: () => database && groupApproved ? read(async (client) => inviteEnabled(await rules(client))) : false,
    referralSettings: async () => {
      const fallback = {
        enabled: Boolean(defaultCreditRules.referral.enabled && defaultCreditRules.referral.reward > 0),
        reward: defaultCreditRules.referral.reward,
        monthlyLimit: defaultCreditRules.referral.monthlyLimit,
      };
      if (!database) return fallback;
      try {
        const config = await read(rules);
        return {
          enabled: referralEnabled(config),
          reward: config.referral.reward,
          monthlyLimit: config.referral.monthlyLimit,
        };
      } catch {
        return fallback;
      }
    },
    purchaseSettings: async () => {
      if (!database) return structuredClone(defaultCreditRules.purchase);
      try { return (await read(rules)).purchase; } catch { return structuredClone(defaultCreditRules.purchase); }
    },
    pendingInvite: (id) => read(async (client) => Boolean(await get(client, `SELECT 1 FROM wallet_invitations i JOIN wallet_accounts a ON a.id = i.account_id
      WHERE i.account_id = $1 AND i.expires_at > $2 AND a.first_use_at IS NULL`, id, clock()))),
    submitted: ({ accountId, reference, createdAt }) => transact((client) => firstUse(client, accountId, "submit:" + reference, createdAt)),
    signOut: (token) => {
      if (typeof token === "string" && sessionToken.test(token)) {
        return transact((client) => run(client, "DELETE FROM wallet_sessions WHERE token_hash = $1", hash(token)));
      }
    },
  };
}
