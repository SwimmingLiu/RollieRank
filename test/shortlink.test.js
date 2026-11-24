import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createShortLinkService,
  createCode,
  normalizeTarget,
  SHORTLINK_CODE_LENGTH,
} from "../server/shortlink.mjs";

function memoryCache() {
  const store = new Map();
  return {
    mode: "memory",
    async get(key) { return store.get(key) ?? null; },
    async set(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    store,
  };
}

/** 用固定字节序列让短码可预测，避免测试依赖随机数。 */
function fixedRandom(byte = 0) {
  return (size) => Uint8Array.from({ length: size }, () => byte);
}

function fakeFetch(calls) {
  return async (url, options) => {
    const target = String(url);
    calls.push({ target, body: options?.body ? JSON.parse(options.body) : null });
    if (target.includes("/cgi-bin/stable_token")) {
      return { ok: true, json: async () => ({ access_token: "TOKEN", expires_in: 7200 }) };
    }
    if (target.includes("/wxa/getwxacodeunlimit")) {
      // 返回足够大的二进制，模拟真实 JPEG 小程序码。
      const buffer = Buffer.alloc(2048, 0xff);
      buffer[0] = 0xff; buffer[1] = 0xd8;
      return { ok: true, arrayBuffer: async () => buffer };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

const env = {
  ROLLIERANK_WECHAT_APP_ID: "wx_test",
  ROLLIERANK_WECHAT_APP_SECRET: "secret",
  ROLLIERANK_SITE_ORIGIN: "https://rank.example.com",
  ROLLIERANK_SHORTLINK_TOKEN: "test-token",
};

const AUTH = { headers: { "x-rollierank-token": "test-token" } };

function harness() {
  let catalog = { versions: [], audit: [], receipts: {}, features: {} };
  const calls = [];
  const cache = memoryCache();
  const service = createShortLinkService({
    cache,
    readCatalog: () => catalog,
    mutateCatalog: (operation) => { catalog = operation(catalog); return catalog; },
    fetchImpl: fakeFetch(calls),
    env,
    randomBytes: fixedRandom(0),
    now: () => 1_700_000_000_000,
  });
  return { service, calls, cache, getCatalog: () => catalog };
}

async function call(service, { pathname, method = "GET", query = new URLSearchParams(), input, request = AUTH }) {
  let out;
  const handled = await service({
    pathname, method, query, input, request,
    send: (status, body) => { out = { status, body }; },
  });
  return { handled, ...out };
}

test("未配置凭证时返回 503", async () => {
  const service = createShortLinkService({
    cache: memoryCache(),
    readCatalog: () => ({ features: {} }),
    mutateCatalog: (op) => op({ features: {} }),
    env: {},
  });
  const out = await call(service, { pathname: "/api/links" });
  assert.equal(out.status, 503);
  assert.equal(out.body.enabled, false);
});

test("不匹配的路径直接放行，不占用请求", async () => {
  const { service } = harness();
  const out = await call(service, { pathname: "/api/catalog" });
  assert.equal(out.handled, false);
});

test("创建短链并落盘到 features.shortLinks", async () => {
  const { service, getCatalog } = harness();
  const out = await call(service, {
    pathname: "/api/links", method: "POST",
    input: { page: "pages/home/home", title: "行测估分", channel: "wechat" },
  });
  assert.equal(out.status, 201);
  assert.equal(out.body.page, "pages/home/home");
  assert.equal(out.body.url, `https://rank.example.com/s/${out.body.code}`);
  assert.equal(out.body.code.length, SHORTLINK_CODE_LENGTH);
  assert.equal(getCatalog().features.shortLinks.length, 1);
});

test("落地页只接受小程序内部路径，拒绝外链", async () => {
  const { service } = harness();
  const out = await call(service, {
    pathname: "/api/links", method: "POST",
    input: { page: "https://evil.example.com/" },
  });
  assert.equal(out.status, 400);
  assert.match(out.body.error, /小程序内部路径/);
});

test("同一短码不会重复分配，冲突时重新生成", async () => {
  let counter = 0;
  let catalog = { versions: [], audit: [], receipts: {}, features: {} };
  const service = createShortLinkService({
    cache: memoryCache(),
    readCatalog: () => catalog,
    mutateCatalog: (operation) => { catalog = operation(catalog); return catalog; },
    fetchImpl: fakeFetch([]),
    env,
    // 前两次生成同一个码，第三次不同，用于验证冲突重试。
    randomBytes: (size) => {
      counter += 1;
      return Uint8Array.from({ length: size }, () => (counter <= 2 ? 0 : 3));
    },
    now: () => 1_700_000_000_000,
  });
  const first = await call(service, { pathname: "/api/links", method: "POST", input: {} });
  const second = await call(service, { pathname: "/api/links", method: "POST", input: {} });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.notEqual(first.body.code, second.body.code);
  assert.equal(catalog.features.shortLinks.length, 2);
});

test("详情接口返回短链信息，visit=1 记录点击", async () => {
  const { service, getCatalog } = harness();
  const created = await call(service, { pathname: "/api/links", method: "POST", input: {} });
  const code = created.body.code;

  const detail = await call(service, {
    pathname: `/api/links/${code}`,
    query: new URLSearchParams({ visit: "1", ref: "group" }),
  });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.clicks, 1);
  const stored = getCatalog().features.shortLinks[0];
  assert.equal(stored.clicks, 1);
  assert.equal(stored.clickLog.length, 1);
  assert.equal(stored.clickLog[0].ref, "group");
});

test("小程序码接口用 check_path:false 拉取并缓存", async () => {
  const { service, calls, cache } = harness();
  const created = await call(service, { pathname: "/api/links", method: "POST", input: {} });
  const code = created.body.code;

  const first = await call(service, { pathname: `/api/links/${code}/qrcode` });
  assert.equal(first.status, 200);
  assert.equal(first.body.mime, "image/jpeg");
  assert.ok(first.body.image.length > 100);

  const qrCall = calls.find((item) => item.target.includes("getwxacodeunlimit"));
  assert.ok(qrCall, "应调用 getwxacodeunlimit");
  assert.equal(qrCall.body.check_path, false, "个人主体必须关闭路径校验");
  assert.equal(qrCall.body.page, "pages/home/home");

  // 第二次命中缓存，不再请求微信。
  const before = calls.filter((item) => item.target.includes("getwxacodeunlimit")).length;
  await call(service, { pathname: `/api/links/${code}/qrcode` });
  const after = calls.filter((item) => item.target.includes("getwxacodeunlimit")).length;
  assert.equal(after, before, "命中缓存不应重复调用微信");
  assert.ok(cache.store.size >= 1);
});

test("创建和列表必须带管理口令", async () => {
  const { service } = harness();

  const noToken = await call(service, {
    pathname: "/api/links", method: "POST", input: {}, request: { headers: {} },
  });
  assert.equal(noToken.status, 401);

  const wrong = await call(service, {
    pathname: "/api/links", method: "POST", input: {},
    request: { headers: { "x-rollierank-token": "nope" } },
  });
  assert.equal(wrong.status, 401);

  const list = await call(service, { pathname: "/api/links", request: { headers: {} } });
  assert.equal(list.status, 401);

  const ok = await call(service, { pathname: "/api/links", method: "POST", input: {} });
  assert.equal(ok.status, 201);
});

test("未配置管理口令时写接口关闭，但落地页仍可读", async () => {
  const noTokenEnv = { ...env, ROLLIERANK_SHORTLINK_TOKEN: "", ROLLIERANK_REVIEW_TOKEN: "" };
  let catalog = { versions: [], audit: [], receipts: {}, features: {} };
  const service = createShortLinkService({
    cache: memoryCache(),
    readCatalog: () => catalog,
    mutateCatalog: (op) => { catalog = op(catalog); return catalog; },
    fetchImpl: fakeFetch([]),
    env: noTokenEnv,
    randomBytes: fixedRandom(0),
    now: () => 1_700_000_000_000,
  });
  const blocked = await call(service, { pathname: "/api/links", method: "POST", input: {} });
  assert.equal(blocked.status, 503);
  assert.match(blocked.body.error, /管理未配置口令/);
});

test("短链不存在时返回 404", async () => {
  const { service } = harness();
  const out = await call(service, { pathname: "/api/links/zzzzzzz" });
  assert.equal(out.status, 404);
});

test("过期短链返回 410", async () => {
  const { service, getCatalog } = harness();
  const created = await call(service, { pathname: "/api/links", method: "POST", input: {} });
  const code = created.body.code;
  getCatalog().features.shortLinks[0].expiresAt = 1; // 早于 now()
  const out = await call(service, { pathname: `/api/links/${code}` });
  assert.equal(out.status, 410);
});

test("短码只含无歧义字符", async () => {
  const code = createCode((size) => Uint8Array.from({ length: size }, (_, i) => i * 7 % 256));
  assert.equal(code.length, SHORTLINK_CODE_LENGTH);
  assert.match(code, /^[a-hj-km-np-z2-9]+$/, "不应出现 o/l/0/1 等易混字符");
});

test("路径规范化：前导斜杠、协议头与非法字符", () => {
  // 单个前导斜杠是合法写法，去掉即可。
  assert.equal(normalizeTarget("/pages/home/home", "pages/home/home"), "pages/home/home");
  // 空值回退到默认落地页。
  assert.equal(normalizeTarget("", "pages/home/home"), "pages/home/home");
  assert.equal(normalizeTarget("   ", "pages/home/home"), "pages/home/home");
  // 协议相对地址与完整 URL 一律拒绝，避免被当成开放重定向。
  assert.throws(() => normalizeTarget("//evil.example.com/x", "pages/home/home"), /小程序内部路径/);
  assert.throws(() => normalizeTarget("https://evil.example.com/", "pages/home/home"), /小程序内部路径/);
  assert.throws(() => normalizeTarget("javascript:alert(1)", "pages/home/home"), /小程序内部路径/);
  // 查询串、空格、中文都不接受：小程序路径只允许字母数字下划线短横和斜杠。
  assert.throws(() => normalizeTarget("pages/home/home?x=1", "pages/home/home"), /格式不正确/);
  assert.throws(() => normalizeTarget("pages/home/首页", "pages/home/home"), /格式不正确/);
});
