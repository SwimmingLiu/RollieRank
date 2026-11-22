import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const iosDirectory = path.join(root, "docs/ui-exploration/ios-v3");
const uiDirectory = path.join(iosDirectory, "ui");
const requireUI = createRequire(path.join(uiDirectory, "package.json"));
const { build } = requireUI("esbuild");
const ownedFiles = ["ui/answer-sheet.tsx", "features/answer-sheet.css"];

function command(file, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output) : reject(new Error(output || `${file} exited ${code}`)));
  });
}

const outer = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>答题卡专项</title><style>html,body{margin:0;background:#eee;height:calc(100vh + 120px)}header{height:60px;display:grid;place-items:center;font:14px sans-serif}iframe{display:block;width:min(100%,430px);height:calc(100vh - 24px);margin:0 auto;border:0;background:white}</style><header>原生答题卡专项</header><iframe title="iOS 答题页面" src="/ios-v3/answer-sheet-fixture.html"></iframe></html>`;
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>答题卡</title>
${["vendor/beui.css", "modern.css", "refined.css", "editorial.css", "typography.css", "features/answer-sheet.css"].map((file) => `<link rel="stylesheet" href="/ios-v3/${file}">`).join("")}
<style>.fixture-content{height:1800px;padding:20px}#last-jump{position:fixed;bottom:0;pointer-events:none}#open-sheet{min-height:44px;padding:8px 12px}.fixture-anchor{margin-top:150px}</style>
<body class="beui-island"><div id="app"><header id="top"><h1>录入答案</h1><button id="open-sheet">答题卡</button></header><main id="stage"><section class="view"><div class="fixture-content"><h2 class="fixture-anchor">当前答卷</h2><p>此背景用于核对画板滚动位置。</p></div></section></main></div><div id="sheet-host"></div><output id="last-jump"></output><script src="/ios-v3/answer-sheet-test.js"></script><script>
const api=window.AnswerSheetFixture;
const originalAnswers=Object.freeze(Array.from({length:135},(_,i)=>i%4===0?'':['A','B','C','D'][i%4]));
let answers=originalAnswers,count=135,current=130,open=false,unmount=null;const jumps=[];
function sectionsFor(total){if(total===130)return [{name:'政治理论',start:1,end:20},{name:'常识判断',start:21,end:35},{name:'言语理解',start:36,end:65},{name:'数量关系',start:66,end:75},{name:'图形推理',start:76,end:85},{name:'定义判断',start:86,end:95},{name:'类比推理',start:96,end:100},{name:'逻辑判断',start:101,end:110},{name:'资料分析',start:111,end:130}];if(total===135)return [{name:'政治理论',start:1,end:20},{name:'常识判断',start:21,end:40},{name:'言语理解',start:41,end:70},{name:'数量关系',start:71,end:85},{name:'判断推理',start:86,end:115},{name:'资料分析',start:116,end:135}];return total?[{name:'短卷题型',start:1,end:total}]:[];}
let sections=sectionsFor(count);
function mountContent(content){const host=content.querySelector('#answer-sheet-mount');if(!host)return;unmount=api.mountAnswerSheet(host,{sections,answers,current,onJump(n){jumps.push(n);document.querySelector('#last-jump').textContent=String(n);current=n;mountContent(content);}});}
function close(){unmount?.();unmount=null;open=false;draw();}
function draw(){api.mountSheet(document.querySelector('#sheet-host'),{open,title:'答题卡',html:'<div id="answer-sheet-mount"></div>',onClose:close,onContentReady:mountContent});}
function show(total=135,question=130){count=total;answers=Object.freeze(originalAnswers.slice(0,total));sections=sectionsFor(total);current=question;open=true;draw();}
document.querySelector('#open-sheet').addEventListener('click',()=>show(count,current));
window.sheetHarness={open:show,close,jumps,answers:()=>answers,originalAnswers,
update(question){current=question;mountContent(document.querySelector('#sheet-content'));},
answer(question,choice){answers=Object.freeze(answers.map((value,i)=>i+1===question?choice:value));mountContent(document.querySelector('#sheet-content'));},
staleCleanup(){const old=unmount;current=2;mountContent(document.querySelector('#sheet-content'));old?.();},
};window.ready=true;
</script></body></html>`;

test("native answer sheet handles 130/135 questions, keyboard, local scrolling and 320px geometry", { timeout: 90000 }, async (t) => {
  const { chromium } = await import("playwright");
  const temporary = await mkdtemp(path.join(tmpdir(), "rollierank-answer-sheet-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const implementation = Object.fromEntries(await Promise.all(ownedFiles.map(async (file) => [file, createHash("sha256").update(await readFile(path.join(iosDirectory, file))).digest("hex")])));

  const config = path.join(temporary, "tsconfig.json");
  await writeFile(config, JSON.stringify({ extends: path.join(uiDirectory, "tsconfig.json"), files: [path.join(uiDirectory, "answer-sheet.tsx")], include: [], exclude: [] }));
  await command(process.execPath, [requireUI.resolve("typescript/bin/tsc"), "--project", config, "--noEmit"], uiDirectory);
  const compiled = path.join(temporary, "answer-sheet.js");
  await build({
    stdin: { contents: 'export { mountAnswerSheet } from "./answer-sheet.tsx"; export { mountSheet } from "./sheet-bridge.tsx";', resolveDir: uiDirectory, loader: "tsx" },
    tsconfig: path.join(uiDirectory, "tsconfig.json"), outfile: compiled, bundle: true, platform: "browser", format: "iife", globalName: "AnswerSheetFixture", jsx: "automatic",
    target: ["safari17", "chrome120"], define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const staticFiles = new Map();
  for (const file of ["vendor/beui.css", "modern.css", "refined.css", "editorial.css", "typography.css", "features/answer-sheet.css"])
    staticFiles.set("/ios-v3/" + file, await readFile(path.join(iosDirectory, file)));
  staticFiles.set("/ios-v3/answer-sheet-test.js", await readFile(compiled));
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    try {
      if (pathname === "/ios-v3/") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(outer); return; }
      if (pathname === "/ios-v3/answer-sheet-fixture.html") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html); return; }
      const mime = { ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" }[path.extname(pathname)];
      if (staticFiles.has(pathname)) { response.writeHead(200, { "Content-Type": mime }).end(staticFiles.get(pathname)); return; }
      if (pathname.startsWith("/ios-v3/assets/") && mime) {
        const file = path.resolve(iosDirectory, "." + pathname.slice("/ios-v3".length));
        if (!file.startsWith(iosDirectory + path.sep)) { response.writeHead(404).end(); return; }
        response.writeHead(200, { "Content-Type": mime }).end(await readFile(file)); return;
      }
      response.writeHead(404).end();
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 878 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(7000);
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  const evidence = path.join(root, "test-results/ios-answer-sheet"); await mkdir(evidence, { recursive: true });
  await page.goto(`http://127.0.0.1:${server.address().port}/ios-v3/`, { waitUntil: "networkidle" });
  const frame = page.frameLocator("iframe");
  await frame.locator("body").evaluate(() => document.fonts.ready);
  const list = () => frame.locator(".ios-answer-sheet-list");
  const cell = (number) => frame.locator(`.ios-answer-sheet-cell[data-question="${number}"]`);
  const screenshot = async (name) => {
    await frame.locator(".rr-sheet:not([inert])").evaluate((element) => element.ownerDocument.fonts.ready);
    await page.locator("iframe").screenshot({ path: path.join(evidence, name), animations: "disabled" });
  };
  const positions = async () => ({
    outer: await page.evaluate(() => scrollY),
    inner: await frame.locator("body").evaluate(() => scrollY),
    background: await frame.locator(".view").evaluate((element) => element.scrollTop),
    sheet: await frame.locator("#sheet-content").evaluate((element) => element.scrollTop),
  });
  const inList = async (number) => cell(number).evaluate((element) => {
    const area = element.closest(".ios-answer-sheet-list");
    const heading = element.closest("section").querySelector(".ios-answer-sheet-group-title");
    const rect = element.getBoundingClientRect(), box = area.getBoundingClientRect();
    return rect.top >= box.top + heading.getBoundingClientRect().height - 1 && rect.bottom <= box.bottom + 1;
  });
  const waitInList = async (number) => page.waitForFunction((target) => {
    const element = document.querySelector("iframe").contentDocument.querySelector(`.ios-answer-sheet-cell[data-question="${target}"]`);
    if (!element) return false;
    const area = element.closest(".ios-answer-sheet-list");
    const heading = element.closest("section").querySelector(".ios-answer-sheet-group-title");
    const rect = element.getBoundingClientRect(), box = area.getBoundingClientRect();
    return rect.top >= box.top + heading.getBoundingClientRect().height - 1 && rect.bottom <= box.bottom + 1;
  }, number, { timeout: 3000 });
  await page.evaluate(() => scrollTo(0, 35));
  await frame.locator(".view").evaluate((element) => { element.scrollTop = 110; });
  const outerBefore = await page.evaluate(() => scrollY);
  const backgroundBefore = await frame.locator(".view").evaluate((element) => element.scrollTop);
  await frame.locator("#open-sheet").click();
  await cell(130).waitFor();
  assert.equal(await frame.locator(".ios-answer-sheet-cell").count(), 135);
  assert.equal(await cell(130).getAttribute("aria-current"), "true");
  assert.equal(await inList(130), true, "opening current is visible below its sticky section heading");
  assert.ok(await list().evaluate((element) => element.scrollTop > 0));
  assert.equal(await page.evaluate(() => scrollY), outerBefore);
  assert.equal(await frame.locator(".view").evaluate((element) => element.scrollTop), backgroundBefore);
  assert.equal(await frame.locator("#sheet-content").evaluate((element) => element.scrollTop), 0);
  assert.ok((await frame.locator(".ios-answer-sheet-summary").innerText()).includes("135"));
  assert.equal(await frame.locator(".ios-answer-sheet-group-title small").last().innerText(), "116–135 题");
  assert.equal(await cell(130).evaluate((element) => getComputedStyle(element).borderTopWidth), "2px");
  const blankSurface = await cell(1).evaluate((element) => getComputedStyle(element).backgroundColor);
  const answeredSurface = await cell(2).evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.notEqual(blankSurface, answeredSurface);
  assert.equal(blankSurface, "rgb(255, 255, 255)");
  const shape = await cell(2).evaluate((element) => ({ radius: Number.parseFloat(getComputedStyle(element).borderRadius), width: element.getBoundingClientRect().width }));
  assert.ok(shape.radius >= 8 && shape.radius < shape.width / 2, "question cells are rounded squares rather than circles");
  await screenshot("135-current-130-390.png");

  const frozen = await frame.locator("body").evaluate(() => [...window.sheetHarness.answers()]);
  assert.equal(await frame.locator(".ios-answer-sheet-summary strong").innerText(), String(frozen.filter(Boolean).length));
  const beforePosition = await positions();
  await frame.locator("body").evaluate(() => window.sheetHarness.update(1));
  assert.equal(await inList(1), true);
  await cell(1).focus();
  const jumpCount = await frame.locator("body").evaluate(() => window.sheetHarness.jumps.length);
  await page.keyboard.press("ArrowRight");
  assert.equal(await cell(2).evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press("ArrowDown");
  assert.equal(await cell(7).evaluate((element) => element === document.activeElement), true);
  assert.equal(await frame.locator("body").evaluate(() => window.sheetHarness.jumps.length), jumpCount);
  await page.keyboard.press("End");
  assert.equal(await cell(135).evaluate((element) => element === document.activeElement), true);
  assert.equal(await inList(135), true);
  await page.keyboard.press("Enter");
  assert.equal(await frame.locator("#last-jump").innerText(), "135");
  assert.equal(await cell(135).getAttribute("aria-current"), "true");
  await page.keyboard.press("Home"); await page.keyboard.press("Space");
  assert.equal(await frame.locator("#last-jump").innerText(), "1");
  assert.deepEqual(await frame.locator("body").evaluate(() => [...window.sheetHarness.answers()]), frozen);
  assert.deepEqual(await positions(), beforePosition, "own scroll/focus never moves background or sheet content");
  await frame.locator("body").evaluate(() => window.sheetHarness.update(135));
  await cell(135).click(); assert.equal(await frame.locator("#last-jump").innerText(), "135");
  await frame.locator("body").evaluate(() => window.sheetHarness.staleCleanup());
  assert.equal(await frame.locator(".ios-answer-sheet-cell").count(), 135, "old cleanup cannot remove an updated mount");
  await list().evaluate((element) => {
    const group = element.querySelectorAll(".ios-answer-sheet-group")[2];
    element.scrollTop += group.getBoundingClientRect().top - element.getBoundingClientRect().top + 60;
  });
  const sticky = await frame.locator(".ios-answer-sheet-group-title").nth(2).evaluate((element) => ({ top: element.getBoundingClientRect().top, listTop: element.closest(".ios-answer-sheet-list").getBoundingClientRect().top, text: element.textContent }));
  assert.ok(Math.abs(sticky.top - sticky.listTop) <= 1, "section title stays pinned inside the list");
  assert.ok(sticky.text.includes("言语理解") && sticky.text.includes("41–70"));
  await screenshot("sticky-section-390.png");

  const geometry = [];
  for (const width of [320, 350, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: width > 430 ? 834 : 878 });
    await frame.locator("body").evaluate(() => window.sheetHarness.update(130));
    await waitInList(130);
    const layout = await frame.locator(".ios-answer-sheet-grid").first().evaluate((element) => ({ columns: getComputedStyle(element).gridTemplateColumns.split(" ").length, gap: getComputedStyle(element).gap }));
    const expected = width <= 350 ? 4 : 5;
    assert.equal(layout.columns, expected);
    const sizes = await frame.locator(".ios-answer-sheet-cell").evaluateAll((elements) => elements.map((element) => ({ w: element.getBoundingClientRect().width, h: element.getBoundingClientRect().height })));
    assert.ok(sizes.every((size) => size.w >= 44 && size.h >= 44), `touch target under 44px at ${width}`);
    assert.equal(await frame.locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.equal(await inList(130), true, `current stays visible after resizing to ${width}`);
    await cell(130).focus(); await page.keyboard.press("Home"); await page.keyboard.press("ArrowDown");
    assert.equal(await cell(expected + 1).evaluate((element) => element === document.activeElement), true);
    await page.keyboard.press("End"); assert.equal(await inList(135), true);
    assert.equal(await cell(135).locator(".ios-answer-sheet-number").innerText(), "135");
    assert.equal(await cell(135).locator(".ios-answer-sheet-answer").evaluate((element) => getComputedStyle(element).fontSize), "20px");
    assert.equal(await cell(135).locator(".ios-answer-sheet-number").evaluate((element) => getComputedStyle(element).fontSize), "11px");
    geometry.push({ width, columns: layout.columns, gap: layout.gap, minimumWidth: Math.min(...sizes.map((size) => size.w)), minimumHeight: Math.min(...sizes.map((size) => size.h)) });
    await screenshot(`135-last-${width}.png`);
  }
  await page.setViewportSize({ width: 390, height: 878 });
  await frame.locator("body").evaluate(() => window.sheetHarness.update(20));
  await cell(20).focus(); await page.keyboard.press("ArrowRight");
  assert.equal(await cell(21).evaluate((element) => element === document.activeElement), true);
  const originalCount = await frame.locator(".ios-answer-sheet-summary").innerText();
  await frame.locator("body").evaluate(() => window.sheetHarness.answer(1, "D"));
  assert.equal(await cell(1).getAttribute("data-answer-state"), "answered");
  assert.notEqual(await frame.locator(".ios-answer-sheet-summary").innerText(), originalCount);
  const callsBeforeClose = await frame.locator("body").evaluate(() => window.sheetHarness.jumps.length);
  const answersBeforeClose = await frame.locator("body").evaluate(() => [...window.sheetHarness.answers()]);
  await frame.locator("#sheet-close").click();
  await frame.locator(".rr-sheet").waitFor({ state: "hidden" });
  assert.equal(await frame.locator("body").evaluate(() => window.sheetHarness.jumps.length), callsBeforeClose);
  assert.deepEqual(await frame.locator("body").evaluate(() => [...window.sheetHarness.answers()]), answersBeforeClose);

  for (const count of [130, 6, 4, 0]) {
    // Locator.evaluate receives the element first; the question-count argument is the second parameter.
    await frame.locator("body").evaluate((element, total) => window.sheetHarness.open(total, total || 1), count);
    await frame.locator(".ios-answer-sheet").waitFor().catch(async (error) => {
      const detail = { count, errors, text: await frame.locator("body").innerText(), sheets: await frame.locator(".rr-sheet").evaluateAll((elements) => elements.map((element) => ({ opacity: getComputedStyle(element).opacity, inert: element.inert, html: element.innerHTML.slice(-2000) }))) };
      await writeFile(path.join(evidence, "failure.json"), JSON.stringify(detail, null, 2));
      throw new Error(`Answer-sheet reopen failed for ${count} questions: ${JSON.stringify(detail)}`, { cause: error });
    });
    assert.equal(await frame.locator(".ios-answer-sheet-cell").count(), count);
    if (count) {
      assert.equal(await inList(count), true);
      await cell(count).click(); assert.equal(await frame.locator("#last-jump").innerText(), String(count));
      await screenshot(`${count}-questions-390.png`);
    } else assert.ok((await frame.locator(".ios-answer-sheet-summary").textContent()).includes("0 / 0"));
    await frame.locator("#sheet-close").click(); await frame.locator(".rr-sheet").waitFor({ state: "hidden" });
  }
  assert.deepEqual(errors, []);
  const finalHashes = Object.fromEntries(await Promise.all(ownedFiles.map(async (file) => [file, createHash("sha256").update(await readFile(path.join(iosDirectory, file))).digest("hex")])));
  assert.deepEqual(finalHashes, implementation, "owned source changed during verification");
  await rm(path.join(evidence, "failure.json"), { force: true });
  await writeFile(path.join(evidence, "verification.json"), JSON.stringify({ runtime: { node: process.version, chromium: browser.version() }, surface: "isolated /ios-v3/ iframe; temporary actual React/beUI component bundle, no public vendor written", implementation, scopedTypecheck: "passed", visual: { blankSurface, answeredSurface, cornerRadius: shape.radius }, geometry, browserErrors: errors, checks: ["135 real cells and current 130 visible in own list", "sticky section ranges and local scrolling", "Arrow/Home/End focus without jump; Enter/Space and pointer call onJump", "background/sheet scroll unchanged", "controlled answers never mutated; props update summary", "current coral outline and separate 11px/20px hierarchy", "44px targets at 320/350/390/430/desktop", "130/6/4/empty question sets", "host close leaves answers and callbacks unchanged", "mount cleanup remains safe across updates"] }, null, 2));
});
