import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { requireTestApi } from "../mini-program/tools/test-api.mjs";
import { firstReleaseCounts } from "../deploy/check-first-release.mjs";

const run = promisify(execFile);
const cwd = new URL("../", import.meta.url);
const require = createRequire(import.meta.url);

function nativeApi(t, wx) {
  const files = ["config.js", "utils/storage.js", "services/api.js"].map(file => require.resolve(`../mini-program/${file}`));
  const cached = files.map(file => require.cache[file]);
  const previous = globalThis.wx;
  for (const file of files) delete require.cache[file];
  globalThis.wx = wx;
  t.after(() => {
    if (previous === undefined) delete globalThis.wx;
    else globalThis.wx = previous;
    files.forEach((file, index) => {
      if (cached[index]) require.cache[file] = cached[index];
      else delete require.cache[file];
    });
  });
  return { config: require(files[0]), api: require(files[2]) };
}

for (const version of ["develop", "trial", undefined, "release"]) {
  test(`微信版本 ${version ?? "未知"} 使用隔离的域名和设备存储`, t => {
    const { config } = nativeApi(t, { getAccountInfoSync: () => ({ miniProgram: { envVersion: version } }) });
    const release = version === "release";
    assert.equal(config.API_BASE, release ? "https://rollie-rank.swimmingliu.cn" : "https://rollie-rank-test.swimmingliu.cn");
    assert.equal(config.IS_TEST_ENVIRONMENT, !release);
    assert.equal(config.storageKey("rr:history"), release ? "rr-release:rr:history" : "rr-test:device:rr:history");
  });
}

test("体验版先核对测试实例，再直接交卷", async t => {
  const calls = [];
  const { api } = nativeApi(t, {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "trial" } }),
    showModal() { assert.fail("测试交卷无需登录弹窗"); },
    request(options) {
      calls.push(options);
      options.success({ statusCode: 200, header: { "X-RollieRank-Environment": "test" }, data: { ok: true } });
    },
  });
  assert.deepEqual(await api.request("submit", {}), { ok: true });
  assert.equal(calls[0].url, "https://rollie-rank-test.swimmingliu.cn/api/catalog");
  assert.deepEqual(calls.map(call => call.method), ["GET", "POST"]);
  assert.ok(calls.every(call => call.url.startsWith("https://rollie-rank-test.swimmingliu.cn/api/")
    && !call.header?.Authorization));
});

test("开发版发现错误的环境标识时停止，正式版按正常方式请求生产", async t => {
  await t.test("测试实例缺少标识", async t => {
    const calls = [];
    const { api } = nativeApi(t, {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: "develop" } }),
      request(options) {
        calls.push(options.method);
        options.success({ statusCode: 200, data: { versions: [] } });
      },
    });
    await assert.rejects(api.request("submit", {}), /测试接口校验失败/);
    assert.deepEqual(calls, ["GET"]);
  });
  await t.test("正式版", async t => {
    const { api } = nativeApi(t, {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: "release" } }),
      request(options) {
        assert.equal(options.url, "https://rollie-rank.swimmingliu.cn/api/catalog");
        assert.equal(options.header.Authorization, undefined);
        options.success({ statusCode: 200, data: { versions: [] } });
      },
    });
    assert.deepEqual(await api.catalog(), []);
  });
});

test("首发检查忽略运营配置并计数用户数据", () => {
  const catalog = { versions: [{ id: "paper:v1" }], receipts: {}, features: {
    positions: { catalogs: { official: {} }, members: {} }, adminAuth: {}, discussions: { settings: {}, comments: [] },
  } };
  assert.ok(Object.values(firstReleaseCounts(catalog)).every(value => value === 0));
  catalog.receipts["test:receipt"] = {};
  catalog.features.positions.members.test = {};
  catalog.features.wechatProfiles = { test: {} };
  catalog.features.discussions.comments.push({});
  const counts = firstReleaseCounts(catalog);
  assert.equal(counts.attempts, 1);
  assert.equal(counts.positionMembers, 1);
  assert.equal(counts.wechatProfiles, 1);
  assert.equal(counts.comments, 1);
});

test("首发检查保留运营短链和匿名点击，要求核对带来源或截断的点击记录", () => {
  const shortLink = { code: "sample2", page: "pages/home/home", clicks: 1, clickLog: [{ at: 100, ref: "" }] };
  const catalog = { versions: [{ id: "paper:v1" }], receipts: {}, features: { shortLinks: [shortLink] } };
  assert.ok(Object.values(firstReleaseCounts(catalog)).every(count => count === 0));
  catalog.features.shortLinks = [{ ...shortLink, clicks: 2 }];
  assert.throws(() => firstReleaseCounts(catalog), /尚未核对的访问记录/);
  catalog.features.shortLinks = [{ ...shortLink, clickLog: [{ at: 100, ref: "unscreened-origin" }] }];
  assert.throws(() => firstReleaseCounts(catalog), /尚未核对的访问记录/);
});

test("联调拒绝生产地址、未标记的本机接口以及跳转", async t => {
  await assert.rejects(requireTestApi(), /请指定测试接口/);
  await assert.rejects(requireTestApi("https://rollie-rank.swimmingliu.cn"), /请指定测试接口/);

  let redirect = false;
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    if (redirect) response.writeHead(307, { Location: "/wrong-target" });
    response.end("{}");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const launch = () => run(process.execPath, ["mini-program/tools/e2e.mjs"], {
    cwd, env: { ...process.env, MINIPROGRAM_API_BASE: origin },
  });
  await assert.rejects(launch(), /未标记为 RollieRank 测试环境/);
  redirect = true;
  await assert.rejects(launch(), /fetch failed/);
  assert.deepEqual(requests, ["GET /api/catalog", "GET /api/catalog"]);
});

test("测试启动缺少独立的数据目录或 systemd 监听描述符时退出", async () => {
  await assert.rejects(run(process.execPath, ["scripts/serve.mjs", "--test-environment"], {
    cwd, env: { ...process.env, ROLLIERANK_DATA_DIR: "", PORT: "4175" },
  }), /需要独立的数据目录和端口/);
  await assert.rejects(run(process.execPath, ["scripts/serve.mjs", "--test-environment", "--systemd-socket"], {
    cwd, env: { ...process.env, LISTEN_FDS: "0", LISTEN_PID: "" },
  }), /需要 systemd 提供一个监听套接字/);
});

test("卷豆部署检查区分网页口令、旧后端和正确的未登录响应", async t => {
  let mode = "proxy-auth";
  const server = createServer((request, response) => {
    if (mode === "proxy-auth") {
      response.writeHead(401, { "WWW-Authenticate": 'Basic realm="RollieRank test"' }).end();
      return;
    }
    response.setHeader("X-RollieRank-Environment", "test");
    response.setHeader("Content-Type", "application/json");
    if (mode === "old-backend") {
      response.writeHead(404).end(JSON.stringify({ error: "接口不存在。" }));
    } else if (request.url === "/api/tool-credits/capabilities") {
      response.end(JSON.stringify({ login: true, purchase: { tokenRecharge: true, tokenRechargeIos: false,
        packages: [{ credits: 5, cents: 500 }] } }));
    } else if (request.url === "/api/tool-credits/quote?tool=answer-sheet") {
      response.end(JSON.stringify({ tool: "answer-sheet", cost: 1 }));
    } else {
      response.writeHead(401).end(JSON.stringify({ errorId: "login" }));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const verify = () => run(process.execPath, [
    "scripts/verify-test-wallet.mjs", `http://127.0.0.1:${server.address().port}`, "--login-ready", "--recharge-ready",
  ], { cwd });

  await assert.rejects(verify(), /缺少测试环境标识/);
  mode = "old-backend";
  await assert.rejects(verify(), /HTTP 状态有误/);
  mode = "live";
  assert.deepEqual(JSON.parse((await verify()).stdout), {
    environment: "test", login: true, recharge: true, walletAuth: true, webAuth: false, scanCost: 1,
  });
});

test("本机验收包只访问测试 API 并使用独立的本地记录", async t => {
  const server = createServer((request, response) => {
    if (request.url === "/api/catalog") {
      response.writeHead(200, { "X-RollieRank-Environment": "test" }).end("{}");
    } else if (request.url === "/ios-v3/app.html") {
      response.end("paper-cards-1114-v3");
    } else {
      response.writeHead(410).end("{}");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const directory = await mkdtemp(join(tmpdir(), "rollierank-test-package-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, "package");
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  await run(process.execPath, ["mini-program/tools/build-shared.mjs", origin, output], { cwd });
  const config = require(join(output, "config.js"));
  const storage = require(join(output, "utils/storage.js"));
  const timing = require(join(output, "utils/timing.js"));
  assert.equal(config.API_BASE, origin);
  assert.equal(storage.KEYS.guest, `rr-test:${port}:rr:guest`);
  assert.equal(storage.KEYS.history, `rr-test:${port}:rr:history`);
  assert.equal(timing.TIMER_KEY, `rr-test:${port}:rr:timer`);
  assert.equal(require("../mini-program/utils/storage.js").KEYS.history, "rr-test:device:rr:history");
});
