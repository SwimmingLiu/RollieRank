import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createToolCreditStore } from "../server/tool-credits-store.mjs";
import { createWechatModeration } from "../server/wechat-moderation.mjs";
import { createWechatCoinPayment } from "../server/wechat-tool-payment.mjs";
import { createWalletTestServer } from "./support/tool-credits-server.mjs";
import { startWalletPostgres } from "./support/wallet-postgres.mjs";

const root = "/api/tool-credits";
const admin = "/admin/api/tool-credits";
const prodKey = "fixture-production-key";
const sandboxKey = "fixture-sandbox-key";
const sessionKey = "fixture-payer-session";
const refreshedKey = "fixture-refreshed-session";
const pushToken = "fixture-push-token";
const appId = "wallet-test-app";
const credentials = { ROLLIERANK_WXPAY_OFFER_ID: "12345", ROLLIERANK_WXPAY_APP_KEY: prodKey,
  ROLLIERANK_WXPAY_SANDBOX_APP_KEY: sandboxKey };
const hmac = (key, value) => createHmac("sha256", key).update(value).digest("hex");
const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

let postgres;
test.before(async () => { postgres = await startWalletPostgres(); });
test.after(() => postgres?.close());

async function fixture(t) {
  const trades = new Map();
  const debits = new Map();
  const faults = { loseDebit: false, rotatedSession: false };
  const moderation = createWechatModeration({ env: { ROLLIERANK_WECHAT_MSG_TOKEN: pushToken } });
  const server = await createWalletTestServer({
    postgres, moderation,
    env: { ...credentials, ROLLIERANK_WXPAY_COIN_ENV: "1", ROLLIERANK_WXPAY_COIN_IOS: "1" },
    fetchImpl: async (url, options = {}) => {
      if (url.pathname === "/sns/jscode2session") {
        const code = url.searchParams.get("js_code");
        return Response.json({ openid: code.includes("different") ? "wechat-other" : "wechat-owner",
          session_key: code.includes("fresh") ? refreshedKey : sessionKey });
      }
      if (url.pathname === "/cgi-bin/stable_token") {
        assert.equal(JSON.parse(options.body).appid, appId);
        return Response.json({ access_token: "fixture-access", expires_in: 7200 });
      }
      const body = JSON.parse(options.body);
      assert.equal(body.env, 1);
      assert.equal(body.openid, "wechat-owner");
      assert.equal(url.searchParams.get("access_token"), "fixture-access");
      assert.equal(url.searchParams.get("pay_sig"), hmac(sandboxKey, url.pathname + "&" + options.body));
      if (url.pathname === "/xpay/query_order") {
        const trade = trades.get(body.order_id);
        return Response.json(trade ? { errcode: 0, order: trade } : { errcode: 268490002 });
      }
      assert.equal(url.pathname, "/xpay/currency_pay");
      const recharge = trades.get("RC" + body.order_id.slice(2));
      assert.match(body.order_id, /^RD[a-f0-9]{30}$/);
      assert.equal(body.amount * 100, recharge.order_fee);
      const key = faults.rotatedSession ? refreshedKey : sessionKey;
      if (url.searchParams.get("signature") !== hmac(key, options.body)) {
        return Response.json({ errcode: 268490009 });
      }
      if (debits.has(body.order_id)) return Response.json({ errcode: 268490004 });
      debits.set(body.order_id, body.amount);
      if (faults.loseDebit) {
        faults.loseDebit = false;
        throw new Error("simulated connection loss after debit");
      }
      return Response.json({ errcode: 0, order_id: body.order_id, balance: 0, used_present_amount: 0 });
    },
  });
  t.after(() => server.close());
  const password = ["Local", "Wallet", "42!"].join("-");
  const setup = await server.json("/admin/api/setup", { username: "recharge-operator", password, confirmPassword: password });
  assert.equal(setup.status, 200);
  const operator = { Cookie: setup.headers.get("set-cookie").split(";")[0] };
  const login = async (code = "login-owner") => {
    const result = await server.json(root + "/login", { code, visitorId: randomUUID() });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return result.data;
  };
  const owner = await login();
  const setPurchase = (purchase = { tokenRecharge: true }) => server.json(admin + "/rules", { purchase }, operator);
  const checkout = (overrides = {}, user = owner) => server.json(root + "/recharges", {
    credits: 5, quotedCents: 500, requestId: randomUUID(), code: "pay-owner", platform: "android", ...overrides,
  }, auth(user));
  const confirm = (id, body = {}, user = owner) => server.json(`${root}/recharges/${id}/confirm`, body, auth(user));
  const wallet = async () => (await server.json(root + "/wallet", undefined, auth(owner))).data;
  function paid(id, changes = {}) {
    trades.set(id, { order_id: id, env_type: 2, status: 4, order_type: 0, order_fee: 500, paid_fee: 500,
      left_fee: 500, wx_order_id: "wx-" + id, update_time: 10, ...changes });
  }
  async function push(payload, { signed = true, xml = false } = {}) {
    const timestamp = "1730000000";
    const nonce = "test-recharge";
    const signature = createHash("sha1").update([pushToken, timestamp, nonce].sort().join("")).digest("hex");
    const query = new URLSearchParams({ timestamp, nonce, signature: signed ? signature : "forged" });
    const body = xml ? "<xml>" + Object.entries(payload).map(([key, value]) => `<${key}>${value}</${key}>`).join("") + "</xml>" : JSON.stringify(payload);
    return fetch(server.origin + "/api/wechat/sec-callback?" + query, {
      method: "POST", headers: { "Content-Type": xml ? "application/xml" : "application/json" }, body,
    });
  }
  return { server, operator, owner, login, setPurchase, checkout, confirm, wallet, paid, push, faults, debits };
}

test("卷豆按 1 元 1 颗签发代币订单，沙箱与现网分别使用各自的密钥", async (t) => {
  const { server, operator, owner, setPurchase, checkout } = await fixture(t);
  const capabilities = () => server.json(root + "/capabilities");
  assert.equal((await capabilities()).data.purchase.tokenRecharge, false);
  assert.equal((await checkout()).status, 403);
  assert.equal((await server.json(admin, undefined, operator)).data.tokenRechargeReady, true);
  assert.equal((await setPurchase({ tokenRecharge: true, packages: [{ credits: 5, cents: 400 }] })).data.errorId, "recharge-price");
  assert.equal((await setPurchase()).status, 200);
  assert.deepEqual((await capabilities()).data.purchase, {
    directPurchase: false, tokenRecharge: true, tokenRechargeIos: false,
    packages: [1, 5, 10, 30, 60].map(credits => ({ credits, cents: 100 * credits })),
  });
  assert.equal((await checkout({ quotedCents: 400 })).data.errorId, "recharge-quote");
  assert.equal((await checkout({ code: "pay-different" })).data.errorId, "recharge-account");
  assert.equal((await checkout({ platform: "ios" })).data.errorId, "recharge-platform");
  const requestId = randomUUID();
  const first = await checkout({ requestId });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const { order, payData } = first.data;
  assert.equal(payData.mode, "short_series_coin");
  assert.deepEqual(JSON.parse(payData.signData), {
    offerId: "12345", buyQuantity: 5, env: 1, currencyType: "CNY", outTradeNo: order.id, attach: order.id,
  });
  assert.equal(payData.paySig, hmac(sandboxKey, "requestVirtualPayment&" + payData.signData));
  assert.equal(payData.signature, hmac(sessionKey, payData.signData));
  assert.equal((await checkout({ requestId })).data.order.id, order.id);
  assert.equal((await checkout({ requestId, credits: 10, quotedCents: 1000 })).data.errorId, "recharge-conflict");
  assert.equal((await server.json(root + "/recharges", undefined, auth(owner))).data.orders.length, 1);
  for (const secret of [sessionKey, sandboxKey, prodKey, "wechat-owner", "debitSignature"]) {
    assert.equal(JSON.stringify(first.data).includes(secret), false);
  }

  const prodOptions = { env: { ...credentials, ROLLIERANK_WXPAY_COIN_ENV: "0" }, appId, secret: "fixture-app-secret" };
  assert.equal(createWechatCoinPayment({ ...prodOptions, testEnvironment: true }), null);
  assert.equal(createWechatCoinPayment({ ...prodOptions, testEnvironment: true,
    env: { ...prodOptions.env, ROLLIERANK_WXPAY_COIN_ENV: "1", ROLLIERANK_WXPAY_SANDBOX_APP_KEY: "" } }), null);
  assert.equal(createWechatCoinPayment({ ...prodOptions,
    env: { ...prodOptions.env, ROLLIERANK_WXPAY_APP_KEY: "" } }), null);
  const prod = createWechatCoinPayment(prodOptions).checkout(order, sessionKey);
  assert.equal(JSON.parse(prod.signData).env, 0);
  assert.equal(prod.paySig, hmac(prodKey, "requestVirtualPayment&" + prod.signData));
});

test("只信签名现金查单，重复确认和推送仅增加一笔可消费的卷豆", async (t) => {
  const { server, owner, login, setPurchase, checkout, confirm, wallet, paid, push, debits } = await fixture(t);
  assert.equal((await setPurchase()).status, 200);
  const { order } = (await checkout()).data;
  const message = { Event: "xpay_coin_pay_notify", OpenId: "wechat-owner", OutTradeNo: order.id, Env: 1 };
  assert.equal((await confirm(order.id, { status: 4, amount: 500 })).data.order.state, "pending");
  assert.equal((await confirm(order.id, {}, await login("login-different"))).status, 404);
  assert.equal((await push(message, { signed: false })).status, 403);
  assert.equal((await push({ ...message, OpenId: "wechat-other" })).status, 403);
  assert.equal((await push({ ...message, Env: 0 })).status, 403);
  assert.equal((await push({ ...message, CoinInfo: { Quantity: 5 } })).status, 502);
  for (const wrong of [{ paid_fee: 499 }, { env_type: 1 }, { order_type: 7 }, { openid: "wechat-other" }]) {
    paid(order.id, wrong);
    assert.equal((await confirm(order.id)).data.errorId, "recharge-order-mismatch");
  }
  assert.equal(debits.size, 0);
  assert.equal((await wallet()).balance, 3);
  paid(order.id);
  const [one, two, notice] = await Promise.all([confirm(order.id), confirm(order.id), push(message, { xml: true })]);
  for (const result of [one, two]) {
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.order.state, "credited");
  }
  assert.equal(notice.status, 200);
  assert.match(await notice.text(), /<ErrCode>0<\/ErrCode>/);
  assert.equal(debits.size, 1);
  assert.equal((await wallet()).balance, 8);
  assert.deepEqual((await wallet()).records.map(row => [row.source, row.amount]), [["purchase", 5], ["welcome", 3]]);
  const worker = createToolCreditStore({ database: server.database, clock: () => Date.now() + 25 * 60 * 60_000 });
  const wechat = { appId, offerId: "12345", env: 1 };
  assert.deepEqual((await worker.recharges.due(wechat)).map(row => row.id), [order.id]);
  assert.deepEqual(await worker.recharges.due(wechat), []);
  const duplicateOrder = (await checkout()).data.order;
  paid(duplicateOrder.id, { wx_order_id: "wx-" + order.id });
  assert.equal((await confirm(duplicateOrder.id)).data.errorId, "recharge-order-mismatch");
  assert.equal(debits.size, 1);

  const store = createToolCreditStore({ database: server.database });
  const operations = Array.from({ length: 9 }, (_, index) => ({ accountId: owner.accountId,
    tool: "answer-sheet", operationId: "paid-tool:" + index }));
  const reserved = await Promise.allSettled(operations.map(key => store.reserve(key, { quotedCost: 1 })));
  assert.equal(reserved.filter(result => result.status === "fulfilled").length, 8);
  const settled = await Promise.all(operations.map((key, index) => reserved[index].status === "fulfilled"
    ? store.settle(key, "paid-tool-result:" + index) : null));
  assert.equal(settled.filter(item => item?.state === "settled").length, 8);
  assert.equal((await wallet()).balance, 0);
});

test("代币扣减丢失回包后沿用同一单号，换码可恢复到账", async (t) => {
  const { setPurchase, checkout, confirm, paid, wallet, faults, debits } = await fixture(t);
  assert.equal((await setPurchase()).status, 200);
  const { order } = (await checkout()).data;
  paid(order.id);
  faults.loseDebit = true;
  assert.equal((await confirm(order.id)).status, 502);
  assert.equal(debits.size, 1);
  assert.equal((await wallet()).balance, 3);
  faults.rotatedSession = true;
  const stale = await confirm(order.id);
  assert.equal(stale.data.order.state, "paid");
  assert.equal(stale.data.order.needsWechatCode, true);
  assert.equal((await confirm(order.id, { code: "fresh-different" })).status, 403);
  // Disabling new checkout still lets previously paid orders finish.
  assert.equal((await setPurchase({ tokenRecharge: false })).status, 200);
  assert.equal((await checkout()).status, 403);
  const recovered = await confirm(order.id, { code: "fresh-owner" });
  assert.equal(recovered.data.order.state, "credited");
  assert.equal((await wallet()).balance, 8);
  assert.equal((await wallet()).records.filter(row => row.source === "purchase").length, 1);
  assert.equal(debits.size, 1);
});

test("签名查单核对退款，暂冻结原批次并只扣回该笔未用卷豆", async (t) => {
  const { server, operator, owner, setPurchase, checkout, confirm, wallet, paid, push } = await fixture(t);
  assert.equal((await setPurchase()).status, 200);
  const { order } = (await checkout()).data;
  paid(order.id);
  assert.equal((await confirm(order.id)).data.order.state, "credited");
  const store = createToolCreditStore({ database: server.database });
  const key = { accountId: owner.accountId, tool: "answer-sheet", operationId: "refund-tool-reserved" };
  assert.equal((await server.json(admin + "/rules", { costs: { "answer-sheet": 4 } }, operator)).status, 200);
  await store.reserve(key, { quotedCost: 4 });
  const refund = { Event: "xpay_refund_notify", OpenId: "wechat-owner", MchOrderId: order.id, RetCode: 0 };
  assert.equal((await push(refund)).status, 502);
  assert.equal((await wallet()).held, 4);
  paid(order.id, { status: 5, left_fee: 0, update_time: 20 });
  assert.equal((await push(refund)).status, 200);
  assert.equal((await wallet()).balance, 3);
  assert.equal((await wallet()).held, 5);
  assert.equal((await store.settle(key, "refunded-result")).state, "released");

  const adminConfirm = () => server.json(`${admin}/recharges/${order.id}/confirm`, {}, operator);
  paid(order.id);
  assert.equal((await adminConfirm()).data.order.state, "refund_pending");
  paid(order.id, { status: 7, update_time: 20 });
  assert.equal((await adminConfirm()).data.order.state, "credited");
  assert.equal((await wallet()).balance, 8);

  const spent = { ...key, operationId: "refund-tool-spent" };
  await store.reserve(spent, { quotedCost: 4 });
  await store.settle(spent, "spent-result");
  paid(order.id, { status: 8, left_fee: 0, update_time: 30 });
  assert.equal((await push(refund)).status, 200);
  assert.equal((await push(refund)).status, 200);
  const state = (await adminConfirm()).data.order;
  assert.equal(state.state, "review");
  assert.equal(state.issue, "refund-shortfall");
  assert.equal((await wallet()).held, 0);
  assert.equal((await wallet()).balance, 0);
  assert.deepEqual((await wallet()).records.map(row => [row.source, row.amount]), [
    ["refund", -4], ["tool", -4], ["purchase", 5], ["welcome", 3],
  ]);
});

test("部分退款由运营核对，原充值批次冻结且赠送卷豆仍可用", async (t) => {
  const { server, operator, setPurchase, checkout, confirm, wallet, paid, push } = await fixture(t);
  assert.equal((await setPurchase()).status, 200);
  const { order } = (await checkout()).data;
  paid(order.id);
  await confirm(order.id);
  paid(order.id, { status: 8, left_fee: 300, update_time: 20 });
  assert.equal((await push({ Event: "xpay_refund_notify", OpenId: "wechat-owner", MchOrderId: order.id, RetCode: 0 })).status, 200);
  assert.equal((await wallet()).balance, 3);
  assert.equal((await wallet()).held, 5);
  const [review] = (await server.json(admin + "/recharges", undefined, operator)).data.orders;
  assert.equal(review.state, "review");
  assert.equal(review.issue, "partial-refund");
});
