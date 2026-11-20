import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

test("latest timer picker and scaled single-answer feedback", { timeout: 60000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), "ios-timer-latest-"));
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = reservation.address().port; await new Promise(done => reservation.close(done));
  const server = spawn(process.execPath, ["scripts/serve.mjs"], { env: { ...process.env, PORT: String(port), ROLLIERANK_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "", browser;
  server.stdout.on("data", chunk => { logs += chunk; }); server.stderr.on("data", chunk => { logs += chunk; });
  t.after(async () => { await browser?.close(); server.kill("SIGTERM"); if (server.exitCode === null) await once(server, "exit"); await rm(directory, { recursive: true, force: true }); });
  await new Promise((done, reject) => { const timeout = setTimeout(() => reject(new Error(logs || "Service not ready")), 15000); server.stdout.on("data", () => { if (logs.includes("RollieRank is ready")) { clearTimeout(timeout); done(); } }); server.once("error", reject); });
  browser = await chromium.launch({ headless: true });
  const evidence = resolve("test-results/feedback-reaudit/timer-entry/latest-comments"); await mkdir(evidence, { recursive: true });
  const base = `http://127.0.0.1:${port}`;
  const openPicker = async session => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", hasTouch: true });
    page.setDefaultTimeout(5000);
    await page.goto(`${base}/ios-v3/app.html?page=home&empty=1&session=latest-${session}&design=paper-cards-1114-v3`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "开始做题计时", exact: true }).click();
    return page;
  };
  const drag = async (page, target, dx, dy = 0, touch = false) => {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox(); assert.ok(box);
    const x = box.x + box.width * (dx < 0 ? .75 : .25), y = box.y + Math.min(box.height / 2, 30);
    if (touch) {
      const session = await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x, y }] });
      for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, x: x + dx * i / 12, y: y + dy * i / 12 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
    } else {
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
    }
    await page.waitForTimeout(100);
  };
  const level = async page => await page.locator('.rr-timer-paper-list').count() ? page.locator('.rr-timer-paper-list').getAttribute('data-picker-level') : "closed";
  await t.test("left swipe and explicit back each remove exactly one picker level", async () => {
    const page = await openPicker("back");
    assert.deepEqual(await page.locator(".rr-timer-institution-option").allTextContents(), ["花生", "超格", "粉笔", "上岸村"]);
    await page.getByRole("button", { name: "选择花生计时套卷", exact: true }).click();
    assert.ok((await page.locator(".rr-timer-collection-option").allTextContents()).every(text => !/\d+\s*套/.test(text)));
    assert.ok((await page.locator(".rr-timer-collection-option").allTextContents()).every(text => !text.includes("行测")));
    await page.getByRole("button", { name: /选择花生一期/ }).click();
    const firstPaper = page.locator('.rr-timer-paper-option').first();
    await drag(page, firstPaper, 0, -75, true);
    assert.equal(await level(page), "paper", "vertical scrolling must not navigate back");
    await drag(page, firstPaper, -20);
    assert.equal(await level(page), "paper", "a short drag must not go back or activate the paper button");
    await drag(page, firstPaper, -105);
    await page.screenshot({ path: join(evidence, "picker-left-to-collection.png") });
    assert.equal(await level(page), "collection", "left swipe from papers returns to collections");
    await drag(page, page.locator('.rr-timer-collection-option').first(), -105);
    assert.equal(await level(page), "institution", "the next left swipe returns to institutions");
    const search = page.getByRole("textbox", { name: "搜索计时套卷", exact: true });
    await search.fill("第 01 套");
    await drag(page, search, -90);
    assert.equal(await level(page), "search", "editing or dragging in search must not close the picker");
    await search.fill("");
    await page.getByRole("button", { name: "选择粉笔计时套卷", exact: true }).click();
    assert.equal(await level(page), "paper");
    await drag(page, page.locator('.rr-timer-paper-option').first(), -105, 0, true);
    assert.equal(await level(page), "collection", "touch back exposes the publisher's one collection");
    await page.locator('.rr-timer-collection-option').first().click();
    await page.getByRole("button", { name: "返回上一级", exact: true }).click();
    assert.equal(await level(page), "collection", "a publisher with one collection still has an exact back step");
    await page.getByRole("button", { name: "返回上一级", exact: true }).click();
    assert.equal(await level(page), "institution");
    await drag(page, page.locator('.rr-timer-institution-option').first(), -105);
    await page.locator('#timer-paper-picker-ui').waitFor({ state: "hidden" });
    assert.equal(await page.locator('.view[data-page="home"]').count(), 1, "root swipe closes without activating a background paper button");
    await page.close();
  });
  await t.test("the actual backdrop supports mouse and native touch back without changing other sheets", async () => {
    const paperLevel = async page => {
      await page.getByRole("button", { name: "选择花生计时套卷", exact: true }).click();
      await page.getByRole("button", { name: /选择花生一期/ }).click();
      assert.equal(await level(page), 'paper');
    };
    const gesture = async (page, dx, dy, touch) => {
      // Both ends are on the user's selected full-screen close button above the sheet.
      const target = await page.evaluate(() => { const element = document.elementFromPoint(300, 80); return { tag: element?.tagName, label: element?.getAttribute('aria-label'), height: element?.getBoundingClientRect().height }; });
      assert.deepEqual(target, { tag: 'BUTTON', label: '关闭面板', height: 844 });
      if (touch) {
        const session = await page.context().newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: 300, y: 80 }] });
        for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, x: 300 + dx * i / 12, y: 80 + dy * i / 12 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
      } else {
        await page.mouse.move(300, 80); await page.mouse.down(); await page.mouse.move(300 + dx, 80 + dy, { steps: 12 }); await page.mouse.up();
      }
      await page.waitForTimeout(100);
    };
    for (const touch of [false, true]) {
      const name = touch ? 'touch' : 'mouse', page = await openPicker(`backdrop-${name}`);
      await paperLevel(page);
      await gesture(page, -140, 0, touch);
      await page.screenshot({ path: join(evidence, `backdrop-${name}-back.png`) });
      assert.equal(await level(page), 'collection', `${name} backdrop left swipe must pop one level rather than dismiss`);
      await page.getByRole('button', { name: /选择花生一期/ }).click();
      await gesture(page, 0, 50, touch);
      assert.equal(await level(page), 'paper', `${name} vertical backdrop movement must not dismiss or navigate`);
      await gesture(page, -140, 0, touch); assert.equal(await level(page), 'collection');
      await gesture(page, -140, 0, touch); assert.equal(await level(page), 'institution');
      await gesture(page, -140, 0, touch);
      await page.locator('#timer-paper-picker-ui').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.view[data-page="home"]').count(), 1);
      await page.close();
    }
    for (const touch of [false, true]) {
      const page = await openPicker(`backdrop-tap-${touch}`);
      await paperLevel(page);
      if (touch) await page.touchscreen.tap(300, 80); else await page.mouse.click(300, 80);
      await page.locator('#timer-paper-picker-ui').waitFor({ state: 'hidden' });
      await page.close();
    }
    const page = await openPicker('backdrop-cleanup');
    await paperLevel(page);
    await page.getByRole('tab', { name: '自定义', exact: true }).click();
    await page.getByRole('spinbutton', { name: '自定义总分钟', exact: true }).waitFor();
    const style = await page.evaluate(() => document.querySelector('[role="dialog"]').previousElementSibling.style.touchAction);
    assert.equal(style, '', 'picker-only touch styling must be restored when the picker leaves');
    await gesture(page, -140, 0, false);
    await page.locator('#practice-timer-ui').waitFor({ state: 'hidden' });
    await page.close();
  });
  await t.test("paper rows are one readable line and custom duration has no preset chips", async () => {
    const page = await openPicker("duration");
    await page.getByRole("button", { name: "选择花生计时套卷", exact: true }).click();
    await page.getByRole("button", { name: /选择花生一期/ }).click();
    const first = page.locator('.rr-timer-paper-option').first();
    assert.match((await first.innerText()).replace(/\s+/g, ""), /^第01套·130题·120分钟$/);
    assert.equal(await first.locator('small').count(), 0, "paper metadata belongs in the readable primary line");
    for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
      await page.setViewportSize({ width, height });
      const labels = await page.locator('.rr-timer-paper-copy').evaluateAll(elements => elements.map(element => ({ font: parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height, line: parseFloat(getComputedStyle(element).lineHeight), fits: element.scrollWidth <= element.clientWidth + 1 })));
      assert.ok(labels.length && labels.every(label => label.font >= 16 && label.height <= label.line + 1 && label.fits), `regular-size paper rows must fit one line at ${width}`);
      await page.screenshot({ path: join(evidence, `paper-rows-${width}.png`) });
    }
    await first.click();
    await page.getByRole("tab", { name: "自定义", exact: true }).click();
    const minutes = page.getByRole("spinbutton", { name: "自定义总分钟", exact: true });
    assert.equal(await minutes.inputValue(), "120");
    assert.equal(await page.locator('.rr-timer-recommendations').count(), 0);
    assert.equal(await page.getByRole('button', { name: /(?:整卷|半卷|单项)建议/ }).count(), 0);
    await page.getByRole("button", { name: "增加一分钟", exact: true }).click();
    assert.equal(await minutes.inputValue(), "121");
    await page.getByRole("button", { name: "减少一分钟", exact: true }).click();
    assert.equal(await minutes.inputValue(), "120");
    // Typing must retain focus while each valid digit updates the model; remounting the field would lose the next digit.
    await minutes.fill("");
    await minutes.pressSequentially("45");
    assert.equal(await minutes.inputValue(), "45");
    assert.equal(await minutes.evaluate(element => document.activeElement === element), true);
    for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: join(evidence, `custom-duration-${width}.png`) });
    }
    await page.getByRole("tab", { name: "套卷", exact: true }).click();
    await page.getByRole("button", { name: "更换计时套卷", exact: true }).click();
    await page.getByRole("textbox", { name: "搜索计时套卷", exact: true }).fill("第 01 套");
    const matches = await page.locator('.rr-timer-search-group h3').allTextContents();
    assert.ok(matches.some(text => text.includes("花生") && text.includes("一期")));
    assert.ok(matches.some(text => text.includes("花生") && text.includes("二期")));
    await page.screenshot({ path: join(evidence, 'cross-collection-search.png') });
    await page.close();
  });
  await t.test("scaled gallery question130 supports both swipe directions and preserves answers", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce", hasTouch: true });
    page.setDefaultTimeout(5000);
    await page.goto(base + '/ios-v3/?design=paper-cards-1114-v3', { waitUntil: 'networkidle' });
    const frame = page.frameLocator('#phone');
    await frame.getByRole('button', { name: '粉笔，选择套卷', exact: true }).click();
    await frame.locator('.rr3-paper-cover.new .rr-card-hit').first().click();
    assert.match(await frame.locator('.paper-identity').innerText(), /粉笔.*01套/);
    const scope = await frame.locator('body').evaluate(() => { const params = new URLSearchParams(location.search); return { institution: params.get('institution'), period: params.get('period'), paper: params.get('paper') }; });
    assert.deepEqual(scope, { institution: '粉笔', period: '1', paper: '1' });
    await frame.getByRole('button', { name: '切换单题模式', exact: true }).click();
    const jump = async number => { await frame.getByRole('button', { name: '答题卡', exact: true }).click(); await frame.locator(`.ios-answer-sheet-cell[data-question="${number}"]`).click(); await frame.locator(`.rr-single-answer[data-single-question="${number}"]`).waitFor(); };
    const question = async number => frame.locator(`.rr-single-answer[data-single-question="${number}"]`).waitFor();
    const swipe = async (direction, touch = false) => {
      const card = frame.locator('.rr-single-paper'), box = await card.boundingBox(); assert.ok(box);
      const logicalWidth = await card.evaluate(element => element.clientWidth);
      assert.ok(box.width / logicalWidth < .9, 'this regression must run through the scaled gallery iframe');
      const x = box.x + box.width * (direction === 'left' ? .7 : .3), y = box.y + box.height / 2;
      const distance = direction === 'left' ? -95 : 95;
      if (touch) {
        const session = await page.context().newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x, y }] });
        for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, x: x + distance * i / 12, y }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
      } else {
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + distance, y, { steps: 12 }); await page.mouse.up();
      }
      await page.waitForTimeout(100);
    };
    await jump(130);
    await frame.getByRole('button', { name: '第 130 题，选 D', exact: true }).click();
    await swipe('right'); await question(129);
    await frame.getByRole('button', { name: '第 129 题，选 A', exact: true }).click(); await question(130);
    await swipe('right', true); await question(129);
    assert.equal(await frame.getByRole('button', { name: '第 129 题，选 A', exact: true }).getAttribute('aria-pressed'), 'true');
    await swipe('left', true); await question(130);
    assert.equal(await frame.getByRole('button', { name: '第 130 题，选 D', exact: true }).getAttribute('aria-pressed'), 'true');
    await swipe('left'); await question(130);
    assert.equal(await frame.getByRole('button', { name: '下一题', exact: true }).isDisabled(), true);
    await page.screenshot({ path: join(evidence, 'scaled-fenbi-question130.png') });
    await jump(1); await swipe('right', true); await question(1);
    assert.equal(await frame.getByRole('button', { name: '上一题', exact: true }).isDisabled(), true);
    await frame.getByRole('button', { name: '第 1 题，选 B', exact: true }).click(); await question(2);
    await swipe('right'); await question(1);
    await frame.getByRole('button', { name: '第 1 题，选 B', exact: true }).click(); await question(2);
    await page.screenshot({ path: join(evidence, 'scaled-reselect-auto-next.png') });
    await page.close();
  });
  await writeFile(join(evidence, 'latest-server.log'), logs);
});
