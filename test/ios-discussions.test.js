import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { buildIOSDiscussionBridge, createIOSDiscussionHost } from "./ios-discussions-fixtures.mjs";
import { pngBytes, wavBytes } from "./discussions-fixtures.mjs";

// The refined flow tests report entry, discussion list and sheet independently of shared app/vendor edits.
const evidence = resolve(".beauye/tasks/ios-discussions-refinement/evidence");
let browser, bridge;
test.before(async () => { bridge = await buildIOSDiscussionBridge(); browser = await chromium.launch({ headless: true }); await mkdir(evidence, { recursive: true }); });
test.after(async () => { await browser?.close(); });
const count = (frame, selector, expected) => frame.waitForFunction(({ selector, expected }) => document.querySelectorAll(selector).length === expected, { selector, expected });
const text = (frame, selector, value) => frame.waitForFunction(({ selector, value }) => document.querySelector(selector)?.textContent.includes(value), { selector, value });
async function openFrame(page, base) {
  await page.goto(base + "/ios-v3/", { waitUntil: "networkidle" });
  const frame = page.frames().find(item => item.url().includes("/ios-v3/app.html"));
  assert.ok(frame); await frame.locator('body[data-discussions-ready="true"]').waitFor(); return frame;
}
async function discussion(frame) {
  await frame.locator('.rr-discussion-entry').click(); await frame.locator('[data-slot=discussion-page]').waitFor();
}
async function editor(frame) {
  await frame.locator('.rr-discussion-compose').click(); await frame.locator('[data-slot=discussion-editor]').waitFor();
}
async function choose(page, frame, name, payload) {
  const chooser = page.waitForEvent('filechooser');
  await frame.getByRole('button', { name, exact: true }).click();
  await (await chooser).setFiles(payload);
}
async function closeSheet(frame) {
  await frame.locator('#discussion-text').press('Escape');
  await count(frame, '[data-slot=discussion-editor]', 0);
}

test("report is a real-count entry; independent list and lazy editor persist combined content and idempotent retry", { timeout: 45000 }, async (t) => {
  let host = await createIOSDiscussionHost(bridge); const directory = host.directory;
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  t.after(async () => { await context.close(); await host.close({ remove: false }); await rm(directory, { recursive: true, force: true }); });
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
  let frame = await openFrame(page, host.base);
  assert.match(await frame.locator('.rr-discussion-entry').innerText(), /本卷交流[\s\S]*暂无讨论/);
  assert.equal(await frame.locator('form,textarea,[data-slot=discussion-page]').count(), 0);
  assert.equal(await frame.evaluate(() => { const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented; }),false);
  await frame.locator('.rr-discussion-entry').scrollIntoViewIfNeeded(); await page.locator('#phone').screenshot({ path: join(evidence, 'report-entry.png') });
  await discussion(frame);
  assert.equal(await frame.locator('.rr-discussion-heading h2').innerText(), '全部评论');
  assert.equal(await frame.locator('form,textarea').count(), 0); await text(frame, '.rr-discussion-empty', '还没有评论');
  await page.locator('#phone').screenshot({ path: join(evidence, 'discussion-empty.png') });
  await editor(frame);
  assert.equal(await frame.getByRole('button', { name: '图片', exact: true }).count(), 1);
  assert.equal(await frame.locator('[data-discussion-file=audio],#discussion-links').count(), 0);
  assert.equal(await frame.locator('.rr-discussion-format-help').count(), 0);
  const body = '<img src=x onerror="window.__discussionXss=1">\n资料分析的时间怎么分配？ https://example.com/question?paper=1&section=data。';
  await frame.locator('#discussion-text').fill(body);
  assert.equal(await frame.evaluate(() => { const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented; }),true);
  await page.locator('#phone').screenshot({ path: join(evidence, 'editor-simple.png') });
  await choose(page, frame, '图片', { name: '题号笔记.png', mimeType: 'image/png', buffer: pngBytes({ width: 80, height: 60 }) });
  await count(frame, '.rr-discussion-selected-images figure', 1);
  assert.equal(await frame.locator('audio,[data-discussion-file=audio],.rr-discussion-record').count(), 0);
  await page.route('**/api/discussions', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '暂时无法发表，请重试。' }) }) : route.continue());
  await frame.getByRole('button', { name: '发送', exact: true }).click(); await text(frame, '.rr-discussion-editor-error', '请重试');
  await frame.locator('#discussion-text').focus(); await page.keyboard.press('Escape');
  await count(frame, '[data-slot=discussion-editor]', 0);
  assert.match(await frame.locator('.rr-discussion-compose').innerText(), /继续编辑草稿/);
  await editor(frame);
  assert.equal(await frame.locator('#discussion-nickname').count(), 0, 'known nickname is no longer an input');
  assert.equal(await frame.locator('#discussion-text').inputValue(), body);
  assert.equal(await frame.locator('.rr-discussion-selected-images figure').count(), 1);
  assert.match(await frame.locator('#discussion-text').inputValue(), /https:\/\/example.com/);
  await page.unroute('**/api/discussions');
  const tokens = [];
  await page.route('**/api/discussions', async route => {
    if (route.request().method() === 'POST') { tokens.push(route.request().postDataJSON().clientId); await route.fetch(); await route.abort(); }
    else await route.continue();
  });
  await frame.getByRole('button', { name: '发送', exact: true }).click(); await frame.locator('.rr-discussion-editor-error').waitFor();
  assert.equal((await frame.evaluate(() => window.__iosDiscussions.list())).total, 1);
  assert.equal((await frame.evaluate(() => window.__iosDiscussions.list())).comments[0].images[0].alt, '题号笔记.png');
  await page.unroute('**/api/discussions');
  // A response lost after commit used to lose both the draft and retry token on a real reload.
  await closeSheet(frame); page.once('dialog', dialog => dialog.accept());
  await frame.goto(frame.url(), { waitUntil: 'networkidle' }); await discussion(frame); await editor(frame);
  assert.equal(await frame.locator('#discussion-text').inputValue(), body);
  assert.equal(await frame.locator('.rr-discussion-selected-images figure').count(), 1);
  await page.route('**/api/discussions', async route => { if (route.request().method() === 'POST') tokens.push(route.request().postDataJSON().clientId); await route.continue(); });
  await frame.getByRole('button', { name: '发送', exact: true }).evaluate(element => { element.click(); element.click(); });
  await count(frame, '[data-slot=discussion-editor]', 0); await count(frame, '.rr-discussion-post', 1);
  assert.equal(tokens.length, 2); assert.equal(tokens[0], tokens[1]);
  assert.equal(await frame.evaluate(() => { const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented; }),false);
  assert.equal((await frame.evaluate(() => window.__iosDiscussions.list())).total, 1);
  assert.equal((await frame.evaluate(() => window.__iosDiscussions.list())).comments[0].author.name, '卷友');
  assert.equal(await frame.locator('.rr-discussion-text').innerText(), body);
  assert.equal(await frame.evaluate(() => window.__discussionXss), undefined);
  assert.equal(await frame.locator('.rr-discussion-post [data-slot=discussion-avatar]').count(), 1);
  assert.equal(await frame.locator('.rr-discussion-text img').count(), 0);
  assert.equal(await frame.locator('.rr-discussion-text a').getAttribute('href'), 'https://example.com/question?paper=1&section=data');
  assert.equal(await frame.locator('.rr-discussion-links').count(), 0);
  assert.deepEqual((await frame.evaluate(() => window.__iosDiscussions.list())).comments[0].links, ['https://example.com/question?paper=1&section=data']);
  await frame.locator('.rr-discussion-image').click(); await frame.locator('.rr-discussion-full-image').waitFor();
  assert.equal(await frame.locator('.rr-discussion-full-image').getAttribute('alt'), '题号笔记.png');
  await page.locator('#phone').screenshot({ path: join(evidence, 'image-sheet.png') });
  await frame.getByRole('dialog').getByRole('button', { name: '关闭面板', exact: true }).click();
  await frame.waitForFunction(() => !document.querySelector('.rr-discussion-full-image'));
  for (const [width, height] of [[390,844],[320,568],[430,932]]) {
    await page.locator('#size').selectOption(`${width},${height}`);
    await frame.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    await frame.locator('.rr-discussion-post').evaluate(element => element.scrollIntoView({ block: 'start' }));
    assert.equal(await frame.locator('.view').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    await page.locator('#phone').screenshot({ path: join(evidence, `discussion-${width}.png`) });
  }
  await frame.getByRole('button', { name: '返回', exact: true }).click();
  await text(frame, '.rr-discussion-entry', '1 条讨论'); assert.equal(await frame.locator('textarea,form').count(), 0);
  await frame.goto(frame.url(), { waitUntil: 'networkidle' }); await text(frame, '.rr-discussion-entry', '1 条讨论');
  await host.close({ remove: false }); host = await createIOSDiscussionHost(bridge, { directory });
  frame = await openFrame(page, host.base); await text(frame, '.rr-discussion-entry', '1 条讨论'); await discussion(frame); await count(frame, '.rr-discussion-post', 1);
  const catalog = JSON.parse(await readFile(join(directory, 'catalog.json'), 'utf8')); assert.equal(catalog.features.discussions.comments.length, 1);
  assert.deepEqual(errors, []);
});

// Geometry, keyboard insets and editor expansion are user-visible contracts, not screenshots of a mirrored implementation.
test("mobile composer aligns text and send, expands the same draft and follows the mobile keyboard", { timeout: 45000 }, async (t) => {
  const host = await createIOSDiscussionHost(bridge);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1300 }, reducedMotion: 'reduce' });
  t.after(async () => { await context.close(); await host.close(); });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const frame = await openFrame(page, host.base);
  await frame.evaluate(() => {
    window.__iosDiscussions.state.profile = { id: window.__iosDiscussions.state.guestId, name: '晚风' };
    const viewport = window.visualViewport;
    window.__nativeViewportHeight = Object.getOwnPropertyDescriptor(viewport, 'height');
    Object.defineProperty(viewport, 'height', { configurable: true, get: () => window.__keyboardHeight ?? innerHeight });
  });
  await discussion(frame); await editor(frame);
  await frame.waitForFunction(() => document.activeElement?.id === 'discussion-text');
  assert.equal(await frame.getByRole('dialog', { name: '发表评论', exact: true }).count(), 1);
  assert.equal(await frame.locator('.sheet-heading').isVisible(), false);
  assert.equal(await frame.locator('.rr-discussion-editor-identity,#discussion-nickname,.rr-discussion-editor footer,.rr-discussion-counter,[data-discussion-file=audio],#discussion-links').count(), 0);
  assert.equal(await frame.getByRole('button', { name: '附件', exact: true }).count(), 0);
  assert.equal(await frame.getByRole('button', { name: '链接', exact: true }).count(), 0);
  assert.equal(await frame.getByRole('button', { name: '附件格式与大小', exact: true }).count(), 0);
  assert.equal(await frame.getByRole('button', { name: '图片', exact: true }).count(), 1);
  assert.equal(await frame.getByRole('button', { name: '录音', exact: true }).count(), 0);
  assert.equal(await frame.locator('.rr-discussion-editor-toolbar').count(), 0, 'the chat input must not leave a separate sparse toolbar');
  const measurements = [];
  for (const [width, height] of [[320,568],[390,844],[430,932]]) {
    await page.locator('#size').selectOption(`${width},${height}`);
    await frame.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const geometry = await frame.locator('.rr-discussion-editor').evaluate(form => {
      const field = form.querySelector('#discussion-text').getBoundingClientRect(), send = form.querySelector('.rr-discussion-submit').getBoundingClientRect(), photo = form.querySelector('.rr-discussion-photo').getBoundingClientRect(), sheet = form.closest('[role=dialog]').getBoundingClientRect();
      return { width: innerWidth, field: field.toJSON(), send: send.toJSON(), photo: photo.toJSON(), sheet: sheet.toJSON(), content: form.scrollWidth, available: form.clientWidth };
    });
    assert.ok(geometry.sheet.height <= 220, `empty composer is too tall at ${width}`);
    // A one-line mobile composer and its send control share one compact touch target.
    assert.ok(geometry.field.height >= 44 && geometry.field.height <= 46);
    assert.ok(geometry.send.x >= geometry.field.right && Math.abs(geometry.send.top - geometry.field.top) <= 1 && Math.abs(geometry.send.bottom - geometry.field.bottom) <= 1);
    assert.ok(geometry.photo.right <= geometry.field.left && Math.abs(geometry.photo.bottom - geometry.send.bottom) <= 1 && geometry.photo.height >= 44);
    assert.ok(geometry.send.height >= 44 && geometry.send.bottom <= height);
    assert.ok(geometry.content <= geometry.available); measurements.push(geometry);
    await page.locator('#phone').screenshot({ path: join(evidence, `composer-${width}.png`) });
  }
  // Review the written chat state at full phone size, not only its empty geometry.
  await frame.locator('#discussion-text').fill('资料分析这题有没有更快的解法？');
  for (const [width, height] of [[320,568],[390,844],[430,932]]) {
    await page.locator('#size').selectOption(`${width},${height}`);
    await frame.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.locator('#phone').screenshot({ path: join(evidence, `chat-input-short-${width}.png`) });
  }
  const body = Array.from({ length: 12 }, (_, index) => `第${index + 1}行评论`).join('\n') + '。';
  await frame.locator('#discussion-text').fill(body.slice(0, -1));
  await frame.locator('#discussion-text').pressSequentially('。');
  const long = await frame.locator('#discussion-text').evaluate(field => ({ height: field.getBoundingClientRect().height, scroll: field.scrollHeight, overflow: getComputedStyle(field).overflowY, scrollTop: field.scrollTop, client: field.clientHeight }));
  assert.ok(long.height >= 145 && long.height <= 154 && long.scroll > long.height); assert.equal(long.overflow, 'auto');
  assert.ok(long.scrollTop + long.client >= long.scroll - 2, 'growing text must keep the newly typed last line visible');
  assert.ok(await frame.locator('.rr-discussion-input-row').evaluate(row => Math.abs(row.querySelector('#discussion-text').getBoundingClientRect().bottom - row.querySelector('.rr-discussion-submit').getBoundingClientRect().bottom) <= 1));
  assert.ok(await frame.locator('.rr-discussion-expand').evaluate(button => button.getBoundingClientRect().height >= 44));
  for (const [width, height] of [[320,568],[390,844],[430,932]]) {
    await page.locator('#size').selectOption(`${width},${height}`);
    await frame.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.locator('#phone').screenshot({ path: join(evidence, `chat-input-growing-${width}.png`) });
  }
  await frame.getByRole('button', { name: '展开编辑', exact: true }).click();
  await frame.locator('.rr-discussion-editor[data-expanded=true]').waitFor();
  await choose(page, frame, '图片', { name: '全屏草稿.png', mimeType: 'image/png', buffer: pngBytes() });
  for (const [width, height] of [[320,568],[390,844],[430,932]]) {
    await page.locator('#size').selectOption(`${width},${height}`);
    await frame.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const full = await frame.locator('.rr-discussion-editor').evaluate(form => ({ sheet: form.closest('[role=dialog]').getBoundingClientRect().toJSON(), field: form.querySelector('#discussion-text').getBoundingClientRect().toJSON(), send: form.querySelector('.rr-discussion-submit').getBoundingClientRect().toJSON(), viewport: innerHeight, available: form.clientWidth, content: form.scrollWidth }));
    await page.locator('#phone').screenshot({ path: join(evidence, `composer-expanded-${width}.png`) });
    await writeFile(join(evidence, `composer-expanded-${width}.json`), JSON.stringify(full, null, 2));
    assert.ok(full.sheet.height >= height - 12 && full.sheet.bottom <= height + 1);
    assert.ok(full.send.bottom <= full.sheet.bottom && full.field.height > 64 && full.content <= full.available, JSON.stringify(full));
    assert.equal(await frame.locator('#discussion-text').inputValue(), body);
    await page.locator('#phone').screenshot({ path: join(evidence, `composer-expanded-${width}.png`) });
  }
  await frame.evaluate(() => { window.__keyboardHeight = 340; window.visualViewport.dispatchEvent(new Event('resize')); });
  const keyboard = await frame.getByRole('dialog').evaluate(sheet => ({ bottom: sheet.getBoundingClientRect().bottom, height: sheet.getBoundingClientRect().height, textBottom: document.querySelector('#discussion-text').getBoundingClientRect().bottom, sendBottom: document.querySelector('.rr-discussion-submit').getBoundingClientRect().bottom }));
  assert.ok(keyboard.bottom <= 340 && keyboard.sendBottom <= 340 && keyboard.textBottom <= 340);
  await page.locator('#phone').screenshot({ path: join(evidence, 'composer-keyboard-430.png') });
  await frame.getByRole('button', { name: '收起编辑', exact: true }).click();
  assert.equal(await frame.locator('#discussion-text').inputValue(), body); assert.equal(await frame.locator('.rr-discussion-selected-images figure').count(), 1);
  await frame.evaluate(() => { window.__keyboardHeight = undefined; window.visualViewport.dispatchEvent(new Event('resize')); });
  for (const [width, height] of [[320,568],[390,844],[430,932]]) {
    await page.locator('#size').selectOption(`${width},${height}`);
    await frame.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const sharedBar = await frame.locator('.rr-discussion-editor').evaluate(form => ({
      image: form.querySelector('.rr-discussion-selected-images figure').getBoundingClientRect().toJSON(),
      bar: form.querySelector('.rr-discussion-input-row').getBoundingClientRect().toJSON(),
      photo: form.querySelector('.rr-discussion-photo').getBoundingClientRect().toJSON(),
      send: form.querySelector('.rr-discussion-submit').getBoundingClientRect().toJSON(),
    }));
    assert.ok(sharedBar.image.bottom <= sharedBar.bar.top && Math.abs(sharedBar.photo.bottom - sharedBar.send.bottom) <= 1, JSON.stringify(sharedBar));
    await page.locator('#phone').screenshot({ path: join(evidence, `chat-input-photo-${width}.png`) });
  }
  // The old generic 70vh body placed the entire attachment below a short keyboard viewport.
  await page.locator('#size').selectOption('320,568');
  await frame.evaluate(() => { window.__keyboardHeight = 300; window.visualViewport.dispatchEvent(new Event('resize')); });
  const compactKeyboard = await frame.locator('.rr-discussion-editor').evaluate(form => ({
    photo: form.querySelector('.rr-discussion-selected-images figure').getBoundingClientRect().toJSON(),
    remove: form.querySelector('.rr-discussion-remove-image').getBoundingClientRect().toJSON(),
    send: form.querySelector('.rr-discussion-submit').getBoundingClientRect().toJSON(),
    field: form.querySelector('#discussion-text').getBoundingClientRect().toJSON(),
    row: form.querySelector('.rr-discussion-input-row').getBoundingClientRect().toJSON(),
  }));
  assert.ok(compactKeyboard.photo.bottom <= 300 && compactKeyboard.remove.bottom <= 300 && compactKeyboard.send.bottom <= 300, JSON.stringify(compactKeyboard));
  assert.ok(compactKeyboard.field.height >= 44);
  assert.ok(compactKeyboard.photo.bottom <= compactKeyboard.row.top, 'photo previews belong above the shared chat input bar');
  await page.locator('#phone').screenshot({ path: join(evidence, 'composer-keyboard-photo-320.png') });
  await frame.evaluate(() => { window.__keyboardHeight = undefined; window.visualViewport.dispatchEvent(new Event('resize')); });
  await frame.locator('#discussion-text').fill('字'.repeat(1800)); assert.equal(await frame.locator('.rr-discussion-counter').innerText(), '1800 / 2000');
  await frame.locator('#discussion-text').fill('这题还有更快的解法吗？ https://example.com/解题。'); assert.equal(await frame.locator('.rr-discussion-counter').count(), 0);
  await closeSheet(frame); await editor(frame);
  assert.equal(await frame.locator('.rr-discussion-selected-images figure').count(), 1);
  assert.match(await frame.locator('#discussion-text').inputValue(), /更快的解法/);
  await frame.getByRole('button', { name: '移除图片 1', exact: true }).focus(); await page.keyboard.press('Tab');
  assert.equal(await frame.getByRole('button', { name: '图片', exact: true }).evaluate(button => button === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await frame.locator('#discussion-text').evaluate(field => field === document.activeElement), true);
  await frame.getByRole('button', { name: '发送', exact: true }).click(); await count(frame, '[data-slot=discussion-editor]', 0);
  assert.equal((await frame.evaluate(() => window.__iosDiscussions.list())).comments[0].author.name, '晚风');
  assert.equal(await frame.locator('.rr-discussion-post-body header strong').innerText(), '晚风');
  assert.ok(await frame.locator('.rr-discussion-text a').getAttribute('href'));
  assert.deepEqual(errors, []);
  await writeFile(join(evidence, 'compact-composer-geometry.json'), JSON.stringify({ measurements, long, keyboard, errors }, null, 2));
});

// Browser storage can be unavailable; authors must keep editing and see when a reload would lose their draft.
test("direct photo entry retains text and images across reload and recovers from storage failure", { timeout: 45000 }, async t => {
  const host = await createIOSDiscussionHost(bridge), context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, reducedMotion: 'reduce' });
  t.after(async () => { await context.close(); await host.close(); });
  const page = await context.newPage(), frame = await openFrame(page, host.base);
  await discussion(frame);
  assert.equal(await frame.getByRole('button', { name: '添加图片', exact: true }).count(), 1);
  assert.equal(await frame.locator('.rr-discussion-compose-bar button button').count(), 0);
  await choose(page, frame, '添加图片', { name: '刷新后保留.png', mimeType: 'image/png', buffer: pngBytes() });
  await count(frame, '.rr-discussion-selected-images figure', 1);
  assert.ok(await frame.locator('.rr-discussion-editor').evaluate(form => form.querySelector('.rr-discussion-selected-images figure').getBoundingClientRect().bottom <= form.querySelector('.rr-discussion-input-row').getBoundingClientRect().top));
  await frame.locator('#discussion-text').fill('刷新后仍可继续编辑的照片草稿');
  await closeSheet(frame); page.once('dialog', dialog => dialog.accept());
  await frame.goto(frame.url(), { waitUntil: 'networkidle' }); await discussion(frame); await editor(frame);
  assert.equal(await frame.locator('#discussion-text').inputValue(), '刷新后仍可继续编辑的照片草稿');
  assert.equal(await frame.locator('.rr-discussion-selected-images figure').count(), 1);
  await frame.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('rollierank:discussion-drafts:')) throw new DOMException('Storage blocked', 'QuotaExceededError'); return original.call(this, key, value); };
    window.__restoreDraftStorage = () => { Storage.prototype.setItem = original; };
  });
  await frame.locator('#discussion-text').fill('存储失败时仍留在页面里的草稿');
  await text(frame, '.rr-discussion-draft-notice', '刷新前请先发表或复制文字');
  await closeSheet(frame); await editor(frame);
  assert.equal(await frame.locator('#discussion-text').inputValue(), '存储失败时仍留在页面里的草稿');
  assert.equal(await frame.locator('.rr-discussion-selected-images figure').count(), 1);
  await frame.evaluate(() => window.__restoreDraftStorage());
  await frame.locator('#discussion-text').fill('存储恢复后可以安全刷新的草稿');
  await count(frame, '.rr-discussion-draft-notice', 0);
  await closeSheet(frame); page.once('dialog', dialog => dialog.accept());
  await frame.goto(frame.url(), { waitUntil: 'networkidle' }); await discussion(frame); await editor(frame);
  assert.equal(await frame.locator('#discussion-text').inputValue(), '存储恢复后可以安全刷新的草稿');
  assert.equal(await frame.locator('.rr-discussion-selected-images figure').count(), 1);
  await closeSheet(frame);
  const target = await frame.evaluate(async () => {
    const f = window.__iosDiscussions;
    const result = await f.api('discussions', { guestId: f.state.guestId, paperId: f.attempt.paperId, attemptId: f.attempt.id,
      clientId: 'long-default-name-reply-context-123', nickname: '卷友', text: '我把 2025 年的基数先化成整百，再用选项间距估算。这里还需要留意正负误差与末位数字。' });
    await f.enter('report'); return result.comment;
  });
  await page.locator('#size').selectOption('320,568'); await discussion(frame);
  await frame.locator(`[data-comment-id="${target.id}"]`).getByRole('button', { name: '回复卷友的评论', exact: true }).click();
  await frame.locator('#discussion-text').fill('给这条原文的回复');
  assert.match(await frame.locator('.rr-discussion-reply-context').innerText(), /基数先化成整百/);
  const quoted = await frame.locator('.rr-discussion-editor').evaluate(form => ({
    content: form.scrollWidth, available: form.clientWidth, send: form.querySelector('.rr-discussion-submit').getBoundingClientRect().toJSON(),
    cancel: form.querySelector('[aria-label="取消回复"]').getBoundingClientRect().toJSON(),
  }));
  assert.ok(quoted.content <= quoted.available && quoted.send.right <= 320 && quoted.cancel.right <= 320, JSON.stringify(quoted));
  await page.locator('#phone').screenshot({ path: join(evidence, 'reply-long-excerpt-320.png') });
});

test("closing sheets and switching papers retains drafts and late image conversion in the original scope", { timeout: 45000 }, async (t) => {
  const host = await createIOSDiscussionHost(bridge); const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  t.after(async () => { await context.close(); await host.close(); });
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message)); const frame = await openFrame(page, host.base);
  await frame.evaluate(() => { window.__iosDiscussions.state.profile = { id: window.__iosDiscussions.state.guestId, name: '\u202e' }; });
  await discussion(frame); await editor(frame); await frame.locator('#discussion-text').fill('第一套卷的草稿');
  await frame.evaluate(() => { const original = createImageBitmap.bind(window); window.createImageBitmap = input => new Promise(resolveBitmap => { window.__finishBitmap = async () => resolveBitmap(await original(input)); }); });
  await choose(page, frame, '图片', { name: '草稿图片.png', mimeType: 'image/png', buffer: pngBytes() });
  await frame.waitForFunction(() => typeof window.__finishBitmap === 'function'); await closeSheet(frame);
  await frame.evaluate(() => window.__iosDiscussions.paper(1)); await discussion(frame); await editor(frame);
  assert.equal(await frame.locator('#discussion-text').inputValue(), ''); assert.equal(await frame.locator('.rr-discussion-selected-images').count(), 0); await closeSheet(frame);
  await frame.evaluate(() => window.__finishBitmap());
  await frame.evaluate(() => window.__iosDiscussions.paper(0)); await discussion(frame); await editor(frame);
  await count(frame, '.rr-discussion-selected-images figure', 1);
  assert.equal(await frame.locator('#discussion-text').inputValue(), '第一套卷的草稿'); assert.equal(await frame.locator('.rr-discussion-editor-identity,#discussion-nickname').count(), 0);
  await frame.getByRole('button', { name: '返回', exact: true }).evaluate(element => element.click());
  await count(frame, '[data-slot=discussion-editor]', 0); await discussion(frame); assert.match(await frame.locator('.rr-discussion-compose').innerText(), /继续编辑草稿/);
  assert.deepEqual(errors, []);
});

test("true count, pagination and in-flight reads preserve legacy stored media without mobile players", { timeout: 45000 }, async (t) => {
  const host = await createIOSDiscussionHost(bridge); const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  t.after(async () => { await context.close(); await host.close(); });
  const page = await context.newPage(); const frame = await openFrame(page, host.base);
  const voice = `data:audio/wav;base64,${wavBytes(1).toString('base64')}`;
  await frame.evaluate(async voice => {
    const f = window.__iosDiscussions;
    for (let index=0;index<24;index++) await f.api('discussions',{paperId:f.attempt.paperId,attemptId:f.attempt.id,guestId:f.state.guestId,clientId:'pagination-refinement-'+index,nickname:'已有同学',text:'已有讨论 '+index,images:[],links:[],audio:index===23?{dataUri:voice,name:'已有语音'}:null});
    await f.enter('report');
  }, voice);
  await text(frame,'.rr-discussion-entry','24 条讨论'); await discussion(frame); await count(frame,'.rr-discussion-post',20);
  assert.equal(await frame.locator('audio').count(), 0);
  await frame.getByRole('button',{name:'更早的讨论',exact:true}).click(); await count(frame,'.rr-discussion-post',24);
  assert.equal((await frame.evaluate(() => window.__iosDiscussions.list())).comments[0].audio.name, '已有语音');
  let release, intercepted, completed;
  const held=new Promise(resolveHeld=>{release=resolveHeld;});const waiting=new Promise(resolveWaiting=>{intercepted=resolveWaiting;});const done=new Promise(resolveDone=>{completed=resolveDone;});
  let firstRead=true;
  await page.route('**/api/discussions?**',async route=>{if(!firstRead){await route.continue();return;}firstRead=false;const response=await route.fetch();intercepted();await held;await route.fulfill({response});completed();});
  await frame.evaluate(()=>{void window.__iosDiscussions.feature.onRoute();});await waiting;
  await editor(frame);await frame.locator('#discussion-text').fill('读取期间发表的新评论');await frame.getByRole('button',{name:'发送',exact:true}).click();await count(frame,'[data-slot=discussion-editor]',0);
  release();await done;await page.unroute('**/api/discussions?**');
  await text(frame,'.rr-discussion-heading','25 条讨论');assert.ok((await frame.locator('.rr-discussion-text').allTextContents()).includes('读取期间发表的新评论'));
  assert.equal(await frame.locator('audio').count(), 0);
});

// The mobile surface must never acquire a microphone or construct an audio recorder.
test("mobile comments stay photo-and-text only through compose, close, reload and destroy", { timeout: 45000 }, async t => {
  const host = await createIOSDiscussionHost(bridge), context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  t.after(async () => { await context.close(); await host.close(); });
  await context.addInitScript(() => {
    window.__microphoneCalls = 0; window.__recorderCalls = 0;
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { window.__microphoneCalls++; throw new Error('Unexpected microphone access'); };
    window.MediaRecorder = class { constructor() { window.__recorderCalls++; throw new Error('Unexpected recorder'); } };
  });
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
  let frame = await openFrame(page, host.base); await discussion(frame); await editor(frame);
  await frame.locator('#discussion-text').fill('关闭后保留的文字'); await closeSheet(frame); await editor(frame);
  assert.equal(await frame.locator('#discussion-text').inputValue(), '关闭后保留的文字');
  assert.equal(await frame.locator('audio,input[accept*="audio"],.rr-discussion-recording').count(), 0);
  assert.equal(await frame.getByRole('button', { name: /语音|录音|录制/ }).count(), 0);
  await frame.getByRole('button', { name: '发送', exact: true }).click(); await count(frame, '[data-slot=discussion-editor]', 0);
  assert.deepEqual(await frame.evaluate(() => [window.__microphoneCalls, window.__recorderCalls]), [0, 0]);
  await frame.goto(frame.url(), { waitUntil: 'networkidle' }); await frame.locator('body[data-discussions-ready="true"]').waitFor(); await discussion(frame); await editor(frame);
  assert.equal(await frame.locator('audio,input[accept*="audio"]').count(), 0);
  await frame.evaluate(() => window.__iosDiscussions.feature.destroy());
  assert.deepEqual(await frame.evaluate(() => [window.__microphoneCalls, window.__recorderCalls]), [0, 0]); assert.deepEqual(errors, []);
});

test("sample access stays read-only and shared sanitizers protect the new React list", { timeout:45000 }, async(t)=>{
  const host=await createIOSDiscussionHost(bridge);const context=await browser.newContext({viewport:{width:1280,height:1000}});t.after(async()=>{await context.close();await host.close();});const page=await context.newPage();const frame=await openFrame(page,host.base);let requests=0;const observer=request=>{if(request.url().includes('/api/discussions'))requests++;};page.on('request',observer);
  await frame.evaluate(()=>window.__iosDiscussions.sample(true));await discussion(frame);assert.equal(await frame.locator('form,textarea,.rr-discussion-compose').count(),0);assert.equal(requests,0);await frame.getByRole('button',{name:'去练习',exact:true}).click();assert.match(await frame.evaluate(()=>window.__iosDiscussions.navigations.at(-1)),/^practice\//);assert.equal(requests,0);page.off('request',observer);
  await frame.evaluate(()=>window.__iosDiscussions.sample(false));
  await page.route('**/api/discussions?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'暂时无法读取讨论，请重试。'})}));
  await frame.evaluate(()=>window.__iosDiscussions.enter('report'));assert.match(await frame.locator('.rr-discussion-entry').innerText(),/暂时无法读取/);await discussion(frame);await text(frame,'.rr-discussion-list-state','请重试');await page.unroute('**/api/discussions?**');await frame.getByRole('button',{name:'重新加载',exact:true}).click();await text(frame,'.rr-discussion-empty','还没有评论');
  const paperId=await frame.evaluate(()=>window.__iosDiscussions.attempt.paperId);
  await page.route('**/api/discussions?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({paperId,total:1,nextCursor:null,comments:[{id:'unsafe-comment',paperId,author:{name:'<script>同学'},text:'<img src=x onerror="window.__unsafe=1">',createdAt:Date.now(),images:[{dataUri:'data:image/svg+xml;base64,PHN2Zy8+',alt:'unsafe'}],audio:{dataUri:'javascript:alert(1)',name:'unsafe'},links:['javascript:alert(1)','https://example.com/safe']}]})}));
  await frame.evaluate(()=>window.__iosDiscussions.enter('report'));await discussion(frame);await count(frame,'.rr-discussion-post',1);assert.equal(await frame.locator('.rr-discussion-post img,.rr-discussion-post audio,.rr-discussion-post script').count(),0);assert.equal(await frame.locator('.rr-discussion-links a').count(),1);assert.equal(await frame.locator('.rr-discussion-links a').getAttribute('rel'),'noopener noreferrer');assert.equal(await frame.evaluate(()=>window.__unsafe),undefined);
});

test("a first read overtaken by a post waits for a fresh authoritative comment count", {timeout:45000},async(t)=>{
  const host=await createIOSDiscussionHost(bridge);const context=await browser.newContext({viewport:{width:1280,height:1000}});t.after(async()=>{await context.close();await host.close();});
  const api=async(path,data)=>{const response=await fetch(host.base+'/api/'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});assert.ok(response.ok);return response.json();};
  const version=(await api('catalog')).versions.find(item=>item.status==='published'),guestId='ios-discussion-guest-123456',attemptId='ios-discussion-attempt-123456';
  const attempt=await api('submit',{versionId:version.id,guestId,attemptId,answers:Array(version.questionCount).fill('A')});
  for(let index=0;index<3;index++)await api('discussions',{paperId:attempt.paperId,guestId,attemptId,clientId:'initial-count-'+index+'-123',nickname:'已有同学',text:'旧评论 '+index,links:[],images:[],audio:null});
  const page=await context.newPage();let release,intercepted,completed,first=true;
  const held=new Promise(resolve=>{release=resolve;}),waiting=new Promise(resolve=>{intercepted=resolve;}),done=new Promise(resolve=>{completed=resolve;});
  await page.route('**/api/discussions?**',async route=>{if(!first){await route.continue();return;}first=false;const response=await route.fetch();intercepted();await held;await route.fulfill({response});completed();});
  await page.goto(host.base+'/ios-v3/',{waitUntil:'domcontentloaded'});const element=await page.locator('#phone').elementHandle(),frame=await element.contentFrame();assert.ok(frame);await frame.locator('.rr-discussion-entry').waitFor();await waiting;
  assert.match(await frame.locator('.rr-discussion-entry').innerText(),/正在读取/);await discussion(frame);await editor(frame);await frame.locator('#discussion-text').fill('首次读取期间的新评论');await frame.getByRole('button',{name:'发送',exact:true}).click();await count(frame,'[data-slot=discussion-editor]',0);assert.match(await frame.locator('.rr-discussion-heading').innerText(),/正在读取/);
  release();await done;await text(frame,'.rr-discussion-heading','4 条讨论');await page.unroute('**/api/discussions?**');assert.equal((await frame.evaluate(()=>window.__iosDiscussions.list())).total,4);assert.ok((await frame.locator('.rr-discussion-text').allTextContents()).includes('首次读取期间的新评论'));
});

test("returning to an expanded thread refreshes replies added by another real reader", { timeout: 20000 }, async t => {
  const host = await createIOSDiscussionHost(bridge), context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  t.after(async () => { await context.close(); await host.close(); });
  const page = await context.newPage(), frame = await openFrame(page, host.base);
  const root = await frame.evaluate(async () => {
    const f = window.__iosDiscussions, target = { paperId: f.attempt.paperId, attemptId: f.attempt.id, guestId: f.state.guestId };
    const root = (await f.api('discussions', { ...target, clientId: 'refresh-thread-root-123', nickname: '晚风', text: '交流一下' })).comment;
    await f.api('discussions', { ...target, clientId: 'refresh-thread-first-123', nickname: '小舟', text: '第一条回复', parentId: root.id });
    await f.enter('report'); return root;
  });
  await discussion(frame); await frame.getByRole('button', { name: '展开1条回复', exact: true }).click(); await count(frame, '.rr-discussion-reply', 1);
  await frame.evaluate(async rootId => {
    const f = window.__iosDiscussions, guestId = 'guest-real-thread-other-123', attemptId = 'attempt-real-thread-other-123';
    await f.api('submit', { guestId, attemptId, versionId: f.version.id, answers: Array(f.version.questionCount).fill('A') });
    await f.api('discussions', { guestId, attemptId, paperId: f.attempt.paperId, clientId: 'refresh-thread-second-123', nickname: '山间', text: '新加入的回复', parentId: rootId });
    await f.enter('report');
  }, root.id);
  await discussion(frame); await text(frame, '.rr-discussion-heading', '3 条讨论');
  await count(frame, '.rr-discussion-reply', 2); assert.ok((await frame.locator('.rr-discussion-reply .rr-discussion-text').allTextContents()).includes('新加入的回复'));
});
