import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

test("real review connects uncertain questions, section jumps and themed per-question reference feedback", { timeout: 120000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-question-feedback-"));
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = reservation.address().port; await new Promise(done => reservation.close(done));
  const output = resolve(`test-results/feedback-reaudit/question-feedback/run-${Date.now()}`); await mkdir(output, { recursive: true });
  const server = spawn(process.execPath, ["scripts/serve.mjs"], { env: { ...process.env, PORT: String(port), ROLLIERANK_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "", browser, page;
  server.stdout.on("data", chunk => { logs += chunk; }); server.stderr.on("data", chunk => { logs += chunk; });
  t.after(async () => { await browser?.close(); server.kill("SIGTERM"); if (server.exitCode === null) await once(server, "exit"); await rm(directory, { recursive: true, force: true }); await writeFile(join(output, "server.log"), logs); });
  await new Promise((done, reject) => { const timer = setTimeout(() => reject(new Error(logs || "Service did not become ready")), 15000); server.stdout.on("data", () => { if (logs.includes("RollieRank is ready")) { clearTimeout(timer); done(); } }); server.once("error", reject); });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" }); page.setDefaultTimeout(10000);
  const errors = [], geometry = [];
  page.on("pageerror", error => errors.push(error.message));
  const capture = async name => {
    for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
      await page.setViewportSize({ width, height });
      // Record a settled view: an exiting sheet can still paint over the already-updated review table.
      if (name === "review-section-jump") await page.locator('.rr-sheet').waitFor({ state: 'hidden' });
      else await page.waitForFunction(() => {
        const sheets = [...document.querySelectorAll('.rr-sheet')];
        const current = sheets.filter(element => !element.hasAttribute('inert'));
        return current.length === 1 && Number(getComputedStyle(current[0]).opacity) === 1
          && sheets.filter(element => element.hasAttribute('inert')).every(element => Number(getComputedStyle(element).opacity) === 0);
      });
      const measured = await page.evaluate(() => {
        const modal = document.querySelector('.rr-sheet:not([inert])');
        const form = document.querySelector('.rr-question-feedback-form');
        const actions = [...(modal?.querySelectorAll('.ios-corrections-sheet-actions button') ?? [])].map(button => button.getBoundingClientRect());
        const footerAligned = !form || (actions.length === 2 && Math.abs(actions[0].top - actions[1].top) <= 1 && actions.every(box => box.height >= 40));
        const footerVisible = !form || actions.every(box => box.top >= 0 && box.bottom <= innerHeight + 1);
        const out = [...(modal?.querySelectorAll('button,fieldset,textarea') ?? [])].filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1); }).length;
        return { width: innerWidth, document: document.documentElement.scrollWidth, out, footerAligned, footerVisible, nativeSelects: form?.querySelectorAll('select').length ?? 0 };
      });
      await page.screenshot({ path: join(output, `${name}-${width}.png`) });
      assert.equal(measured.document, measured.width); assert.equal(measured.out, 0); assert.equal(measured.footerAligned, true, "feedback actions must align in one row"); assert.equal(measured.footerVisible, true, "feedback actions must stay visible on a short phone"); assert.equal(measured.nativeSelects, 0);
      geometry.push({ state: name, ...measured });
    }
    await page.setViewportSize({ width: 390, height: 844 });
  };
  try {
    await page.goto(`http://127.0.0.1:${port}/ios-v3/app.html?page=entry&institution=${encodeURIComponent("粉笔")}&period=1&paper=1&session=question-feedback&design=paper-cards-1114-v3`, { waitUntil: "networkidle" });
    await page.locator('.answer-row').first().waitFor();
    await page.getByRole("button", { name: "存疑第 2 题", exact: true }).click();
    await page.locator('.choice[data-option="A"]').evaluateAll(buttons => buttons.forEach(button => button.click()));
    await page.locator('[data-action="confirm"]').click();
    await page.getByRole("button", { name: "先提交", exact: true }).click();
    await page.locator('.rr3-score-card').waitFor();
    await page.locator('[data-action="details"]').click();
    await page.getByRole("tab", { name: /^待检查 1$/ }).click();
    assert.equal(await page.locator('.detail-answer-row').count(), 1);
    assert.match(await page.locator('.detail-answer-row').getAttribute('aria-label'), /^第2题/);
    await page.getByRole("button", { name: "反馈参考答案", exact: true }).click();
    await page.locator('.rr-feedback-question').waitFor();
    assert.equal(await page.locator('[name="question"]').inputValue(), "2");
    assert.equal(await page.locator('.rr-feedback-mark').innerText(), "存疑");
    assert.doesNotMatch(await page.locator('#sheet-content').innerText(), /v1\.0|答案修订/);
    const cards = page.locator('[data-correction-row]');
    const reference = (await cards.first().locator('.rr-feedback-original span').last().innerText()).trim().slice(-1);
    const answer = reference === "D" ? "B" : "D";
    await cards.first().locator(`[data-suggested-answer][value="${answer}"]`).check();
    await cards.first().locator('[name="evidence"]').fill("按题本第 2 题条件复核，提交这道存疑题的参考答案反馈。");
    await capture("marked-question-feedback");
    await page.setViewportSize({ width: 320, height: 330 });
    await cards.first().locator('[name="evidence"]').focus();
    await page.waitForFunction(() => {
      const field = document.querySelector('.rr-question-feedback-form textarea');
      const action = document.querySelector('.ios-corrections-sheet-actions button[form="correction-feedback-form"]');
      if (!field || !action) return false;
      const text = field.getBoundingClientRect(), submit = action.getBoundingClientRect();
      return text.top >= 0 && text.bottom <= submit.top - 1 && submit.bottom <= innerHeight + 1;
    });
    await page.screenshot({ path: join(output, "feedback-keyboard-320x330.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-correction-action="add-row"]').click();
    await page.locator('.rr-feedback-picker summary').click();
    await page.getByRole("button", { name: "反馈第 130 题", exact: true }).click();
    await cards.nth(1).waitFor();
    assert.equal(await cards.nth(1).locator('[name="question"]').inputValue(), "130");
    const otherReference = (await cards.nth(1).locator('.rr-feedback-original span').last().innerText()).trim().slice(-1);
    await cards.nth(1).locator(`[data-suggested-answer][value="${otherReference === "D" ? "B" : "D"}"]`).check();
    await cards.nth(1).locator('[name="evidence"]').fill("补充核对题本末题，保留与前一道反馈的独立题号。");
    await capture("multiple-question-feedback");
    const submission = page.waitForResponse(response => response.url().includes('/api/corrections/submit') && response.request().method() === 'POST');
    await page.locator('button[form="correction-feedback-form"]').click();
    const response = await submission; assert.equal(response.status(), 200);
    const payload = response.request().postDataJSON(), saved = await response.json();
    assert.deepEqual(payload.changes.map(item => item.question), [2, 130]);
    assert.deepEqual(saved.feedback.items.map(item => item.question), [2, 130]);
    await page.locator('[data-correction-action="close"]').click();
    await page.getByRole("tab", { name: /^全部/ }).click();
    await page.getByRole("button", { name: "选择复盘板块", exact: true }).click();
    await page.getByRole("button", { name: "复盘资料分析", exact: true }).click();
    await page.locator('tbody[aria-label="资料分析"] .detail-answer-row').first().waitFor();
    assert.equal(await page.locator('.detail-type-row').count(), 1);
    await capture("review-section-jump");
    const number = Number((await page.locator('.detail-answer-row').first().getAttribute('aria-label')).match(/^第(\d+)题/)[1]);
    await page.getByRole('button', { name: `第 ${number} 题选项分布`, exact: true }).click();
    await page.locator('.rr-insights').getByRole('button', { name: '反馈参考答案', exact: true }).click();
    await page.locator('.rr-feedback-question').waitFor();
    assert.equal(await page.locator('[name="question"]').inputValue(), String(number));
    await capture("distribution-to-question-feedback");
    assert.deepEqual(errors, []);
    await writeFile(join(output, "results.json"), JSON.stringify({ passed: true, checks: ["marks survive submission into review", "themed per-question radio feedback", "no visible version metadata", "two explicit question feedback payloads persist", "actual section switch", "distribution opens the same question feedback", "320/390/430 geometry"], geometry, errors, feedback: { questions: saved.feedback.items.map(item => item.question) } }, null, 2));
  } catch (error) {
    await page?.screenshot({ path: join(output, "failure.png"), fullPage: true });
    await writeFile(join(output, "failure.json"), JSON.stringify({ error: String(error), geometry, errors }, null, 2));
    throw error;
  }
});
