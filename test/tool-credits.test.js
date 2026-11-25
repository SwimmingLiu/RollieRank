import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createToolCreditStore } from "../server/tool-credits-store.mjs";
import { createWalletDatabase, migrateWalletDatabase } from "../server/tool-credits-postgres.mjs";
import { firstReleaseWalletCounts } from "../deploy/check-first-release.mjs";
import { createWalletTestServer } from "./support/tool-credits-server.mjs";
import { startWalletPostgres } from "./support/wallet-postgres.mjs";

const execFileAsync = promisify(execFile);
const adminRoutes = "/admin/api/";
const walletRoutes = "/api/tool-credits/";
const auth = (session) => ({ Authorization: "Bearer " + session.token });
let postgres;
test.before(async () => { postgres = await startWalletPostgres(); });
test.after(() => postgres?.close());

async function serverFor(t, options) {
  const server = await createWalletTestServer({ postgres, ...options });
  t.after(() => server.close());
  return server;
}

test("卷豆迁移接入现有 PostgreSQL schema，保留已有会话表及迁移记录", async (t) => {
  const env = { DATABASE_URL: postgres.url, DATABASE_SCHEMA: "public" };
  const database = createWalletDatabase({ env });
  t.after(() => database.close());
  await database.transaction(async (client) => {
    await client.query(`CREATE TABLE sessions (id text PRIMARY KEY);
      INSERT INTO sessions VALUES ('existing-application-session');
      CREATE TABLE schema_migrations (
        name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
      INSERT INTO schema_migrations (name, checksum) VALUES ('001_initial.sql', 'existing-checksum')`);
  });
  const migrationEnv = { ...process.env, ...env, MIGRATION_DATABASE_URL: postgres.url };
  const runs = await Promise.all(Array.from({ length: 2 }, () => execFileAsync(
    process.execPath, ["scripts/migrate-tool-credits.mjs"], { env: migrationEnv },
  )));
  const applied = runs.flatMap(run => JSON.parse(run.stdout).applied);
  assert.deepEqual(applied, ["wallet/001_initial.sql", "wallet/002_account_uid.sql", "wallet/003_wechat_tool_purchases.sql",
    "wallet/004_wechat_coin_recharges.sql", "wallet/005_wechat_coin_refund_polling.sql", "wallet/006_fractional_credits.sql"]);
  assert.deepEqual(await migrateWalletDatabase(database), []);
  await database.transaction(async (client) => {
    assert.equal((await client.query("SELECT id FROM sessions")).rows[0].id, "existing-application-session");
    assert.deepEqual((await client.query("SELECT name, checksum FROM schema_migrations")).rows, [
      { name: "001_initial.sql", checksum: "existing-checksum" },
    ]);
    assert.deepEqual((await client.query("SELECT name FROM wallet_schema_migrations ORDER BY name")).rows, [
      { name: "wallet/001_initial.sql" },
      { name: "wallet/002_account_uid.sql" },
      { name: "wallet/003_wechat_tool_purchases.sql" },
      { name: "wallet/004_wechat_coin_recharges.sql" },
      { name: "wallet/005_wechat_coin_refund_polling.sql" },
      { name: "wallet/006_fractional_credits.sql" },
    ]);
  }, { readOnly: true });
  assert.deepEqual(await firstReleaseWalletCounts(database), {
    walletAccounts: 0, walletEntries: 0, walletOperations: 0, walletInvites: 0, walletPaymentOrders: 0, walletPaymentRefunds: 0,
    walletCoinRecharges: 0,
  });
});

test("测试入口只使用独立 PostgreSQL 配置，缺库时保留免费业务", async (t) => {
  assert.equal(createWalletDatabase({ env: { DATABASE_URL: postgres.url }, testEnvironment: true }), null);
  assert.throws(() => createWalletDatabase({
    env: { DATABASE_URL: postgres.url, DATABASE_SCHEMA: "app_data", TEST_DATABASE_URL: postgres.url, TEST_DATABASE_SCHEMA: "app_data" },
    testEnvironment: true,
  }), /独立的测试 schema/);
  const server = await serverFor(t, { postgres: false, exchange: () => { throw new Error("库未配置时不换码"); } });
  assert.equal((await server.json(walletRoutes + "capabilities")).data.login, false);
  const unavailable = await server.json(walletRoutes + "login", { code: "wallet-test-disabled" });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.data.errorId, "wallet-unavailable");
  const { status, data } = await server.json("/api/catalog");
  assert.equal(status, 200);
  const version = data.versions[0];
  assert.equal((await server.json("/api/submit", {
    guestId: randomUUID(), attemptId: randomUUID(), versionId: version.id,
    answers: version.questions.map(() => "A"),
  })).status, 200);
});

async function login(server, openId, extra) {
  const result = await server.json(walletRoutes + "login", { visitorId: randomUUID(), code: "wallet-test-" + openId, ...extra });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data;
}

async function adminSession(server) {
  const password = ["Wallet-Test", "42", "Admin!"].join("-");
  const result = await server.json(adminRoutes + "setup", { username: "wallet-admin", password, confirmPassword: password });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return { Cookie: result.headers.get("set-cookie").split(";")[0] };
}

test("微信账号在新设备找回同一余额，老练习首次关联也只赠一份", async (t) => {
  const server = await serverFor(t);
  assert.equal((await server.json(walletRoutes + "wallet")).status, 401);
  assert.equal((await server.json(adminRoutes + "tool-credits")).status, 401);
  assert.equal((await server.json(walletRoutes + "login", { code: "unverified-code" })).status, 401);
  const [first, second] = await Promise.all([login(server, "same-user"), login(server, "same-user")]);
  assert.equal(first.accountId, second.accountId);
  assert.equal(Number(first.created) + Number(second.created), 1);
  assert.equal(first.balance, 3);
  const current = (await server.json(walletRoutes + "wallet", undefined, auth(second))).data;
  assert.deepEqual(current.records.map(row => [row.source, row.amount]), [["welcome", 3]]);
  assert.equal(current.nextBefore, null);
  assert.ok(!JSON.stringify(current).includes("same-user"));
  assert.equal((await server.json(walletRoutes + "logout", {}, auth(first))).status, 200);
  assert.equal((await server.json(walletRoutes + "wallet", undefined, auth(first))).status, 401);

  const admin = await adminSession(server);
  await server.json(adminRoutes + "tool-credits/rules", { welcome: { newAccount: 1, existingMember: 3 } }, admin);
  const guestId = randomUUID();
  const { data: { token } } = await server.json("/api/miniprogram-profile/session", {});
  await server.json("/api/miniprogram-profile/profile", { token, guestId, name: "老卷友" });
  const legacy = await login(server, "legacy", { visitorId: guestId, bindLegacy: true, profileToken: token });
  const restored = await login(server, "legacy");
  const newcomer = await login(server, "other");
  assert.equal(legacy.balance, 3);
  assert.equal(restored.balance, 3);
  assert.equal(restored.accountId, legacy.accountId);
  assert.equal(newcomer.balance, 1);
  assert.equal((await server.json(walletRoutes + "login", {
    visitorId: guestId, bindLegacy: true, profileToken: token, code: "wallet-test-other",
  })).status, 409);
  assert.deepEqual((await server.json("/api/points/me?guestId=" + guestId)).data.records, []);
  assert.deepEqual(await firstReleaseWalletCounts(server.database), {
    walletAccounts: 3, walletEntries: 3, walletOperations: 0, walletInvites: 0, walletPaymentOrders: 0, walletPaymentRefunds: 0,
    walletCoinRecharges: 0,
  });
});

test("登录在服务端以微信换码结果为准", async (t) => {
  const received = [];
  const sessionKeyFixture = ["local", "session", "fixture"].join("-");
  const server = await serverFor(t, {
    fetchImpl: async (url, options) => {
      received.push({ url, options });
      const code = url.searchParams.get("js_code");
      if (code === "unreachable") throw new Error("模拟微信网络异常");
      return Response.json(code === "invalid" ? { errcode: 40029 } : { openid: "official-open-id", session_key: sessionKeyFixture });
    },
  });
  const first = await server.json(walletRoutes + "login", { code: "wx-code-one", openid: "claimed-account-a" });
  const second = await server.json(walletRoutes + "login", { code: "wx-code-two", openid: "claimed-account-b" });
  assert.equal(first.status, 200);
  assert.equal(first.data.accountId, second.data.accountId);
  assert.ok(!JSON.stringify(first.data).includes("official-open-id"));
  assert.ok(!JSON.stringify(first.data).includes(sessionKeyFixture));
  assert.equal(received[0].url.origin + received[0].url.pathname, "https://api.weixin.qq.com/sns/jscode2session");
  assert.equal(received[0].url.searchParams.get("appid"), "wallet-test-app");
  assert.equal(received[0].url.searchParams.get("secret"), ["local", "app", "fixture"].join("-"));
  assert.equal(received[0].url.searchParams.get("js_code"), "wx-code-one");
  assert.equal(received[0].url.searchParams.get("grant_type"), "authorization_code");
  assert.ok(received[0].options.signal);
  assert.equal((await server.json(walletRoutes + "login", { code: "invalid" })).status, 401);
  assert.equal((await server.json(walletRoutes + "login", { code: "unreachable" })).status, 502);
});

test("两进程争用最后一颗卷豆，重试、释放、超时及结算各只生效一次", async (t) => {
  let now = Date.now();
  const server = await serverFor(t, { clock: () => now });
  const admin = await adminSession(server);
  await server.json(adminRoutes + "tool-credits/rules", { welcome: { newAccount: 1 }, costs: { "other-tool": 2, "third-tool": 1 } }, admin);
  const session = await login(server, "customer");
  const { accountId } = session;
  await server.database.transaction(async (client) => {
    assert.equal((await client.query("SHOW default_transaction_isolation")).rows[0].default_transaction_isolation, "repeatable read");
    assert.equal((await client.query("SHOW transaction_isolation")).rows[0].transaction_isolation, "read committed");
  });
  const moduleUrl = new URL("../server/tool-credits-store.mjs", import.meta.url).href;
  const databaseModule = new URL("../server/tool-credits-postgres.mjs", import.meta.url).href;
  const childScript = `
    import { createToolCreditStore } from ${JSON.stringify(moduleUrl)};
    import { createWalletDatabase } from ${JSON.stringify(databaseModule)};
    const key = process.argv[1];
    const database = createWalletDatabase({ testEnvironment: true });
    const store = createToolCreditStore({ database });
    try { console.log(JSON.stringify(await store.reserve(JSON.parse(key), { quotedCost: 1 }))); }
    catch (error) { console.log(JSON.stringify({ error: error.statusCode })); }
    finally { await database.close(); }
  `;
  const key = (operationId, tool = "third-tool") => ({ accountId, tool, operationId });
  const operations = [key("device-a"), key("device-b")];
  const notices = await Promise.all(operations.map(async (op) => {
    const { stdout } = await execFileAsync(process.execPath, [
      "--input-type=module", "-e", childScript, JSON.stringify(op),
    ], { env: { ...process.env, ...server.databaseEnv } });
    return JSON.parse(stdout);
  }));
  assert.equal(notices.filter(notice => notice.state === "reserved").length, 1);
  assert.equal(notices.filter(notice => notice.error === 402).length, 1);
  const store = createToolCreditStore({ database: server.database, clock: () => now });
  const prior = operations[notices.findIndex(notice => notice.state === "reserved")];
  const held = (await server.json(walletRoutes + "wallet", undefined, auth(session))).data;
  assert.deepEqual([held.balance, held.held, held.records.length], [0, 1, 1]);
  const manualWhileHeld = await server.json(adminRoutes + "tool-credits/adjust", {
    accountId, requestId: randomUUID(), amount: -1, reason: "核对占用余额",
  }, admin);
  assert.equal(manualWhileHeld.status, 402);
  assert.equal(manualWhileHeld.data.errorId, "balance");
  assert.equal((await store.reserve(prior, { quotedCost: 1 })).created, false);
  assert.equal((await store.release(prior)).state, "released");
  assert.equal((await store.release(prior)).state, "released");
  assert.equal((await store.settle(prior, "result:late")).state, "released");

  const expiring = key("expired-test");
  await store.reserve(expiring, { quotedCost: 1, holdMs: 1000 });
  now += 1001;
  assert.equal((await store.operation(expiring)).state, "expired");
  assert.equal((await store.wallet(accountId, 0)).balance, 1);
  assert.equal((await store.settle(expiring, "result:late")).state, "expired");

  const adjust = { accountId, amount: 2, reason: "验收补发", requestId: randomUUID() };
  assert.equal((await server.json(adminRoutes + "tool-credits/adjust", adjust, admin)).status, 200);
  assert.equal((await server.json(adminRoutes + "tool-credits/adjust", adjust, admin)).data.balance, 3);
  assert.equal((await server.json(adminRoutes + "tool-credits/adjust", { ...adjust, amount: 3 }, admin)).status, 409);
  const delivered = key("real-operation", "other-tool");
  await assert.rejects(() => store.reserve(delivered, { quotedCost: 1 }), { statusCode: 409 });
  assert.equal((await store.reserve(delivered, { quotedCost: 2 })).cost, 2);
  await server.json(adminRoutes + "tool-credits/rules", { costs: { "other-tool": 4 } }, admin);
  assert.equal(await store.quote("other-tool"), 4);
  assert.equal((await store.settle(delivered, "result:published")).cost, 2);
  assert.equal((await store.settle(delivered, "result:published")).state, "settled");
  assert.equal((await store.release(delivered)).state, "settled");
  await assert.rejects(() => store.settle(delivered, "result:different"), { statusCode: 409 });
  const later = key("another-operation");
  await store.reserve(later, { quotedCost: 1 });
  assert.equal((await store.settle(later, "result:published")).state, "settled");
  const wallet = await store.wallet(accountId, 0);
  assert.deepEqual(wallet.records.map(row => row.amount), [-1, -2, 2, 1]);
  assert.equal(wallet.balance, 0);
  const reopened = createWalletDatabase({ env: server.databaseEnv, testEnvironment: true });
  t.after(() => reopened.close());
  const secondPool = createToolCreditStore({ database: reopened });
  assert.equal((await secondPool.operation(delivered)).deliveryRef, "result:published");
});

test("购豆与广告关闭，邀请仅认可已获准渠道及首次有效使用", async (t) => {
  const off = await serverFor(t, { groupApproved: true });
  const offAdmin = await adminSession(off);
  const defaultRules = (await off.json(adminRoutes + "tool-credits", undefined, offAdmin)).data.rules;
  assert.equal(defaultRules.invite.enabled, false);
  assert.deepEqual(defaultRules.purchase, {
    directPurchase: false, tokenRecharge: false,
    packages: [1, 5, 10, 30, 60].map(credits => ({ credits, cents: credits * 100 })),
  });
  assert.deepEqual(defaultRules.ads, { enabled: false, reward: 1, dailyLimit: 2 });
  for (const patch of [{ purchase: { tokenRecharge: true } }, { purchase: { directPurchase: true } }, {
    ads: { enabled: true },
  }, { invite: { groups: true } }]) {
    assert.equal((await off.json(adminRoutes + "tool-credits/rules", patch, offAdmin)).status, 409);
  }

  let now = Date.now();
  const proofs = new Map();
  const server = await serverFor(t, {
    groupApproved: true,
    clock: () => now,
    verifyInviteVisit: async ({ code, scene, proof }) => {
      const stored = proofs.get(proof);
      return stored?.code === code && stored.scene === scene ? { openid: stored.openid, proofId: proof } : null;
    },
  });
  const admin = await adminSession(server);
  const inviter = await login(server, "first-inviter");
  const another = await login(server, "second-inviter");
  assert.equal((await server.json(walletRoutes + "invite/code", {}, auth(inviter))).status, 403);
  await server.json(adminRoutes + "tool-credits/rules", { invite: { enabled: true, groups: true, monthlyLimit: 1 } }, admin);
  const codeFor = async session => (await server.json(walletRoutes + "invite/code", {}, auth(session))).data.code;
  const first = await codeFor(inviter);
  const second = await codeFor(another);
  const visitorId = randomUUID();
  async function visit(code, guestId, scene, openid, proof = randomUUID()) {
    if (openid) proofs.set(proof, { code, scene, openid });
    return (await server.json(walletRoutes + "invite/visit", { code, visitorId: guestId, scene, proof })).data;
  }
  assert.equal((await visit(second, visitorId, 1007, "first-guest")).accepted, false);
  assert.equal((await visit(first, visitorId, 1008)).accepted, false);
  const { claim } = await visit(first, visitorId, 1008, "first-guest");
  assert.match(claim, /^[a-f0-9]{48}$/);
  assert.equal((await visit(second, visitorId, 1008, "first-guest")).claim, claim);
  const tried = await login(server, "another-wechat", { visitorId, inviteClaim: claim });
  const invited = await login(server, "first-guest", { visitorId, inviteClaim: claim });
  const store = createToolCreditStore({ database: server.database, clock: () => now });
  assert.equal(await store.pendingInvite(tried.accountId), false);
  assert.equal(await store.pendingInvite(invited.accountId), true);
  assert.equal((await store.wallet(inviter.accountId, 0)).balance, 3);
  await server.json(adminRoutes + "tool-credits/rules", { invite: { reward: 4 } }, admin);
  const version = (await server.json("/api/catalog")).data.versions[0];
  const submit = {
    guestId: visitorId, attemptId: randomUUID(), versionId: version.id,
    answers: version.questions.map(() => "A"),
  };
  assert.equal((await server.json("/api/submit", { ...submit, guestId: randomUUID() }, auth(invited))).status, 200);
  assert.equal((await store.wallet(inviter.accountId, 0)).balance, 3);
  assert.equal((await server.json("/api/submit", submit, auth(invited))).status, 200);
  assert.equal((await server.json("/api/submit", submit, auth(invited))).status, 200);
  assert.equal((await store.wallet(inviter.accountId, 0)).balance, 5);
  assert.equal((await store.wallet(another.accountId, 0)).balance, 3);
  assert.deepEqual((await store.wallet(inviter.accountId, 0)).records.map(row => [row.source, row.amount]), [["invite", 2], ["welcome", 3]]);

  const extraGuest = randomUUID();
  const extraClaim = (await visit(first, extraGuest, 1044, "next-guest")).claim;
  const extra = await login(server, "next-guest", { visitorId: extraGuest, inviteClaim: extraClaim });
  const use = { accountId: extra.accountId, tool: "answer-sheet", operationId: "eligible-test" };
  await store.reserve(use, { quotedCost: 0.1 });
  await assert.rejects(() => store.recordToolUse(use), { statusCode: 409 });
  await store.settle(use, "result:ready");
  await store.recordToolUse(use);
  await store.recordToolUse(use);
  assert.equal((await store.wallet(inviter.accountId, 0)).balance, 5);
  assert.equal((await store.wallet(extra.accountId, 0)).balance, 2.9);

  const selfGuest = randomUUID();
  assert.equal((await visit(first, selfGuest, 1008, "first-inviter")).accepted, false);
  await login(server, "first-inviter", { visitorId: selfGuest });
  assert.equal(await store.pendingInvite(inviter.accountId), false);

  const futureGuest = randomUUID();
  const oldProof = randomUUID();
  const obsolete = await visit(first, futureGuest, 1008, "future-guest", oldProof);
  now += 8 * 24 * 60 * 60 * 1000;
  assert.equal((await visit(first, futureGuest, 1008, null, oldProof)).accepted, false);
  const fresh = await visit(second, futureGuest, 1008, "future-guest");
  assert.notEqual(fresh.claim, obsolete.claim);
  const freshSession = await login(server, "future-guest", { visitorId: futureGuest, inviteClaim: fresh.claim });
  const freshUse = { accountId: freshSession.accountId, tool: "answer-sheet", operationId: "fresh-use" };
  await store.reserve(freshUse, { quotedCost: 0.1 });
  await store.settle(freshUse, "result:fresh");
  await store.recordToolUse(freshUse);
  assert.equal((await store.wallet(another.accountId, 0)).balance, 7);
});

test("运营接口配置工具价格、调整卷豆并保留内部审计", async (t) => {
  const server = await serverFor(t);
  const session = await login(server, "admin-target");
  const admin = await adminSession(server);
  const path = adminRoutes + "tool-credits";
  const patch = { costs: { "answer-sheet": 2, "photo-review": 3 } };
  assert.equal((await server.json(path + "/rules", patch, auth(session))).status, 401);
  assert.equal((await server.json(path + "/rules", patch, admin)).status, 200);
  assert.equal((await server.json(path + "/rules", { costs: { "photo-review": 0 } }, admin)).status, 400);
  const quote = await server.json(walletRoutes + "quote?tool=photo-review", undefined, auth(session));
  assert.deepEqual(quote.data, { tool: "photo-review", cost: 3 });
  assert.equal((await server.json(walletRoutes + "quote?tool=unknown", undefined, auth(session))).status, 404);
  const payload = { accountId: session.accountId, amount: 2, reason: "试用补发", requestId: randomUUID() };
  assert.equal((await server.json(path + "/adjust", payload, admin)).data.balance, 5);
  assert.equal((await server.json(path + "/adjust", { ...payload, amount: -6, requestId: randomUUID() }, admin)).status, 402);
  assert.equal((await server.json(path + "/adjust", { ...payload, amount: -1, reason: "回收", requestId: randomUUID() }, admin)).status, 200);
  const state = (await server.json(path + "?accountId=" + session.accountId, undefined, admin)).data;
  assert.equal(state.accounts[0].balance, 4);
  assert.equal(state.records.find(row => row.reason === "试用补发").operator, "wallet-admin");
  const wallet = (await server.json(walletRoutes + "wallet", undefined, auth(session))).data;
  assert.deepEqual(wallet.records.map(row => row.reason), ["人工扣回", "人工补发", "首次登录赠送"]);
});

test("未执行 002_account_uid 迁移时，卷豆登录、余额、明细与后台仍可用且不报 503", async (t) => {
  const { readFile } = await import("node:fs/promises");
  const schema = `wallet_no_uid_${randomUUID().slice(0, 8)}`;
  const database = createWalletDatabase({ env: { DATABASE_URL: postgres.url, DATABASE_SCHEMA: schema } });
  t.after(() => database.close());
  const initialSql = await readFile(new URL("../server/migrations/wallet/001_initial.sql", import.meta.url), "utf8");
  await database.transaction(async (client) => {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
    await client.query(initialSql);
  });

  const store = createToolCreditStore({ database, groupApproved: false });
  const loggedIn = await store.login({ wechatKey: "legacy-schema-user", visitorId: randomUUID() });
  assert.equal(loggedIn.balance, 3);
  assert.equal(loggedIn.uid, null);

  const wallet = await store.wallet(loggedIn.accountId, 0);
  assert.equal(wallet.balance, 3);
  assert.equal(wallet.uid, null);
  assert.equal(wallet.records.length, 1);

  const admin = await store.adminView("");
  assert.equal(admin.accounts.length, 1);
  assert.equal(admin.accounts[0].uid, null);
  assert.equal(admin.accounts[0].balance, 3);

  const adjusted = await store.adjust({
    accountId: loggedIn.accountId,
    amount: 2,
    reason: "兼容补发",
    requestId: randomUUID(),
    actor: "admin",
  });
  assert.equal(adjusted.balance, 5);
});

test("答题卡扫描默认消耗 0.1 颗，3 颗赠豆可精确扫描 30 次且支持 0.1 颗调账", async (t) => {
  const server = await serverFor(t);
  const admin = await adminSession(server);
  const session = await login(server, "fractional-scanner");
  const store = createToolCreditStore({ database: server.database });

  const quote = await server.json(walletRoutes + "quote?tool=answer-sheet", undefined, auth(session));
  assert.deepEqual(quote.data, { tool: "answer-sheet", cost: 0.1 });

  // Reject more than 1 decimal place in rules and manual adjustments.
  assert.equal((await server.json(adminRoutes + "tool-credits/rules", { costs: { "answer-sheet": 0.05 } }, admin)).status, 400);
  assert.equal((await server.json(adminRoutes + "tool-credits/adjust", {
    accountId: session.accountId, amount: 0.05, reason: "非法精度", requestId: randomUUID(),
  }, admin)).status, 400);

  // 30 consecutive 0.1-credit scans exhaust 3.0 credits with zero floating-point drift.
  for (let i = 1; i <= 30; i += 1) {
    const key = { accountId: session.accountId, tool: "answer-sheet", operationId: `scan-${i}` };
    const reserved = await store.reserve(key, { quotedCost: 0.1 });
    assert.equal(reserved.cost, 0.1);
    const settled = await store.settle(key, `scan-res-${i}`);
    assert.equal(settled.state, "settled");
    assert.equal(settled.cost, 0.1);
    const expectedBalance = Number(((30 - i) / 10).toFixed(1));
    assert.equal((await store.wallet(session.accountId, 0)).balance, expectedBalance);
  }
  await assert.rejects(
    () => store.reserve({ accountId: session.accountId, tool: "answer-sheet", operationId: "scan-31" }, { quotedCost: 0.1 }),
    { statusCode: 402, errorId: "balance" },
  );

  // Manual fractional adjustment (+0.3 then -0.1 -> 0.2)
  const add = await server.json(adminRoutes + "tool-credits/adjust", {
    accountId: session.accountId, amount: 0.3, reason: "补发三次扫描", requestId: randomUUID(),
  }, admin);
  assert.equal(add.status, 200);
  assert.equal(add.data.balance, 0.3);
  const sub = await server.json(adminRoutes + "tool-credits/adjust", {
    accountId: session.accountId, amount: -0.1, reason: "扣回一次扫描", requestId: randomUUID(),
  }, admin);
  assert.equal(sub.status, 200);
  assert.equal(sub.data.balance, 0.2);
});

test("006 迁移无损缩放历史整数余额与占用，并将默认扫描用量从 1 升级为 0.1", async (t) => {
  const { readFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const schema = `wallet_upgrade_006_${randomUUID().slice(0, 8)}`;
  const database = createWalletDatabase({ env: { DATABASE_URL: postgres.url, DATABASE_SCHEMA: schema } });
  t.after(() => database.close());

  const preMigrations = [
    "001_initial.sql",
    "002_account_uid.sql",
    "003_wechat_tool_purchases.sql",
    "004_wechat_coin_recharges.sql",
    "005_wechat_coin_refund_polling.sql",
  ];
  await database.transaction(async (client) => {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
    await client.query(`CREATE TABLE wallet_schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    )`);
    for (const file of preMigrations) {
      const sql = await readFile(new URL(`../server/migrations/wallet/${file}`, import.meta.url), "utf8");
      await client.query(sql);
      const checksum = createHash("sha256").update(sql).digest("hex");
      await client.query("INSERT INTO wallet_schema_migrations (name, checksum) VALUES ($1, $2)", ["wallet/" + file, checksum]);
    }
    await client.query("INSERT INTO wallet_rules (id, value) VALUES (1, $1::jsonb)", [JSON.stringify({
      welcome: { newAccount: 3, existingMember: 3 },
      costs: { "answer-sheet": 1 },
      invite: { enabled: false, groups: false, reward: 2, monthlyLimit: 10, registerDays: 7, useDays: 7 },
      purchase: { directPurchase: false, tokenRecharge: true, packages: [{ credits: 1, cents: 100 }] },
      ads: { enabled: false, reward: 1, dailyLimit: 2 },
    })]);
  });

  // Seed a pre-006 account with 3 credits and an active 1-credit hold.
  const preStore = createToolCreditStore({ database, groupApproved: false });
  const user = await preStore.login({ wechatKey: "pre-006-user", visitorId: randomUUID() });
  assert.equal(user.balance, 3);
  const oldKey = { accountId: user.accountId, tool: "answer-sheet", operationId: "pre-006-op" };
  await preStore.reserve(oldKey, { quotedCost: 1 });
  assert.deepEqual(
    [(await preStore.wallet(user.accountId, 0)).balance, (await preStore.wallet(user.accountId, 0)).held],
    [2, 1],
  );

  // Run migration 006 and verify existing balances, holds, and default answer-sheet cost.
  assert.deepEqual(await migrateWalletDatabase(database), ["wallet/006_fractional_credits.sql"]);
  const postStore = createToolCreditStore({ database, groupApproved: false });
  assert.equal(await postStore.quote("answer-sheet"), 0.1);
  const afterMigrate = await postStore.wallet(user.accountId, 0);
  assert.equal(afterMigrate.balance, 2);
  assert.equal(afterMigrate.held, 1);
  assert.equal(afterMigrate.records[0].amount, 3);

  // Pre-006 1-credit reservation settles at its original 1 credit; new scan consumes 0.1 credit.
  assert.equal((await postStore.settle(oldKey, "pre-006-result")).cost, 1);
  assert.equal((await postStore.wallet(user.accountId, 0)).balance, 2);
  const newKey = { accountId: user.accountId, tool: "answer-sheet", operationId: "post-006-op" };
  await postStore.reserve(newKey, { quotedCost: 0.1 });
  await postStore.settle(newKey, "post-006-result");
  const finalWallet = await postStore.wallet(user.accountId, 0);
  assert.equal(finalWallet.balance, 1.9);
  assert.deepEqual(finalWallet.records.map(row => [row.amount, row.balanceAfter]), [[-0.1, 1.9], [-1, 2], [3, 3]]);
});

test("答题卡识别接入卷豆扣费：成功扣 0.1 颗、失败释放占用、余额不足返回 402", async (t) => {
  const { readFile } = await import("node:fs/promises");
  const server = await serverFor(t);
  const admin = await adminSession(server);
  const sheetBytes = await readFile(new URL("./fixtures/omr/sheet-c.jpg", import.meta.url));
  const sheetBase64 = sheetBytes.toString("base64");

  // 未登录调用返回 401 login。
  const unauthed = await server.json("/api/omr/recognize", { image: sheetBase64, expectedQuestions: 140 });
  assert.equal(unauthed.status, 401);
  assert.equal(unauthed.data.errorId, "login");

  // 登录后正常识别成功扣减 0.1 颗卷豆，余额从 3 变为 2.9。
  const session = await login(server, "omr-billed-user");
  const ok = await server.json("/api/omr/recognize", {
    image: sheetBase64,
    expectedQuestions: 140,
    quotedCost: 0.1,
    operationId: randomUUID(),
  }, auth(session));
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.ok(ok.data.recognized > 0);
  assert.equal(ok.data.billing.charged, 0.1);
  assert.equal(ok.data.billing.state, "settled");
  const afterOk = (await server.json(walletRoutes + "wallet", undefined, auth(session))).data;
  assert.equal(afterOk.balance, 2.9);
  assert.equal(afterOk.held, 0);
  assert.equal(afterOk.records[0].amount, -0.1);
  assert.equal(afterOk.records[0].tool, "answer-sheet");

  // 过期报价返回 409 quote，不扣卷豆。
  const stale = await server.json("/api/omr/recognize", {
    image: sheetBase64,
    expectedQuestions: 140,
    quotedCost: 1,
    operationId: randomUUID(),
  }, auth(session));
  assert.equal(stale.status, 409);
  assert.equal(stale.data.errorId, "quote");

  // 非答题卡图片识别失败（422）自动释放占用，余额保持 2.9。
  const nonSheet = await readFile(new URL("../assets/miniprogram-qrcode.jpg", import.meta.url));
  const failed = await server.json("/api/omr/recognize", {
    image: nonSheet.toString("base64"),
    expectedQuestions: 140,
    quotedCost: 0.1,
    operationId: randomUUID(),
  }, auth(session));
  assert.equal(failed.status, 422);
  const afterFail = (await server.json(walletRoutes + "wallet", undefined, auth(session))).data;
  assert.equal(afterFail.balance, 2.9);
  assert.equal(afterFail.held, 0);

  // 将余额扣回至 0 后再次识图，返回 402 balance。
  const drain = await server.json(adminRoutes + "tool-credits/adjust", {
    accountId: session.accountId,
    amount: -2.9,
    reason: "测试余额不足拦截",
    requestId: randomUUID(),
  }, admin);
  assert.equal(drain.status, 200);
  assert.equal(drain.data.balance, 0);
  const insufficient = await server.json("/api/omr/recognize", {
    image: sheetBase64,
    expectedQuestions: 140,
    quotedCost: 0.1,
    operationId: randomUUID(),
  }, auth(session));
  assert.equal(insufficient.status, 402);
  assert.equal(insufficient.data.errorId, "balance");
});
