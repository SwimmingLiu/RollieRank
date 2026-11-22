import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createApi } from "../server/api.mjs";
import { createWechatModeration } from "../server/wechat-moderation.mjs";
import { pngUri } from "./discussions-fixtures.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

function signCallback(token, timestamp, nonce) {
  return createHash("sha1").update([token, timestamp, nonce].sort().join("")).digest("hex");
}

async function startTestServer({ env = {}, fetchImpl } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "rollierank-mod-"));
  const dataDirectory = pathToFileURL(dir + path.sep);
  const moderation = createWechatModeration({ env, fetchImpl });
  const api = await createApi({ dataDirectory, moderation });
  const iosRoot = path.join(ROOT, "docs/ui-exploration/ios-v3");
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
      const resource = path.posix.normalize(pathname === "/" ? "/index.html" : pathname);
      const ios = resource.startsWith("/ios-v3/");
      const selectedRoot = ios ? iosRoot : ROOT;
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
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* plain text */ }
    return { status: res.status, body: parsed, headers: res.headers };
  }
  async function submitAttempt(guestId, attemptId) {
    const catalog = (await json("/api/catalog")).body;
    const version = catalog.versions[0];
    const answers = Array(version.questionCount).fill("A");
    const submitted = await json("/api/submit", { guestId, attemptId, versionId: version.id, answers });
    assert.equal(submitted.status, 200);
    return { version, attempt: submitted.body };
  }
  return {
    baseUrl,
    dir,
    json,
    submitAttempt,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("WeChat msgSecCheck and mediaCheckAsync enforce text/image OCR moderation and callback transitions", async (t) => {
  const oldToken = process.env.ROLLIERANK_REVIEW_TOKEN;
  process.env.ROLLIERANK_REVIEW_TOKEN = "mod-secret-token";
  t.after(() => {
    if (oldToken === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN;
    else process.env.ROLLIERANK_REVIEW_TOKEN = oldToken;
  });

  const calls = [];
  const mockFetch = async (url, init = {}) => {
    const href = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ href, body });
    if (href.includes("/cgi-bin/stable_token")) {
      return new Response(JSON.stringify({ access_token: "mock-access-token", expires_in: 7200 }), { status: 200 });
    }
    if (href.includes("/sns/jscode2session")) {
      return new Response(JSON.stringify({ openid: "wx-openid-user-1" }), { status: 200 });
    }
    if (href.includes("/wxa/msg_sec_check")) {
      if (body.content.includes("卖课加微")) {
        return new Response(JSON.stringify({ errcode: 0, trace_id: "txt-risky", result: { suggest: "risky", label: 10001 } }), { status: 200 });
      }
      if (body.content.includes("疑似引流")) {
        return new Response(JSON.stringify({ errcode: 0, trace_id: "txt-review", result: { suggest: "review", label: 10001 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ errcode: 0, trace_id: "txt-pass", result: { suggest: "pass", label: 100 } }), { status: 200 });
    }
    if (href.includes("/wxa/media_check_async")) {
      return new Response(JSON.stringify({ errcode: 0, trace_id: `media-trace-${calls.length}` }), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };

  const server = await startTestServer({
    env: {
      ROLLIERANK_WECHAT_APP_ID: "wx-test-app",
      ROLLIERANK_WECHAT_APP_SECRET: "wx-test-secret",
      ROLLIERANK_WECHAT_MSG_TOKEN: "wx-msg-token",
      ROLLIERANK_PUBLIC_BASE_URL: "https://example.test",
    },
    fetchImpl: mockFetch,
  });
  t.after(() => server.close());

  const guestA = "guest-mod-author-1";
  const attemptA = "attempt-mod-author-1";
  const guestB = "guest-mod-reader-2";
  const attemptB = "attempt-mod-reader-2";
  const { version } = await server.submitAttempt(guestA, attemptA);
  await server.submitAttempt(guestB, attemptB);

  // 1. Risky text is blocked immediately and logged in blockedLog.
  const risky = await server.json("/api/discussions", {
    paperId: version.paperId, attemptId: attemptA, guestId: guestA,
    clientId: "client-risky-001", nickname: "考生甲", text: "卖课加微 12345", wxCode: "wx-code-1",
  });
  assert.equal(risky.status, 422);

  // 2. Review-suggested text is stored as flagged (visible to author only, hidden from others).
  const flagged = await server.json("/api/discussions", {
    paperId: version.paperId, attemptId: attemptA, guestId: guestA,
    clientId: "client-flagged-002", nickname: "考生甲", text: "疑似引流内容", wxCode: "wx-code-1",
  });
  assert.equal(flagged.status, 201);
  assert.equal(flagged.body.comment.moderationStatus, "flagged");
  const readerList1 = await server.json(`/api/discussions?paperId=${encodeURIComponent(version.paperId)}&guestId=${guestB}&attemptId=${attemptB}`);
  assert.equal(readerList1.body.comments.length, 0);

  // 3. Image comment submits mediaCheckAsync with a signed temporary URL and stays pending until callback.
  const withImage = await server.json("/api/discussions", {
    paperId: version.paperId, attemptId: attemptA, guestId: guestA,
    clientId: "client-image-003", nickname: "考生甲", text: "分享一张手写笔记",
    images: [{ dataUri: pngUri(), alt: "笔记图" }], wxCode: "wx-code-1",
  });
  assert.equal(withImage.status, 201);
  assert.equal(withImage.body.comment.moderationStatus, "pending");

  const mediaCall = calls.find((item) => item.href.includes("/wxa/media_check_async"));
  assert.ok(mediaCall, "mediaCheckAsync must be called for image comments");
  const signedPath = new URL(mediaCall.body.media_url).pathname + new URL(mediaCall.body.media_url).search;

  // Valid signed media URL returns PNG bytes; tampered signature fails with 403.
  const mediaRes = await fetch(`${server.baseUrl}${signedPath}`);
  assert.equal(mediaRes.status, 200);
  assert.equal(mediaRes.headers.get("content-type"), "image/png");
  const tamperedRes = await fetch(`${server.baseUrl}${signedPath}tampered`);
  assert.equal(tamperedRes.status, 403);

  // 4. WeChat callback GET verification checks SHA-1 signature and echoes echostr.
  const ts = "1700000000";
  const nonce = "abc123";
  const sig = signCallback("wx-msg-token", ts, nonce);
  const echoRes = await server.json(`/api/wechat/sec-callback?signature=${sig}&timestamp=${ts}&nonce=${nonce}&echostr=hello-wx`);
  assert.equal(echoRes.status, 200);
  assert.equal(echoRes.body, "hello-wx");
  const badSigRes = await server.json(`/api/wechat/sec-callback?signature=deadbeef&timestamp=${ts}&nonce=${nonce}&echostr=hello-wx`);
  assert.equal(badSigRes.status, 403);

  // 5. WeChat POST callback (XML format) approves the image comment and makes it publicly visible.
  const adminListBefore = await server.json("/api/discussions/admin/list", { reviewToken: "mod-secret-token", status: "all" });
  const imgComment = adminListBefore.body.comments.find((c) => c.id === withImage.body.comment.id);
  assert.equal(imgComment.moderation.traces.length, 1);
  const traceId = imgComment.moderation.traces[0].traceId;
  const xmlPayload = `<xml><Event><![CDATA[wxa_media_check]]></Event><trace_id><![CDATA[${traceId}]]></trace_id><result><suggest><![CDATA[pass]]></suggest><label>100</label></result></xml>`;
  const cbRes = await fetch(`${server.baseUrl}/api/wechat/sec-callback?signature=${sig}&timestamp=${ts}&nonce=${nonce}`, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xmlPayload,
  });
  assert.equal(cbRes.status, 200);
  assert.equal(await cbRes.text(), "success");

  const readerList2 = await server.json(`/api/discussions?paperId=${encodeURIComponent(version.paperId)}&guestId=${guestB}&attemptId=${attemptB}`);
  assert.equal(readerList2.body.comments.length, 1);
  assert.equal(readerList2.body.comments[0].id, withImage.body.comment.id);
  assert.equal("moderationStatus" in readerList2.body.comments[0], false);

  // 6. Another image comment flagged as risky via JSON callback (e.g. OCR ad text in image) is auto-rejected.
  const badImage = await server.json("/api/discussions", {
    paperId: version.paperId, attemptId: attemptA, guestId: guestA,
    clientId: "client-image-004", nickname: "考生甲", text: "看图",
    images: [{ dataUri: pngUri(), alt: "广告图" }], wxCode: "wx-code-1",
  });
  const adminListMid = await server.json("/api/discussions/admin/list", { reviewToken: "mod-secret-token", status: "all" });
  const badTrace = adminListMid.body.comments.find((c) => c.id === badImage.body.comment.id).moderation.traces[0].traceId;
  const jsonCb = await fetch(`${server.baseUrl}/api/wechat/sec-callback?signature=${sig}&timestamp=${ts}&nonce=${nonce}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Event: "wxa_media_check", trace_id: badTrace, result: { suggest: "risky", label: 10001 } }),
  });
  assert.equal(jsonCb.status, 200);
  const adminAfterReject = await server.json("/api/discussions/admin/list", { reviewToken: "mod-secret-token", status: "rejected" });
  assert.equal(adminAfterReject.body.comments.length, 1);
  assert.match(adminAfterReject.body.comments[0].moderation.reason, /广告/);
  assert.equal(adminAfterReject.body.blockedLog.length, 1);

  // 7. Profile nickname check rejects risky names via WeChat msgSecCheck.
  const session = await server.json("/api/miniprogram-profile/session", {});
  const badName = await server.json("/api/miniprogram-profile/profile", {
    token: session.body.token, name: "卖课加微", wxCode: "wx-code-1",
  });
  assert.equal(badName.status, 422);
});

test("Admin comment moderation supports settings, keywords, review actions, reports and browser UI", async (t) => {
  const oldToken = process.env.ROLLIERANK_REVIEW_TOKEN;
  const reviewToken = "admin-browser-token";
  process.env.ROLLIERANK_REVIEW_TOKEN = reviewToken;
  t.after(() => {
    if (oldToken === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN;
    else process.env.ROLLIERANK_REVIEW_TOKEN = oldToken;
  });

  const server = await startTestServer();
  t.after(() => server.close());

  const guestA = "guest-admin-ui-001";
  const attemptA = "attempt-admin-ui-001";
  const guestB = "guest-admin-ui-002";
  const attemptB = "attempt-admin-ui-002";
  const { version } = await server.submitAttempt(guestA, attemptA);
  await server.submitAttempt(guestB, attemptB);

  // Unauthenticated admin calls are rejected.
  assert.equal((await server.json("/api/discussions/admin/list", {})).status, 403);
  assert.equal((await server.json("/api/discussions/admin/settings", { mode: "manual" })).status, 403);

  // Configure manual review mode and a blocked keyword.
  const updatedSettings = await server.json("/api/discussions/admin/settings", {
    reviewToken,
    mode: "manual",
    blockedKeywords: ["内部原题", "代考"],
  });
  assert.equal(updatedSettings.status, 200);
  assert.equal(updatedSettings.body.settings.mode, "manual");
  assert.deepEqual(updatedSettings.body.settings.blockedKeywords, ["内部原题", "代考"]);

  // Keyword is blocked immediately.
  const kwBlocked = await server.json("/api/discussions", {
    paperId: version.paperId, attemptId: attemptA, guestId: guestA,
    clientId: "client-kw-001", nickname: "考生甲", text: "这里有 内部 原题 分享",
  });
  assert.equal(kwBlocked.status, 422);

  // Normal comment waits in pending queue under manual mode.
  const pendingPost = await server.json("/api/discussions", {
    paperId: version.paperId, attemptId: attemptA, guestId: guestA,
    clientId: "client-manual-002", nickname: "考生甲", text: "资料分析第三题很好用排除法",
    images: [{ dataUri: pngUri(), alt: "草稿图" }],
  });
  assert.equal(pendingPost.status, 201);
  assert.equal(pendingPost.body.comment.moderationStatus, "pending");

  // Browser end-to-end verification on the desktop admin console (#/admin).
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${server.baseUrl}/#/admin`, { waitUntil: "networkidle" });
  await page.waitForSelector('.app-shell.admin-console');
  await page.waitForSelector('[data-feature="discussions-admin"] .disc-admin-card');
  await page.click('.admin-auth-banner [data-action="admin-unlock"]');
  await page.fill('#admin-unlock-form [name="reviewToken"]', reviewToken);
  await page.click('button[form="admin-unlock-form"]');
  await page.waitForSelector('.disc-admin-item');
  await page.waitForSelector('.admin-table-row');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `desktop admin console must not overflow horizontally (got ${overflow}px)`);

  // Preview image modal opens and closes cleanly.
  await page.click('[data-disc-admin-action="preview-image"]');
  await page.waitForSelector('.disc-admin-lightbox img');
  await page.click('[data-disc-admin-action="close"]');

  // Approve the pending comment from the UI.
  await page.click('[data-disc-admin-action="approve"]');
  await page.waitForFunction(() => document.querySelector('[data-feature="discussions-admin"]')?.textContent?.includes("当前没有待复核评论"));

  // Now guestB can read it and report it back into the review queue.
  const visibleToB = await server.json(`/api/discussions?paperId=${encodeURIComponent(version.paperId)}&guestId=${guestB}&attemptId=${attemptB}`);
  assert.equal(visibleToB.body.comments.length, 1);
  const reported = await server.json("/api/discussions/report", {
    paperId: version.paperId, attemptId: attemptB, guestId: guestB,
    commentId: pendingPost.body.comment.id, reason: "疑似广告",
  });
  assert.equal(reported.status, 200);
  assert.equal(reported.body.reportCount, 1);

  // Refresh in UI and reject, then delete from rejected tab.
  await page.click('[data-feature="discussions-admin"] [data-disc-admin-action="refresh"]');
  await page.waitForSelector('.disc-admin-item');
  await page.click('[data-disc-admin-action="reject"]');
  await page.waitForFunction(() => document.querySelector('[data-feature="discussions-admin"]')?.textContent?.includes("当前没有待复核评论"));

  await page.click('[data-disc-admin-action="filter"][data-filter="rejected"]');
  await page.waitForSelector('.disc-admin-item');
  await page.click('[data-disc-admin-action="delete"]');
  await page.waitForSelector('[data-disc-admin-action="confirm-delete"]');
  await page.click('[data-disc-admin-action="confirm-delete"]');
  await page.waitForFunction(() => document.querySelector('[data-feature="discussions-admin"]')?.textContent?.includes("没有匹配的评论"));

  // Audit log records admin actions.
  const adminData = await server.json("/api/admin", undefined, { Authorization: `Bearer ${reviewToken}` });
  assert.equal(adminData.status, 200);
  assert.ok(adminData.body.audit.some((row) => row.action.includes("评论")));
});
