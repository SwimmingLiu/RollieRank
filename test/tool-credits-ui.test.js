import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createApi } from "../server/api.mjs";
import { createWalletDatabase, migrateWalletDatabase } from "../server/tool-credits-postgres.mjs";
import { startWalletPostgres } from "./support/wallet-postgres.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const VISUAL_DIR = path.join(ROOT, "test-results/verification/visual/tool-credits");

async function startIsolatedWalletDatabase() {
  const postgres = await startWalletPostgres();
  const schema = "rollierank_ui_" + randomBytes(6).toString("hex");
  const database = createWalletDatabase({
    env: { TEST_DATABASE_URL: postgres.url, TEST_DATABASE_SCHEMA: schema },
    testEnvironment: true,
  });
  await migrateWalletDatabase(database);
  return {
    database,
    async close() {
      await database.close().catch(() => {});
      await postgres.close().catch(() => {});
    },
  };
}

async function startAdminWalletServer(database) {
  const dir = await mkdtemp(path.join(tmpdir(), "rollierank-credits-ui-"));
  const dataDirectory = pathToFileURL(dir + path.sep);
  const api = await createApi({
    dataDirectory,
    toolCreditOptions: {
      database,
      exchange: async (code) => (code.startsWith("wallet-test-") ? code.slice("wallet-test-".length) : null),
    },
  });
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
  };
  const server = createServer(async (request, response) => {
    response.setHeader("X-RollieRank-Environment", "test");
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (await api(request, response, pathname)) return;
      if (pathname === "/admin") {
        response.writeHead(302, { Location: "/admin/" }).end();
        return;
      }
      const resource = path.posix.normalize(pathname === "/" ? "/index.html" : pathname);
      const ios = resource.startsWith("/ios-v3/");
      const selectedRoot = ios ? path.join(ROOT, "docs/ui-exploration/ios-v3") : ROOT;
      const relative = ios ? resource.slice("/ios-v3".length) : resource;
      const target = path.resolve(selectedRoot, "." + (relative.endsWith("/") ? relative + "index.html" : relative));
      if (!target.startsWith(selectedRoot + path.sep) || !(await stat(target)).isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      const body = await readFile(target);
      response.writeHead(200, { "Content-Type": types[path.extname(target).toLowerCase()] || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  async function json(route, body, headers = {}) {
    const res = await fetch(`${baseUrl}${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const parsed = await res.json().catch(() => ({}));
    return { status: res.status, body: parsed, headers: res.headers };
  }
  return {
    dir,
    baseUrl,
    origin: baseUrl,
    json,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("admin console tool-credits view supports accounts, ledger, pricing preview, rules update and manual adjustment", async (t) => {
  const prevUser = process.env.ROLLIERANK_ADMIN_USER;
  const prevPass = process.env.ROLLIERANK_ADMIN_PASSWORD;
  delete process.env.ROLLIERANK_ADMIN_USER;
  delete process.env.ROLLIERANK_ADMIN_PASSWORD;
  t.after(() => {
    if (prevUser === undefined) delete process.env.ROLLIERANK_ADMIN_USER; else process.env.ROLLIERANK_ADMIN_USER = prevUser;
    if (prevPass === undefined) delete process.env.ROLLIERANK_ADMIN_PASSWORD; else process.env.ROLLIERANK_ADMIN_PASSWORD = prevPass;
  });

  const walletDb = await startIsolatedWalletDatabase();
  t.after(() => walletDb.close());
  const server = await startAdminWalletServer(walletDb.database);
  t.after(() => server.close());

  // Seed two real wallet accounts (one newcomer, one legacy member)
  const newcomer = await server.json("/api/tool-credits/login", {
    code: "wallet-test-ui-newcomer",
    visitorId: "visitor-ui-newcomer-01",
  });
  assert.equal(newcomer.status, 200);
  assert.equal(newcomer.body.uid, 10001);

  const legacyGuestId = "visitor-ui-legacy-02";
  const { body: { token: profileToken } } = await server.json("/api/miniprogram-profile/session", {});
  await server.json("/api/miniprogram-profile/profile", { token: profileToken, guestId: legacyGuestId, name: "老卷友小王" });
  const legacy = await server.json("/api/tool-credits/login", {
    code: "wallet-test-ui-legacy",
    visitorId: legacyGuestId,
    bindLegacy: true,
    profileToken,
  });
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.uid, 10002);

  await mkdir(VISUAL_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${server.baseUrl}/admin/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#setup-form");
  await page.fill("#setup-user", "opsadmin");
  await page.fill("#setup-pass", "CreditAdmin123!");
  await page.fill("#setup-confirm", "CreditAdmin123!");
  await page.click('#setup-form button[type="submit"]');
  await page.waitForSelector(".console");

  // Navigate to 卷豆 view
  await page.click('[data-nav="credits"]');
  await page.waitForSelector('[data-view="tool-credits"]');
  await page.waitForSelector(`[data-credit-account-row="${newcomer.body.accountId}"]`);
  await page.waitForSelector(`[data-credit-account-row="${legacy.body.accountId}"]`);

  // Capture accounts view at 1440px
  await page.screenshot({ path: path.join(VISUAL_DIR, "admin-credits-accounts-1440.png"), fullPage: true });

  // Open Rules modal, test real-time scan preview and save rules
  await page.click('[data-action="open-credit-rules"]');
  await page.waitForSelector("#credit-rules-form");
  await page.fill("#rule-welcome-new", "5");
  await page.fill('[data-tool-cost="answer-sheet"]', "2");
  assert.equal((await page.locator('[data-preview="new-scans"]').textContent()).trim(), "2 张");
  assert.equal((await page.locator('[data-preview="existing-scans"]').textContent()).trim(), "1 张");
  await page.screenshot({ path: path.join(VISUAL_DIR, "admin-credits-rules-modal-1440.png") });
  await page.click('button[form="credit-rules-form"]');
  await page.waitForFunction(() => !document.querySelector("#credit-rules-form"));
  await page.waitForFunction(() => document.body.textContent.includes("新人送 5 颗 · 每张用 2 颗"));

  // Manual adjust (+4) then deduct (-1) on newcomer account
  await page.click(`[data-credit-account-row="${newcomer.body.accountId}"] [data-action="adjust-account"]`);
  await page.waitForSelector("#credit-adjust-form");
  await page.fill("#adjust-count-input", "4");
  await page.fill("#adjust-reason-input", "实拍验收补偿四颗");
  await page.screenshot({ path: path.join(VISUAL_DIR, "admin-credits-adjust-modal-1440.png") });
  await page.click('button[form="credit-adjust-form"]');
  await page.waitForFunction(() => !document.querySelector("#credit-adjust-form"));
  await page.waitForFunction((id) => {
    const row = document.querySelector(`[data-credit-account-row="${id}"]`);
    return row && row.textContent.includes("7 颗");
  }, newcomer.body.accountId);

  await page.click(`[data-credit-account-row="${newcomer.body.accountId}"] [data-action="adjust-account"]`);
  await page.waitForSelector("#credit-adjust-form");
  await page.click('[data-adjust-dir="deduct"]');
  await page.fill("#adjust-count-input", "2");
  await page.fill("#adjust-reason-input", "重复补偿扣回");
  await page.click('button[form="credit-adjust-form"]');
  await page.waitForFunction(() => !document.querySelector("#credit-adjust-form"));
  await page.waitForFunction((id) => {
    const row = document.querySelector(`[data-credit-account-row="${id}"]`);
    return row && row.textContent.includes("5 颗");
  }, newcomer.body.accountId);

  // Switch to ledger tab & verify audit reasons + operator are visible
  await page.click('[data-filter-tab="records"]');
  await page.waitForFunction(() => document.body.textContent.includes("实拍验收补偿四颗") && document.body.textContent.includes("重复补偿扣回"));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: path.join(VISUAL_DIR, "admin-credits-records-1440.png"), fullPage: true });

  // Filter by 5-digit UID
  await page.fill("[data-credit-account-search]", String(newcomer.body.uid));
  await page.click('[data-view="tool-credits"] button[type="submit"]');
  await page.waitForFunction((uid) => document.body.textContent.includes(`当前仅查看账号 ${uid}`), String(newcomer.body.uid));

  // Narrow desktop layout check (1024x768)
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(VISUAL_DIR, "admin-credits-narrow-1024.png"), fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `admin tool-credits must not overflow horizontally (got ${overflow}px)`);
  assert.deepEqual(errors, []);
});

test("miniprogram tool-credits service works end-to-end against real wallet server", async (t) => {
  const walletDb = await startIsolatedWalletDatabase();
  t.after(() => walletDb.close());
  const server = await startAdminWalletServer(walletDb.database);
  t.after(() => server.close());

  const storeMap = new Map();
  let nextLoginCode = "wallet-test-mp-user-1";
  const prevWx = globalThis.wx;

  globalThis.wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "develop" } }),
    getStorageSync: (key) => (storeMap.has(key) ? structuredClone(storeMap.get(key)) : ""),
    setStorageSync: (key, value) => storeMap.set(key, structuredClone(value)),
    removeStorageSync: (key) => storeMap.delete(key),
    login: ({ success }) => success({ code: nextLoginCode }),
    request: ({ url, method = "GET", header = {}, data, success, fail }) => {
      const parsed = new URL(url);
      const target = new URL(parsed.pathname + parsed.search, server.origin);
      fetch(target, {
        method,
        headers: header,
        body: method === "POST" ? JSON.stringify(data ?? {}) : undefined,
      })
        .then(async (res) => {
          const json = await res.json().catch(() => null);
          const headers = {};
          res.headers.forEach((value, key) => { headers[key] = value; });
          success({ statusCode: res.status, data: json, header: headers });
        })
        .catch(fail);
    },
  };
  t.after(() => {
    if (prevWx === undefined) delete globalThis.wx;
    else globalThis.wx = prevWx;
  });

  const requireMp = createRequire(path.join(ROOT, "mini-program/package.json"));
  for (const rel of [
    "../mini-program/config.js",
    "../mini-program/utils/storage.js",
    "../mini-program/utils/format.js",
    "../mini-program/services/api.js",
    "../mini-program/services/profile.js",
    "../mini-program/services/tool-credits.js",
  ]) {
    delete requireMp.cache[requireMp.resolve(rel)];
  }
  const storage = requireMp("../mini-program/utils/storage.js");
  const api = requireMp("../mini-program/services/api.js");
  const credits = requireMp("../mini-program/services/tool-credits.js");

  const cap = await credits.capabilities();
  assert.equal(cap.login, true);
  assert.equal(cap.invite, false);
  assert.equal(cap.purchase.directPurchase, false);
  assert.equal(cap.purchase.tokenRecharge, false);
  assert.equal(cap.ads, false);

  const loginRes = await credits.login();
  assert.equal(loginRes.created, true);
  assert.equal(loginRes.balance, 3);
  assert.equal(loginRes.uid, 10001);
  assert.equal(credits.hasSession(), true);
  assert.equal(credits.accountId(), loginRes.accountId);
  assert.equal(credits.uid(), 10001);

  const quote = await credits.quote("answer-sheet");
  assert.equal(quote.cost, 1);
  assert.equal(credits.scannableCount(loginRes.balance, quote.cost), 3);

  const wallet = await credits.wallet(0);
  assert.equal(wallet.balance, 3);
  assert.equal(wallet.held, 0);
  assert.equal(wallet.records.length, 1);
  assert.equal(wallet.records[0].amountText, "+3");
  assert.equal(wallet.records[0].positive, true);
  assert.equal(wallet.nextBefore, null);

  // Submitting an attempt automatically includes the Bearer token without breaking normal scoring
  const versions = await api.catalog(true);
  const version = versions[0];
  const submitted = await api.submit({
    version,
    answers: Array(version.questionCount).fill("A"),
    attemptId: "attempt-mp-credits-01",
  });
  assert.equal(submitted.id, "attempt-mp-credits-01");

  // Logout clears local token and revokes server session
  const oldToken = storage.toolCreditToken();
  await credits.logout();
  assert.equal(credits.hasSession(), false);
  storage.setToolCreditToken(oldToken);
  await assert.rejects(() => credits.wallet(0), (err) => err.statusCode === 401);
  assert.equal(credits.hasSession(), false, "401 must automatically clear expired local token");
});

test("miniprogram credits and records entry pass visual layout checks at 320, 390 and 430 widths", async (t) => {
  await mkdir(VISUAL_DIR, { recursive: true });
  const recordsWxml = await readFile(path.join(ROOT, "mini-program/pages/records/records.wxml"), "utf8");
  const profileWxml = await readFile(path.join(ROOT, "mini-program/pages/profile/profile.wxml"), "utf8");
  const creditsWxml = await readFile(path.join(ROOT, "mini-program/pages/credits/credits.wxml"), "utf8");
  const creditsJs = await readFile(path.join(ROOT, "mini-program/pages/credits/credits.js"), "utf8");
  assert.match(recordsWxml, /class="records__credits"[^>]*bindtap="openCredits"/, "个人中心页应直接展示卷豆入口");
  assert.doesNotMatch(profileWxml, /openCredits/, "头像点进去的个人资料二级页不应包含卷豆入口");
  assert.doesNotMatch(creditsWxml, /答题卡扫描|还可扫描/, "卷豆页不应与扫描功能强绑定");
  assert.doesNotMatch(creditsWxml, /账号编号|退出登录/, "卷豆页不应展示长账号编号与退出登录");
  assert.match(creditsWxml, /UID \{\{uid\}\}/, "卷豆页应展示 5 位 UID");
  assert.match(creditsWxml, /bindtap="openLedger"[\s\S]*bindtap="selectPackage"[\s\S]*bindtap="submitRecharge"/, "卷豆页应直接展示充值档位并收口明细抽屉");
  assert.match(creditsWxml, /catchtap="closeSheet"/, "抽屉遮罩点击空白应关闭");
  assert.match(creditsJs, /closeSheet\(\)\s*\{\s*this\.sheetDrag\?\.reset\(\)/, "closeSheet 应使用标准 sheetDrag.reset() 关闭抽屉");

  const appWxss = (await readFile(path.join(ROOT, "mini-program/app.wxss"), "utf8"))
    .replace(/(\d+(?:\.\d+)?)rpx/g, (_, n) => `${Number(n) * 0.5}px`)
    .replace(/^page\b/gm, "body");
  const creditsWxss = (await readFile(path.join(ROOT, "mini-program/pages/credits/credits.wxss"), "utf8"))
    .replace(/(\d+(?:\.\d+)?)rpx/g, (_, n) => `${Number(n) * 0.5}px`);
  const recordsWxss = (await readFile(path.join(ROOT, "mini-program/pages/records/records.wxss"), "utf8"))
    .replace(/(\d+(?:\.\d+)?)rpx/g, (_, n) => `${Number(n) * 0.5}px`)
    .replace(/\bimage\b/g, "img");

  const iconUri = async (name) => {
    const svg = await readFile(path.join(ROOT, "mini-program/assets/ui", name), "utf8");
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };
  const avatarSvg = await readFile(path.join(ROOT, "mini-program/assets/avatars/rank-1.svg"), "utf8");
  const paperSvg = await readFile(path.join(ROOT, "mini-program/assets/answer-paper.svg"), "utf8");
  const creditsArtSvg = await readFile(path.join(ROOT, "mini-program/assets/credits-art.svg"), "utf8");
  const icons = {
    bean: await iconUri("bean-ochre.svg"),
    copy: await iconUri("copy.svg"),
    close: await iconUri("close.svg"),
    shareLight: await iconUri("share-light.svg"),
    chevron: await iconUri("chevron.svg"),
    mapPin: await iconUri("map-pin.svg"),
    trend: await iconUri("trend.svg"),
    search: await iconUri("search.svg"),
    checkLight: await iconUri("check-light.svg"),
    back: await iconUri("back.svg"),
    avatar: `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg)}`,
    paperArt: `data:image/svg+xml;utf8,${encodeURIComponent(paperSvg)}`,
    creditsArt: `data:image/svg+xml;utf8,${encodeURIComponent(creditsArtSvg)}`,
  };

  const shellHtml = (title, bodyMarkup, { showBack = true } = {}) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${appWxss}
button { border: none; font-family: inherit; cursor: pointer; }
${creditsWxss}
${recordsWxss}
body { margin: 0; overflow: auto; height: auto; min-height: 100vh; }
.sim-nav { display: flex; align-items: center; gap: 8px; height: 52px; padding: 8px 16px 0; background: var(--paper); font-size: 16px; font-weight: 700; color: var(--ink); }
.sim-nav--center { justify-content: center; }
.sim-nav img { width: 18px; height: 18px; }
img { display: block; }
</style>
</head>
<body>
  <div class="sim-nav ${showBack ? "" : "sim-nav--center"}">${showBack ? `<img src="${icons.back}" alt="" />` : ""}<span>${title}</span></div>
  ${bodyMarkup}
</body>
</html>`;

  const guestMarkup = `
  <div class="credits">
    <div class="credits__hero">
      <div class="credits__hero-main">
        <div class="credits__hero-copy grow">
          <div class="credits__eyebrow"><img class="credits__eyebrow-icon" src="${icons.bean}" alt="" /><span>卷豆</span><span class="credits__pill credits__pill--coral">首登送 3 颗</span></div>
          <div class="credits__guest-title">登录领取卷豆</div>
          <div class="credits__guest-desc">使用同一微信账号，换设备自动同步余额。</div>
        </div>
        <img class="credits__hero-art" src="${icons.creditsArt}" alt="" />
      </div>
      <button class="credits__bind-row credits__bind-row--on" type="button">
        <div class="credits__checkbox credits__checkbox--on"><img class="credits__check-icon" src="${icons.checkLight}" alt="" /></div>
        <div class="stack grow">
          <div class="credits__bind-title">关联本机练习资料</div>
          <div class="credits__bind-hint">核对既有资料或正式回执，领取首次绑定赠送</div>
        </div>
      </button>
      <button class="credits__login-btn" type="button">微信登录</button>
    </div>
  </div>`;

  const signedInMarkup = `
  <div class="credits__scroll-body">
  <div class="credits">
    <div class="credits__hero">
      <div class="credits__hero-main">
        <div class="credits__hero-copy grow">
          <div class="credits__eyebrow"><img class="credits__eyebrow-icon" src="${icons.bean}" alt="" /><span>可用卷豆</span></div>
          <div class="credits__balance-main">
            <span class="display-num credits__balance-num">3</span>
            <span class="credits__balance-unit">颗</span>
          </div>
        </div>
        <img class="credits__hero-art" src="${icons.creditsArt}" alt="" />
      </div>
      <div class="credits__hero-foot">
        <button class="credits__uid-chip" type="button"><span class="num">UID 10001</span><img class="credits__uid-copy" src="${icons.copy}" alt="" /></button>
        <button class="credits__ledger-link" type="button"><span>卷豆明细</span><img class="credits__ledger-arrow" src="${icons.chevron}" alt="" /></button>
      </div>
    </div>
    <div class="credits__section">
      <div class="credits__section-head">
        <span class="credits__section-title">充值卷豆</span>
        <span class="credits__section-sub">渠道即将开放</span>
      </div>
      <div class="credits__pack-grid">
        <button class="credits__pack credits__pack--featured credits__pack--on" type="button">
          <div class="credits__pack-left">
            <div class="credits__pack-title-row"><span class="credits__pack-count num">10<span class="credits__pack-unit"> 颗</span></span><span class="credits__pack-tag">常用</span></div>
            <span class="credits__pack-unit-price num">约 ¥0.60/颗</span>
          </div>
          <span class="credits__pack-price credits__pack-price--lg num">¥6</span>
        </button>
        <button class="credits__pack" type="button"><div class="credits__pack-head"><span class="credits__pack-count num">1<span class="credits__pack-unit"> 颗</span></span></div><div class="credits__pack-foot"><span class="credits__pack-price num">¥1</span><span class="credits__pack-unit-price num">¥1.00/颗</span></div></button>
        <button class="credits__pack" type="button"><div class="credits__pack-head"><span class="credits__pack-count num">5<span class="credits__pack-unit"> 颗</span></span></div><div class="credits__pack-foot"><span class="credits__pack-price num">¥4</span><span class="credits__pack-unit-price num">¥0.80/颗</span></div></button>
        <button class="credits__pack" type="button"><div class="credits__pack-head"><span class="credits__pack-count num">30<span class="credits__pack-unit"> 颗</span></span></div><div class="credits__pack-foot"><span class="credits__pack-price num">¥15</span><span class="credits__pack-unit-price num">¥0.50/颗</span></div></button>
        <button class="credits__pack" type="button"><div class="credits__pack-head"><span class="credits__pack-count num">60<span class="credits__pack-unit"> 颗</span></span></div><div class="credits__pack-foot"><span class="credits__pack-price num">¥27</span><span class="credits__pack-unit-price num">¥0.45/颗</span></div></button>
      </div>
      <div class="credits__recharge-note">卷豆长期可用，充值与赠送共用余额，优先消耗赠送。</div>
    </div>
  </div>
  </div>
  <div class="credits__footer">
    <div class="credits__footer-info">
      <span class="credits__footer-label">已选 10 颗</span>
      <span class="display-num credits__footer-price">¥6</span>
    </div>
    <button class="credits__footer-btn credits__footer-btn--soon" type="button">支付即将开放</button>
  </div>`;

  const ledgerSheetMarkup = `
  ${signedInMarkup}
  <div class="sheet-layer">
    <div class="sheet-shade"></div>
    <div class="sheet-panel credits__sheet">
      <div class="sheet-grabber-zone"><div class="sheet-grabber"></div></div>
      <div class="sheet-head"><span>卷豆明细</span><button class="sheet-close" type="button" aria-label="关闭"><img src="${icons.close}" style="width:16px;height:16px;" alt="" /></button></div>
      <div class="sheet-scroll">
        <div class="credits__list">
          <div class="credits__item">
            <div class="credits__item-main grow">
              <div class="credits__item-head"><span class="credits__item-title ellipsis">使用工具</span><span class="credits__item-tag">答题卡扫描</span></div>
              <span class="credits__item-time">2026-11-22 10:18</span>
            </div>
            <div class="credits__item-right">
              <span class="num credits__item-amount credits__item-amount--neg">-1</span>
              <span class="credits__item-balance">余额 6 颗</span>
            </div>
          </div>
          <div class="credits__item">
            <div class="credits__item-main grow">
              <div class="credits__item-head"><span class="credits__item-title ellipsis">人工补发</span></div>
              <span class="credits__item-time">2026-11-21 19:05</span>
            </div>
            <div class="credits__item-right">
              <span class="num credits__item-amount credits__item-amount--pos">+4</span>
              <span class="credits__item-balance">余额 7 颗</span>
            </div>
          </div>
          <div class="credits__item">
            <div class="credits__item-main grow">
              <div class="credits__item-head"><span class="credits__item-title ellipsis">首次登录赠送</span></div>
              <span class="credits__item-time">2026-11-20 09:30</span>
            </div>
            <div class="credits__item-right">
              <span class="num credits__item-amount credits__item-amount--pos">+3</span>
              <span class="credits__item-balance">余额 3 颗</span>
            </div>
          </div>
        </div>
        <div class="credits__end-note">已显示全部明细</div>
      </div>
    </div>
  </div>`;

  const recordsMarkup = (signedIn) => `
  <div class="records">
    <button class="records__profile" type="button">
      <img class="records__avatar" src="${icons.avatar}" alt="" />
      <div class="stack grow">
        <span class="records__name ellipsis">卷友3918</span>
        ${signedIn ? "" : `<span class="records__profile-hint">点击同步微信头像和昵称</span>`}
      </div>
      <img class="records__art" src="${icons.paperArt}" alt="" />
    </button>
    <button class="records__credits" type="button">
      <img class="records__credits-img" src="${icons.bean}" alt="" />
      <span class="records__credits-title">卷豆</span>
      <div class="records__credits-right grow">
        <div class="records__credits-amount">
          <span class="records__credits-num ${signedIn ? "" : "records__credits-num--empty"} num">${signedIn ? "3" : "--"}</span>
          <span class="records__credits-unit">颗</span>
        </div>
        ${signedIn ? "" : `<span class="records__credits-sub">去领取</span>`}
      </div>
      <img class="records__credits-arrow" src="${icons.chevron}" alt="" />
    </button>
    <div class="records__grid">
      <button class="records__cell" type="button">
        <div class="records__cell-label"><img src="${icons.mapPin}" alt="" />报考岗位</div>
        <div class="records__cell-value"><span class="ellipsis grow">未选岗</span><img src="${icons.chevron}" alt="" /></div>
      </button>
      <button class="records__cell" type="button">
        <div class="records__cell-label"><img src="${icons.trend}" alt="" />成长分析</div>
        <div class="records__cell-value"><span class="grow">2<span class="records__unit"> 次</span></span><img src="${icons.chevron}" alt="" /></div>
      </button>
    </div>
    <div class="records__tools">
      <div class="records__tabs grow">
        <button class="records__tab records__tab--on" type="button">全部</button>
        <button class="records__tab" type="button">已完成</button>
        <button class="records__tab" type="button">录入中</button>
      </div>
      <button class="records__search" type="button" aria-label="搜索套卷"><img src="${icons.search}" alt="" /></button>
    </div>
  </div>`;

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();

  const cases = [
    ["mp-credits-guest", "卷豆", guestMarkup, [320, 390], true],
    ["mp-credits-signedin", "卷豆", signedInMarkup, [320, 390, 430], true],
    ["mp-credits-ledger-sheet", "卷豆", ledgerSheetMarkup, [320, 390], true],
    ["mp-records-credits-guest", "练习记录", recordsMarkup(false), [320, 390], false],
    ["mp-records-credits-signedin", "练习记录", recordsMarkup(true), [320, 390, 430], false],
  ];

  for (const [name, title, markup, widths, showBack] of cases) {
    for (const width of widths) {
      const height = width === 320 ? 568 : width === 390 ? 844 : 932;
      await page.setViewportSize({ width, height });
      await page.setContent(shellHtml(title, markup, { showBack }), { waitUntil: "load" });
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        tinyButtons: [...document.querySelectorAll("button")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width < 32 || r.height < 32;
        }).map((el) => ({ text: el.textContent.trim(), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })),
      }));
      assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1, `${name}@${width} overflows horizontally (${metrics.scrollWidth} > ${metrics.innerWidth})`);
      assert.deepEqual(metrics.tinyButtons, [], `${name}@${width} has undersized buttons`);
      await page.screenshot({ path: path.join(VISUAL_DIR, `${name}-${width}.png`), fullPage: true });
    }
  }
});
