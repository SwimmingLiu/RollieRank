import { createHash } from "node:crypto";
import { createToolCreditStore } from "./tool-credits-store.mjs";
import { createWalletDatabase } from "./tool-credits-postgres.mjs";
import { createToolCreditsCommerce, paymentPush } from "./tool-credits-commerce.mjs";
import { createToolCreditsRecharge } from "./tool-credits-recharge.mjs";
import { createWechatCoinPayment, createWechatToolPayment } from "./wechat-tool-payment.mjs";
import { creditError, validAccountRef, validCreditAmount, validId } from "./tool-credits-rules.mjs";
import { wechatProfilesByGuest } from "./wechat-profile.mjs";

const ROOT = "/api/tool-credits";
const WECHAT_CODE = /^[\w-]{1,256}$/;
const GROUP_SCENES = [1008, 1044];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function wechatSession(code, { appId, secret, fetchImpl }) {
  if (!appId || !secret) throw creditError(503, "微信登录暂未开放。");
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.search = new URLSearchParams({ appid: appId, secret, js_code: code, grant_type: "authorization_code" });
  let result;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error();
    result = await response.json();
  } catch {
    throw creditError(502, "暂时连不上微信，请稍后重试。");
  }
  if (result?.errcode || typeof result?.openid !== "string" || !WECHAT_CODE.test(result.openid)) {
    throw creditError(401, "微信登录已失效，请重试。");
  }
  return { openid: result.openid, sessionKey: result.session_key };
}

export function createToolCredits({ readCatalog, mutateCatalog }, {
  env = process.env, fetchImpl = globalThis.fetch, exchange, clock, verifyInviteVisit, testEnvironment = false,
  database: suppliedDatabase,
} = {}) {
  // A staging wallet can exchange WeChat codes without enabling other WeChat features.
  const walletAppId = env.ROLLIERANK_WALLET_WECHAT_APP_ID?.trim();
  const walletSecret = env.ROLLIERANK_WALLET_WECHAT_APP_SECRET?.trim();
  const [appId, secret] = walletAppId || walletSecret
    ? [walletAppId, walletSecret]
    : [env.ROLLIERANK_WECHAT_APP_ID?.trim(), env.ROLLIERANK_WECHAT_APP_SECRET?.trim()];
  const groupApproved = env.ROLLIERANK_WECHAT_GROUP_INVITE_APPROVED === "1" && typeof verifyInviteVisit === "function";
  const database = suppliedDatabase ?? createWalletDatabase({ env, testEnvironment });
  let payment = null;
  try {
    if (database) payment = createWechatToolPayment({ env, appId, secret, fetchImpl, clock });
  } catch (error) {
    console.warn(error.message);
  }
  // Recharge has its own environment and never depends on a published direct-purchase product.
  const coinPayment = database ? createWechatCoinPayment({ env, appId, secret, fetchImpl, clock, testEnvironment }) : null;
  const store = createToolCreditStore({ database, groupApproved, directPurchaseReady: Boolean(payment),
    tokenRechargeReady: Boolean(coinPayment), clock });
  const bearer = (request) => /^Bearer ([a-f0-9]{64})$/i.exec(request.headers.authorization ?? "")?.[1];
  const accountKey = (openid) => sha256((appId || "local-test") + ":" + openid);

  async function getWechatSession(code) {
    const result = exchange ? await exchange(code) : await wechatSession(code, { appId, secret, fetchImpl });
    const session = typeof result === "string" ? { openid: result } : result;
    if (typeof session?.openid !== "string" || !WECHAT_CODE.test(session.openid)) {
      throw creditError(401, "微信登录已失效，请重试。");
    }
    return session;
  }

  async function requireAccount(request) {
    const account = await store.account(bearer(request));
    if (!account) throw creditError(401, "请先登录微信账号。", "login");
    return account;
  }

  const commerce = createToolCreditsCommerce({ payment, store, requireAccount, getWechatSession, accountKey });
  const recharge = createToolCreditsRecharge({ payment: coinPayment, orders: store.recharges, requireAccount, getWechatSession, accountKey });

  async function handle({ pathname, method, input, query, send, request }) {
    if (!pathname.startsWith(ROOT + "/")) return false;
    const route = pathname.slice(ROOT.length);
    if (method === "GET" && route === "/capabilities") {
      const purchase = await store.purchaseSettings();
      const directPurchase = Boolean(payment && purchase.directPurchase);
      const tokenRecharge = Boolean(coinPayment && purchase.tokenRecharge);
      send(200, {
        login: Boolean(database && (exchange || (appId && secret))), invite: await store.inviteEnabled(),
        purchase: {
          directPurchase, tokenRecharge, packages: purchase.packages,
          ...(tokenRecharge ? { tokenRechargeIos: coinPayment.ios } : {}),
          ...(directPurchase ? { products: payment.products } : {}),
        },
        ads: false,
      });
      return true;
    }
    if (method === "POST" && route === "/login") {
      if (typeof input.code !== "string" || !WECHAT_CODE.test(input.code)) throw creditError(400, "请重新登录微信。");
      if ((input.visitorId != null || input.bindLegacy === true) && !validId(input.visitorId)) {
        throw creditError(400, "本机身份凭证有误。");
      }
      if (!database) throw creditError(503, "卷豆 PostgreSQL 尚未配置。", "wallet-unavailable");
      const { openid } = await getWechatSession(input.code);
      const wechatKey = accountKey(openid);
      let legacyGuestId;
      if (input.bindLegacy === true && validId(input.visitorId)) {
        const catalog = readCatalog();
        const profile = typeof input.profileToken === "string" && /^[a-f0-9]{48}$/.test(input.profileToken)
          ? catalog.features.wechatProfiles?.[sha256(input.profileToken)] : null;
        const deviceProfile = profile?.guestId === input.visitorId;
        const knownOwner = wechatProfilesByGuest(catalog).get(input.visitorId)?.phone?.owner;
        if ((knownOwner && knownOwner !== wechatKey) ||
            (deviceProfile && profile.phone?.owner && profile.phone.owner !== wechatKey)) {
          throw creditError(403, "请使用已绑定本机资料的微信账号。");
        }
        const priorReceipt = validId(input.attemptId) && catalog.receipts[`${input.visitorId}:${input.attemptId}`];
        if (!deviceProfile && (!priorReceipt || priorReceipt.isSample)) {
          throw creditError(400, "暂时无法确认本机资料，可以取消关联后登录。");
        }
        legacyGuestId = input.visitorId;
      }
      const wallet = await store.login({ wechatKey, legacyGuestId, visitorId: input.visitorId, inviteClaim: input.inviteClaim });
      send(200, wallet);
      return true;
    }
    if (method === "POST" && route === "/invite/visit") {
      let claim = null;
      if (GROUP_SCENES.includes(input.scene) && validId(input.visitorId) &&
          typeof input.code === "string" && /^[a-zA-Z0-9_-]{16}$/.test(input.code) &&
          typeof input.proof === "string" && input.proof.length > 0 && input.proof.length <= 8192 && await store.inviteEnabled()) {
        const verified = await verifyInviteVisit({ code: input.code, scene: input.scene, proof: input.proof });
        if (typeof verified?.openid === "string" && WECHAT_CODE.test(verified.openid) &&
            typeof verified.proofId === "string" && verified.proofId && verified.proofId.length <= 256) {
          claim = await store.enterInvite({
            code: input.code, visitorId: input.visitorId,
            wechatKey: accountKey(verified.openid), proofKey: sha256(verified.proofId),
          });
        }
      }
      send(200, claim ? { accepted: true, claim } : { accepted: false });
      return true;
    }
    if (method === "POST" && route === "/logout") {
      await store.signOut(bearer(request));
      send(200, { ok: true });
      return true;
    }

    if (method === "GET" && route === "/wallet") {
      const { id } = await requireAccount(request);
      const before = Number(query.get("before") || 0);
      if (!Number.isSafeInteger(before) || before < 0) throw creditError(400, "明细页码无效。");
      send(200, await store.wallet(id, before));
    } else if (method === "GET" && route === "/quote") {
      const tool = query.get("tool");
      send(200, { tool, cost: await store.quote(tool) });
    } else if (method === "POST" && route === "/invite/code") {
      const { id } = await requireAccount(request);
      send(200, await store.makeInvite(id));
    } else {
      const context = { route, method, input, request, send };
      return await recharge.handle(context) || commerce.handle(context);
    }
    return true;
  }

  async function handleAdmin({ sub, method, input, query, send, session }) {
    if (sub === "tool-credits" && method === "GET") {
      const accountId = query.get("accountId") || "";
      if (accountId && !validAccountRef(accountId)) throw creditError(400, "账号 UID 或编号有误。");
      send(200, await store.adminView(accountId));
    } else if (sub === "tool-credits/rules" && method === "POST") {
      send(200, { rules: await store.setRules(input, session.username) });
    } else if (sub === "tool-credits/adjust" && method === "POST") {
      const { accountId, amount, requestId } = input;
      const reason = typeof input.reason === "string" ? input.reason.trim() : "";
      if (!validAccountRef(accountId) || !validId(requestId) ||
          !validCreditAmount(amount, { min: -10000, max: 10000, allowZero: false }) ||
          !reason || reason.length > 200) throw creditError(400, "请填写账号、调整颗数和原因。");
      send(200, await store.adjust({ accountId, amount, reason, requestId, actor: session.username }));
    } else {
      const context = { sub, method, input, query, send, session };
      return await recharge.handleAdmin(context) || commerce.handleAdmin(context);
    }
    return true;
  }

  async function invitedAccount(request, guestId) {
    if (!groupApproved || !guestId) return null;
    try {
      const account = await store.account(bearer(request));
      return account?.guestId === guestId && await store.pendingInvite(account.id) ? account.id : null;
    } catch {
      // Wallet availability must not prevent free submissions.
      return null;
    }
  }

  function stageInviteUse(accountId, receiptKey, attempt) {
    if (!accountId || !attempt.answers.some(Boolean)) return;
    const features = readCatalog().features;
    (features.toolCreditInviteSubmissions ??= {})[receiptKey] = {
      accountId, reference: sha256(receiptKey), createdAt: attempt.createdAt,
    };
  }

  async function flushInviteUses() {
    const entries = Object.entries(readCatalog().features.toolCreditInviteSubmissions ?? {});
    if (!entries.length) return;
    for (const [, entry] of entries) await store.submitted(entry);
    await mutateCatalog(({ features }) => {
      const staged = features.toolCreditInviteSubmissions;
      if (!staged) return;
      for (const [key] of entries) delete staged[key];
      if (!Object.keys(staged).length) delete features.toolCreditInviteSubmissions;
    });
  }

  const { quote, operation, reserve, settle, release, recordToolUse } = store;
  return {
    handle, handleAdmin, invitedAccount, stageInviteUse, flushInviteUses,
    async handleWechatPaymentPush(raw, response) {
      const message = paymentPush(raw);
      return await recharge.handleWechatPush(message, raw, response) || commerce.handleWechatPush(message, raw, response);
    },
    billing: Object.freeze({ requireAccount, quote, operation, reserve, settle, release, recordToolUse }),
  };
}
