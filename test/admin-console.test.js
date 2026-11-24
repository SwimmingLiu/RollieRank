import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { createApi } from "../server/api.mjs";
import { pngUri } from "./discussions-fixtures.mjs";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

async function runCli(args) {
  const { stdout } = await execFileAsync(process.execPath, [path.join(ROOT, "scripts/rollie-admin.mjs"), ...args], {
    cwd: ROOT,
    timeout: 15000,
  });
  return JSON.parse(stdout);
}

async function startConsoleServer({ dir: existingDir } = {}) {
  const dir = existingDir ?? await mkdtemp(path.join(tmpdir(), "rollierank-console-"));
  const dataDirectory = pathToFileURL(dir + path.sep);
  const api = await createApi({ dataDirectory });
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
  };
  const server = createServer(async (request, response) => {
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
    json,
    async close({ remove = true } = {}) {
      await new Promise((resolve) => server.close(resolve));
      if (remove) await rm(dir, { recursive: true, force: true });
    },
  };
}

test("React/BaseUI/beUI /admin/ console supports setup, password change, moderation, users, points and omits paper catalog", async (t) => {
  const prevUser = process.env.ROLLIERANK_ADMIN_USER;
  const prevPass = process.env.ROLLIERANK_ADMIN_PASSWORD;
  delete process.env.ROLLIERANK_ADMIN_USER;
  delete process.env.ROLLIERANK_ADMIN_PASSWORD;
  t.after(() => {
    if (prevUser === undefined) delete process.env.ROLLIERANK_ADMIN_USER; else process.env.ROLLIERANK_ADMIN_USER = prevUser;
    if (prevPass === undefined) delete process.env.ROLLIERANK_ADMIN_PASSWORD; else process.env.ROLLIERANK_ADMIN_PASSWORD = prevPass;
  });

  const server = await startConsoleServer();
  t.after(() => server.close());

  const catalog = (await server.json("/api/catalog")).body;
  const version = catalog.versions[0];
  const guestId = "guest-console-user-01";
  const attemptId = "attempt-console-user-01";
  assert.equal((await server.json("/api/submit", {
    guestId, attemptId, versionId: version.id, name: "小红薯考生",
    answers: Array(version.questionCount).fill("A"),
  })).status, 200);
  const posted = await server.json("/api/discussions", {
    paperId: version.paperId, attemptId, guestId,
    clientId: "client-console-001", nickname: "小红薯考生",
    text: "这套资料分析计算量适中，附一张笔记图",
    images: [{ dataUri: pngUri(), alt: "笔记" }],
  });
  assert.equal(posted.status, 201);

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${server.baseUrl}/admin/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#setup-form");
  await page.fill("#setup-user", "opsadmin");
  await page.fill("#setup-pass", "FirstPass123!");
  await page.fill("#setup-confirm", "FirstPass123!");
  await page.click('#setup-form button[type="submit"]');
  await page.waitForSelector(".console");

  // Paper catalog management must NOT appear in the admin navigation.
  const navText = await page.locator("aside nav").textContent();
  assert.equal(navText.includes("套卷管理"), false);

  // Verify DB stores salted hash (never plaintext) and blocks second setup.
  const dbRaw = await readFile(path.join(server.dir, "catalog.json"), "utf8");
  assert.equal(dbRaw.includes("FirstPass123!"), false);
  assert.equal((await server.json("/api/console/setup", { username: "attacker", password: "NewPassword999", confirmPassword: "NewPassword999" })).status, 409);

  // Users view -> Base UI Drawer detail.
  await page.click('[data-nav="users"]');
  await page.waitForSelector('[data-action="open-user-drawer"]');
  await page.click('[data-action="open-user-drawer"]');
  await page.waitForSelector('[role="dialog"]');
  await page.keyboard.press("Escape");

  // Points view -> Base UI Modal grant +20 points.
  await page.click('[data-nav="points"]');
  await page.getByRole("button", { name: "发放积分" }).click();
  await page.waitForSelector("#grant-points-form");
  await page.selectOption("#grant-target-select", guestId);
  await page.fill("#grant-delta-input", "20");
  await page.fill("#grant-reason-input", "管理员手动发放测试");
  await page.click('button[form="grant-points-form"]');
  await page.waitForFunction(() => document.body.textContent.includes("管理员手动发放测试"));

  // Comments view -> Base UI Tabs -> all comments visible.
  await page.click('[data-nav="comments"]');
  await page.waitForSelector('[data-filter-tab="all"]');
  await page.click('[data-filter-tab="all"]');
  await page.waitForSelector(".comment-row");

  // Change password via Base UI Modal.
  await page.click('[data-action="open-password-modal"]');
  await page.waitForSelector("#password-change-form");
  await page.fill('#password-change-form [name="currentPassword"]', "FirstPass123!");
  await page.fill('#password-change-form [name="newPassword"]', "UpdatedPass456!");
  await page.fill('#password-change-form [name="confirmPassword"]', "UpdatedPass456!");
  await page.click('button[form="password-change-form"]');
  await page.waitForFunction(() => !document.querySelector("#password-change-form"));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `admin console must not overflow horizontally (got ${overflow}px)`);
  assert.deepEqual(errors, []);

  // Logout & verify persistence across restart.
  await page.click('[data-action="logout"]');
  await page.waitForSelector("#login-form");
  const dir = server.dir;
  await server.close({ remove: false });

  const restarted = await startConsoleServer({ dir });
  t.after(() => restarted.close({ remove: true }));
  assert.equal((await restarted.json("/api/console/login", { username: "opsadmin", password: "FirstPass123!" })).status, 401);
  const relogin = await restarted.json("/api/console/login", { username: "opsadmin", password: "UpdatedPass456!" });
  assert.equal(relogin.status, 200);

  // CLI remote mode verification (--url + --token).
  const remoteOverview = await runCli(["overview", "--url", restarted.baseUrl, "--token", relogin.body.token, "--json"]);
  assert.equal(remoteOverview.metrics.totalUsers, 1);
  assert.equal(remoteOverview.metrics.totalPointsBalance, 20);

  const remoteGrant = await runCli([
    "points", "grant", "--url", restarted.baseUrl, "--token", relogin.body.token,
    "--users", guestId, "--delta", "30", "--type", "activity", "--reason", "CLI 远程发放", "--json",
  ]);
  assert.equal(remoteGrant.count, 1);
  assert.equal(remoteGrant.entries[0].balanceAfter, 50);

  await runCli(["users", "mute", guestId, "--url", restarted.baseUrl, "--token", relogin.body.token, "--reason", "CLI 禁言", "--json"]);
  assert.equal((await restarted.json("/api/discussions", {
    paperId: version.paperId, attemptId, guestId,
    clientId: "client-muted-cli", nickname: "小红薯考生", text: "禁言中发言",
  })).status, 403);
  await runCli(["users", "unmute", guestId, "--url", restarted.baseUrl, "--token", relogin.body.token, "--json"]);

  // CLI local direct mode verification (--data-dir) without needing password.
  const localComments = await runCli(["comments", "list", "--data-dir", dir, "--status", "all", "--json"]);
  assert.equal(localComments.total, 1);
  await runCli(["comments", "approve", posted.body.comment.id, "--data-dir", dir, "--reward", "10", "--json"]);
  await runCli(["comments", "reject", posted.body.comment.id, "--data-dir", dir, "--reason", "CLI 本地拒绝清除", "--json"]);
  const afterReject = await runCli(["comments", "list", "--data-dir", dir, "--status", "all", "--json"]);
  assert.equal(afterReject.total, 0);

  const localAudit = await runCli(["audit", "list", "--data-dir", dir, "--json"]);
  assert.ok(localAudit.total >= 4);
});

test("admin console enforces single-use setup and brute-force IP lockout", async (t) => {
  const prevReview = process.env.ROLLIERANK_REVIEW_TOKEN;
  const prevPass = process.env.ROLLIERANK_ADMIN_PASSWORD;
  process.env.ROLLIERANK_REVIEW_TOKEN = "prod-review-token";
  delete process.env.ROLLIERANK_ADMIN_PASSWORD;
  t.after(() => {
    if (prevReview === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = prevReview;
    if (prevPass === undefined) delete process.env.ROLLIERANK_ADMIN_PASSWORD; else process.env.ROLLIERANK_ADMIN_PASSWORD = prevPass;
  });

  const server = await startConsoleServer();
  t.after(() => server.close());

  const sess = await server.json("/api/console/session");
  assert.equal(sess.body.needsSetup, true);

  // First-time setup only needs username + password.
  assert.equal((await server.json("/api/console/setup", {
    username: "opsadmin", password: "StrongPassword1!", confirmPassword: "StrongPassword1!",
  }, { "X-Real-IP": "198.51.100.11" })).status, 200);

  // Repeat setup is permanently closed with 409.
  assert.equal((await server.json("/api/console/setup", {
    username: "other", password: "AnotherPassword1!", confirmPassword: "AnotherPassword1!",
  }, { "X-Real-IP": "198.51.100.12" })).status, 409);

  // 5 consecutive bad login attempts from one IP trigger 429 lockout with Retry-After.
  const attackerIp = { "X-Real-IP": "203.0.113.77" };
  for (let i = 0; i < 5; i++) {
    const attempt = await server.json("/api/console/login", { username: "opsadmin", password: `wrong-${i}` }, attackerIp);
    assert.equal(attempt.status, 401);
  }
  const locked = await server.json("/api/console/login", { username: "opsadmin", password: "StrongPassword1!" }, attackerIp);
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get("retry-after")) > 0);

  // Another legitimate IP is not blocked by the attacker's IP lock.
  const legit = await server.json("/api/console/login", { username: "opsadmin", password: "StrongPassword1!" }, { "X-Real-IP": "198.51.100.22" });
  assert.equal(legit.status, 200);
});

test("custom ROLLIERANK_ADMIN_PATH hides default /admin and /api/console routes behind 404", async (t) => {
  const prevPath = process.env.ROLLIERANK_ADMIN_PATH;
  process.env.ROLLIERANK_ADMIN_PATH = "/ops-hidden-9x7k";
  t.after(() => {
    if (prevPath === undefined) delete process.env.ROLLIERANK_ADMIN_PATH;
    else process.env.ROLLIERANK_ADMIN_PATH = prevPath;
  });

  const server = await startConsoleServer();
  t.after(() => server.close());

  assert.equal((await server.json("/api/console/session")).status, 404);
  const custom = await server.json("/ops-hidden-9x7k/api/session");
  assert.equal(custom.status, 200);
  assert.equal(custom.body.needsSetup, true);
});
