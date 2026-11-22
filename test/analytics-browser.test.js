import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>成长分析模块验收夹具</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/src/features/analytics.css"><body><label style="display:flex;gap:12px;padding:10px 20px;background:#fff;font-size:12px">模块验收场景 <select id="fixture-mode"><option value="overall">整体分析</option><option value="paper">同卷分析</option><option value="report">结果页</option><option value="entry">个人记录入口</option><option value="empty">无记录</option><option value="single">单次同卷记录</option><option value="first">首刷报告</option><option value="sample">示例报告</option></select><button id="fixture-correction" type="button">应用订正样例</button></label><div id="app"></div><script type="module">
import { createAnalyticsFeature } from '/src/features/analytics.js';
import { gradeVersion } from '/src/model.js';
import { DEFAULT_RULES } from '/src/scoring.js';
import { shell } from '/src/ui.js';
const questions = Array.from({length:130}, (_,i) => {const rule=DEFAULT_RULES.find(r=>i+1>=r.start&&i+1<=r.end);return {number:i+1,type:rule.name,typeId:rule.id,cents:rule.cents,correctAnswer:'A'};});
const make = (i, changes={}) => {const paperId=i%2?'paper-bravo':'paper-alpha';const institution=i%2?'机构乙':'机构甲';const answers=questions.map((q,j)=>j%10<(i%5+4)?'A':'B');return {id:'record-'+String(i).padStart(3,'0'),paperId,versionId:paperId+':v1',paperTitle:i%2?'机构乙行测套卷 · 名称较长的同规则试卷':'机构甲行测套卷',institution,project:'2027 国考练习',period:'一期',versionLabel:'1.0',createdAt:new Date(2026,9,1+i,9,0).getTime(),report:gradeVersion({questions},answers),...changes};};
const records=Array.from({length:60},(_,i)=>make(i));
records[11].createdAt=records[10].createdAt;
const otherQuestions=questions.map((q,i)=>({...q,type:q.type==='政治理论'?'综合知识':q.type,cents:q.cents+(i===0?10:i===129?-10:0)}));
records.push(make(2,{id:'different-rule',paperId:'paper-other',paperTitle:'另一评分规则套卷',report:gradeVersion({questions:otherQuestions},Array(130).fill('A'))}));
const state={attempts:records};
const catalog=[{id:'paper-alpha:v1',paperId:'paper-alpha',title:'机构甲行测套卷',status:'published'}];
let mode='overall';let selected=records[40];
const ctx={state:()=>state,catalog:()=>catalog,attempt:()=>selected,route:()=>({page:mode==='overall'||mode==='paper'?'stats':mode,id:mode==='paper'?'paper-alpha:v1':selected?.id}),render};
const feature=createAnalyticsFeature(ctx);
function render(){let content;state.attempts=mode==='empty'?[]:mode==='single'?[records[0]]:records;if(mode==='sample'){selected={...records[0],isSample:true};content='<div data-feature="analytics-comparison"></div>';}else if(mode==='report'||mode==='first'){selected=mode==='first'?records[0]:records[40];content='<div class="page-title"><h1>本次练习报告</h1></div><div data-feature="analytics-comparison"></div>';}else if(mode==='entry')content='<div class="page-title"><h1>我的练习记录</h1></div><div data-feature="analytics-entry"></div>';else content=feature.statsView({state,catalog,...(mode==='paper'||mode==='single'?{version:catalog[0],versionId:catalog[0].id}:{})});document.querySelector('#app').innerHTML=shell(content,{state,active:'me'});feature.afterRender();}
document.querySelector('#fixture-mode').addEventListener('change',e=>{mode=e.target.value;render();});
document.querySelector('#fixture-correction').addEventListener('click',()=>{const previous=records[38];previous.report=gradeVersion({questions},Array(130).fill('A'));render();});
window.addEventListener('hashchange',()=>{if(location.hash==='#/stats'){mode='overall';document.querySelector('#fixture-mode').value=mode;render();}});
render();
</script></body></html>`;

test("analytics modules work in Chromium with real controls, keyboard, pagination and mobile layouts", { timeout: 60000 }, async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { t.skip("Optional browser validation requires Playwright; pure behavior tests remain available."); return; }
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === "/") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(fixture); return; }
      if (!["/styles.css", "/favicon.svg"].includes(pathname) && (!pathname.startsWith("/src/") || pathname.startsWith("/src/data/") || !/\.(css|js)$/.test(pathname))) { response.writeHead(404).end(); return; }
      const file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root)) { response.writeHead(404).end(); return; }
      response.writeHead(200, { "Content-Type": pathname.endsWith(".css") ? "text/css" : pathname.endsWith(".svg") ? "image/svg+xml" : "text/javascript" }).end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const evidence = path.join(root, ".beauye/tasks/analytics/evidence");
  await mkdir(evidence, { recursive: true });
  const inputs = ["src/analytics.js", "src/features/analytics.js", "src/features/analytics.css", "src/model.js", "src/scoring.js", "src/ui.js", "styles.css"];
  const inputHashes = async () => Object.fromEntries(await Promise.all(inputs.map(async (file) => [file, createHash("sha256").update(await readFile(path.join(root, file))).digest("hex")])));
  const implementation = await inputHashes();
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "networkidle" });
  await page.locator("[data-analytics-chart]").waitFor();
  assert.equal(await page.locator(".analytics-filters select").count(), 4);
  assert.equal(await page.locator(".analytics-attempts tbody tr").count(), 13);
  assert.equal(await page.locator('[data-analytics-control="ruleSignature"]').count(), 0);
  assert.equal(await page.locator('[data-analytics-control="examCategory"] option').count(), 2);
  const controls = (name) => page.locator(`[data-analytics-control="${name}"]`);

  // 空卷型保留选择；同类不同权重通过来源与自身指标查看，不再切换隐藏分值组。
  await controls("examCategory").selectOption("guokao-subprovincial");
  assert.ok((await page.locator('[role="status"]').innerText()).includes("没有练习记录"));
  await controls("metric").selectOption("accuracy");
  assert.equal(await controls("examCategory").inputValue(),"guokao-subprovincial");
  await controls("examCategory").selectOption("guokao-city");
  await controls("metric").selectOption("rate");
  await controls("sourceId").selectOption("paper-other");
  await controls("dimension").selectOption({ label: "政治理论" });
  assert.ok((await page.locator(".analytics-attempts").innerText()).includes("此卷未包含该题型"));
  assert.equal(await page.locator(".analytics-point").count(), 0);
  assert.equal(await page.locator(".analytics-rule,.analytics-weight-order").count(),0);
  await page.screenshot({ path: path.join(evidence, "missing-type-1440.png"), fullPage: true });
  await controls("sourceId").selectOption("all");
  await controls("dimension").selectOption("total");
  await controls("metric").selectOption("accuracy");
  assert.ok((await page.locator(".analytics-section-head h2").innerText()).includes("正确率"));
  await controls("metric").selectOption("rate");
  await controls("sourceId").selectOption("paper-bravo");
  assert.equal(await page.locator(".analytics-attempts tbody tr").count(), 6);
  assert.ok(!(await page.locator(".analytics-attempts").innerText()).includes("机构甲"));
  await controls("sourceId").selectOption("all");
  await controls("from").fill("2026-10-01");
  await controls("to").fill("2026-10-04");
  assert.equal(await page.locator(".analytics-attempts tbody tr").count(), 5);
  await controls("from").fill("2026-11-14");
  assert.ok((await page.locator('[role="status"]').innerText()).includes("开始日期不能晚于结束日期"));
  await page.screenshot({ path: path.join(evidence, "invalid-date-1440.png"), fullPage: true });
  await controls("from").fill("");
  await controls("to").fill("");

  await controls("page").selectOption("0");
  assert.ok((await page.locator(".analytics-attempts").innerText()).includes("第 1 次"));
  const tieButton = page.locator('button[data-attempt-id="record-010"]');
  await tieButton.focus();
  await tieButton.press("Space");
  assert.equal(await page.locator("[data-analytics-chart]").getAttribute("data-analytics-selected"), "record-010");
  await page.locator("[data-analytics-chart]").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("[data-analytics-chart]").getAttribute("data-analytics-selected"), "record-011");
  assert.equal(await page.locator("[data-analytics-chart]").evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press("Home");
  assert.equal(await page.locator("[data-analytics-chart]").getAttribute("data-analytics-selected"), "record-000");
  await page.keyboard.press("End");
  assert.equal(await page.locator("[data-analytics-chart]").getAttribute("data-analytics-selected"), "record-022");
  await page.getByRole("button", { name: "晚一页" }).click();
  assert.equal(await controls("page").inputValue(), "1");
  await page.getByRole("button", { name: "早一页" }).click();
  assert.equal(await controls("page").inputValue(), "0");
  assert.equal(await controls("page").evaluate((element) => element === document.activeElement), true);
  assert.equal(await page.locator('.analytics-rule').count(),0,"no first-paper weights may be presented as a universal category rule");
  await page.screenshot({ path: path.join(evidence, "overall-controls.png"), fullPage: true });

  const geometry = [];
  for (const mode of ["overall", "paper", "report", "entry"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator("#fixture-mode").selectOption(mode);
    if (mode === "paper") {
      // 同卷入口的来源可见；切换卷型后可返回全部地市历史，再显式选回入口卷。
      assert.equal(await controls("sourceId").inputValue(),"paper-alpha");
      assert.ok((await controls('examCategory').locator('option[value="guokao-city"]').innerText()).includes('61 次'));
      await controls('examCategory').selectOption('guokao-subprovincial');
      assert.equal(await page.locator('.analytics-attempts').count(),0);
      await controls('examCategory').selectOption('guokao-city');
      assert.equal(await controls('sourceId').inputValue(),'all');
      assert.ok((await page.locator('.analytics-summary').innerText()).includes('61'));
      await controls('sourceId').selectOption('paper-alpha');
      await controls("dimension").selectOption({ label: "言语理解" });
      assert.ok((await page.locator(".analytics-section-head h2").innerText()).includes("言语理解"));
      await controls("dimension").selectOption("total");
      await controls("page").selectOption("0");
    }
    if (mode === "paper" || mode === "report") {
      const chart = page.locator("[data-analytics-chart]");
      await chart.focus();
      await page.keyboard.press("Home");
      assert.equal(await chart.getAttribute("data-analytics-selected"), "record-000");
      await page.keyboard.press("End");
      assert.equal(await chart.getAttribute("data-analytics-selected"), mode === "paper" ? "record-046" : "record-040");
    }
    for (const width of [1440, 1280, 390, 320]) {
      const height = width < 700 ? 844 : width === 1280 ? 800 : 900;
      await page.setViewportSize({ width, height });
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      geometry.push({ mode, height, ...overflow });
      assert.equal(overflow.document, width, `${mode} overflows at ${width}px`);
      await page.screenshot({ path: path.join(evidence, `${mode}-${width}.png`), fullPage: true });
      if (width === 320 && await page.locator(".analytics-attempts").count()) {
        const scrollRegion = page.locator(".analytics-attempts").locator("..");
        await page.locator(".analytics-attempts tbody tr").last().scrollIntoViewIfNeeded();
        await scrollRegion.hover();
        await page.mouse.wheel(1000, 0);
        await page.waitForFunction(() => document.querySelector('.analytics-attempts').parentElement.scrollLeft > 0);
        assert.ok((await page.locator(".analytics-attempts tbody tr").last().innerText()).includes("查看报告"));
        await page.screenshot({ path: path.join(evidence, `${mode}-table-end-320.png`) });
      }
    }
    if (mode === "report") {
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok((await page.locator(".analytics-comparison").innerText()).includes("上一刷 VS 本次"));
      assert.ok(!(await page.locator(".analytics-attempts").innerText()).includes("第 22 次"));
      const before = await page.locator(".analytics-comparison").innerText();
      await page.locator("#fixture-correction").click();
      const after = await page.locator(".analytics-comparison").innerText();
      assert.notEqual(before, after);
      await page.locator(".analytics-type-comparison summary").click();
      assert.equal(await page.locator(".analytics-type-comparison tbody tr").count(), 6);
      await page.screenshot({ path: path.join(evidence, "report-type-comparison-390.png"), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".analytics-entry").click();
  assert.equal(await page.locator(".analytics-page-title h1").innerText(), "成长分析");
  for (const mode of ["empty", "single", "first", "sample"]) {
    await page.locator("#fixture-mode").selectOption(mode);
    const body = await page.locator("main").innerText();
    if (mode === "first") assert.ok(!body.includes("上一刷 VS 本次"), `first: ${body}`);
    else assert.ok(body.includes(mode === "empty" ? "还没有可分析" : mode === "single" ? "目前只有一次记录" : "示例报告不计入"), `${mode}: ${body}`);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({ path: path.join(evidence, `${mode}-${width}.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(await inputHashes(), implementation, "The rendered implementation must remain stable throughout browser validation");
  await writeFile(path.join(evidence, "browser-validation.json"), JSON.stringify({ fixture: "isolated synthetic reports with real feature modules and existing shell", runtime: { node: process.version, chromium: browser.version() }, implementation, viewports: geometry, browserErrors: errors, checks: ["rule isolation", "type missing", "cross-institution sources", "metric selection", "inclusive dates", "invalid date range", "all history pages", "timestamp ties", "native button Space", "chart arrows/Home/End", "focus retention", "rule disclosure", "prior comparison", "updated correction report", "type comparison", "record entry navigation", "empty/single/sample", "table last row and horizontal scroll", "no horizontal page overflow"] }, null, 2));
});
