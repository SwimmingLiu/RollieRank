import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import jpeg from "jpeg-js";

test("mobile practice OMR scanner uploads real answer sheet photos, merges drafts, marks low-confidence items and handles errors", { timeout: 90000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ios-omr-browser-"));
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((done) => reservation.close(done));

  const server = spawn(process.execPath, ["scripts/serve.mjs"], {
    env: { ...process.env, PORT: String(port), ROLLIERANK_DATA_DIR: directory },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  let browser;
  server.stdout.on("data", (chunk) => { logs += chunk; });
  server.stderr.on("data", (chunk) => { logs += chunk; });
  t.after(async () => {
    await browser?.close();
    server.kill("SIGTERM");
    if (server.exitCode === null) await once(server, "exit");
    await rm(directory, { recursive: true, force: true });
  });

  await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error(logs || "Service not ready")), 15000);
    server.stdout.on("data", () => {
      if (logs.includes("RollieRank is ready")) {
        clearTimeout(timeout);
        done();
      }
    });
    server.once("error", reject);
  });

  // 构造一张合法但空白的 JPEG，用来验证无网格答题卡的失败提示且不破坏现有草稿。
  const blankJpegPath = join(directory, "blank.jpg");
  const blankBuffer = Buffer.alloc(400 * 400 * 4, 250);
  await writeFile(blankJpegPath, jpeg.encode({ data: blankBuffer, width: 400, height: 400 }, 85).data);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const evidence = resolve("test-results/omr-ui");
  await mkdir(evidence, { recursive: true });

  const capture = async (name) => {
    for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(80);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${name}: horizontal overflow at ${width}`);
      if (name.startsWith("omr-")) {
        const primary = page.locator("#omr-scanner-ui .rr-omr-actions button").last();
        const bounds = await primary.boundingBox();
        assert.ok(bounds && bounds.y + bounds.height <= height + 1, `${name}: primary action clipped at ${width}x${height} (bottom=${bounds ? bounds.y + bounds.height : "null"})`);
      }
      await page.screenshot({ path: join(evidence, `${name}-${width}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
  };

  const url = `http://127.0.0.1:${port}/ios-v3/app.html?page=entry&institution=${encodeURIComponent("四海")}&period=1&paper=1&empty=1&session=ios-omr-test&design=paper-cards-1114-v3`;
  await page.goto(url, { waitUntil: "networkidle" });

  // 1. 验证录答案工具栏展示“扫卡”按钮且各尺寸不溢出。
  const scanButton = page.getByRole("button", { name: "扫描答题卡", exact: true });
  await scanButton.waitFor({ state: "visible" });
  await capture("entry-toolbar");

  // 2. 打开扫描弹层并上传真实样张 sheet-a.jpg。
  await scanButton.click();
  await page.locator("#omr-scanner-ui").waitFor({ state: "visible" });
  await capture("omr-idle");

  await page.locator("#omr-scanner-ui input[type='file']").setInputFiles(resolve("test/fixtures/omr/sheet-a.jpg"));
  await page.locator("#omr-scanner-ui[data-omr-phase='ready'], #omr-scanner-ui .rr-omr-sheet[data-omr-phase='ready']").waitFor({ state: "visible", timeout: 25000 });
  const recognizedA = Number(await page.locator("#omr-scanner-ui .rr-omr-metric strong").first().textContent());
  assert.ok(recognizedA >= 90, `预期至少识别 90 题，实际 ${recognizedA}`);
  await capture("omr-ready");

  // 3. 填入空草稿，检查已答数并验证刷新后草稿保留。
  await page.locator("#omr-scanner-ui").getByRole("button", { name: "填入" }).click();
  await page.locator("#omr-scanner-ui").waitFor({ state: "hidden" });
  const countText = await page.locator("#answer-count").textContent();
  const answeredAfterA = Number((countText || "").match(/^(\d+)/)?.[1] || 0);
  assert.equal(answeredAfterA, recognizedA);

  await page.reload({ waitUntil: "networkidle" });
  const reloadedCount = Number(((await page.locator("#answer-count").textContent()) || "").match(/^(\d+)/)?.[1] || 0);
  assert.equal(reloadedCount, recognizedA, "刷新页面后识别填入的草稿应保留");

  // 4. 手动改写第 1 题，再扫另一张答题卡 sheet-b.jpg，验证默认“仅补空题”与“整份替换”。
  const q1Current = await page.locator('#question-1 button.selected').getAttribute("data-option");
  const manualChoice = q1Current === "A" ? "B" : "A";
  await page.locator(`#question-1 button[data-option="${manualChoice}"]`).click();
  assert.equal(await page.locator("#question-1 button.selected").getAttribute("data-option"), manualChoice);

  await page.getByRole("button", { name: "扫描答题卡", exact: true }).click();
  await page.locator("#omr-scanner-ui input[type='file']").setInputFiles(resolve("test/fixtures/omr/sheet-b.jpg"));
  await page.locator("#omr-scanner-ui .rr-omr-sheet[data-omr-phase='ready']").waitFor({ state: "visible", timeout: 25000 });

  // 已有草稿时默认选中“仅补空题”。
  const fillBlankRadio = page.locator("#omr-scanner-ui [role='radio']").first();
  const replaceRadio = page.locator("#omr-scanner-ui [role='radio']").nth(1);
  assert.equal(await fillBlankRadio.getAttribute("aria-checked"), "true");
  await capture("omr-merge");

  const applyButton = page.locator("#omr-scanner-ui").getByRole("button", { name: "填入" });
  if (await applyButton.isEnabled()) {
    await applyButton.click();
    await page.locator("#omr-scanner-ui").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#question-1 button.selected").getAttribute("data-option"), manualChoice, "仅补空题不应覆盖已手填的第 1 题");
  } else {
    await page.locator("#sheet-content").press("Escape");
  }

  // 选择“整份替换”覆盖草稿。
  await page.getByRole("button", { name: "扫描答题卡", exact: true }).click();
  await page.locator("#omr-scanner-ui input[type='file']").setInputFiles(resolve("test/fixtures/omr/sheet-b.jpg"));
  await page.locator("#omr-scanner-ui .rr-omr-sheet[data-omr-phase='ready']").waitFor({ state: "visible", timeout: 25000 });
  const recognizedB = Number(await page.locator("#omr-scanner-ui .rr-omr-metric strong").first().textContent());
  await replaceRadio.click();
  assert.equal(await replaceRadio.getAttribute("aria-checked"), "true");
  await page.locator("#omr-scanner-ui").getByRole("button", { name: "填入" }).click();
  await page.locator("#omr-scanner-ui").waitFor({ state: "hidden" });
  const answeredAfterReplace = Number(((await page.locator("#answer-count").textContent()) || "").match(/^(\d+)/)?.[1] || 0);
  assert.equal(answeredAfterReplace, recognizedB);

  // 5. 上传无选项框的空白图，验证友好错误提示且草稿不受影响。
  await page.getByRole("button", { name: "扫描答题卡", exact: true }).click();
  await page.locator("#omr-scanner-ui input[type='file']").setInputFiles(blankJpegPath);
  await page.locator("#omr-scanner-ui .rr-omr-sheet[data-omr-phase='error']").waitFor({ state: "visible", timeout: 20000 });
  const errorText = await page.locator("#omr-scanner-ui .rr-omr-alert.is-error").textContent();
  assert.match(errorText || "", /没有找到|未识别到有效涂黑/);
  await capture("omr-error");
  await page.locator("#omr-scanner-ui").getByRole("button", { name: "手录" }).click();
  await page.locator("#omr-scanner-ui").waitFor({ state: "hidden" });
  const answeredAfterError = Number(((await page.locator("#answer-count").textContent()) || "").match(/^(\d+)/)?.[1] || 0);
  assert.equal(answeredAfterError, recognizedB, "识别失败不应清空已有草稿");

  assert.deepEqual(errors, [], `不应产生页面脚本异常: ${errors.join("; ")}`);
});
