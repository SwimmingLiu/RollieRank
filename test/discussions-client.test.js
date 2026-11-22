import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createDiscussionHost, commentInput, pngBytes, wavBytes } from "./discussions-fixtures.mjs";

// Production has no browser runtime dependency; this QA suite uses the workspace's Playwright.
let chromium;
try { ({ chromium } = await import("playwright")); } catch { /* Run with Playwright installed to exercise this suite. */ }
let browser;
test.before(async () => {
  if (chromium) browser = await chromium.launch({ headless: true, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
});
test.after(async () => { await browser?.close(); });
const browserTest = (name, body) => test(name, { skip: !chromium && "Playwright is needed for browser QA", timeout: 45000 }, body);
const evidence = resolve(".beauye/tasks/discussions/evidence");
const waitCount = (page, selector, expected) => page.waitForFunction(({ selector, expected }) => document.querySelectorAll(selector).length === expected, { selector, expected });
const waitText = (page, selector, text) => page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
const comments = ".discussions-comment";
const submit = 'form[data-discussions-form] button[type="submit"]';

browserTest("browser publishes combined media, retains failures, retries idempotently and reads after reload/restart", async (t) => {
  let host = await createDiscussionHost(); const directory = host.directory;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  t.after(async () => { await context.close(); await host.close({ remove: false }); await rm(directory, { recursive: true, force: true }); });
  const page = await context.newPage(); const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(host.base, { waitUntil: "networkidle" });
  await page.locator("#discussions-text").waitFor();
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: join(evidence, "report-empty.png"), fullPage: true });
  assert.match(await page.locator("#discussions-identity-help").innerText(), /首次发言/);
  await page.locator(submit).click();
  assert.equal(await page.locator("#discussions-nickname").evaluate((element) => element.validity.valueMissing), true);
  await page.locator("#discussions-nickname").fill("<小卷同学>");
  const text = '<img src=x onerror="window.__discussionXss=1">\n这次资料分析的时间怎么分配？';
  await page.locator("#discussions-text").fill(text);
  await page.locator(".discussions-links-editor summary").click();
  await page.locator("#discussions-links").fill("javascript:alert(1)");
  await page.locator(submit).click();
  await waitText(page, ".discussions-error", "HTTP");
  assert.equal((await host.request()).body.total, 0);
  await page.locator("#discussions-links").fill("https://example.com/question?q=1&view=all");
  await page.locator('[data-discussions-file="images"]').setInputFiles({ name: "题号标记.png", mimeType: "image/png", buffer: pngBytes({ width: 40, height: 20 }) });
  await waitCount(page, ".discussions-draft-image", 1);
  await page.locator("#discussions-alt-0").fill("第 12 题的时间分配笔记");
  await page.locator('[data-discussions-file="images"]').setInputFiles({ name: "bad.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg onload="alert(1)"/>') });
  await waitText(page, ".discussions-error", "PNG");
  assert.equal(await page.locator(".discussions-draft-image").count(), 1);
  assert.equal(await page.locator("#discussions-text").inputValue(), text);
  await page.locator('[data-discussions-file="audio"]').setInputFiles({ name: "解题思路.wav", mimeType: "audio/wav", buffer: wavBytes(1) });
  await waitCount(page, ".discussions-draft-audio audio", 1);
  await page.locator("#discussions-audio-name").fill("我的解题思路，文字说明见评论");
  host.setFailWrite(true);
  await page.locator(submit).click();
  await waitText(page, ".discussions-error", "写入失败");
  assert.equal(await page.locator("#discussions-text").inputValue(), text);
  assert.equal(await page.locator("#discussions-links").inputValue(), "https://example.com/question?q=1&view=all");
  assert.equal(await page.locator(".discussions-draft-image").count(), 1);
  assert.equal(await page.locator(".discussions-draft-audio audio").count(), 1);
  assert.equal((await host.request()).body.total, 0);
  await page.screenshot({ path: join(evidence, "publish-write-failure.png"), fullPage: true });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("discussions-test-state")).profile.name), "<小卷同学>");
  host.setFailWrite(false);
  await page.route("**/api/discussions", async (route) => {
    if (route.request().method() === "POST") { await route.fetch(); await route.abort(); }
    else await route.continue();
  });
  await page.locator(submit).click();
  await waitText(page, ".discussions-error", "连接失败");
  assert.equal((await host.request()).body.total, 1, "server saved the comment even though response was lost");
  assert.equal(await page.locator("#discussions-text").inputValue(), text);
  await page.unroute("**/api/discussions");
  await page.locator(submit).evaluate((element) => { element.click(); element.click(); });
  await waitCount(page, comments, 1);
  await waitText(page, ".discussions-success", "已发表");
  assert.equal((await host.request()).body.total, 1, "same clientId retries exactly once");
  assert.equal(await page.locator("#discussions-text").inputValue(), "");
  assert.equal(await page.locator(".discussions-draft-image").count(), 0);
  assert.equal(await page.locator(".discussions-text").innerText(), text);
  assert.equal(await page.locator(".discussions-text img, .discussions-text script").count(), 0);
  assert.equal(await page.evaluate(() => window.__discussionXss), undefined);
  assert.equal(await page.locator(".discussions-comment-head b").innerText(), "<小卷同学>");
  assert.equal(await page.locator(".discussions-comment audio").getAttribute("controls"), "");
  assert.equal(await page.locator(".discussions-link").getAttribute("rel"), "noopener noreferrer");
  await page.locator('[data-discussions-action="preview"]').click();
  await page.locator("dialog[open] .discussions-full-image").waitFor();
  assert.equal(await page.locator("dialog img").getAttribute("alt"), "第 12 题的时间分配笔记");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  await page.locator(".discussions-comment audio").evaluate((audio) => { window.__discussionAudio = audio; audio.load(); });
  await page.waitForFunction(() => Number.isFinite(window.__discussionAudio?.duration));
  assert.ok(Math.abs(await page.locator(".discussions-comment audio").evaluate((audio) => audio.duration) - 1) < .02);
  await page.locator('[data-discussions-action="refresh"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-discussions-list-status]')?.textContent.includes("正在读取"));
  assert.equal(await page.locator(".discussions-comment audio").evaluate((audio) => audio === window.__discussionAudio), true);
  await mkdir(evidence, { recursive: true });
  for (const [width, height] of [[1440, 900], [1280, 800], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await page.locator(".discussions-heading").scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no overflow at ${width}`);
    await page.screenshot({ path: join(evidence, `report-${width}.png`), fullPage: true });
    await page.locator(".discussions").evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 80));
    await page.screenshot({ path: join(evidence, `report-${width}-viewport.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#discussions-text").fill("这段未发表的内容应在换页后保留");
  await page.getByRole("link", { name: "返回我的记录", exact: true }).click();
  await page.getByRole("link", { name: "查看成绩报告", exact: true }).click();
  await waitCount(page, comments, 1);
  assert.equal(await page.locator("#discussions-text").inputValue(), "这段未发表的内容应在换页后保留");
  await page.reload({ waitUntil: "networkidle" });
  await waitCount(page, comments, 1);
  assert.equal(await page.locator("#discussions-nickname").inputValue(), "<小卷同学>");
  await page.getByRole("link", { name: "返回我的记录", exact: true }).click();
  let discussionReads = 0;
  const countReads = (request) => { if (request.url().includes("/api/discussions")) discussionReads++; };
  page.on("request", countReads);
  await page.getByRole("link", { name: "查看示例报告", exact: true }).click();
  await page.locator(".discussions-sample").waitFor();
  assert.equal(await page.locator("form[data-discussions-form]").count(), 0);
  assert.equal(discussionReads, 0);
  page.off("request", countReads);
  await page.screenshot({ path: join(evidence, "sample-report.png"), fullPage: true });
  for (const [width, height] of [[1280, 800], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: join(evidence, `sample-report-${width}.png`), fullPage: true });
  }
  await host.close({ remove: false });
  host = await createDiscussionHost({ directory });
  await page.goto(host.base, { waitUntil: "networkidle" });
  await waitCount(page, comments, 1);
  assert.equal(await page.locator(".discussions-text").innerText(), text);
  assert.deepEqual(errors, []);
  await writeFile(join(evidence, "publish-browser.json"), JSON.stringify({ browser: browser.version(), result: "passed", viewports: [[1440, 900], [1280, 800], [390, 844], [320, 740]], assertions: ["combined-media", "failed-write-preserves-input", "lost-response-idempotent-retry", "safe-rendering", "image-modal", "native-audio-decodes", "stable-audio-node", "route-draft-retention", "reload", "restart", "sample-isolation"], pageErrors: errors }, null, 2));
});

browserTest("avatar helper uses local initials and recovers from failed or delayed remote images", async (t) => {
  const host = await createDiscussionHost(); const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  t.after(async () => { await context.close(); await host.close(); });
  const page = await context.newPage(); await page.goto(host.base, { waitUntil: "networkidle" });
  await page.route("**/avatar-good.png", (route) => route.fulfill({ contentType: "image/png", body: pngBytes({ width: 40, height: 40 }) }));
  await page.evaluate(async () => {
    const { renderDiscussionsAvatar, bindDiscussionsAvatars } = await import("/src/features/discussions-avatar.js");
    const container = document.createElement("div"); container.id = "avatar-test";
    container.innerHTML = renderDiscussionsAvatar({ name: '<小卷"同学>', seed: "stable", image: location.origin + "/avatar-missing.png" }) +
      renderDiscussionsAvatar({ name: "另一位同学", seed: "stable", image: location.origin + "/avatar-good.png" }) +
      renderDiscussionsAvatar({ name: "安全头像", image: "javascript:alert(1)" });
    document.querySelector(".discussions-heading").append(container); bindDiscussionsAvatars(container);
  });
  await page.waitForFunction(() => document.querySelector('#avatar-test img')?.dataset.discussionsLoaded === "false");
  await page.waitForFunction(() => document.querySelectorAll('#avatar-test img')[1]?.dataset.discussionsLoaded === "true");
  assert.equal(await page.locator("#avatar-test .discussions-avatar").nth(0).innerText(), "<");
  assert.equal(await page.locator("#avatar-test img").nth(0).evaluate((image) => getComputedStyle(image).opacity), "0");
  assert.equal(await page.locator("#avatar-test img").nth(1).evaluate((image) => getComputedStyle(image).opacity), "1");
  assert.equal(await page.locator("#avatar-test .discussions-avatar").nth(2).locator("img").count(), 0);
  assert.equal(await page.locator("#avatar-test .discussions-avatar").nth(0).getAttribute("aria-label"), '<小卷"同学>的头像');
  assert.equal(await page.locator("#avatar-test .discussions-avatar").nth(0).getAttribute("class"), await page.locator("#avatar-test .discussions-avatar").nth(1).getAttribute("class"));
});

browserTest("recording recovers from denied permission and releases tracks on stop, cancel, late permission and route exit", async (t) => {
  const host = await createDiscussionHost();
  const context = await browser.newContext({ permissions: ["microphone"], viewport: { width: 390, height: 844 } });
  t.after(async () => { await context.close(); await host.close(); });
  await context.addInitScript(() => {
    window.__discussionStreams = []; window.__discussionMediaCalls = 0;
    // Headless macOS cannot open its audio service here. Generate actual browser audio
    // tracks, then exercise the real MediaRecorder, codec, decoding and stop lifecycle.
    window.__createDiscussionTestStream = async () => {
      const track = new MediaStreamTrackGenerator({ kind: "audio" });
      const writer = track.writable.getWriter();
      const stream = new MediaStream([track]);
      let timestamp = 0;
      const interval = setInterval(() => {
        if (track.readyState === "ended") { clearInterval(interval); writer.close().catch(() => {}); return; }
        const data = Float32Array.from({ length: 1600 }, (_, i) => Math.sin((timestamp / 1000000 + i / 16000) * 440 * 2 * Math.PI) * .1);
        const frame = new AudioData({ format: "f32", sampleRate: 16000, numberOfFrames: 1600, numberOfChannels: 1, timestamp, data });
        timestamp += 100000;
        writer.write(frame).catch(() => {}).finally(() => frame.close());
      }, 100);
      window.__discussionStreams.push(stream);
      return stream;
    };
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (++window.__discussionMediaCalls === 1) throw new DOMException("denied", "NotAllowedError");
      return window.__createDiscussionTestStream(constraints);
    };
  });
  const page = await context.newPage(); const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(host.base, { waitUntil: "networkidle" });
  await page.locator("#discussions-nickname").fill("语音同学");
  await page.locator("#discussions-text").fill("录音失败也应保留这段文字");
  await page.locator('[data-discussions-action="record"]').click();
  await waitText(page, ".discussions-error", "麦克风权限");
  assert.equal(await page.locator("#discussions-text").inputValue(), "录音失败也应保留这段文字");
  await page.screenshot({ path: join(evidence, "microphone-denied.png"), fullPage: true });
  await page.locator('[data-discussions-action="record"]').click();
  await page.locator('[data-discussions-action="stop-recording"]').waitFor();
  await page.locator('[data-discussions-action="cancel-recording"]').click();
  assert.equal(await page.evaluate(() => window.__discussionStreams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended"))), true);
  assert.equal(await page.locator(".discussions-draft-audio").count(), 0);
  await page.locator('[data-discussions-action="record"]').click();
  await page.locator('[data-discussions-action="stop-recording"]').waitFor();
  await page.screenshot({ path: join(evidence, "recording-mobile.png"), fullPage: true });
  await page.waitForTimeout(350);
  await page.locator('[data-discussions-action="stop-recording"]').click();
  await waitCount(page, ".discussions-draft-audio audio", 1);
  assert.equal(await page.evaluate(() => window.__discussionStreams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended"))), true);
  await page.locator(submit).click();
  await waitCount(page, ".discussions-comment audio", 1);
  await page.locator('[data-discussions-action="record"]').click();
  await page.locator('[data-discussions-action="stop-recording"]').waitFor();
  await page.getByRole("link", { name: "返回我的记录", exact: true }).click();
  await page.getByRole("link", { name: "查看成绩报告", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__discussionStreams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended"))), true);
  await page.getByRole("link", { name: "查看成绩报告", exact: true }).click();
  await page.locator('[data-discussions-action="record"]').waitFor();
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await window.__createDiscussionTestStream(constraints);
      return new Promise((resolve) => { window.__resolveDiscussionPermission = () => resolve(stream); });
    };
  });
  await page.locator('[data-discussions-action="record"]').click();
  await page.waitForFunction(() => typeof window.__resolveDiscussionPermission === "function");
  await page.locator('[data-discussions-action="cancel-recording"]').click();
  await page.evaluate(() => window.__resolveDiscussionPermission());
  await page.waitForFunction(() => window.__discussionStreams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended")));
  assert.equal(await page.locator(".discussions-draft-audio").count(), 0);
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = window.__createDiscussionTestStream; });
  await page.locator('[data-discussions-action="record"]').click();
  await page.locator('[data-discussions-action="stop-recording"]').waitFor();
  assert.equal(await page.evaluate(() => {
    document.querySelector('[data-feature="discussions"]').remove();
    window.__discussionsHarness.feature.afterRender();
    return window.__discussionStreams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended"));
  }), true, "removing the mount releases tracks even before a route hook runs");
  await page.evaluate(() => window.__discussionsHarness.render());
  await page.locator('[data-discussions-action="record"]').click();
  await page.locator('[data-discussions-action="stop-recording"]').waitFor();
  const finalTracks = await page.evaluate(() => {
    const before = window.__discussionStreams.flatMap((stream) => stream.getTracks());
    window.__discussionsHarness.feature.destroy();
    return before.every((track) => track.readyState === "ended");
  });
  assert.equal(finalTracks, true);
  assert.deepEqual(errors, []);
  await writeFile(join(evidence, "recording-browser.json"), JSON.stringify({ browser: browser.version(), result: "passed", mediaSource: "Generated browser audio track; native MediaRecorder and codec. Physical microphone and OS permission dialog not tested.", assertions: ["permission-denied-recovery", "cancel-releases-tracks", "stop-normalizes-and-publishes", "route-exit-releases-tracks", "late-permission-releases-tracks", "destroy"], pageErrors: errors }, null, 2));
});

browserTest("async reads preserve editing focus and new posts, while pagination retains earlier audio nodes", async (t) => {
  const host = await createDiscussionHost(); const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  t.after(async () => { await context.close(); await host.close(); });
  for (let i = 0; i < 23; i++) await host.request(commentInput({ clientId: `browser-pagination-${i}`, text: `已有讨论 ${i}`, ...(i === 22 ? { audio: { dataUri: `data:audio/wav;base64,${wavBytes(1).toString("base64")}` } } : {}) }));
  const page = await context.newPage(); await page.goto(host.base, { waitUntil: "networkidle" });
  await waitCount(page, comments, 20);
  await page.locator(".discussions-comment audio").evaluate((audio) => { window.__discussionAudio = audio; });
  await page.locator('[data-discussions-action="more"]').click();
  await waitCount(page, comments, 23);
  assert.equal(await page.locator(".discussions-comment audio").evaluate((audio) => audio === window.__discussionAudio), true);
  let release, intercepted, completed;
  const waiting = new Promise((resolveWaiting) => { intercepted = resolveWaiting; });
  const held = new Promise((resolveHeld) => { release = resolveHeld; });
  const fulfilled = new Promise((resolveFulfilled) => { completed = resolveFulfilled; });
  await page.route("**/api/discussions?**", async (route) => {
    const response = await route.fetch(); intercepted(); await held; await route.fulfill({ response }); completed();
  });
  await page.locator('[data-discussions-action="refresh"]').click();
  await waiting;
  await page.locator("#discussions-nickname").fill("并发同学");
  await page.locator("#discussions-text").fill("读取尚未返回时发表的新评论");
  await page.locator("#discussions-text").evaluate((element) => { element.focus(); element.setSelectionRange(3, 6); });
  assert.equal(await page.locator("#discussions-text").evaluate((element) => element === document.activeElement), true);
  await page.locator(submit).click();
  await waitText(page, ".discussions-success", "已发表");
  await page.locator("#discussions-text").fill("继续编辑中的内容");
  await page.locator("#discussions-text").evaluate((element) => { element.focus(); element.setSelectionRange(2, 5); });
  release();
  await fulfilled;
  await page.unroute("**/api/discussions?**");
  await page.waitForFunction(() => !document.querySelector('[data-discussions-list-status]')?.textContent.includes("正在读取"));
  assert.equal(await page.locator("#discussions-text").inputValue(), "继续编辑中的内容");
  assert.deepEqual(await page.locator("#discussions-text").evaluate((element) => [element === document.activeElement, element.selectionStart, element.selectionEnd]), [true, 2, 5]);
  assert.ok((await page.locator(".discussions-text").allTextContents()).includes("读取尚未返回时发表的新评论"));
  assert.equal((await host.request()).body.total, 24);
});

browserTest("unsupported recording leaves native audio upload available and keyboard controls operable", async (t) => {
  const host = await createDiscussionHost(); const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  t.after(async () => { await context.close(); await host.close(); });
  await context.addInitScript(() => { Object.defineProperty(window, "MediaRecorder", { value: undefined }); });
  const page = await context.newPage(); await page.goto(host.base, { waitUntil: "networkidle" });
  assert.equal(await page.locator('[data-discussions-action="record"]').count(), 0);
  await page.locator('[data-discussions-action="pick-audio"]').focus();
  assert.equal(await page.locator('[data-discussions-action="pick-audio"]').evaluate((element) => element === document.activeElement), true);
  assert.equal(await page.locator('[data-discussions-file="audio"]').getAttribute("tabindex"), "-1");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".discussions-links-editor summary").evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".discussions-links-editor").getAttribute("open"), "");
  await page.locator('[data-discussions-file="audio"]').setInputFiles({ name: "上传音频.wav", mimeType: "audio/wav", buffer: wavBytes() });
  await waitCount(page, ".discussions-draft-audio audio", 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

browserTest("media decoding enforces dimensions and duration, retains existing media and normalizes JPEG/WebP", async (t) => {
  const host = await createDiscussionHost(); const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  t.after(async () => { await context.close(); await host.close(); });
  const page = await context.newPage(); const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(host.base, { waitUntil: "networkidle" });
  await page.locator('[data-discussions-file="images"]').setInputFiles({ name: "有效.png", mimeType: "image/png", buffer: pngBytes() });
  await waitCount(page, ".discussions-draft-image", 1);
  await page.evaluate(() => {
    const original = window.createImageBitmap.bind(window); window.__discussionDecoderCalls = 0;
    window.createImageBitmap = (...args) => { window.__discussionDecoderCalls++; return original(...args); };
  });
  await page.locator('[data-discussions-file="images"]').setInputFiles({ name: "像素过大.png", mimeType: "image/png", buffer: pngBytes({ width: 9000, height: 1 }) });
  await waitText(page, ".discussions-error", "像素过大");
  assert.equal(await page.evaluate(() => window.__discussionDecoderCalls), 0, "oversized image rejected before bitmap allocation");
  await page.locator('[data-discussions-file="images"]').setInputFiles({ name: "损坏.png", mimeType: "image/png", buffer: pngBytes().subarray(0, 35) });
  await waitText(page, ".discussions-error", "无法解码");
  assert.equal(await page.locator(".discussions-draft-image").count(), 1);
  const formats = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 120; canvas.height = 80;
    const context = canvas.getContext("2d"); context.fillStyle = "#a57db9"; context.fillRect(0, 0, 120, 80);
    return [canvas.toDataURL("image/jpeg"), canvas.toDataURL("image/webp")];
  });
  for (const [index, dataUri] of formats.entries()) {
    const mimeType = dataUri.slice(5, dataUri.indexOf(";"));
    await page.locator('[data-discussions-file="images"]').setInputFiles({ name: `图片.${index ? "webp" : "jpg"}`, mimeType, buffer: Buffer.from(dataUri.split(",")[1], "base64") });
    await waitCount(page, ".discussions-draft-image", index + 2);
  }
  await page.locator('[data-discussions-file="audio"]').setInputFiles({ name: "有效音频.wav", mimeType: "audio/wav", buffer: wavBytes(1) });
  await waitCount(page, ".discussions-draft-audio audio", 1);
  const originalSource = await page.locator(".discussions-draft-audio audio").getAttribute("src");
  await page.locator('[data-discussions-file="audio"]').setInputFiles({ name: "损坏音频.wav", mimeType: "audio/wav", buffer: Buffer.from("this is not audio") });
  await waitText(page, ".discussions-error", "无法解码");
  assert.equal(await page.locator(".discussions-draft-audio audio").getAttribute("src"), originalSource);
  await page.locator('[data-discussions-file="audio"]').setInputFiles({ name: "过长音频.wav", mimeType: "audio/wav", buffer: wavBytes(61) });
  await waitText(page, ".discussions-error", "60 秒");
  assert.equal(await page.locator(".discussions-draft-audio audio").getAttribute("src"), originalSource);
  await page.evaluate(() => {
    const { state, render } = window.__discussionsHarness;
    state.profile = { id: state.guestId, name: "已有昵称" }; render();
  });
  assert.equal(await page.locator("#discussions-nickname").inputValue(), "已有昵称");
  await page.locator("#discussions-text").fill("图片转换与音频校验后可以继续发表");
  await page.locator(submit).click();
  await waitCount(page, comments, 1);
  const persisted = (await host.request()).body.comments[0];
  assert.equal(persisted.images.length, 3);
  assert.equal(persisted.images.every((image) => image.dataUri.startsWith("data:image/png;base64,")), true);
  assert.equal(persisted.audio.duration, 1);
  assert.equal(persisted.author.name, "已有昵称");
  assert.deepEqual(errors, []);
});
