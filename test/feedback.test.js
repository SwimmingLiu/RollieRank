import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { createApi } from "../server/api.mjs";
import { buildSubscribeMessageData, formatSubscribeFieldValue } from "../server/feedback.mjs";
import { firstReleaseCounts } from "../deploy/check-first-release.mjs";
import { pngUri } from "./discussions-fixtures.mjs";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

async function startFeedbackServer({ feedbackOptions, env } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "rollierank-feedback-"));
  const dataDirectory = pathToFileURL(dir + path.sep);
  const api = await createApi({
    dataDirectory,
    feedbackOptions: {
      ...(feedbackOptions || {}),
      ...(env ? { env } : {}),
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
  return {
    dir,
    baseUrl,
    async request(p, body, headers = {}) {
      const res = await fetch(`${baseUrl}${p}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data, headers: res.headers };
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("WeChat subscribe message field formatter enforces WeChat length and format rules", () => {
  const ts = Date.UTC(2026, 10, 22, 6, 35); // 2026-11-22 14:35 Asia/Shanghai
  assert.equal(formatSubscribeFieldValue("time3", "", ts), "2026-11-22 14:35");
  assert.equal(formatSubscribeFieldValue("date1", "", ts), "2026-11-22");
  assert.equal(formatSubscribeFieldValue("thing2", "12345678901234567890123456", ts), "1234567890123456789…");
  assert.equal(formatSubscribeFieldValue("phrase1", "功能建议反馈超长", ts), "功能建议反");

  const data = buildSubscribeMessageData(
    { categoryKey: "thing1", contentKey: "thing2", timeKey: "time3", userKey: "" },
    { category: "bug", content: "提交成绩页面白屏了\n请尽快排查", nickname: "卷友8888", createdAt: ts },
  );
  assert.deepEqual(Object.keys(data), ["thing1", "thing2", "time3"]);
  assert.equal(data.thing1.value, "问题报错");
  assert.equal(data.thing2.value, "提交成绩页面白屏了 请尽快排查");
  assert.equal(data.time3.value, "2026-11-22 14:35");
});

test("User feedback submission, isolation, admin WeChat subscribe reminder, quota & error recovery", async () => {
  const wechatCalls = [];
  let tokenCount = 0;
  let nextSendResponse = { errcode: 0, errmsg: "ok" };

  const mockFetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(init.body) : null;
    wechatCalls.push({ path: u.pathname, query: Object.fromEntries(u.searchParams), body });
    if (u.pathname === "/cgi-bin/stable_token") {
      tokenCount += 1;
      return new Response(JSON.stringify({ access_token: `tok-${tokenCount}`, expires_in: 7200 }), { status: 200 });
    }
    if (u.pathname === "/sns/jscode2session") {
      return new Response(JSON.stringify({ openid: `openid-${u.searchParams.get("js_code")}` }), { status: 200 });
    }
    if (u.pathname === "/cgi-bin/message/subscribe/send") {
      const reply = typeof nextSendResponse === "function" ? nextSendResponse(body, u.searchParams) : nextSendResponse;
      return new Response(JSON.stringify(reply), { status: 200 });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const reviewToken = "test-review-secret-token";
  const srv = await startFeedbackServer({
    env: {
      ROLLIERANK_REVIEW_TOKEN: reviewToken,
      ROLLIERANK_WECHAT_APP_ID: "wx_test_appid",
      ROLLIERANK_WECHAT_APP_SECRET: "wx_test_secret",
      ROLLIERANK_WECHAT_FEEDBACK_TEMPLATE_ID: "tmpl_feedback_123456",
      ROLLIERANK_WECHAT_SUBSCRIBE_STATE: "trial",
    },
    feedbackOptions: { fetchImpl: mockFetch },
  });

  try {
    // 1. Validation checks
    const badCat = await srv.request("/api/feedback", { guestId: "guest-user-0001", category: "invalid", content: "hello" });
    assert.equal(badCat.status, 400);
    const emptyContent = await srv.request("/api/feedback", { guestId: "guest-user-0001", category: "bug", content: "   " });
    assert.equal(emptyContent.status, 400);

    // 2. Unauthorized admin subscribe is rejected
    const unauth = await srv.request("/api/feedback/admin/subscribe", { reviewToken: "wrong", wxCode: "admin-code-1" });
    assert.equal(unauth.status, 403);

    // 3. Admin subscribes twice -> quota reaches 2
    const sub1 = await srv.request("/api/feedback/admin/subscribe", {
      reviewToken,
      wxCode: "admin-code-1",
      label: "主管理员",
      accepted: true,
    });
    assert.equal(sub1.status, 200);
    assert.equal(sub1.data.subscriber.quota, 1);
    assert.equal(sub1.data.notify.totalQuota, 1);

    const sub2 = await srv.request("/api/feedback/admin/subscribe", {
      reviewToken,
      wxCode: "admin-code-1",
      label: "主管理员",
      accepted: true,
    });
    assert.equal(sub2.status, 200);
    assert.equal(sub2.data.subscriber.quota, 2);

    // 4. User submits feedback with screenshot -> triggers WeChat subscribe send & decrements quota 2 -> 1
    const sampleImg = pngUri();
    const submitRes = await srv.request("/api/feedback", {
      feedbackId: "fb-idempotent-001",
      guestId: "guest-user-0001",
      nickname: "小卷",
      category: "suggestion",
      content: "希望能增加深色模式，晚上刷题眼睛更舒服一些！",
      contact: "wxid_test123",
      images: [{ dataUri: sampleImg, alt: "首页截图" }],
      clientMeta: { platform: "miniprogram", envVersion: "trial", appVersion: "1.0.0" },
    });
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.data.feedback.status, "pending");
    assert.equal(submitRes.data.feedback.images.length, 1);
    assert.equal(submitRes.data.notified.attempted, 1);
    assert.equal(submitRes.data.notified.sent, 1);

    const sendCall = wechatCalls.find((c) => c.path === "/cgi-bin/message/subscribe/send");
    assert.ok(sendCall);
    assert.equal(sendCall.body.touser, "openid-admin-code-1");
    assert.equal(sendCall.body.template_id, "tmpl_feedback_123456");
    assert.equal(sendCall.body.miniprogram_state, "trial");
    assert.equal(sendCall.body.page, "pages/admin/admin");
    assert.equal(sendCall.body.data.thing1.value, "功能建议");
    assert.ok(sendCall.body.data.thing2.value.length <= 20);

    // Idempotent replay should NOT send a second notification
    const replayRes = await srv.request("/api/feedback", {
      feedbackId: "fb-idempotent-001",
      guestId: "guest-user-0001",
      category: "suggestion",
      content: "希望能增加深色模式，晚上刷题眼睛更舒服一些！",
    });
    assert.equal(replayRes.status, 200);
    assert.equal(replayRes.data.notified.attempted, 0);

    // 5. Isolation: another user cannot see guest-user-0001's feedback
    const mineOther = await srv.request("/api/feedback/mine?guestId=guest-user-9999");
    assert.equal(mineOther.status, 200);
    assert.equal(mineOther.data.items.length, 0);

    const mineSelf = await srv.request("/api/feedback/mine?guestId=guest-user-0001");
    assert.equal(mineSelf.status, 200);
    assert.equal(mineSelf.data.items.length, 1);
    assert.equal(mineSelf.data.items[0].id, "fb-idempotent-001");

    // 6. Token expired (40001) triggers automatic token refresh retry
    let attemptCount = 0;
    nextSendResponse = () => {
      attemptCount += 1;
      return attemptCount === 1
        ? { errcode: 40001, errmsg: "invalid credential" }
        : { errcode: 0, errmsg: "ok" };
    };
    const submit2 = await srv.request("/api/feedback", {
      guestId: "guest-user-0001",
      category: "bug",
      content: "计时器偶尔重置",
    });
    assert.equal(submit2.status, 200);
    assert.equal(submit2.data.notified.sent, 1);
    assert.equal(attemptCount, 2);
    assert.equal(tokenCount, 2);

    // Quota is now 0 -> admin re-subscribes (+1) and then hits 43101 -> quota zeroed gracefully
    await srv.request("/api/feedback/admin/subscribe", {
      reviewToken,
      wxCode: "admin-code-1",
      label: "主管理员",
      accepted: true,
    });
    nextSendResponse = { errcode: 43101, errmsg: "user refuse to accept the msg" };
    const submit3 = await srv.request("/api/feedback", {
      guestId: "guest-user-0001",
      category: "paper",
      content: "希望补充 2027 联考模考卷",
    });
    assert.equal(submit3.status, 200);
    assert.equal(submit3.data.notified.attempted, 1);
    assert.equal(submit3.data.notified.sent, 0);

    // 7. Mini-program admin only checks push status (no feedback list/reply endpoints in mini-program)
    const notifyStatus = await srv.request("/api/feedback/admin/notify-status", { reviewToken });
    assert.equal(notifyStatus.status, 200);
    assert.equal(notifyStatus.data.items, undefined);
    assert.equal(notifyStatus.data.notify.totalQuota, 0);
    assert.match(notifyStatus.data.notify.subscribers[0].lastError, /订阅次数已用完/);

    const blockedMpList = await srv.request("/api/feedback/admin/list", { reviewToken, status: "pending" });
    assert.equal(blockedMpList.status, 404);
    const blockedMpReply = await srv.request("/api/feedback/admin/reply", {
      reviewToken,
      feedbackId: "fb-idempotent-001",
      status: "replied",
      replyText: "should not work",
    });
    assert.equal(blockedMpReply.status, 404);

    // 8. Web Admin Console records every feedback & handles replies
    const setupRes = await srv.request("/admin/api/setup", {
      username: "admin",
      password: "StrongPassword123",
      confirmPassword: "StrongPassword123",
    });
    assert.equal(setupRes.status, 200);
    const cookie = setupRes.headers.get("set-cookie").split(";")[0];

    const consoleList = await srv.request("/admin/api/feedback?status=pending", undefined, { Cookie: cookie });
    assert.equal(consoleList.status, 200);
    assert.equal(consoleList.data.summary.pending, 3);

    const replyRes = await srv.request(
      "/admin/api/feedback/update",
      {
        feedbackId: "fb-idempotent-001",
        status: "replied",
        replyText: "收到！深色模式已排入下一版计划。",
      },
      { Cookie: cookie },
    );
    assert.equal(replyRes.status, 200);
    assert.equal(replyRes.data.feedback.status, "replied");

    // User immediately sees the reply in /api/feedback/mine
    const mineAfterReply = await srv.request("/api/feedback/mine?guestId=guest-user-0001");
    assert.equal(mineAfterReply.data.repliedCount, 1);
    assert.ok(mineAfterReply.data.latestReplyAt > 0);
    const updatedItem = mineAfterReply.data.items.find((i) => i.id === "fb-idempotent-001");
    assert.equal(updatedItem.reply.text, "收到！深色模式已排入下一版计划。");
  } finally {
    await srv.close();
  }
});

test("Web Admin Console feedback management, notification settings, CLI and Playwright UI", async () => {
  const srv = await startFeedbackServer();
  try {
    // Submit a feedback item
    const created = await srv.request("/api/feedback", {
      guestId: "guest-console-01",
      nickname: "考公小王",
      category: "bug",
      content: "个人中心切回首页偶发卡顿",
      contact: "wang@example.com",
    });
    assert.equal(created.status, 200);
    const fbId = created.data.feedback.id;

    // Setup admin account
    const setupRes = await srv.request("/admin/api/setup", {
      username: "admin",
      password: "StrongPassword123",
      confirmPassword: "StrongPassword123",
    });
    assert.equal(setupRes.status, 200);
    const cookie = setupRes.headers.get("set-cookie").split(";")[0];

    // Overview metrics reflect pending user feedback & skipped push summary is recorded
    const ov = await srv.request("/admin/api/overview", undefined, { Cookie: cookie });
    assert.equal(ov.status, 200);
    assert.equal(ov.data.metrics.pendingFeedbacks, 1);
    assert.equal(ov.data.metrics.totalFeedbacks, 1);

    const listWithSkip = await srv.request("/admin/api/feedback?status=pending", undefined, { Cookie: cookie });
    assert.equal(listWithSkip.status, 200);
    assert.equal(listWithSkip.data.items[0].notifySummary.attempted, 0);
    assert.ok(listWithSkip.data.items[0].notifySummary.skippedReason);

    // Update notify settings via admin console
    const notifyUpd = await srv.request(
      "/admin/api/feedback/notify-settings",
      {
        enabled: true,
        templateId: "tmpl_console_999999",
        miniprogramState: "formal",
        page: "pages/admin/admin",
        fieldMap: { categoryKey: "thing1", contentKey: "thing2", timeKey: "time3", userKey: "thing4" },
      },
      { Cookie: cookie },
    );
    assert.equal(notifyUpd.status, 200);
    assert.equal(notifyUpd.data.notify.templateId, "tmpl_console_999999");

    // Playwright real browser test for Web Admin Console #feedback view
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
      await page.goto(`${srv.baseUrl}/admin/`);
      await page.fill("#login-user", "admin");
      await page.fill("#login-pass", "StrongPassword123");
      await page.click('button[type="submit"]');
      await page.waitForSelector('button[data-nav="feedback"]');
      await page.click('button[data-nav="feedback"]');
      await page.waitForSelector("text=个人中心切回首页偶发卡顿");
      const visualDir = path.join(ROOT, "test-results/verification/visual");
      await mkdir(visualDir, { recursive: true });
      await page.screenshot({ path: path.join(visualDir, "feedback-admin-desktop.png"), fullPage: true });

      // Open reply modal and reply
      await page.click('tbody button:has-text("处理")');
      await page.waitForSelector("#feedback-reply-textarea");
      await page.fill("#feedback-reply-textarea", "已定位并修复，感谢反馈！");
      await page.click('button[form="feedback-reply-form"]');
      await page.waitForSelector("text=已保存处理结果");

      // Open WeChat notify settings modal and verify saved template ID
      await page.click('button:has-text("微信提醒")');
      await page.waitForSelector("#notify-template-id");
      const val = await page.inputValue("#notify-template-id");
      assert.equal(val, "tmpl_console_999999");
      await page.screenshot({ path: path.join(visualDir, "feedback-admin-notify-modal.png") });
    } finally {
      await browser.close();
    }

    // Verify CLI feedback list & status update
    const { stdout } = await execFileAsync(
      process.execPath,
      [path.join(ROOT, "scripts/rollie-admin.mjs"), "feedback", "list", "--data-dir", srv.dir, "--json"],
      { cwd: ROOT, timeout: 15000 },
    );
    const cliList = JSON.parse(stdout);
    assert.equal(cliList.summary.replied, 1);
    assert.equal(cliList.items[0].id, fbId);
    assert.equal(cliList.items[0].reply.text, "已定位并修复，感谢反馈！");

    // Check first-release gate recognizes feedback feature and flags non-zero userFeedback
    const catalogJson = JSON.parse(await readFile(path.join(srv.dir, "catalog.json"), "utf8"));
    const countsWithData = firstReleaseCounts(catalogJson);
    assert.equal(countsWithData.userFeedback, 1);

    // Delete feedback via admin console -> counts should drop to 0
    const del = await srv.request("/admin/api/feedback/delete", { feedbackId: fbId }, { Cookie: cookie });
    assert.equal(del.status, 200);
    const catalogAfterDel = JSON.parse(await readFile(path.join(srv.dir, "catalog.json"), "utf8"));
    assert.equal(firstReleaseCounts(catalogAfterDel).userFeedback, 0);
  } finally {
    await srv.close();
  }
});

test("Mini-program feedback entries and synchronous subscribe message invocation contract", () => {
  const appJson = JSON.parse(readFileSync(path.join(ROOT, "mini-program/app.json"), "utf8"));
  assert.ok(appJson.pages.includes("pages/feedback/feedback"));
  assert.equal(appJson.tabBar.list[1].text, "个人中心");

  const tabbarJs = readFileSync(path.join(ROOT, "mini-program/components/rr-tabbar/rr-tabbar.js"), "utf8");
  assert.match(tabbarJs, /label:\s*"个人中心"/);

  const recordsWxml = readFileSync(path.join(ROOT, "mini-program/pages/records/records.wxml"), "utf8");
  const profileWxml = readFileSync(path.join(ROOT, "mini-program/pages/profile/profile.wxml"), "utf8");
  const feedbackWxml = readFileSync(path.join(ROOT, "mini-program/pages/feedback/feedback.wxml"), "utf8");
  const adminWxml = readFileSync(path.join(ROOT, "mini-program/pages/admin/admin.wxml"), "utf8");
  const settingsJs = readFileSync(path.join(ROOT, "mini-program/pages/settings/settings.js"), "utf8");
  assert.match(recordsWxml, /<rr-nav[^>]*title="个人中心"[^>]*action-icon="comment"[^>]*bind:action="openFeedback"/);
  assert.match(profileWxml, /bindtap="openFeedback"/);
  assert.doesNotMatch(feedbackWxml, /openAdmin|维护者/, "feedback page should not expose admin entry in mini-program");
  assert.doesNotMatch(adminWxml, /userFeedbacks|openUserFeedback/, "mini-program admin page should not list user feedback records");
  assert.match(settingsJs, /wx\.navigateBack/, "saving nickname should navigate back to profile page");

  const adminJs = readFileSync(path.join(ROOT, "mini-program/pages/admin/admin.js"), "utf8");
  const match = adminJs.match(/subscribeFeedbackNotify\s*\(\)\s*\{([\s\S]*?)wx\.requestSubscribeMessage/);
  assert.ok(match, "admin.js should invoke wx.requestSubscribeMessage in subscribeFeedbackNotify");
  const codeWithoutComments = match[1].replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(codeWithoutComments, /\bawait\b/, "wx.requestSubscribeMessage must be invoked synchronously before any await");
});

test("Mini-program feedback page and personal center nav icon pass visual layout checks at 320, 390 and 430 widths", async () => {
  const visualDir = path.join(ROOT, "test-results/verification/visual");
  await mkdir(visualDir, { recursive: true });
  const appWxss = (await readFile(path.join(ROOT, "mini-program/app.wxss"), "utf8"))
    .replace(/(\d+(?:\.\d+)?)rpx/g, (_, n) => `${Number(n) * 0.5}px`)
    .replace(/^page\b/gm, "body");
  const fbWxss = (await readFile(path.join(ROOT, "mini-program/pages/feedback/feedback.wxss"), "utf8"))
    .replace(/(\d+(?:\.\d+)?)rpx/g, (_, n) => `${Number(n) * 0.5}px`)
    .replace(/\bimage\b/g, "img");
  const navWxss = (await readFile(path.join(ROOT, "mini-program/components/rr-nav/rr-nav.wxss"), "utf8"))
    .replace(/(\d+(?:\.\d+)?)rpx/g, (_, n) => `${Number(n) * 0.5}px`)
    .replace(/\bimage\b/g, "img");
  const iconUri = async (name) => {
    const svg = await readFile(path.join(ROOT, "mini-program/assets/ui", name), "utf8");
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };
  const icons = {
    back: await iconUri("back.svg"),
    comment: await iconUri("comment.svg"),
    help: await iconUri("help.svg"),
    warn: await iconUri("warn.svg"),
    book: await iconUri("book.svg"),
    image: await iconUri("image.svg"),
    lock: await iconUri("lock.svg"),
  };
  const renderHtml = (navHtml, bodyHtml, footerHtml = "") => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
/* 模拟微信 style:"v2" 默认 button 居中与 disabled 浅灰洗白，防止真机退化 */
button { margin-left: auto; margin-right: auto; border: none; font-family: inherit; cursor: pointer; }
button[disabled] { background-color: #f7f7f7; color: rgba(0, 0, 0, 0.3); }
${appWxss}
${navWxss}
${fbWxss}
body { margin: 0; overflow: auto; height: auto; min-height: 100vh; }
img { display: block; }
</style></head><body>
${navHtml}
${bodyHtml}
${footerHtml}
</body></html>`;

  const submitHtml = (disabled) => renderHtml(
    `<div class="nav" style="padding-top:12px;--menu-clearance:96px;"><div class="nav__bar nav__bar--action" style="height:44px;"><button class="nav__back" type="button"><img class="nav__back-icon" src="${icons.back}" alt="" /></button><span class="nav__title">意见反馈</span><button class="nav__action" type="button"><span>记录</span><span class="nav__dot"></span></button></div></div>`,
    `
  <div class="fb__scroll-submit"><div class="fb">
    <div class="fb__form">
      <div class="fb__cats">
        <button class="fb__cat fb__cat--on" type="button"><img class="fb__cat-icon" src="${icons.help}" alt="" /><span>功能建议</span></button>
        <button class="fb__cat" type="button"><img class="fb__cat-icon" src="${icons.warn}" alt="" /><span>问题报错</span></button>
        <button class="fb__cat" type="button"><img class="fb__cat-icon" src="${icons.book}" alt="" /><span>试卷缺失</span></button>
        <button class="fb__cat" type="button"><img class="fb__cat-icon" src="${icons.comment}" alt="" /><span>其他</span></button>
      </div>
      <div class="fb__composer">
        <textarea class="fb__textarea" placeholder="说说想新增或优化的功能…">${disabled ? "" : "希望能增加夜间模式，晚上刷题更护眼。"}</textarea>
        <div class="fb__composer-foot">
          <div class="fb__images"><button class="fb__add-img" type="button"><img src="${icons.image}" alt="" /><span class="num">0/3</span></button></div>
          <span class="fb__counter num">${disabled ? "0/1000" : "18/1000"}</span>
        </div>
      </div>
      <div class="fb__contact-card">
        <img class="fb__contact-icon" src="${icons.comment}" alt="" />
        <input class="fb__contact-input grow" value="${disabled ? "" : "wxid_rollie"}" placeholder="联系方式 · 微信号或邮箱（选填）" />
      </div>
    </div>
  </div></div>`,
    `<div class="footer-bar"><button class="fb__submit" type="button"${disabled ? " disabled" : ""}>提交反馈</button></div>`,
  );

  const personalCenterNavHtml = renderHtml(
    `<div class="nav" style="padding-top:12px;--menu-clearance:96px;"><div class="nav__bar nav__bar--action" style="height:44px;"><span class="nav__title">个人中心</span><button class="nav__action" type="button" aria-label="意见反馈"><img class="nav__icon" src="${icons.comment}" alt="" /><span class="nav__dot"></span></button></div></div>`,
    ``,
  );

  const browser = await chromium.launch();
  try {
    for (const width of [320, 390, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 760 } });
      await page.setContent(submitHtml(true));
      const emptyCheck = await page.evaluate(() => {
        const composer = document.querySelector(".fb__composer").getBoundingClientRect();
        const addBtn = document.querySelector(".fb__add-img").getBoundingClientRect();
        const submitStyle = getComputedStyle(document.querySelector(".fb__submit"));
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          addLeftDelta: addBtn.left - composer.left,
          disabledBg: submitStyle.backgroundColor,
        };
      });
      assert.equal(emptyCheck.overflow, false, `feedback submit page overflows horizontally at ${width}px`);
      assert.ok(emptyCheck.addLeftDelta <= 24, `photo upload tile must be flush-left, not centered (delta=${emptyCheck.addLeftDelta})`);
      assert.notEqual(emptyCheck.disabledBg, "rgb(247, 247, 247)", "disabled submit button must not wash out to WeChat default #f7f7f7");
      if (width === 390) {
        await page.screenshot({ path: path.join(visualDir, "feedback-mp-submit-empty-390.png") });
      }

      await page.setContent(submitHtml(false));
      if (width === 320 || width === 390) {
        await page.screenshot({ path: path.join(visualDir, `feedback-mp-submit-${width}.png`) });
      }
      await page.setContent(personalCenterNavHtml);
      const navCheck = await page.evaluate(() => {
        const title = document.querySelector(".nav__title").getBoundingClientRect();
        const action = document.querySelector(".nav__action").getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > window.innerWidth, gap: action.left - title.right };
      });
      assert.equal(navCheck.overflow, false, `personal center nav overflows at ${width}px`);
      assert.ok(navCheck.gap >= 4, `nav title collides with feedback icon at ${width}px (gap=${navCheck.gap})`);
      if (width === 390) {
        await page.screenshot({ path: path.join(visualDir, "feedback-mp-personal-nav-390.png") });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
