import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createWalletTestServer } from "./support/tool-credits-server.mjs";
import { startWalletPostgres } from "./support/wallet-postgres.mjs";

const requireMp = createRequire(new URL("../mini-program/package.json", import.meta.url));
const root = "/api/tool-credits/recharges";
let postgres;
test.before(async () => { postgres = await startWalletPostgres(); });
test.after(() => postgres?.close());

async function fixture(t) {
  const scenario = { device: "android", model: "", cashier: "paid", loseCreate: false, loseConfirm: false,
    wrongEnv: false, staleDebit: false, holdCashier: false, holdCreate: false, loseConfirmResult: false };
  const trades = new Map();
  const requests = [];
  const checkouts = [];
  const toasts = [];
  const modals = [];
  const saved = new Map();
  let loginCount = 0;
  let resumeCreate;
  let readyToRelease;
  const createReached = new Promise(resolve => { readyToRelease = resolve; });
  let readyCashier;
  const cashierReached = new Promise(resolve => { readyCashier = resolve; });
  const server = await createWalletTestServer({
    postgres,
    env: { ROLLIERANK_WXPAY_OFFER_ID: "12345", ROLLIERANK_WXPAY_SANDBOX_APP_KEY: "local-sandbox-fixture",
      ROLLIERANK_WXPAY_COIN_ENV: "1" },
    fetchImpl: async (url, options) => {
      if (url.pathname === "/sns/jscode2session") return Response.json({ openid: "wx-local-owner", session_key: "local-fixture-session" });
      if (url.pathname === "/cgi-bin/stable_token") return Response.json({ access_token: "local-access", expires_in: 7200 });
      const body = JSON.parse(options.body);
      if (url.pathname === "/xpay/query_order") {
        const order = trades.get(body.order_id);
        return Response.json(order ? { errcode: 0, order } : { errcode: 268490002 });
      }
      assert.equal(url.pathname, "/xpay/currency_pay");
      if (scenario.staleDebit) {
        scenario.staleDebit = false;
        return Response.json({ errcode: 268490009 });
      }
      return Response.json({ errcode: 0, order_id: body.order_id });
    },
  });
  t.after(() => server.close());
  const password = ["Local", "Wallet", "42!"].join("-");
  const setup = await server.json("/admin/api/setup", { username: "local-operator", password, confirmPassword: password });
  assert.equal(setup.status, 200);
  const cookie = setup.headers.get("set-cookie").split(";")[0];
  assert.equal((await server.json("/admin/api/tool-credits/rules", { purchase: { tokenRecharge: true } }, { Cookie: cookie })).status, 200);

  const originalWx = globalThis.wx;
  const originalPage = globalThis.Page;
  let finishCashier;
  globalThis.wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "develop" } }),
    getDeviceInfo: () => ({ platform: scenario.device, model: scenario.model }),
    getStorageSync: key => saved.get(key),
    setStorageSync: (key, value) => saved.set(key, structuredClone(value)),
    removeStorageSync: key => saved.delete(key),
    login: ({ success }) => success({ code: "local-wx-code-" + ++loginCount }),
    showToast: payload => toasts.push(payload.title),
    showModal: payload => modals.push(payload),
    requestVirtualPayment(options) {
      assert.equal(options.mode, "short_series_coin");
      const input = JSON.parse(options.signData);
      assert.equal(input.env, 1);
      assert.match(input.outTradeNo, /^RC[a-f0-9]{30}$/);
      assert.match(options.paySig, /^[a-f0-9]{64}$/);
      assert.match(options.signature, /^[a-f0-9]{64}$/);
      checkouts.push(input);
      finishCashier = (notify = true) => {
        if (scenario.cashier === "paid") {
          const cents = input.buyQuantity * 100;
          trades.set(input.outTradeNo, { order_id: input.outTradeNo, env_type: 2, status: 4, order_type: 0,
            order_fee: cents, paid_fee: cents, left_fee: cents, wx_order_id: "wx-" + input.outTradeNo, update_time: 10 });
          if (notify) options.success();
        } else if (notify) {
          options.fail({ errCode: -2 });
        }
        if (notify) options.complete();
      };
      readyCashier();
      if (!scenario.holdCashier) finishCashier();
    },
    async request({ url, method, data, header, success, fail }) {
      const { pathname, search } = new URL(url);
      if (pathname.startsWith(root) && method === "POST") requests.push({ pathname, data });
      if (pathname.endsWith("/confirm") && scenario.loseConfirm) {
        scenario.loseConfirm = false;
        fail({ errMsg: "request:fail timeout" });
        return;
      }
      try {
        const response = await fetch(server.origin + pathname + search, {
          method, headers: header, body: method === "POST" ? JSON.stringify(data) : undefined,
        });
        const payload = await response.json();
        if (pathname === root && method === "POST" && scenario.loseCreate) {
          scenario.loseCreate = false;
          fail({ errMsg: "request:fail timeout" });
          return;
        }
        if (pathname === root && method === "POST" && scenario.holdCreate) {
          scenario.holdCreate = false;
          await new Promise(resolve => { resumeCreate = resolve; readyToRelease(); });
        }
        if (pathname.endsWith("/confirm") && scenario.loseConfirmResult) {
          scenario.loseConfirmResult = false;
          fail({ errMsg: "request:fail timeout" });
          return;
        }
        if (pathname === root && method === "POST" && scenario.wrongEnv) {
          payload.payData.signData = JSON.stringify({ ...JSON.parse(payload.payData.signData), env: 0 });
        }
        success({ statusCode: response.status, header: Object.fromEntries(response.headers), data: payload });
      } catch (error) {
        fail(error);
      }
    },
  };
  t.after(() => {
    if (originalWx === undefined) delete globalThis.wx;
    else globalThis.wx = originalWx;
    if (originalPage === undefined) delete globalThis.Page;
    else globalThis.Page = originalPage;
  });
  for (const file of ["./config.js", "./utils/storage.js", "./services/api.js", "./services/tool-credits.js"]) {
    delete requireMp.cache[requireMp.resolve(file)];
  }
  let definition;
  globalThis.Page = config => { definition = config; };
  const path = requireMp.resolve("./pages/credits/credits.js");
  delete requireMp.cache[path];
  requireMp(path);
  function openPage() {
    const page = { ...definition, data: structuredClone(definition.data), setData: values => Object.assign(page.data, values) };
    page.onLoad();
    return page;
  }
  const page = openPage();
  await page.onShow();
  await page.onLogin();
  assert.equal(page.data.balance, 3);
  assert.equal(page.data.packages[page.data.selectedPackIndex].credits, 1);
  const storage = requireMp("./utils/storage.js");
  return { scenario, page, openPage, requests, checkouts, toasts, modals, cashierReached, createReached,
    finishCashier: notify => finishCashier(notify), releaseCreate: () => resumeCreate(),
    forgetOrder: () => storage.setToolCreditRecharge(storage.toolCreditAccountId(), null) };
}

test("iPhone 和 iPhone 模拟器显示 Apple IAP 说明，通用模拟器可查看预览步骤", async t => {
  const { scenario, page, requests, checkouts, modals } = await fixture(t);
  for (const [device, model, guide] of [["devtools", "", "preview"], ["devtools", "iPhone 17", "ios"], ["ios", "iPhone 17", "ios"]]) {
    Object.assign(scenario, { device, model });
    await page.onShow();
    assert.equal(page.data.rechargeTestGuide, guide);
    await page.submitRecharge();
    assert.match(modals.at(-1).content, guide === "ios" ? /Apple IAP.*现网/ : /「预览」.*扫码/);
    assert.doesNotMatch(modals.at(-1).content, /安卓/);
  }
  assert.equal(modals.length, 3);
  assert.deepEqual(requests, []);
  assert.deepEqual(checkouts, []);
});

test("原生页面双点只调起一次微信收银台，查单确认后余额和明细一起刷新", { timeout: 8000 }, async t => {
  const { scenario, page, requests, checkouts, toasts, finishCashier, cashierReached } = await fixture(t);
  scenario.holdCashier = true;
  const payment = page.submitRecharge();
  await page.submitRecharge();
  await cashierReached;
  assert.equal(checkouts.length, 1);
  assert.match(page.data.rechargeAction, /等待微信支付/);
  assert.equal(page.data.balance, 3);
  finishCashier();
  await payment;
  assert.equal(requests.filter(item => item.pathname === root).length, 1);
  assert.equal(page.data.balance, 4);
  page.openLedger();
  assert.equal(page.data.sheet, "ledger");
  assert.deepEqual(page.data.records.map(item => [item.title, item.amount]), [["微信充值", 1], ["首次登录赠送", 3]]);
  assert.equal(toasts.at(-1), "已到账 1 颗");
});

test("下单期间退出再进入，只有仍在当前页面的请求能打开收银台", { timeout: 8000 }, async t => {
  const { scenario, page, openPage, requests, checkouts, createReached, releaseCreate } = await fixture(t);
  scenario.holdCreate = true;
  const leaving = page.submitRecharge();
  await createReached;
  page.onUnload();
  const reopened = openPage();
  await reopened.onShow();
  await reopened.submitRecharge();
  assert.equal(requests.filter(item => item.pathname === root).length, 1);
  releaseCreate();
  await leaving;
  assert.equal(checkouts.length, 0);
  await reopened.submitRecharge();
  const attempts = requests.filter(item => item.pathname === root);
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].data.requestId, attempts[1].data.requestId);
  assert.equal(checkouts.length, 1);
  assert.equal(reopened.data.balance, 4);
});

test("下单回包丢失复用请求编号，微信取消后可重新选择", async t => {
  const { scenario, page, requests, checkouts } = await fixture(t);
  scenario.loseCreate = true;
  scenario.cashier = "cancelled";
  await page.submitRecharge();
  assert.match(page.data.rechargeMessage, /超时/);
  assert.equal(checkouts.length, 0);
  await page.submitRecharge();
  const creations = requests.filter(item => item.pathname === root);
  assert.equal(creations.length, 2);
  assert.equal(creations[0].data.requestId, creations[1].data.requestId);
  assert.notEqual(creations[0].data.code, creations[1].data.code);
  assert.equal(checkouts.length, 1);
  assert.equal(page.data.rechargeOrder, null);
  assert.equal(page.data.rechargeMessage, "支付已取消。");
  assert.equal(page.data.balance, 3);
});

test("收银台后断网，回到原生页会按原订单恢复到账并更新过期会话签名", async t => {
  const { scenario, page, openPage, requests, checkouts } = await fixture(t);
  scenario.loseConfirm = true;
  scenario.staleDebit = true;
  await page.submitRecharge();
  assert.equal(page.data.balance, 3);
  const orderId = page.data.rechargeOrder.orderId;
  assert.match(page.data.rechargeMessage, /查询到账/);
  const reopened = openPage();
  await reopened.onShow();
  assert.equal(reopened.data.balance, 4);
  assert.equal(reopened.data.rechargeOrder, null);
  assert.equal(checkouts.length, 1);
  assert.equal(requests.filter(item => item.pathname === root).length, 1);
  const checks = requests.filter(item => item.pathname === `${root}/${orderId}/confirm`);
  assert.ok(checks.some(item => typeof item.data.code === "string"));
});

test("微信没有回调时返回页面查原单，到账前的重试不会发起第二笔付款", { timeout: 8000 }, async t => {
  const { scenario, page, cashierReached, finishCashier, requests, checkouts } = await fixture(t);
  scenario.holdCashier = true;
  const payment = page.submitRecharge();
  await cashierReached;
  await page.onShow();
  await payment;
  await page.submitRecharge();
  assert.match(page.data.rechargeMessage, /正在确认/);
  assert.equal(page.data.balance, 3);
  finishCashier(false);
  await page.submitRecharge();
  assert.equal(page.data.balance, 4);
  assert.equal(checkouts.length, 1);
  assert.equal(requests.filter(item => item.pathname === root).length, 1);
});

test("本机没有旧订单时从服务端找回已付款订单，换码完成到账", async t => {
  const { scenario, page, openPage, forgetOrder, requests, checkouts } = await fixture(t);
  scenario.staleDebit = true;
  scenario.loseConfirmResult = true;
  await page.submitRecharge();
  assert.equal(page.data.balance, 3);
  const id = page.data.rechargeOrder.orderId;
  forgetOrder();
  const reopened = openPage();
  await reopened.onShow();
  assert.equal(reopened.data.balance, 4);
  assert.equal(checkouts.length, 1);
  assert.ok(requests.some(item => item.pathname === `${root}/${id}/confirm` && item.data.code));
});

test("测试包拒绝传入现网收银台参数", async t => {
  const { scenario, page, checkouts } = await fixture(t);
  scenario.wrongEnv = true;
  await page.submitRecharge();
  assert.equal(checkouts.length, 0);
  assert.match(page.data.rechargeMessage, /校验失败/);
  assert.equal(page.data.balance, 3);
});

test("正式版 iPhone 使用已开放的 Apple 支付渠道和现网签名", async t => {
  const originalWx = globalThis.wx;
  let opened = 0;
  globalThis.wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "release" } }),
    getDeviceInfo: () => ({ platform: "ios", model: "iPhone 17" }),
    requestVirtualPayment({ signData, success }) {
      assert.equal(JSON.parse(signData).env, 0);
      opened += 1;
      success();
    },
  };
  t.after(() => {
    if (originalWx === undefined) delete globalThis.wx;
    else globalThis.wx = originalWx;
  });
  for (const file of ["./config.js", "./utils/storage.js", "./services/api.js", "./services/tool-credits.js"]) {
    delete requireMp.cache[requireMp.resolve(file)];
  }
  const credits = requireMp("./services/tool-credits.js");
  assert.match(credits.rechargeDevice({ tokenRechargeIos: false }).message, /iOS/);
  assert.equal(credits.rechargeDevice({ tokenRechargeIos: true }).platform, "ios");
  const order = { id: `RC${"0".repeat(30)}`, credits: 1 };
  const result = await credits.payRecharge({ mode: "short_series_coin", signData: JSON.stringify({
    outTradeNo: order.id, buyQuantity: 1, env: 0, currencyType: "CNY",
  }), paySig: "fixture-pay-sign", signature: "fixture-session-sign" }, order);
  assert.equal(result, "paid");
  assert.equal(opened, 1);
});
