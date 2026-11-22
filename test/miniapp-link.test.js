import { test } from "node:test";
import assert from "node:assert/strict";
import { createMiniappLinkService } from "../server/miniapp-link.mjs";

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

function fakeFetch(calls) {
  return async (url, options) => {
    const target = String(url);
    calls.push({ target, body: options?.body ? JSON.parse(options.body) : null });
    if (target.includes("/cgi-bin/stable_token")) {
      return { ok: true, json: async () => ({ access_token: "TOKEN", expires_in: 7200 }) };
    }
    if (target.includes("/wxa/genwxashortlink")) {
      return { ok: true, json: async () => ({ errcode: 0, link: "https://wxaurl.cn/abc123" }) };
    }
    if (target.includes("/wxa/generate_urllink")) {
      return { ok: true, json: async () => ({ errcode: 0, url_link: "https://wxaurl.cn/def456" }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

const env = {
  ROLLIERANK_WECHAT_APP_ID: "wx_test",
  ROLLIERANK_WECHAT_APP_SECRET: "secret",
};

function handler(cache, calls) {
  return createMiniappLinkService({ cache, fetchImpl: fakeFetch(calls), env });
}

test("未配置凭证时返回 503", async () => {
  const service = createMiniappLinkService({ cache: memoryCache(), env: {} });
  let out;
  await service({ pathname: "/api/miniapp/shortlink", method: "GET", query: new URLSearchParams(), send: (s, b) => { out = { s, b }; } });
  assert.equal(out.s, 503);
  assert.equal(out.b.enabled, false);
});

test("生成短链并写入缓存，第二次命中缓存不再调用微信", async () => {
  const cache = memoryCache();
  const calls = [];
  const service = handler(cache, calls);
  const run = () => new Promise((resolve) => {
    service({ pathname: "/api/miniapp/shortlink", method: "GET", query: new URLSearchParams(), send: (s, b) => resolve({ s, b }) });
  });

  const first = await run();
  assert.equal(first.s, 200);
  assert.equal(first.b.link, "https://wxaurl.cn/abc123");
  assert.equal(first.b.browserSupported, false);

  const afterFirst = calls.length;
  const second = await run();
  assert.equal(second.b.link, "https://wxaurl.cn/abc123");
  assert.equal(calls.length, afterFirst, "缓存命中时不应再请求微信");

  const shortCall = calls.find((c) => c.target.includes("genwxashortlink"));
  assert.equal(shortCall.body.page_url, "pages/home/home");
  assert.equal(shortCall.body.is_permanent, false);
});

test("urllink 走 URL Link 接口并单独缓存", async () => {
  const cache = memoryCache();
  const calls = [];
  const service = handler(cache, calls);
  const out = await new Promise((resolve) => {
    service({ pathname: "/api/miniapp/urllink", method: "GET", query: new URLSearchParams(), send: (s, b) => resolve({ s, b }) });
  });
  assert.equal(out.s, 200);
  assert.equal(out.b.link, "https://wxaurl.cn/def456");
  const call = calls.find((c) => c.target.includes("generate_urllink"));
  assert.equal(call.body.expire_type, 1);
  assert.equal(call.body.expire_interval, 30);
});

test("微信返回错误码时透出可读错误", async () => {
  const service = createMiniappLinkService({
    cache: memoryCache(),
    env,
    fetchImpl: async (url) => {
      if (String(url).includes("stable_token")) {
        return { ok: true, json: async () => ({ access_token: "T", expires_in: 7200 }) };
      }
      return { ok: true, json: async () => ({ errcode: 45009, errmsg: "reach max api daily quota limit" }) };
    },
  });
  const out = await new Promise((resolve) => {
    service({ pathname: "/api/miniapp/shortlink", method: "GET", query: new URLSearchParams(), send: (s, b) => resolve({ s, b }) });
  });
  assert.equal(out.s, 502);
  assert.match(out.b.error, /45009/);
});

test("非 GET 请求返回 405", async () => {
  const service = handler(memoryCache(), []);
  const out = await new Promise((resolve) => {
    service({ pathname: "/api/miniapp/shortlink", method: "POST", query: new URLSearchParams(), send: (s, b) => resolve({ s, b }) });
  });
  assert.equal(out.s, 405);
});

// 个人主体拿不到短链权限时，聚合入口应自动退回小程序码。
test("entry 在 shortlink 无权限时退回 qrcode", async () => {
  const cache = memoryCache();
  const service = createMiniappLinkService({
    cache,
    env,
    fetchImpl: async (url) => {
      const target = String(url);
      if (target.includes("stable_token")) {
        return { ok: true, json: async () => ({ access_token: "T", expires_in: 7200 }) };
      }
      if (target.includes("genwxashortlink")) {
        return { ok: true, json: async () => ({ errcode: 43104, errmsg: "this appid does not have permission" }) };
      }
      if (target.includes("getwxacode")) {
        // 用足够长的二进制模拟 JPEG 图片
        return { ok: true, arrayBuffer: async () => new Uint8Array(4096).fill(7).buffer };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    },
  });
  const out = await new Promise((resolve) => {
    service({ pathname: "/api/miniapp/entry", method: "GET", query: new URLSearchParams(), send: (s, b) => resolve({ s, b }) });
  });
  assert.equal(out.s, 200);
  assert.equal(out.b.kind, "qrcode");
  assert.equal(out.b.mime, "image/jpeg");
  assert.ok(out.b.image && out.b.image.length > 100);
  assert.ok(out.b.degraded.some((d) => d.includes("43104")), "应记录短链失败原因");
});

test("qrcode 接口返回 base64 图片", async () => {
  const cache = memoryCache();
  const service = createMiniappLinkService({
    cache,
    env,
    fetchImpl: async (url) => {
      if (String(url).includes("stable_token")) {
        return { ok: true, json: async () => ({ access_token: "T", expires_in: 7200 }) };
      }
      return { ok: true, arrayBuffer: async () => new Uint8Array(2048).fill(3).buffer };
    },
  });
  const out = await new Promise((resolve) => {
    service({ pathname: "/api/miniapp/qrcode", method: "GET", query: new URLSearchParams(), send: (s, b) => resolve({ s, b }) });
  });
  assert.equal(out.s, 200);
  assert.equal(out.b.kind, "qrcode");
  assert.equal(Buffer.from(out.b.image, "base64").length, 2048);
});

test("qrcode 接口把微信 JSON 错误转成可读提示", async () => {
  const service = createMiniappLinkService({
    cache: memoryCache(),
    env,
    fetchImpl: async (url) => {
      if (String(url).includes("stable_token")) {
        return { ok: true, json: async () => ({ access_token: "T", expires_in: 7200 }) };
      }
      const payload = Buffer.from(JSON.stringify({ errcode: 41030, errmsg: "invalid page" }));
      return { ok: true, arrayBuffer: async () => payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.length) };
    },
  });
  const out = await new Promise((resolve) => {
    service({ pathname: "/api/miniapp/qrcode", method: "GET", query: new URLSearchParams(), send: (s, b) => resolve({ s, b }) });
  });
  assert.equal(out.s, 502);
  assert.match(out.b.error, /41030/);
});
