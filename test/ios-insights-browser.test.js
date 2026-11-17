import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const percentage = (rate) => rate === null ? "—" : `${Number((rate * 100).toFixed(1))}%`;
const query = (path, values) => "positions/" + path + "?" + new URLSearchParams(values);

// Drive the shipped app and public API; other users enter the board through the same production submit transaction.
test("real mobile insights join score-band comparisons, answer distributions and automatically ranked public results", { timeout: 180000 }, async (t) => {
  const evidence = join(root, "test-results/insights-browser", `run-${Date.now()}-${process.pid}`);
  await mkdir(evidence, { recursive: true });
  const directory = await mkdtemp(join(tmpdir(), "rollierank-insights-ui-"));
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((done) => reservation.close(done));
  const reviewToken = "insights-browser-review-" + process.pid;
  const service = spawn(process.execPath, ["scripts/serve.mjs"], { cwd: root,
    env: { ...process.env, PORT: String(port), ROLLIERANK_DATA_DIR: directory, ROLLIERANK_REVIEW_TOKEN: reviewToken }, stdio: ["ignore", "pipe", "pipe"] });
  let serverOutput = "";
  service.stdout.on("data", (chunk) => { serverOutput += chunk; });
  service.stderr.on("data", (chunk) => { serverOutput += chunk; });
  let browser, page;
  const runtimeErrors = [], screenshots = [], geometry = [], checks = [], responses = [], insightRequests = [];
  t.after(async () => {
    await browser?.close();
    if (service.exitCode === null) { service.kill("SIGTERM"); await once(service, "exit"); }
    await writeFile(join(evidence, "server.log"), serverOutput);
    await rm(directory, { recursive: true, force: true });
    assert.ok((await import("node:fs")).existsSync(evidence), "teardown must retain browser evidence");
  });
  await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error("Real preview did not start: " + serverOutput)), 15000);
    const ready = () => { if (serverOutput.includes("RollieRank is ready")) { clearTimeout(timer); done(); } };
    service.stdout.on("data", ready);
    service.once("error", (error) => { clearTimeout(timer); fail(error); });
    service.once("exit", (code) => { clearTimeout(timer); fail(new Error(`Preview exited ${code}: ${serverOutput}`)); });
    ready();
  });
  const base = `http://127.0.0.1:${port}`;
  const api = async (path, data, expected = 200) => {
    const response = await fetch(base + "/api/" + path, data === undefined ? {} : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const body = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(body)}`);
    return body;
  };
  assert.ok((await api("catalog")).versions.length, "doctor: real published catalog is usable");
  assert.ok((await api("positions/hierarchy")).options.length, "doctor: real job source is usable");
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("request", (request) => { if (request.url().includes("/api/positions/insights?")) insightRequests.push(request.url()); });
  const allNationalReads = () => insightRequests.filter((url) => { const q = new URL(url).searchParams; return q.get("scope") === "nationwide" && q.get("band") === "all"; }).length;
  const frame = page.frameLocator("#phone");
  const openView = async (name) => {
    await page.locator(`.page-picker [data-page="${name}"]`).click();
    await frame.locator(`.view[data-page="${name}"]`).waitFor();
  };
  const closePanel = async () => {
    await frame.getByRole("dialog").getByRole("button", { name: "关闭面板", exact: true }).click();
    await frame.getByRole("dialog").waitFor({ state: "hidden" });
  };
  const inspectAndCapture = async (name) => {
    for (const size of ["320,568", "390,844", "430,932"]) {
      await page.locator("#size").selectOption(size);
      await frame.locator("body").evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const metrics = await frame.locator("body").evaluate(() => {
        const panel = document.querySelector(".rr-insights");
        const overlaps = [];
        const scope = panel?.querySelector(".rr-insight-toolbar > div");
        const count = panel?.querySelector(".rr-insight-toolbar > span");
        if (scope && count && scope.getBoundingClientRect().right > count.getBoundingClientRect().left + 1) overlaps.push("scope overlaps sample count");
        for (const row of panel?.querySelectorAll(".rr-insight-options > div:not(.rr-insight-blank)") ?? []) {
          const [label, bar, value] = row.children;
          if (label.getBoundingClientRect().right > bar.getBoundingClientRect().left + 1 || bar.getBoundingClientRect().right > value.getBoundingClientRect().left + 1)
            overlaps.push("answer label overlaps distribution");
        }
        const person = panel?.querySelector(".rr-insight-person");
        if (person) for (const child of person.children) {
          if (child.getBoundingClientRect().right > person.getBoundingClientRect().right + 1)
            overlaps.push("public identity escapes its score card");
        }
        const publicRank = person?.querySelector(":scope > span:last-child");
        if (publicRank) {
          const style = getComputedStyle(publicRank);
          const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5;
          if (publicRank.getBoundingClientRect().height > lineHeight * 1.25)
            overlaps.push("public rank wraps under a valid long nickname");
        }
        // The outer sheet clips overflow, so a document-width check alone can hide a widened card.
        if (panel) for (const child of panel.querySelectorAll(".rr-insight-public > *")) {
          if (child.getBoundingClientRect().right > panel.getBoundingClientRect().right + 1)
            overlaps.push("public score content escapes its panel");
        }
        for (const cell of document.querySelectorAll('[data-insight-row]')) {
          const stat = cell.querySelector('.rr-detail-cohort');
          if (stat && stat.scrollWidth > cell.clientWidth + 1) overlaps.push("question statistic escapes its table cell");
        }
        for (const pair of panel?.querySelectorAll('.rr-insight-value-pair') ?? []) {
          const columns = [...pair.children];
          if (columns[0].getBoundingClientRect().right > columns[1].getBoundingClientRect().left + 1) overlaps.push('personal and mean columns overlap');
          for (const column of columns) {
            const value = column.querySelector('strong');
            if (value.getBoundingClientRect().right > column.getBoundingClientRect().right + 1) overlaps.push(`comparison value escapes its labeled column: ${value.textContent}, column ${column.clientWidth}px, value ${value.getBoundingClientRect().width}px, font ${getComputedStyle(value).fontSize}`);
          }
        }
        return { width: innerWidth, content: document.documentElement.scrollWidth, font: getComputedStyle(document.body).fontFamily,
          background: getComputedStyle(document.querySelector("#app")).backgroundColor, panelWidth: panel?.getBoundingClientRect().width ?? null, emptyNoticeHeight:panel?.querySelector('.rr-insight-empty.is-compact')?.getBoundingClientRect().height??null, overlaps };
      });
      // Retain the actual failing phone before assertions so clipped cards remain reviewable.
      const image = join(evidence, `${name}-${metrics.width}.png`);
      await page.locator("#phone").screenshot({ path: image }); screenshots.push(image);
      assert.equal(metrics.content, metrics.width, `${name}: horizontal overflow`);
      assert.match(metrics.font, /Nunito|FangYuan/);
      assert.equal(metrics.background, "rgb(252, 248, 241)");
      assert.deepEqual(metrics.overlaps, [], `${name}: icon/text overlap`);
      // 空范围提示应是一行状态，不能重新挤出85px空白而把本人值推到屏幕下方。
      if(name==='comparison-empty')assert.ok(metrics.emptyNoticeHeight>0&&metrics.emptyNoticeHeight<=36);
      geometry.push({ name, ...metrics });
      const content = frame.locator("#sheet-content");
      if (await content.count() && await content.evaluate((element) => element.scrollHeight > element.clientHeight + 2)) {
        await content.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
        const lower = join(evidence, `${name}-bottom-${metrics.width}.png`);
        await page.locator("#phone").screenshot({ path: lower }); screenshots.push(lower);
        await content.evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
      }
    }
    await page.locator("#size").selectOption("390,844");
  };
  try {
    await page.goto(base + "/ios-v3/?design=paper-cards-1114-v3&session=insights-browser", { waitUntil: "networkidle" });
    await openView("entry");
    await frame.locator(".answer-row").first().waitFor();
    await frame.locator('.choice[data-option="A"]').evaluateAll((buttons) => buttons.forEach((button) => button.click()));
    const submitted = page.waitForResponse((response) => response.url() === base + "/api/submit" && response.request().method() === "POST");
    await frame.locator('[data-action="confirm"]').click();
    await frame.locator('[data-position-action="skip-submit"]').click();
    const receiptResponse = await submitted;
    assert.equal(receiptResponse.status(), 200);
    const own = await receiptResponse.json();
    const guestId = receiptResponse.request().postDataJSON().guestId;
    await frame.locator('.view[data-page="report"] .rr3-score-card').waitFor();
    assert.equal(own.isSample, false);
    assert.ok(own.report.rows.length > 0);
    checks.push("the current user submits actual button selections through the real mobile API");

    await openView("me");
    await frame.getByRole("button", { name: "选择报考岗位", exact: true }).click();
    let selectedId;
    for (let depth = 0; depth < 8; depth++) {
      const options = frame.locator('.rr-position-options[aria-busy="false"]');
      await options.locator(".rr-position-option:not([disabled])").first().waitFor();
      const leaf = options.locator("[data-position-leaf]").first();
      if (await leaf.count()) { selectedId = await leaf.getAttribute("data-position-leaf"); await leaf.click(); break; }
      const previous = await options.getAttribute("aria-label");
      await options.locator(".rr-position-option").first().click();
      await page.waitForFunction((prior) => {
        const options = document.querySelector("#phone").contentDocument.querySelector(".rr-position-options");
        return options && options.getAttribute("aria-busy") === "false" && options.getAttribute("aria-label") !== prior;
      }, previous);
    }
    assert.ok(selectedId, "real hierarchical selection reaches a specific position");
    await frame.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal((await api("positions/profile?" + new URLSearchParams({ guestId }))).positionId, selectedId);
    const otherPosition = (await api("positions/catalog?pageSize=20")).items.find((item) => item.id !== selectedId);
    assert.ok(otherPosition);
    const correct = own.report.rows.map((row) => row.correctAnswer);
    const chooseScore = (target) => {
      let earned = 0;
      return own.report.rows.map((row) => {
        if (earned / own.report.maxCents < target) { earned += row.maxCents; return row.correctAnswer; }
        return ["A", "B", "C", "D"].find((answer) => answer !== row.correctAnswer);
      });
    };
    const peers = [];
    for (const [index, name, target, sameJob] of [[0, "分布满分", 1, true], [1, "分布八五", .85, true], [2, "分布六二", .62, false], [3, "分布零分", 0, true], [4, "测试昵称一二三四五六七八九十甲乙", .95, false]]) {
      const id = `insights-browser-peer-${index}`, attemptId = `insights-browser-attempt-${index}`;
      const choices = index === 0 ? correct : index === 3 ? correct.map(() => null) : chooseScore(target);
      const attempt = await api("submit", { guestId: id, attemptId, versionId: own.versionId, answers: choices, name });
      await api("positions/selection", { guestId: id, positionId: sameJob ? selectedId : otherPosition.id });
      peers.push({ id, name, attempt });
    }
    await openView("report");
    await frame.locator(".rr3-rank-link").click();
    assert.equal(await frame.getByRole("button", { name: "上榜设置", exact: true }).count(), 0);
    assert.ok((await api("positions/profile?" + new URLSearchParams({ guestId }))).participation.attemptIds.includes(own.id));
    // A second complete low-scoring attempt must not duplicate this person or replace their best total.
    await api("submit", { guestId: peers[1].id, attemptId: "insights-browser-repeat-low", name: peers[1].name, versionId: own.versionId, answers: correct.map(() => null) });
    await frame.getByRole("button", { name: "查看分布满分公开成绩", exact: true }).waitFor();
    const scope = { guestId, versionId: own.versionId };
    const selectedBoard = await api(query("leaderboard", { ...scope, scope: "selected" }));
    assert.equal(selectedBoard.count, 4);
    assert.ok((await frame.locator(".rr6-ranking").innerText()).includes(`超越 ${Number(selectedBoard.self.surpassedPercent.toFixed(1))}%`));
    await frame.getByRole("button", { name: "返回估分报告", exact: true }).click();
    await frame.getByRole("button", { name: "分数段能力对比", exact: true }).click();
    await frame.locator(".rr-insight-comparison").waitFor();
    await frame.getByLabel("6 位样本", { exact: true }).waitFor();
    await frame.getByRole("dialog").getByRole("button", { name: "同岗", exact: true }).click();
    await frame.getByLabel("4 位样本", { exact: true }).waitFor();
    assert.equal(await frame.getByLabel("4 位样本", { exact: true }).count(), 1);
    assert.equal(await frame.getByText("样本较少", { exact: true }).count(), 0);
    await frame.getByRole("dialog").getByRole("button", { name: "全国", exact: true }).click();
    await frame.getByLabel("6 位样本", { exact: true }).waitFor();
    assert.equal(await frame.getByText("样本较少", { exact: true }).count(), 0);
    const nationwide = await api(query("insights", { ...scope, attemptId: own.id, scope: "nationwide", band: "all" }));
    assert.equal(await frame.locator(".rr-insight-comparison > div").count(), nationwide.subjects.length);
    for (const subject of nationwide.subjects) {
      const ownBar = frame.getByRole("progressbar", { name: `${subject.name}本人得分率`, exact: true });
      const meanBar = frame.getByRole("progressbar", { name: `${subject.name}群体平均得分率`, exact: true });
      assert.equal(Number(await ownBar.getAttribute("aria-valuenow")), subject.ownRate * 100);
      assert.equal(Number(await meanBar.getAttribute("aria-valuenow")), subject.averageRate * 100);
      const card = frame.locator('.rr-insight-subject-card').filter({ has: frame.getByText(subject.name, { exact: true }) });
      assert.equal(await card.locator('.rr-insight-value-pair > span').nth(0).locator('small').innerText(), '我的');
      assert.equal(await card.locator('.rr-insight-value-pair > span').nth(0).locator('strong').innerText(), percentage(subject.ownRate));
      assert.equal(await card.locator('.rr-insight-value-pair > span').nth(1).locator('small').innerText(), '全国均值');
      assert.equal(await card.locator('.rr-insight-value-pair > span').nth(1).locator('strong').innerText(), percentage(subject.averageRate));
      assert.equal(await card.locator('.rr-insight-delta').count(), 0);
    }
    await frame.getByRole("tab", { name: /^80以上，3人$/ }).click();
    await frame.getByLabel("3 位样本", { exact: true }).waitFor();
    const highBand = await api(query("insights", { ...scope, attemptId: own.id, scope: "nationwide", band: "80plus" }));
    for (const subject of highBand.subjects)
      assert.equal(Number(await frame.getByRole("progressbar", { name: `${subject.name}群体平均得分率`, exact: true }).getAttribute("aria-valuenow")), subject.averageRate * 100);
    await frame.getByRole("tab", { name: /^全部，6人$/ }).click();
    await frame.getByLabel("6 位样本", { exact: true }).waitFor();
    await inspectAndCapture("comparison");
    const emptyBand = nationwide.bands.find((item) => item.id !== "all" && item.count === 0);
    assert.ok(emptyBand, "public peer submissions leave a score band empty");
    await frame.getByRole("tab", { name: new RegExp(`^${emptyBand.label.replaceAll(" ", "")}，0人$`) }).click();
    await frame.getByText("暂无样本", { exact: true }).waitFor();
    assert.ok((await frame.locator(".rr-insight-comparison").innerText()).includes("—"));
    await inspectAndCapture("comparison-empty");
    await frame.getByRole("tab", { name: /^全部，6人$/ }).click();
    await frame.getByRole("dialog").getByRole("button", { name: "同岗", exact: true }).click();
    await frame.getByLabel("4 位样本", { exact: true }).waitFor();
    await closePanel();
    checks.push("score bands and nationwide/job scope use actual automatically ranked peers, including empty and small samples");

    const nationalBeforeDetails = allNationalReads();
    await frame.locator('[data-action="details"]').click();
    await frame.locator("#detail-tabs").getByRole("tab", { name: /^全部 / }).click();
    await frame.locator('[data-insight-row="1"] .rr-detail-cohort[data-state="ready"]').waitFor();
    const allQuestions = await api(query("insights", { ...scope, attemptId: own.id, scope: "nationwide", band: "all" }));
    const assertQuestionRows = async (data, wrongOnly = false) => {
      const shown = wrongOnly ? data.questions.filter((question) => question.ownAnswer && question.ownAnswer !== question.correctAnswer) : data.questions;
      assert.equal(await frame.locator('[data-insight-row]').count(), shown.length);
      for (const question of shown) {
        const cell = frame.locator(`[data-insight-row="${question.number}"]`);
        await cell.locator('.rr-detail-cohort[data-state="ready"]').waitFor();
        assert.equal(await cell.locator('strong').innerText(), percentage(question.options.find((option) => option.answer === question.correctAnswer).rate));
        const wrong = question.ownAnswer && question.ownAnswer !== question.correctAnswer;
        if (wrong) assert.equal(await cell.locator('small').innerText(), `同错 ${percentage(question.options.find((option) => option.answer === question.ownAnswer).rate)}`);
        else assert.equal(await cell.locator('small').count(), 0);
      }
    };
    await assertQuestionRows(allQuestions);
    await frame.locator("#detail-tabs").getByRole("tab", { name: /^错题 / }).click();
    await assertQuestionRows(allQuestions, true);
    await inspectAndCapture("question-rates-wrong");
    await frame.locator("#detail-tabs").getByRole("tab", { name: /^全部 / }).click();
    await assertQuestionRows(allQuestions);
    assert.equal(allNationalReads() - nationalBeforeDetails, 1, "all review rows and both filters reuse one nationwide full-paper read");
    await inspectAndCapture("question-rates-all");
    await frame.getByRole("button", { name: "第 1 题选项分布", exact: true }).click();
    await frame.locator(".rr-insight-options").waitFor();
    const distribution = await api(query("insights", { ...scope, attemptId: own.id, scope: "nationwide", band: "all" }));
    const first = distribution.questions[0];
    const displayed = await frame.locator(".rr-insight-answers").innerText();
    assert.match(displayed, /我选\s*A/);
    assert.match(displayed, new RegExp(`参考\\s*${first.correctAnswer}`));
    for (const option of first.options) {
      assert.equal(await frame.getByRole("progressbar", { name: `选项 ${option.answer}`, exact: true }).getAttribute("aria-valuetext"), `${option.count}人，${percentage(option.rate)}`);
    }
    assert.equal(first.options.reduce((sum, option) => sum + option.count, first.blank.count), distribution.sampleCount);
    assert.equal(first.blank.count, 1);
    await inspectAndCapture("question-distribution");
    await frame.getByRole("tab", { name: /^80以上，3人$/ }).click();
    await frame.getByLabel("3 位样本", { exact: true }).waitFor();
    const highDistribution = await api(query("insights", { ...scope, attemptId: own.id, scope: "nationwide", band: "80plus" }));
    for (const option of highDistribution.questions[0].options)
      assert.equal(await frame.getByRole("progressbar", { name: `选项 ${option.answer}`, exact: true }).getAttribute("aria-valuetext"), `${option.count}人，${percentage(option.rate)}`);
    await frame.getByRole("tab", { name: /^全部，6人$/ }).click();
    await frame.getByLabel("6 位样本", { exact: true }).waitFor();
    await frame.getByRole("button", { name: "下一题分布", exact: true }).click();
    assert.match(await frame.locator(".rr-insight-question-heading").innerText(), /第 2 题/);
    await frame.getByRole("button", { name: "上一题分布", exact: true }).click();
    assert.match(await frame.locator(".rr-insight-question-heading").innerText(), /第 1 题/);
    await closePanel();
    checks.push("question-number entry shows original personal/reference choices, true A-D counts and a blank-inclusive denominator");

    await openView("rank");
    await frame.getByRole("button", { name: "全国", exact: true }).click();
    await frame.getByRole("button", { name: "查看分布满分公开成绩", exact: true }).waitFor();
    const publicResponse = page.waitForResponse((response) => response.url().includes("/api/positions/public-result?") && response.request().method() === "GET");
    await frame.getByRole("button", { name: "查看分布满分公开成绩", exact: true }).click();
    const publicData = await (await publicResponse).json();
    await frame.locator(".rr-insight-public").waitFor();
    assert.equal(publicData.participantCount, 6);
    assert.equal(publicData.result.totalCents, own.report.maxCents);
    assert.match(await frame.locator(".rr-insight-person").innerText(), /分布满分/);
    assert.equal(await frame.locator(".rr-insight-subjects > div").count(), publicData.result.subjects.length);
    assert.equal(await frame.locator(".rr-insight-options,.rr-insight-answers,.detail-table").count(), 0);
    assert.ok((await frame.locator(".rr-insight-public-meta").innerText()).includes(`超越 ${Number(publicData.result.surpassedPercent.toFixed(1))}%`));
    const serialized = JSON.stringify(publicData);
    for (const secret of [guestId, own.id, peers[0].id, peers[0].attempt.id, '"answers"', '"correctAnswer"', '"attemptId"', '"guestId"'])
      assert.equal(serialized.includes(secret), false, "public result exposed private data: " + secret);
    await inspectAndCapture("public-result");
    responses.push({ own, selectedBoard, nationwide, highBand, distribution, highDistribution, publicData });
    await closePanel();
    await frame.getByRole("button", { name: `查看${peers[4].name}公开成绩`, exact: true }).click();
    await frame.locator(".rr-insight-public").waitFor();
    await inspectAndCapture("public-long-name");
    await api("positions/withdraw", { guestId: peers[0].id });
    await api(query("public-result", { ...scope, scope: "nationwide", publicId: publicData.result.publicId }), undefined, 404);
    await closePanel();
    await frame.getByRole("button", { name: "我的岗位", exact: true }).click();
    await frame.getByRole("button", { name: "全国", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector("#phone").contentDocument.querySelector('[aria-label="查看分布满分公开成绩"]'));
    checks.push("rank cards open only scoped public totals/subjects, show strict-below percentiles and honor withdrawal");
    // A real approved correction refreshes reference answers, nationwide rates and the wrong-answer subline.
    const changedQuestion = own.report.rows.find((row) => row.answer === 'A' && row.correctAnswer !== 'A');
    assert.ok(changedQuestion);
    const feedback = await api('corrections/submit', { guestId, attemptId: own.id, feedbackId: 'insights-ui-correction-feedback', baseRevision: own.answerRevision ?? 0,
      changes: [{ question: changedQuestion.question, suggestedAnswer: 'A', evidence: '隔离测试核对题目答案订正。' }] });
    await api('corrections/review', { reviewToken, reviewId: 'insights-ui-correction-review', feedbackId: feedback.feedback.id,
      questionNumbers: [changedQuestion.question], decision: 'approve', expectedRevision: own.answerRevision ?? 0, reason: '隔离测试确认订正并重算。' });
    await openView('report');
    await frame.locator('[data-action="details"]').click();
    await frame.locator('#detail-tabs').getByRole('tab', { name: /^全部 / }).click();
    const corrected = await api(query('insights', { ...scope, attemptId: own.id, scope: 'nationwide', band: 'all' }));
    assert.equal(corrected.answerRevision, 1);
    await assertQuestionRows(corrected);
    assert.equal(await frame.locator(`[data-insight-row="${changedQuestion.question}"] small`).count(), 0);
    await frame.locator('#detail-tabs').getByRole('tab', { name: /^错题 / }).click();
    await assertQuestionRows(corrected, true);
    assert.equal(await frame.locator(`[data-insight-row="${changedQuestion.question}"]`).count(), 0);
    await inspectAndCapture('question-rates-corrected');
    checks.push('each review row shows nationwide correct and same-wrong percentages, reuses one full-paper response and follows approved corrections');

    // Failed and late reads must neither fabricate zero rates nor paint a different page.
    await openView('report');
    await page.route('**/api/positions/insights?**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '统计暂不可用' }) }));
    await frame.locator('[data-action="details"]').click();
    await frame.locator('#detail-tabs').getByRole('tab', { name: /^全部 / }).click();
    await frame.locator('.rr-detail-cohort[data-state="error"]').first().waitFor();
    assert.ok((await frame.locator('.rr-detail-cohort strong').allTextContents()).every((value) => value === '—'));
    await frame.getByRole('button', { name: '第 1 题选项分布', exact: true }).click();
    await frame.getByRole('alert').waitFor();
    await page.unroute('**/api/positions/insights?**');
    await frame.getByRole('button', { name: '重试', exact: true }).click();
    await frame.locator('.rr-insight-options').waitFor();
    await closePanel();
    await assertQuestionRows(corrected);
    await openView('report');
    let releaseRead, capturedRead, completeRead;
    const heldRead = new Promise((resolveRead) => { releaseRead = resolveRead; });
    const readCaptured = new Promise((resolveCaptured) => { capturedRead = resolveCaptured; });
    const readCompleted = new Promise((resolveComplete) => { completeRead = resolveComplete; });
    await page.route('**/api/positions/insights?**', async (route) => { const response = await route.fetch(); capturedRead(); await heldRead; await route.fulfill({ response }); completeRead(); });
    await frame.locator('[data-action="details"]').click(); await readCaptured;
    await openView('me'); releaseRead(); await readCompleted;
    await page.unroute('**/api/positions/insights?**');
    await frame.locator('.view[data-page="me"]').waitFor();
    assert.equal(await frame.locator('[data-insight-row],.rr-detail-cohort').count(), 0);
    checks.push('error states keep unmeasured rates blank, retry recovers all rows and delayed responses cannot overwrite another route');

    for (const id of [guestId, ...peers.map((peer) => peer.id)]) await api('positions/withdraw', { guestId: id });
    await openView('report'); await frame.locator('[data-action="details"]').click();
    await frame.locator('#detail-tabs').getByRole('tab', { name: /^全部 / }).click();
    const emptyQuestions = await api(query('insights', { ...scope, attemptId: own.id, scope: 'nationwide', band: 'all' }));
    assert.equal(emptyQuestions.sampleCount, 0); await assertQuestionRows(emptyQuestions);
    await inspectAndCapture('question-rates-empty');
    checks.push('an empty nationwide cohort shows unmeasured dashes in every review row');
    responses.push({ allQuestions, corrected, emptyQuestions, insightRequests });
    assert.deepEqual(runtimeErrors, []);
    const result = { passed: true, base, checks, runtimeErrors, geometry, screenshots, responses };
    await writeFile(join(evidence, "results.json"), JSON.stringify(result, null, 2));
    await writeFile(join(root, "test-results/insights-browser/latest.json"), JSON.stringify({ passed: true, evidence }, null, 2));
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, "failure.png"), fullPage: true }).catch(() => {});
    await writeFile(join(evidence, "results.json"), JSON.stringify({ passed: false, error: String(error.stack || error), checks, runtimeErrors, geometry, screenshots }, null, 2));
    await writeFile(join(root, "test-results/insights-browser/latest.json"), JSON.stringify({ passed: false, evidence }, null, 2));
    throw error;
  }
});
