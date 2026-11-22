import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("the actual iOS gallery iframe exposes the connected job and analysis controls", { timeout: 30000 }, async t => {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { t.skip("Install Playwright to verify the actual iOS entry"); return; }
  const directory = await mkdtemp(join(tmpdir(), "ios-entry-"));
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const process = spawn(globalThis.process.execPath, ["scripts/serve.mjs"], {
    env: { ...globalThis.process.env, PORT: String(port), ROLLIERANK_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = ""; process.stdout.on("data", chunk => { output += chunk; }); process.stderr.on("data", chunk => { output += chunk; });
  let browser;
  t.after(async () => { await browser?.close(); process.kill("SIGTERM"); if (process.exitCode === null) await once(process, "exit"); await rm(directory, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Preview did not start: " + output)), 10000);
    process.stdout.on("data", () => { if (output.includes("RollieRank is ready")) { clearTimeout(timer); resolve(); } });
    process.once("error", error => { clearTimeout(timer); reject(error); });
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  const base = `http://127.0.0.1:${port}`;
  await page.goto(base + "/ios-v3/?design=paper-cards-1114-v3", { waitUntil: "networkidle" });
  await page.locator('.page-picker [data-page="me"]').click();
  const frame = page.frameLocator("#phone");
  await frame.locator('.view[data-page="me"]').waitFor();
  // 真实入口必须使用已接入的紧凑双卡，避免仅验证根应用或静态旧稿。
  await frame.getByRole("button", { name: "选择报考岗位", exact: true }).waitFor();
  assert.equal(await frame.getByText("成长分析", { exact: true }).count(), 1);
  assert.equal(await frame.locator(".rr-practice-tool").count(), 2);
  assert.equal(await frame.getByText("反馈与订正通知", { exact: true }).count(), 0);
  await frame.getByRole("button", { name: "搜索练习记录", exact: true }).click();
  await frame.getByRole("searchbox", { name: "查询练习记录", exact: true }).fill("没有这份卷");
  assert.equal(await frame.locator(".rr6-record-card").count(), 0);
  // Search already has a clear control; an empty card needs no duplicate instruction or reset action.
  assert.equal(await frame.locator(".rr2-profile-empty p,.rr2-profile-empty button").count(), 0);
  await frame.getByRole("button", { name: "收起搜索", exact: true }).click();
  assert.equal(await frame.locator(".rr6-record-card").count(), 0);
  await page.locator('.page-picker [data-page="papers"]').click();
  await frame.locator('.rr3-paper-cover.new .rr-card-hit').first().click();
  await frame.locator('.view[data-page="entry"]').waitFor();
  assert.equal(await frame.locator(".answer-row").count(), 130);
  assert.equal((await frame.locator(".identity #answer-count").innerText()).replace(/\s+/g,""), "0/130");
  await frame.getByRole("button", { name: "第 1 题，选 A", exact: true }).click();
  await frame.locator('[data-action="confirm"]').click();
  await frame.getByRole("button", { name: "留空交卷", exact: true }).click();
  await frame.getByRole("button", { name: "先提交", exact: true }).click();
  await frame.locator(".rr3-score-card").waitFor();
  assert.equal(await frame.locator(".ios-service-notice,.rr-score-verification").count(), 0);
  assert.ok(!(await frame.locator("body").innerText()).includes("旧版估分"));
  // Feature refresh can replace the footer after an earlier comment mount; measure the current complete row atomically.
  const footer = await frame.locator('body').evaluate(() => new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const inspect = () => {
      const row = document.querySelector('#bottom .row-actions');
      const buttons = [...(row?.querySelectorAll('button') ?? [])];
      const bounds = buttons.map(button => button.getBoundingClientRect().toJSON());
      if (buttons.length === 3 && row.querySelector('button.rr-report-comment') && bounds.every(rect => rect.width > 0 && rect.height > 0)) { resolve(bounds); return; }
      if (Date.now() >= deadline) { reject(new Error('The current report footer never mounted all three visible actions')); return; }
      requestAnimationFrame(inspect);
    };
    inspect();
  }));
  assert.equal(footer.length, 3);
  assert.ok(footer.every(rect => Math.abs(rect.top - footer[0].top) <= 1 && Math.abs(rect.height - 48) <= 1));
  // 从榜单退回报告后，报告返回应回首页，不能重新压栈形成往返循环。
  await frame.locator('.rr3-rank-link').click();
  await frame.getByRole('button',{name:'返回估分报告',exact:true}).click();
  await frame.locator('.view[data-page="report"]').waitFor();
  await frame.locator('#top').getByRole('button',{name:'返回',exact:true}).click();
  await frame.locator('.view[data-page="home"]').waitFor();

  // 首页与练习记录之间支持左右滑动切换，效果与底部菜单栏一致；边缘方向和弹层打开时不误切。
  const phoneBox = await page.locator('#phone').boundingBox();
  const swipePhone = async (startX, endX, y) => {
    await page.mouse.move(phoneBox.x + startX, phoneBox.y + y);
    await page.mouse.down();
    await page.mouse.move(phoneBox.x + endX, phoneBox.y + y, { steps: 10 });
    await page.mouse.up();
  };
  await swipePhone(phoneBox.width * 0.2, phoneBox.width * 0.8, phoneBox.height * 0.55);
  await frame.locator('.view[data-page="home"]').waitFor();
  await swipePhone(phoneBox.width * 0.82, phoneBox.width * 0.18, phoneBox.height * 0.55);
  await frame.locator('.view[data-page="me"]').waitFor();
  assert.equal(await frame.locator('.tabbar button[data-root="me"]').getAttribute('aria-current'), 'page');
  await swipePhone(phoneBox.width * 0.82, phoneBox.width * 0.18, phoneBox.height * 0.55);
  await frame.locator('.view[data-page="me"]').waitFor();
  await swipePhone(phoneBox.width * 0.18, phoneBox.width * 0.82, phoneBox.height * 0.55);
  await frame.locator('.view[data-page="home"]').waitFor();
  assert.equal(await frame.locator('.tabbar button[data-root="home"]').getAttribute('aria-current'), 'page');

  // Reproduce the previous browser archive: recover authored offline work, keeping real receipts and exact demo seeds separate.
  await page.locator('.page-picker [data-page="me"]').click();
  await frame.locator('.view[data-page="me"]').waitFor();
  await frame.locator('.rr6-record-card').first().waitFor();
  const currentRecords = await frame.locator('.rr6-record-card').count();
  await frame.locator('body').evaluate(() => {
    const authored = { id: 'legacy-personal-offline-1', institution: '四海', period: 1, paper: 5, complete: true, answers: Array(130).fill('B') };
    const demonstration = { id: 'legacy-四海|1|3-0', institution: '四海', period: 1, paper: 3, complete: false, answers: Array(130).fill('') };
    const key = Object.keys(localStorage).find(name => {
      try { return name.startsWith('rollierank:ios:design:v3') && Array.isArray(JSON.parse(localStorage.getItem(name))?.history); } catch { return false; }
    });
    if (!key) throw new Error('No actual saved practice history exists for the archive migration fixture');
    localStorage.setItem(key + ':preview-archive:v1', JSON.stringify([authored, demonstration]));
  });
  // The gallery may still be loading preview images when the saved records are ready.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await frame.locator('.view[data-components="ready"]').waitFor();
  await page.locator('.page-picker [data-page="me"]').click();
  await frame.locator('.rr6-record-card').nth(currentRecords).waitFor();
  assert.equal(await frame.locator('.rr6-record-card').count(), currentRecords + 1);
  assert.ok((await frame.locator('body').innerText()).replace(/\s+/g, '').includes('05套'));
  assert.ok(!(await frame.locator('body').innerText()).includes('旧版估分'));
  await mkdir('test-results/feedback-reaudit/history', { recursive: true });
  await page.locator('#size').selectOption('390,844');
  await page.locator('#phone').screenshot({ path: 'test-results/feedback-reaudit/history/recovered-authored-record-390.png' });
  await frame.getByRole('button', { name: '搜索练习记录', exact: true }).click();
  await frame.getByRole('searchbox', { name: '查询练习记录', exact: true }).fill('没有这份卷');
  await frame.locator('.rr2-profile-empty h3').waitFor();
  assert.equal(await frame.locator('.rr2-profile-empty p,.rr2-profile-empty button').count(), 0);
  await page.locator('#phone').screenshot({ path: 'test-results/feedback-reaudit/history/empty-result-390.png' });

  assert.equal((await page.request.get(base + "/api/catalog")).status(), 200);
  assert.equal((await page.request.get(base + "/ios-v3/assets/brand/rollierank-logo-transparent.png")).status(), 200);
  assert.equal((await page.request.get(base + "/src/data/papers.js")).status(), 404);
  assert.deepEqual(errors, []);
});
