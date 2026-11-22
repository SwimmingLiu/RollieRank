import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createToolCreditStore } from "../server/tool-credits-store.mjs";
import { createWechatModeration } from "../server/wechat-moderation.mjs";
import { createWalletTestServer } from "./support/tool-credits-server.mjs";
import { startWalletPostgres } from "./support/wallet-postgres.mjs";

const root = "/api/tool-credits";
const admin = "/admin/api/tool-credits";
const appKey = ["fixture", "offer", "key"].join("-");
const sessionKey = ["fixture", "wechat", "session"].join("-");
const callbackToken = ["fixture", "push", "token"].join("-");
const products = [{ productId: "sheet_once", tool: "answer-sheet", title: "扫描一次", cents: 300 }];
const auth = (token) => ({ Authorization: "Bearer " + token });
const hmac = (key, text) => createHmac("sha256", key).update(text).digest("hex");

function deferred() {
  let resolve;
  const promise = new Promise(callback => { resolve = callback; });
  return { promise, resolve };
}

let postgres;
test.before(async () => { postgres = await startWalletPostgres(); });
test.after(() => postgres?.close());

async function fixture(t, { allowIos = false } = {}) {
  const appTrades = new Map();
  const refundTrades = new Map();
  const delivery = [];
  const refundRequests = [];
  const faults = { refundCode: 0, deliveryGate: null, refundGate: null, loseRefundResponse: false };
  const moderation = createWechatModeration({ env: { ROLLIERANK_WECHAT_MSG_TOKEN: callbackToken } });
  const server = await createWalletTestServer({
    postgres, moderation,
    env: {
      ROLLIERANK_WXPAY_OFFER_ID: "12345", ROLLIERANK_WXPAY_APP_KEY: appKey,
      ROLLIERANK_WXPAY_GOODS: JSON.stringify(products.map(product => ({ ...product, ios: allowIos }))),
    },
    fetchImpl: async (url, options = {}) => {
      switch (url.pathname) {
        case "/sns/jscode2session": {
          const code = url.searchParams.get("js_code");
          return Response.json({ openid: code.includes("different") ? "wechat-second" : "wechat-first", session_key: sessionKey });
        }
        case "/cgi-bin/stable_token":
          return Response.json({ access_token: "fixture-local-access", expires_in: 7200 });
      }
      assert.equal(url.searchParams.get("access_token"), "fixture-local-access");
      const body = JSON.parse(options.body);
      if (url.pathname === "/xpay/notify_provide_goods") {
        assert.equal(url.searchParams.has("pay_sig"), false);
        assert.equal(body.env, 0);
        delivery.push(body.order_id);
        if (faults.deliveryGate) {
          faults.deliveryGate.started.resolve();
          await faults.deliveryGate.finish.promise;
        }
        appTrades.get(body.order_id).status = 4;
        return new Response(null, { status: 200 });
      }
      assert.equal(url.searchParams.get("pay_sig"), hmac(appKey, url.pathname + "&" + options.body));
      assert.equal(body.env, 0);
      if (url.pathname === "/xpay/query_order") {
        const order = appTrades.get(body.order_id) ?? refundTrades.get(body.order_id);
        return Response.json(order ? { errcode: 0, order } : { errcode: 268490002 });
      }
      assert.equal(url.pathname, "/xpay/refund_order");
      assert.equal(body.left_fee, 300);
      assert.equal(body.refund_fee, 300);
      assert.equal(body.req_from, "1");
      refundRequests.push(body);
      if (faults.refundGate) {
        faults.refundGate.started.resolve();
        await faults.refundGate.finish.promise;
      }
      if (faults.refundCode) return Response.json({ errcode: faults.refundCode });
      refundTrades.set(body.refund_order_id, {
        order_id: body.refund_order_id, order_type: 1, status: 5, refund_fee: 300,
      });
      if (faults.loseRefundResponse) throw new Error("simulated connection loss after acceptance");
      return Response.json({ errcode: 0, refund_order_id: body.refund_order_id, pay_order_id: body.order_id });
    },
  });
  t.after(() => server.close());
  const password = ["Test", "Wallet", "42!"].join("-");
  const setup = await server.json("/admin/api/setup", { username: "payment-operator", password, confirmPassword: password });
  assert.equal(setup.status, 200);
  const operator = { Cookie: setup.headers.get("set-cookie").split(";")[0] };
  const login = async (code = "login-first") => {
    const session = await server.json(root + "/login", { code, visitorId: randomUUID() });
    assert.equal(session.status, 200);
    return session.data;
  };
  const owner = await login();
  const checkout = (overrides = {}, token = owner.token) => server.json(root + "/purchases", {
    productId: products[0].productId, requestId: randomUUID(), code: "pay-first", platform: "android", quotedCents: 300, ...overrides,
  }, auth(token));
  const confirm = (id, token = owner.token) => server.json(`${root}/purchases/${id}/confirm`, {}, auth(token));
  const setPayment = async (directPurchase = true) => {
    const result = await server.json(admin + "/rules", { purchase: { directPurchase } }, operator);
    assert.equal(result.status, 200, JSON.stringify(result.data));
  };
  function paid(id, trade = {}) {
    appTrades.set(id, {
      order_id: id, order_type: 0, status: 2, order_fee: 300, paid_fee: 300, left_fee: 300,
      wx_order_id: "wx-" + id, ...trade,
    });
  }
  return { server, operator, owner, checkout, confirm, login, setPayment, paid, delivery, refundTrades, refundRequests, appTrades, faults };
}

test("个人主体直购使用官方双签名，售价和付款账号由服务器校验", async (t) => {
  const { server, owner, checkout, setPayment } = await fixture(t);
  assert.equal((await server.json(root + "/capabilities")).data.purchase.directPurchase, false);
  assert.equal((await checkout()).status, 403);
  await setPayment();
  const capabilities = (await server.json(root + "/capabilities")).data.purchase;
  assert.equal(capabilities.directPurchase, true);
  assert.equal(capabilities.tokenRecharge, false);
  assert.deepEqual(capabilities.products, [{ ...products[0], ios: false }]);
  assert.equal((await checkout({ platform: "ios" })).status, 403);
  assert.equal((await checkout({ quotedCents: 1 })).status, 409);
  assert.equal((await checkout({ code: "pay-different" })).status, 403);
  assert.equal((await server.json(root + "/purchases", undefined, auth(owner.token))).data.orders.length, 0);

  const requestId = randomUUID();
  const first = await checkout({ requestId });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const { payData, order } = first.data;
  assert.equal(order.state, "pending");
  assert.equal(order.entitlement, null);
  assert.match(order.id, /^RR[a-f0-9]{30}$/);
  assert.deepEqual(JSON.parse(payData.signData), {
    offerId: "12345", buyQuantity: 1, env: 0, currencyType: "CNY",
    productId: "sheet_once", goodsPrice: 300, outTradeNo: order.id, attach: order.id,
  });
  assert.equal(payData.mode, "short_series_goods");
  assert.equal(payData.paySig, hmac(appKey, "requestVirtualPayment&" + payData.signData));
  assert.equal(payData.signature, hmac(sessionKey, payData.signData));
  assert.equal(JSON.stringify(first.data).includes(sessionKey), false);
  assert.equal(JSON.stringify(first.data).includes("wechat-first"), false);
  const retry = await checkout({ requestId });
  assert.deepEqual(retry.data.payData, payData);
  assert.equal(retry.data.order.id, order.id);
});

test("微信查单和签名推送只发一次工具使用权，交付失败可释放", async (t) => {
  const { server, operator, owner, checkout, confirm, login, setPayment, paid, delivery } = await fixture(t);
  await setPayment();
  const { order } = (await checkout()).data;
  const store = createToolCreditStore({ database: server.database });
  const key = { accountId: owner.accountId, tool: "answer-sheet", operationId: "delivery-first" };
  const funding = { paymentOrderId: order.id };
  const other = await login("login-different");
  assert.equal((await confirm(order.id, other.token)).status, 404);
  await assert.rejects(() => store.reserve(key, funding), { statusCode: 409 });
  paid(order.id, { paid_fee: 1 });
  assert.equal((await confirm(order.id)).status, 502);
  await assert.rejects(() => store.reserve(key, funding), { statusCode: 409 });

  paid(order.id);
  const event = `<xml><Event><![CDATA[xpay_goods_deliver_notify]]></Event><OpenId>wechat-first</OpenId><OutTradeNo>${order.id}</OutTradeNo></xml>`;
  const sendPush = (signature) => fetch(server.origin + "/api/wechat/sec-callback?timestamp=123&nonce=xyz&signature=" + signature, {
    method: "POST", headers: { "Content-Type": "application/xml" }, body: event,
  });
  const bad = await sendPush("forged");
  assert.equal(bad.status, 403);
  await bad.body.cancel();
  const signature = createHash("sha1").update([callbackToken, "123", "xyz"].sort().join("")).digest("hex");
  const push = await sendPush(signature);
  assert.equal(push.status, 200);
  assert.match(await push.text(), /<ErrCode>0<\/ErrCode>/);
  const repeats = await Promise.all([confirm(order.id), confirm(order.id), confirm(order.id)]);
  assert.ok(repeats.every(result => result.status === 200 && result.data.order.entitlement === "available"));
  assert.deepEqual(delivery, [order.id]);

  const otherOrder = (await checkout()).data.order;
  paid(otherOrder.id, { wx_order_id: "wx-" + order.id });
  assert.equal((await confirm(otherOrder.id)).status, 502);
  await assert.rejects(() => store.reserve({ ...key, tool: "another-tool" }, funding), { statusCode: 404 });
  const contenders = [key, { ...key, operationId: "delivery-second" }];
  const reservations = await Promise.allSettled(contenders.map(candidate => store.reserve(candidate, funding)));
  assert.equal(reservations.filter(result => result.status === "fulfilled").length, 1);
  const held = contenders[reservations.findIndex(result => result.status === "fulfilled")];
  const retryKey = { ...key, operationId: "delivery-retry" };
  assert.equal((await store.release(held)).state, "released");
  assert.equal((await store.reserve(retryKey, funding)).cost, 0);
  assert.equal((await store.settle(retryKey, "answer-result")).state, "settled");
  await assert.rejects(() => store.reserve({ ...retryKey, operationId: "repeat-used" }, funding), { statusCode: 409 });
  const after = (await server.json(root + "/purchases/" + order.id, undefined, auth(owner.token))).data;
  assert.equal(after.order.entitlement, "used");
  const wallet = (await server.json(root + "/wallet", undefined, auth(owner.token))).data;
  assert.equal(wallet.balance, 3);
  assert.deepEqual(wallet.records.map(entry => entry.source), ["welcome"]);
  const refund = await server.json(`${admin}/purchases/${order.id}/refund`, { requestId: randomUUID(), reason: "0" }, operator);
  assert.equal(refund.status, 409);
});

test("微信退款受理期间锁住使用权，查到原路退回后才完成", async (t) => {
  const { server, operator, owner, checkout, confirm, setPayment, paid, refundTrades, refundRequests, appTrades } = await fixture(t, { allowIos: true });
  await setPayment();
  const store = createToolCreditStore({ database: server.database });
  async function purchase(trade, platform = "android") {
    const { order } = (await checkout({ platform })).data;
    paid(order.id, trade);
    assert.equal((await confirm(order.id)).data.order.state, "paid");
    return order;
  }
  const order = await purchase();
  const key = { accountId: owner.accountId, tool: order.tool, operationId: "refund-scan" };
  const funding = { paymentOrderId: order.id };
  const path = `${admin}/purchases/${order.id}/refund`;
  const request = { requestId: randomUUID(), reason: "3" };
  const initiated = await server.json(path, request, operator);
  assert.equal(initiated.status, 200, JSON.stringify(initiated.data));
  assert.equal(initiated.data.order.state, "refunding");
  assert.equal(refundRequests.length, 1);
  assert.equal((await server.json(path, request, operator)).data.refundId, initiated.data.refundId);
  assert.equal(refundRequests.length, 1);
  await assert.rejects(() => store.reserve(key, funding), { statusCode: 409 });
  assert.equal((await confirm(order.id)).data.order.state, "refunding");
  refundTrades.get(initiated.data.refundId).status = 8;
  assert.equal((await confirm(order.id)).data.order.state, "refunded");
  await assert.rejects(() => store.reserve(key, funding), { statusCode: 409 });

  const recoverable = await purchase();
  const failed = await server.json(`${admin}/purchases/${recoverable.id}/refund`, { requestId: randomUUID(), reason: "1" }, operator);
  assert.equal(failed.status, 200);
  refundTrades.get(failed.data.refundId).status = 7;
  assert.equal((await confirm(recoverable.id)).data.order.entitlement, "available");

  const ios = await purchase({ order_type: 7 }, "ios");
  const iosRefund = await server.json(`${admin}/purchases/${ios.id}/refund`, { requestId: randomUUID(), reason: "1" }, operator);
  assert.equal(iosRefund.status, 409);
  appTrades.get(ios.id).left_fee = 0;
  assert.equal((await confirm(ios.id)).data.order.state, "review");

  const mismatched = (await checkout({ platform: "android" })).data.order;
  paid(mismatched.id, { order_type: 7 });
  const checkedMismatch = (await confirm(mismatched.id)).data.order;
  assert.equal(checkedMismatch.state, "review");
  assert.equal(checkedMismatch.entitlement, null);
});

test("并发确认只发送一次发货和退款请求，明确拒绝或丢回包按微信实单恢复", async (t) => {
  const { server, operator, checkout, confirm, setPayment, paid, delivery, faults, refundTrades, refundRequests } = await fixture(t);
  await setPayment();
  const order = (await checkout()).data.order;
  paid(order.id);
  const deliveryGate = { started: deferred(), finish: deferred() };
  faults.deliveryGate = deliveryGate;
  const firstConfirmation = confirm(order.id);
  try {
    await Promise.race([
      deliveryGate.started.promise,
      firstConfirmation.then(() => assert.fail("没有触发微信发货确认")),
    ]);
    assert.equal((await confirm(order.id)).data.order.entitlement, "available");
    assert.deepEqual(delivery, [order.id]);
  } finally {
    deliveryGate.finish.resolve();
  }
  assert.equal((await firstConfirmation).status, 200);
  faults.deliveryGate = null;

  const refundGate = { started: deferred(), finish: deferred() };
  faults.refundGate = refundGate;
  faults.refundCode = 268490013;
  const refundPath = `${admin}/purchases/${order.id}/refund`;
  const refundRequest = { requestId: randomUUID(), reason: "1" };
  const firstRefund = server.json(refundPath, refundRequest, operator);
  try {
    await Promise.race([
      refundGate.started.promise,
      firstRefund.then(() => assert.fail("没有触发微信退款请求")),
    ]);
    assert.equal((await server.json(refundPath, refundRequest, operator)).data.order.state, "refunding");
    assert.equal(refundRequests.length, 1);
  } finally {
    refundGate.finish.resolve();
  }
  assert.equal((await firstRefund).data.order.entitlement, "available");
  faults.refundGate = null;
  faults.refundCode = 0;
  faults.loseRefundResponse = true;
  const lost = await server.json(refundPath, { requestId: randomUUID(), reason: "1" }, operator);
  assert.equal(lost.data.order.state, "refunding");
  assert.equal(refundRequests.length, 2);
  refundTrades.get(lost.data.refundId).status = 8;
  assert.equal((await confirm(order.id)).data.order.state, "refunded");
  assert.equal(refundRequests.length, 2);
});
