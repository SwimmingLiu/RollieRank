import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { pngBytes } from "./discussions-fixtures.mjs";

// Three independent browser identities submit through the shipped app before interacting with the same paper.
test("real mobile A/B/C comments support persistent likes, threaded replies, independent drafts and pagination without voice", { timeout: 180000 }, async t => {
  const evidence = resolve("test-results/discussion-interactions", `run-${Date.now()}-${process.pid}`);
  await mkdir(evidence, { recursive: true });
  const directory = await mkdtemp(join(tmpdir(), "rollierank-comment-ui-"));
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = reservation.address().port; await new Promise(done => reservation.close(done));
  const server = spawn(process.execPath, ["scripts/serve.mjs"], { env: { ...process.env, PORT: String(port), ROLLIERANK_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "", browser;
  server.stdout.on("data", chunk => { logs += chunk; }); server.stderr.on("data", chunk => { logs += chunk; });
  const errors = [], screenshots = [], geometry = [], checks = [], receipts = [], responseEvidence = [];
  let failure = null;
  t.after(async () => {
    await browser?.close();
    if (server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
    await writeFile(join(evidence, "server.log"), logs);
    await writeFile(join(evidence, "results.json"), JSON.stringify({ status: failure ? "failed" : "passed", failure, errors, screenshots, geometry, checks, receipts, responses: responseEvidence }, null, 2));
    await rm(directory, { recursive: true, force: true });
  });
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error(logs || "Service not ready")), 15000);
    const ready = () => { if (logs.includes("RollieRank is ready")) { clearTimeout(timer); done(); } };
    server.stdout.on("data", ready); server.once("error", error => { clearTimeout(timer); reject(error); }); ready();
  });
  const base = `http://127.0.0.1:${port}`;
  const api = async (path, body, expected = 200) => {
    const response = await fetch(base + "/api/" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
  };
  const list = target => api("discussions?" + new URLSearchParams(target));
  const postSelector = id => `[data-comment-id="${id}"]`;
  const rootSelector = id => `[data-thread-id="${id}"]`;
  const waitExactCount = (reader, selector, expected) => reader.page.waitForFunction(({ selector, expected }) => document.querySelector("#phone").contentDocument.querySelectorAll(selector).length === expected, { selector, expected });
  const openReport = async reader => {
    await reader.page.locator('.page-picker [data-page="report"]').click();
    await reader.frame.locator('.view[data-page="report"] .rr3-score-card').waitFor();
  };
  const openDiscussion = async reader => {
    await openReport(reader); await reader.frame.locator('.rr-report-comment').click();
    await reader.frame.locator('[data-slot="discussion-page"]').waitFor();
  };
  const closeEditor = async reader => {
    await reader.frame.locator('#discussion-text').press("Escape");
    await reader.frame.locator('[data-slot="discussion-editor"]').waitFor({ state: "hidden" });
  };
  const compose = async (reader, text, replyId = null) => {
    if (replyId) await reader.frame.locator(postSelector(replyId)).getByRole("button", { name: /^回复.*的评论$/ }).click();
    else await reader.frame.locator('.rr-discussion-compose').click();
    await reader.frame.locator('#discussion-text').fill(text);
  };
  const send = async reader => {
    const waiting = reader.page.waitForResponse(response => response.url() === base + "/api/discussions" && response.request().method() === "POST");
    await reader.frame.getByRole("button", { name: "发送", exact: true }).click();
    const response = await waiting; assert.ok(response.ok()); const result = await response.json();
    await reader.frame.locator('[data-slot="discussion-editor"]').waitFor({ state: "hidden" });
    responseEvidence.push({ operation: "comment", status: response.status(), comment: { id: result.comment.id, parentId: result.comment.parentId, rootId: result.comment.rootId, replyTo: result.comment.replyTo }, total: result.total });
    return result.comment;
  };
  const capture = async (reader, name) => {
    await reader.frame.locator('.toast').waitFor({ state: 'hidden' });
    for (const size of ["320,568", "390,844", "430,932"]) {
      await reader.page.locator('#size').selectOption(size);
      await reader.frame.locator('body').evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      const measures = await reader.frame.locator('body').evaluate(() => {
        const issues = [], editor = document.querySelector('.rr-discussion-editor'), dock = document.querySelector('.rr-discussion-compose-dock');
        for (const article of document.querySelectorAll('.rr-discussion-post')) {
          const bounds = article.getBoundingClientRect(), body = article.querySelector('.rr-discussion-post-body').getBoundingClientRect();
          if (bounds.right > innerWidth + 1 || body.right > bounds.right + 1) issues.push("comment overflows paper");
          const footer = article.querySelector('.rr-discussion-post-actions'), like = footer.querySelector('.rr-discussion-like').getBoundingClientRect();
          const reply = footer.querySelector('button').getBoundingClientRect();
          if (like.left < reply.right - 1 || like.height < 32 || reply.height < 32) issues.push("comment actions collide or shrink");
        }
        if (editor && editor.dataset.expanded !== "true") {
          const input = editor.querySelector('#discussion-text').getBoundingClientRect(), send = editor.querySelector('.rr-discussion-submit').getBoundingClientRect();
          if (send.left < input.right || Math.abs(send.bottom - input.bottom) > 1 || send.bottom > innerHeight + 1) issues.push("composer and send misalign");
        } else if (editor) {
          const sheet = editor.closest('[role="dialog"]').getBoundingClientRect(), input = editor.querySelector('#discussion-text').getBoundingClientRect(), send = editor.querySelector('.rr-discussion-submit').getBoundingClientRect();
          if (sheet.height < innerHeight - 12 || input.bottom > sheet.bottom + 1 || send.bottom > sheet.bottom + 1 || input.height < 64) issues.push("full-screen input escapes its sheet");
        }
        if (dock && dock.getBoundingClientRect().bottom > innerHeight + 1) issues.push("compose dock escapes phone");
        return { width: innerWidth, content: document.documentElement.scrollWidth, background: getComputedStyle(document.querySelector('#app')).backgroundColor, font: getComputedStyle(document.body).fontFamily, issues };
      });
      geometry.push({ state: name, ...measures }); assert.equal(measures.width, measures.content); assert.match(measures.font, /Nunito|FangYuan/); assert.equal(measures.background, "rgb(252, 248, 241)"); assert.deepEqual(measures.issues, []);
      const path = join(evidence, `${name}-${measures.width}.png`); await reader.page.locator('#phone').screenshot({ path }); screenshots.push(path);
      if (name === 'interactive-thread') {
        await reader.frame.locator('.view[data-page="discussion"]').evaluate(view => view.scrollTo({ top: view.scrollHeight, behavior: 'instant' }));
        const clearance = await reader.frame.locator('.rr-discussion-reply').last().evaluate(article => ({ actionsBottom: article.querySelector('.rr-discussion-post-actions').getBoundingClientRect().bottom, dockTop: document.querySelector('.rr-discussion-compose-dock').getBoundingClientRect().top, scrollTop: document.querySelector('.view').scrollTop, scrollHeight: document.querySelector('.view').scrollHeight, availableHeight: document.querySelector('.view').clientHeight }));
        geometry.push({ state: name + '-bottom', width: measures.width, ...clearance });
        const bottomPath = join(evidence, `${name}-bottom-${measures.width}.png`); await reader.page.locator('#phone').screenshot({ path: bottomPath }); screenshots.push(bottomPath);
        assert.ok(clearance.actionsBottom <= clearance.dockTop + 1, 'last reply actions hide behind compose dock');
      }
    }
    await reader.page.locator('#size').selectOption("390,844");
  };
  try {
    assert.ok((await api("catalog")).versions.length); assert.ok((await api("positions/hierarchy")).options.length);
    browser = await chromium.launch({ headless: true });
    const readers = [];
    for (const label of ["A", "B", "C"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, reducedMotion: "reduce" });
      await context.addInitScript(() => {
        window.__commentDeviceCalls = 0;
        if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { window.__commentDeviceCalls++; throw new Error("Unexpected microphone access"); };
        window.MediaRecorder = class { constructor() { window.__commentDeviceCalls++; throw new Error("Unexpected MediaRecorder"); } };
      });
      const page = await context.newPage(); page.setDefaultTimeout(12000); page.on("pageerror", error => errors.push({ reader: label, message: error.message }));
      const frame = page.frameLocator('#phone'), reader = { context, page, frame, label };
      readers.push(reader);
      await page.goto(base + "/ios-v3/?design=paper-cards-1114-v3", { waitUntil: "networkidle" });
      await page.locator('.page-picker [data-page="entry"]').click(); await frame.locator('.answer-row').first().waitFor();
      await frame.locator('.choice[data-option="A"]').evaluateAll(buttons => buttons.forEach(button => button.click()));
      const waiting = page.waitForResponse(response => response.url() === base + "/api/submit" && response.request().method() === "POST");
      await frame.locator('[data-action="confirm"]').click(); await frame.locator('[data-position-action="skip-submit"]').click();
      const response = await waiting, receipt = await response.json(); assert.equal(response.status(), 200); assert.equal(receipt.isSample, false);
      reader.scope = { guestId: response.request().postDataJSON().guestId, attemptId: receipt.id, paperId: receipt.paperId };
      receipts.push({ label, paperId: receipt.paperId, attemptId: receipt.id });
      await frame.locator('.view[data-page="report"] .rr3-score-card').waitFor();
    }
    const [a, b, c] = readers; assert.equal(new Set(readers.map(reader => reader.scope.guestId)).size, 3); assert.equal(new Set(readers.map(reader => reader.scope.paperId)).size, 1);
    checks.push("three isolated users create actual non-sample receipts for the same paper");
    // Photo selection must start directly from the collapsed dock, inside the real click gesture.
    await openDiscussion(a); assert.equal(await a.frame.locator('.rr-discussion-compose-bar button button').count(), 0);
    const chooser = a.page.waitForEvent('filechooser'); await a.frame.getByRole('button', { name: '添加图片', exact: true }).click();
    await (await chooser).setFiles({ name: "解题笔记.png", mimeType: "image/png", buffer: pngBytes({ width: 100, height: 80 }) });
    await a.frame.locator('.rr-discussion-selected-images figure').waitFor();
    await a.frame.locator('#discussion-text').fill("A：资料分析这题有更快的解法吗？ https://example.com/solution。");
    await capture(a, "composer-photo");
    const body = await a.frame.locator('#discussion-text').inputValue();
    await a.frame.locator('#discussion-text').fill(Array.from({ length: 12 }, (_, index) => `第 ${index + 1} 行解题思路`).join('\n'));
    assert.ok(await a.frame.locator('#discussion-text').evaluate(field => field.getBoundingClientRect().height >= 145 && field.scrollHeight > field.clientHeight));
    await capture(a, "composer-growing");
    await a.frame.getByRole('button', { name: '展开编辑', exact: true }).click();
    await a.frame.locator('.rr-discussion-editor[data-expanded="true"]').waitFor(); await capture(a, "composer-fullscreen");
    await a.frame.getByRole('button', { name: '收起编辑', exact: true }).click(); await a.frame.locator('#discussion-text').fill(body);
    assert.equal(await a.frame.locator('.rr-discussion-selected-images figure').count(), 1);
    const root = await send(a);
    assert.equal((await list(a.scope)).total, 1); assert.equal(await a.frame.locator('.rr-discussion-text a').getAttribute('href'), "https://example.com/solution");
    await openDiscussion(b); const likeB = b.frame.locator(postSelector(root.id)).locator('.rr-discussion-like');
    await b.page.route('**/api/discussions/like', async route => { await route.fetch(); await route.abort(); });
    await likeB.click(); await b.frame.locator('.rr-discussion-action-error').waitFor(); assert.equal((await list(b.scope)).comments[0].likeCount, 1);
    await b.page.unroute('**/api/discussions/like'); await likeB.click(); await b.frame.locator(postSelector(root.id) + ' .rr-discussion-like[aria-pressed="true"]').waitFor();
    assert.equal((await list(b.scope)).comments[0].likeCount, 1);
    await likeB.click(); await b.frame.locator(postSelector(root.id) + ' .rr-discussion-like[aria-pressed="false"]').waitFor(); assert.equal((await list(b.scope)).comments[0].likeCount, 0);
    await likeB.click(); await b.frame.locator(postSelector(root.id) + ' .rr-discussion-like[aria-pressed="true"]').waitFor();
    await b.page.reload({ waitUntil: "networkidle" }); await openDiscussion(b);
    await b.frame.locator(postSelector(root.id) + ' .rr-discussion-like[aria-pressed="true"]').waitFor();
    await openDiscussion(c); await c.frame.locator(postSelector(root.id) + ' .rr-discussion-like').click();
    await c.frame.locator(postSelector(root.id) + ' .rr-discussion-like[aria-pressed="true"]').waitFor(); assert.equal((await list(a.scope)).comments[0].likeCount, 2);
    checks.push("like, unlike, response-loss retry and page reload persist one like per real identity");

    await compose(c, "C：可以先算增长量，再比较。", root.id); assert.match(await c.frame.locator('.rr-discussion-reply-context').innerText(), /回复.*卷友/);
    assert.match(await c.frame.locator('.rr-discussion-reply-context').innerText(), /资料分析这题有更快的解法/);
    const cReply = await send(c); assert.equal(cReply.parentId, root.id); assert.equal(cReply.rootId, root.id);
    await openDiscussion(a); await a.frame.locator(rootSelector(root.id)).getByRole('button', { name: '展开1条回复', exact: true }).click();
    await a.frame.locator(postSelector(cReply.id)).waitFor(); await compose(a, "A：谢谢，这样确实省时间。", cReply.id);
    await a.page.route('**/api/discussions', async route => { if (route.request().method() === "POST") { await route.fetch(); await route.abort(); } else await route.continue(); });
    await a.frame.getByRole('button', { name: '发送', exact: true }).click(); await a.frame.locator('.rr-discussion-editor-error').waitFor();
    assert.equal(await a.frame.locator('#discussion-text').inputValue(), "A：谢谢，这样确实省时间。"); assert.equal((await list(a.scope)).total, 3);
    await a.page.unroute('**/api/discussions'); const aReply = await send(a);
    assert.equal(aReply.parentId, cReply.id); assert.equal(aReply.rootId, root.id); assert.equal(aReply.replyTo.id, cReply.id);
    assert.equal((await list(a.scope)).total, 3); assert.equal((await list(a.scope)).comments[0].replyCount, 2);
    await capture(a, "interactive-thread");
    checks.push("reply to a root and to its reply renders one nested thread; lost-response retry keeps one reply");

    await openDiscussion(b); await compose(b, "主评论的独立草稿"); await closeEditor(b);
    await compose(b, "给主评论的回复草稿", root.id); await closeEditor(b);
    await b.frame.locator(rootSelector(root.id)).getByRole('button', { name: '展开2条回复', exact: true }).click(); await b.frame.locator(postSelector(cReply.id)).waitFor();
    await compose(b, "给回复的另一份草稿", cReply.id); await closeEditor(b);
    await b.frame.locator(postSelector(root.id)).getByRole('button', { name: /^回复.*的评论$/ }).click(); assert.equal(await b.frame.locator('#discussion-text').inputValue(), "给主评论的回复草稿");
    await b.frame.getByRole('button', { name: '取消回复', exact: true }).click(); assert.equal(await b.frame.locator('#discussion-text').inputValue(), "主评论的独立草稿");
    assert.equal(await b.frame.locator('.rr-discussion-reply-context').count(), 0); await closeEditor(b);
    await b.frame.locator(postSelector(cReply.id)).getByRole('button', { name: /^回复.*的评论$/ }).click(); assert.equal(await b.frame.locator('#discussion-text').inputValue(), "给回复的另一份草稿");
    assert.match(await b.frame.locator('.rr-discussion-reply-context').innerText(), /可以先算增长量/);
    const draftPhoto = b.page.waitForEvent('filechooser'); await b.frame.getByRole('button', { name: '图片', exact: true }).click();
    await (await draftPhoto).setFiles({ name: '回复草稿.png', mimeType: 'image/png', buffer: pngBytes({ width: 80, height: 60 }) });
    await b.frame.locator('.rr-discussion-selected-images figure').waitFor();
    await capture(b, "reply-draft"); await closeEditor(b);
    // In-session reopen alone missed the loss of independent root/reply drafts on a real page reload.
    b.page.once('dialog', dialog => dialog.accept()); await b.page.reload({ waitUntil: 'networkidle' }); await openDiscussion(b);
    await b.frame.locator(rootSelector(root.id)).getByRole('button', { name: '展开2条回复', exact: true }).click();
    await b.frame.locator(postSelector(cReply.id)).getByRole('button', { name: /^回复.*的评论$/ }).click();
    assert.equal(await b.frame.locator('#discussion-text').inputValue(), '给回复的另一份草稿');
    assert.equal(await b.frame.locator('.rr-discussion-selected-images figure').count(), 1);
    assert.match(await b.frame.locator('.rr-discussion-reply-context').innerText(), /可以先算增长量/);
    await capture(b, 'reply-draft-reloaded'); await closeEditor(b);
    await b.frame.locator(postSelector(root.id)).getByRole('button', { name: /^回复.*的评论$/ }).click();
    assert.equal(await b.frame.locator('#discussion-text').inputValue(), '给主评论的回复草稿');
    await b.frame.getByRole('button', { name: '取消回复', exact: true }).click();
    assert.equal(await b.frame.locator('#discussion-text').inputValue(), '主评论的独立草稿'); await closeEditor(b);
    await b.frame.locator(postSelector(cReply.id) + ' .rr-discussion-like').click(); await b.frame.locator(postSelector(cReply.id) + ' .rr-discussion-like[aria-pressed="true"]').waitFor();
    const likedReplies = await api('discussions/replies?' + new URLSearchParams({ ...b.scope, rootId: root.id }));
    assert.equal(likedReplies.comments.find(comment => comment.id === cReply.id).likeCount, 1); assert.equal(likedReplies.comments.find(comment => comment.id === cReply.id).likedByMe, true);
    checks.push("root, root-reply and reply-to-reply drafts keep separate text and target context");

    for (let index = 0; index < 22; index++) await api("discussions", { ...c.scope, nickname: "小舟", clientId: `real-pagination-reply-${index}-123`, text: `补充讨论 ${index + 1}`, parentId: root.id }, 201);
    await openDiscussion(c);
    await c.page.route('**/api/discussions/replies?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '暂时无法读取回复，请重试。' }) }));
    await c.frame.locator(rootSelector(root.id)).getByRole('button', { name: '展开24条回复', exact: true }).click(); await c.frame.getByRole('button', { name: '重试回复', exact: true }).waitFor();
    await c.page.unroute('**/api/discussions/replies?**'); await c.frame.getByRole('button', { name: '重试回复', exact: true }).click();
    await waitExactCount(c, '.rr-discussion-reply', 20);
    await c.frame.getByRole('button', { name: '展开更多回复', exact: true }).click(); await waitExactCount(c, '.rr-discussion-reply', 24);
    assert.equal(new Set(await c.frame.locator('.rr-discussion-reply').evaluateAll(elements => elements.map(element => element.dataset.commentId))).size, 24);
    await c.frame.locator('.rr-discussion-thread-toggle').click(); await waitExactCount(c, '.rr-discussion-reply', 0);
    await c.frame.locator('.rr-discussion-thread-toggle').click(); await waitExactCount(c, '.rr-discussion-reply', 24);
    assert.equal((await list(c.scope)).total, 25);
    await openReport(c); await c.frame.getByRole('button', { name: '评论本卷，25 条讨论', exact: true }).waitFor();
    checks.push("reply read failure retries, 20+4 pagination expands and collapses, and report count includes 24 replies");

    const versions = (await api('catalog')).versions.filter(item => item.status === 'published');
    const another = await api('submit', { guestId: b.scope.guestId, attemptId: 'actual-comment-other-paper-123', versionId: versions.find(item => item.paperId !== root.paperId).id, answers: Array(versions.find(item => item.paperId !== root.paperId).questionCount).fill('A') });
    const cross = { guestId: b.scope.guestId, attemptId: another.id, paperId: another.paperId };
    await api('discussions/like', { ...cross, commentId: root.id, liked: true }, 404);
    await api('discussions', { ...cross, clientId: 'actual-cross-paper-reply-123', nickname: '卷友', text: '跨卷目标', parentId: root.id }, 404);
    await api('discussions/replies?' + new URLSearchParams({ ...cross, rootId: root.id }), undefined, 404);
    checks.push("a valid receipt from another paper cannot like, reply or read this thread");
    for (const reader of readers) {
      assert.equal(await reader.frame.locator('audio,input[accept*="audio"],.rr-discussion-recording').count(), 0);
      assert.equal(await reader.frame.getByRole('button', { name: /语音|录音|录制/ }).count(), 0);
      assert.equal(await reader.frame.locator('body').evaluate(() => window.__commentDeviceCalls), 0);
    }
    assert.deepEqual(errors, []); checks.push("all three mobile identities make zero media-device or MediaRecorder calls and render no voice controls");
  } catch (error) {
    failure = { name: error.name, message: error.message, stack: error.stack };
    if (browser) for (const [index, context] of browser.contexts().entries()) for (const [pageIndex, page] of context.pages().entries()) await page.screenshot({ path: join(evidence, `failure-${index}-${pageIndex}.png`), fullPage: true }).catch(() => {});
    throw error;
  }
});
