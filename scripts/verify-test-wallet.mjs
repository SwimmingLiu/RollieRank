import assert from "node:assert/strict";

const [base, ...flags] = process.argv.slice(2);
const url = URL.canParse(base || "") ? new URL(base) : null;
const loopback = url?.protocol === "http:" && url.hostname === "127.0.0.1";
const publicTest = url?.origin === "https://rollie-rank-test.swimmingliu.cn";

if ((!loopback && !publicTest) || url.href !== url.origin + "/" ||
    flags.some(flag => !["--login-ready", "--recharge-ready"].includes(flag))) {
  throw new Error("请指定回环或 RollieRank HTTPS 测试服务，可加 --login-ready 或 --recharge-ready 核对准备情况。");
}

function read(path) {
  return fetch(new URL(path, url), { redirect: "error", signal: AbortSignal.timeout(8_000) });
}

async function walletJson(path, status) {
  const response = await read(path);
  assert.equal(response.headers.get("x-rollierank-environment"), "test", path + " 缺少测试环境标识");
  assert.equal(response.status, status, path + " HTTP 状态有误");
  assert.match(response.headers.get("content-type") || "", /^application\/json\b/, path + " 未返回 JSON");
  return response.json();
}

const capability = await walletJson("/api/tool-credits/capabilities", 200);
assert.equal(typeof capability.login, "boolean");
const unauthenticated = await walletJson("/api/tool-credits/wallet", 401);
assert.equal(unauthenticated.errorId, "login");
const rechargeUnauthenticated = await walletJson("/api/tool-credits/recharges", 401);
assert.equal(rechargeUnauthenticated.errorId, "login");

const recharge = capability.purchase?.tokenRecharge;
assert.equal(typeof recharge, "boolean");
assert.ok(Array.isArray(capability.purchase.packages) && capability.purchase.packages.every(({ credits, cents }) =>
  Number.isInteger(credits) && credits > 0 && cents === credits * 100), "卷豆充值档位必须为 1 元 1 颗");
if (flags.includes("--recharge-ready")) {
  assert.equal(recharge, true, "卷豆沙箱充值尚未开启");
  assert.equal(capability.purchase.tokenRechargeIos, false, "微信沙箱只接受非 Apple 支付");
  const order = await walletJson("/api/tool-credits/recharges/RC" + "0".repeat(30), 401);
  assert.equal(order.errorId, "login");
}

let scanCost;
if (flags.includes("--login-ready")) {
  assert.equal(capability.login, true, "卷豆微信登录尚未配置");
  const quote = await walletJson("/api/tool-credits/quote?tool=answer-sheet", 200);
  assert.equal(quote.tool, "answer-sheet");
  assert.ok(typeof quote.cost === "number" && Number.isFinite(quote.cost) && quote.cost > 0 && Number(quote.cost.toFixed(1)) === quote.cost, "卷豆报价无效");
  scanCost = quote.cost;
}

if (publicTest) {
  const website = await read("/ios-v3/app.html");
  assert.equal(website.status, 401, "网页测试站仍需口令");
  assert.match(website.headers.get("www-authenticate") || "", /^Basic\b/i);
  await website.body?.cancel();
}

console.log(JSON.stringify({ environment: "test", login: capability.login, recharge, walletAuth: true, webAuth: publicTest, scanCost }));
