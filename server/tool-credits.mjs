import { createHash } from "node:crypto";
import { createToolCreditStore } from "./tool-credits-store.mjs";
import { createWalletDatabase } from "./tool-credits-postgres.mjs";
import { createToolCreditsCommerce, paymentPush } from "./tool-credits-commerce.mjs";
import { createToolCreditsRecharge } from "./tool-credits-recharge.mjs";
import { createWechatCoinPayment, createWechatToolPayment } from "./wechat-tool-payment.mjs";
import { creditError, validAccountRef, validCreditAmount, validId } from "./tool-credits-rules.mjs";
import { wechatProfilesByGuest } from "./wechat-profile.mjs";
import { accountIdForGuest, canLinkAccountGuest, linkAccountGuest } from "./account-identity.mjs";

const ROOT = "/api/tool-credits";
const WECHAT_CODE = /^[\w-]{1,256}$/;
const GROUP_SCENES = [1008, 1044];
const QR_ENVS = new Set(["release", "trial", "develop"]);
const QR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const QR_CACHE_MAX = 500;
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

  let qrAccessToken = "";
  let qrAccessTokenExpires = 0;
  let pendingQrToken = null;
  const qrCache = new Map();

  async function getWechatStableToken() {
    if (!appId || !secret) throw creditError(503, "专属小程序码暂未配置。");
    const now = typeof clock === "function" ? clock() : Date.now();
    if (qrAccessToken && now < qrAccessTokenExpires) return qrAccessToken;
    pendingQrToken ??= (async () => {
      let response;
      try {
        response = await fetchImpl("https://api.weixin.qq.com/cgi-bin/stable_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "client_credential",
            appid: appId,
            secret,
            force_refresh: false,
          }),
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        throw creditError(502, "暂时连不上微信，请稍后重试。");
      }
      if (!response.ok) throw creditError(502, "获取微信凭证失败。");
      const result = await response.json();
      if (result?.errcode || !result?.access_token) {
        throw creditError(502, "暂时无法获取微信凭证。");
      }
      qrAccessToken = result.access_token;
      qrAccessTokenExpires = (typeof clock === "function" ? clock() : Date.now()) +
        Math.max(0, (Number(result.expires_in) || 7200) - 120) * 1000;
      return qrAccessToken;
    })().finally(() => { pendingQrToken = null; });
    return pendingQrToken;
  }

  async function generateReferralQr(code, envVersion) {
    const now = typeof clock === "function" ? clock() : Date.now();
    const cacheKey = `${code}:${envVersion}`;
    const cached = qrCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.image;
    const token = await getWechatStableToken();
    const scene = `r=${code}`;
    let response;
    try {
      response = await fetchImpl(
        `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scene,
            page: "pages/home/home",
            width: 280,
            check_path: false,
            env_version: envVersion,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch {
      throw creditError(502, "暂时连不上微信，请稍后重试。");
    }
    if (!response.ok) throw creditError(502, "生成专属小程序码失败。");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.subarray(0, 1).toString() === "{") {
      throw creditError(502, "微信未能生成专属小程序码。");
    }
    if (buffer.length < 256) throw creditError(502, "微信返回的小程序码数据无效。");
    const image = buffer.toString("base64");
    if (qrCache.size >= QR_CACHE_MAX) {
      const oldestKey = qrCache.keys().next().value;
      if (oldestKey) qrCache.delete(oldestKey);
    }
    qrCache.set(cacheKey, { image, expiresAt: now + QR_CACHE_TTL_MS });
    return image;
  }

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
      const referral = await store.referralSettings();
      const directPurchase = Boolean(payment && purchase.directPurchase);
      const tokenRecharge = Boolean(coinPayment && purchase.tokenRecharge);
      send(200, {
        login: Boolean(database && (exchange || (appId && secret))), invite: await store.inviteEnabled(),
        referral,
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
      let expectedLegacyAccountId = null;
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
        expectedLegacyAccountId = accountIdForGuest(catalog, input.visitorId);
      }
      const wallet = await store.login({
        wechatKey,
        legacyGuestId,
        expectedLegacyAccountId,
        visitorId: input.visitorId,
        inviteClaim: input.inviteClaim,
        referralCode: input.referralCode,
      });
      const loginAccountId = wallet?.accountId || wallet?.account?.id;
      if (validId(loginAccountId)) {
        const knownDevices = await store.linkedDevices(loginAccountId).catch(() => []);
        const candidates = new Set(knownDevices);
        if (validId(legacyGuestId)) candidates.add(legacyGuestId);
        const snapshot = readCatalog();
        const toLink = [...candidates].filter((gid) =>
          canLinkAccountGuest(snapshot, loginAccountId, gid, { allowLegacyClaim: true }),
        );
        if (toLink.length) {
          await mutateCatalog((catalog) => {
            for (const gid of toLink) {
              linkAccountGuest(catalog, loginAccountId, gid, { allowLegacyClaim: true });
            }
          }).catch(() => {});
        }
      }
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
    } else if (method === "GET" && route === "/referral") {
      const { id } = await requireAccount(request);
      send(200, await store.referralInfo(id));
    } else if (method === "GET" && route === "/referral/qrcode") {
      const { id } = await requireAccount(request);
      const info = await store.referralInfo(id);
      const requestedEnv = String(query.get("env") || "").trim();
      const envVersion = QR_ENVS.has(requestedEnv)
        ? requestedEnv
        : (testEnvironment ? "trial" : "release");
      const image = await generateReferralQr(info.code, envVersion);
      send(200, { code: info.code, scene: `r=${info.code}`, image, mime: "image/jpeg" });
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
    billing: Object.freeze({ enabled: Boolean(database), requireAccount, quote, operation, reserve, settle, release, recordToolUse }),
  };
}
