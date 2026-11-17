import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createApi } from "../server/api.mjs";
import { positionId } from "../server/positions.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const guestId = "guest-positions-browser-1234";
const fixture = (versionId) => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>岗位模块验收</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/src/features/positions.css"><body><label style="display:flex;gap:12px;padding:10px;background:#fff">模块验收环境<select id="fixture-mode"><option value="me">我的记录</option><option value="practice">提交答卷</option><option value="rank">练习榜</option><option value="admin">目录管理</option></select></label><div id="app"></div><dialog id="modal"></dialog><div id="toast" role="status"></div><script type="module">
import {createPositionsFeature} from '/src/features/positions.js';
import {shell,esc} from '/src/ui.js';
const api=async(path,data)=>{const response=await fetch('/api/'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;};
const versions=(await api('catalog')).versions;const chosen=versions.find(v=>v.id===${JSON.stringify(versionId)});
const saved=localStorage.getItem('positions-fixture');const state=saved?JSON.parse(saved):{guestId:${JSON.stringify(guestId)},profile:{name:'验收甲',id:${JSON.stringify(guestId)}},attempts:[],drafts:{}};
let route={page:'me',id:chosen.id},dimension='total';
const modal=document.querySelector('#modal');let opener;
const ctx={state:()=>state,route:()=>route,catalog:()=>[chosen],version:()=>chosen,dimension:()=>dimension,api,persist:()=>localStorage.setItem('positions-fixture',JSON.stringify(state)),toast:m=>document.querySelector('#toast').textContent=m,openModal(title,body,actions='',className=''){opener=document.activeElement;modal.className=className;modal.innerHTML='<div class="modal-heading"><h2>'+title+'</h2><button type="button" data-fixture-action="close" aria-label="关闭弹窗">×</button></div><div class="modal-body">'+body+'</div>'+(actions?'<div class="modal-actions">'+actions+'</div>':'');if(!modal.open)modal.showModal();},closeModal:()=>modal.close(),navigate:p=>{route={page:p,id:chosen.id};render();},render,submitAttempt,syncAttempts:()=>api('attempts/sync',{guestId:state.guestId})};
const feature=createPositionsFeature(ctx);
function render(){const mode=route.page;document.querySelector('#fixture-mode').value=mode;const content=mode==='me'?'<div class="page-title"><h1>我的练习记录</h1></div><div data-feature="positions-profile"></div>':mode==='rank'?feature.rankView({catalog:[chosen],state,version:chosen,dimension}):mode==='admin'?'<div class="page-title"><h1>目录管理</h1></div><div data-feature="positions-admin"></div>':'<div class="page-title"><h1>真实服务端提交</h1></div><section class="card" style="padding:24px"><p>四道题的验收答卷，前两题作答，后两题留空。</p><button type="button" class="button primary" data-fixture-action="submit-dialog">提交答卷</button></section>';document.querySelector('#app').innerHTML=shell(content,{state,active:mode==='rank'?'rank':'me'});feature.afterRender();}
async function submitAttempt(){if(await feature.beforeSubmit()===false)return;const receipt=await api('submit',{guestId:state.guestId,attemptId:'attempt-positions-browser-001',versionId:chosen.id,answers:['A','B',null,null],name:state.profile?.name||'卷友'});if(!state.attempts.some(a=>a.id===receipt.id))state.attempts.push(receipt);ctx.persist();modal.close();await feature.afterSubmit(receipt);route={page:'rank',id:chosen.id};render();await feature.onRoute();}
document.querySelector('#fixture-mode').addEventListener('change',async e=>{route={page:e.target.value,id:chosen.id};dimension='total';render();await feature.onRoute();});
document.addEventListener('click',async e=>{const el=e.target.closest('[data-fixture-action],[data-action="dimension"]');if(!el)return;if(el.dataset.action==='dimension'){dimension=el.dataset.value;render();return;}if(el.dataset.fixtureAction==='close')modal.close();if(el.dataset.fixtureAction==='submit-dialog')ctx.openModal('确认提交','<p>提交真实答卷并由本地服务核分。</p>','<button type="button" class="button primary" id="submit-attempt" data-fixture-action="submit">确认提交</button>');if(el.dataset.fixtureAction==='submit')await submitAttempt();});
modal.addEventListener('close',()=>{if(opener?.isConnected)opener.focus();});
render();await feature.onRoute();
</script></body></html>`;

test("positions work in Chromium with real persisted API scores, paging, explicit skip, automatic ranking, failures and mobile layouts", { timeout: 90000 }, async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { t.skip("Optional browser checks require Playwright and Chromium."); return; }
  const directory = await mkdtemp(join(tmpdir(), "rollierank-positions-browser-"));
  const dataDirectory = pathToFileURL(directory + "/");
  let api = await createApi({ dataDirectory });
  let versionId;
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (await api(request, response, pathname)) return;
    if (pathname === "/") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(fixture(versionId)); return; }
    if (!["/styles.css", "/favicon.svg"].includes(pathname) && (!pathname.startsWith("/src/") || pathname.startsWith("/src/data/") || !/\.(css|js)$/.test(pathname))) { response.writeHead(404).end(); return; }
    try {
      const path = resolve(root, "." + pathname);
      if (!path.startsWith(root + sep)) { response.writeHead(404).end(); return; }
      response.writeHead(200, { "Content-Type": pathname.endsWith(".css") ? "text/css" : pathname.endsWith(".svg") ? "image/svg+xml" : "text/javascript" }).end(await readFile(path));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, data) => {
    const response = await fetch(`${base}/api/${path}`, data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {});
    assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`);
    return response.json();
  };
  const paper = await request("admin/import", { title: "岗位模块四题验收卷", institution: "验收", project: "验收", period: "一期", variant: "通用",
    csv: "题号,题型,答案,分值\n1,判断,A,1\n2,判断,B,1\n3,资料,C,1\n4,资料,D,1" });
  versionId = paper.id;
  await request("admin/status", { versionId, status: "published" });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const evidence = join(root, ".beauye/tasks/positions/evidence");
  await mkdir(evidence, { recursive: true });
  const inputPaths = ["src/features/positions.js", "src/features/positions.css", "server/positions.mjs", "scripts/import-positions.py", "src/ui.js", "styles.css"];
  const hashes = async () => Object.fromEntries(await Promise.all(inputPaths.map(async (name) => [name, createHash("sha256").update(await readFile(join(root, name))).digest("hex")])));
  const implementation = await hashes();
  const check = (name) => page.locator(`[data-position-action="${name}"]`);
  const currentProfile = () => request(`positions/profile?guestId=${guestId}`);
  const geometry = [];
  const screenshots = [];
  let excelBrowser = false;
  const capture = async (name) => {
    const path = join(evidence, `${name}.png`);
    await page.screenshot({ path, fullPage: true });
    screenshots.push(path);
  };
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await check("choose").waitFor();
    assert.ok((await page.locator(".positions-profile").innerText()).includes("尚未选岗"));

    // The first real receipt is saved only after the user explicitly skips the job reminder.
    await page.locator("#fixture-mode").selectOption("practice");
    await page.locator('[data-fixture-action="submit-dialog"]').click();
    await page.locator("#submit-attempt").click();
    await check("skip-submit").waitFor();
    assert.equal((await request("attempts/sync", { guestId })).attempts.length, 0);
    for (const [width, height] of [[1440, 900], [1280, 800], [390, 844], [320, 844]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      await capture(`before-first-submit-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await check("skip-submit").click();
    await page.waitForSelector(".positions-board-row");
    assert.equal((await request("attempts/sync", { guestId })).attempts.length, 1);
    assert.equal((await currentProfile()).positionId, null);

    await check("choose").first().click();
    await page.waitForSelector(".positions-picker-row");
    assert.equal(await page.locator(".positions-picker-row").count(), 20);
    const firstCode = await page.locator(".positions-picker-row").first().innerText();
    await check("picker-next").click();
    await page.waitForFunction(() => document.querySelector('dialog .positions-pagination')?.textContent.includes('第 2 /'));
    assert.notEqual(await page.locator(".positions-picker-row").first().innerText(), firstCode);
    await check("picker-prev").click();
    await page.waitForFunction(() => document.querySelector('dialog .positions-pagination')?.textContent.includes('第 1 /'));
    await page.locator("#positions-search").fill("绝不存在的岗位检索词");
    await page.locator("#positions-search").press("Enter");
    await page.getByText("没有匹配的岗位，请调整搜索条件。", { exact: true }).waitFor();
    await capture("search-empty-1440");
    await page.locator("#positions-search").fill("002000");
    await page.locator("#positions-search").press("Enter");
    await page.waitForSelector(".positions-picker-row");
    await page.route("**/api/positions/selection", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "选岗服务暂不可用" }) }));
    await check("pick-position").first().click();
    await page.getByRole("alert").filter({ hasText: "选岗服务暂不可用" }).waitFor();
    await capture("selection-failure-1440");
    assert.equal(await page.locator("#positions-search").inputValue(), "002000");
    assert.equal((await currentProfile()).positionId, null);
    await page.unroute("**/api/positions/selection");
    await check("pick-position").first().click();
    await page.waitForFunction(() => !document.querySelector('dialog').open);
    const chosen = (await currentProfile()).positionId;
    assert.ok(chosen);
    await page.reload({ waitUntil: "networkidle" });
    assert.ok((await page.locator(".positions-profile").innerText()).includes("中央办公厅"));
    assert.equal((await currentProfile()).positionId, chosen);

    await page.locator("#fixture-mode").selectOption("rank");
    await page.waitForSelector(".positions-board-row");
    assert.equal(await check("participation").count(), 0);
    assert.equal(await page.getByRole("button", { name: "上榜设置", exact: true }).count(), 0);
    assert.ok((await page.locator(".positions-board-row").innerText()).includes("验收甲"));
    assert.equal((await currentProfile()).participation.attemptIds.length, 1);
    await check("rules").click();
    assert.equal(await page.locator(".positions-rules p").count(), 3);
    await page.getByRole("button", { name: "知道了", exact: true }).click();

    await check("browse").click();
    await page.waitForSelector(".positions-picker-row");
    await check("pick-position").nth(1).click();
    await page.waitForFunction(() => !document.querySelector('dialog').open);
    await page.waitForSelector(".positions-empty h3");
    assert.equal((await currentProfile()).positionId, chosen);
    await capture("other-job-empty-1440");
    await check("scope-nationwide").click();
    await page.waitForSelector(".positions-board-row");
    await page.locator('[data-action="dimension"]').filter({ hasText: "资料" }).click();
    await page.waitForFunction(() => document.querySelector('.positions-board-row strong')?.textContent.includes('0%'));
    await page.locator('[data-action="dimension"]').filter({ hasText: "总分榜" }).click();
    await page.waitForFunction(() => document.querySelector('.positions-board-row strong')?.textContent.includes('2'));

    await page.route("**/api/positions/leaderboard?**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"榜单服务暂不可用"}' }));
    await check("scope-selected").click();
    await check("retry-board").waitFor();
    await capture("server-failure-1440");
    await page.unroute("**/api/positions/leaderboard?**");
    await check("retry-board").click();
    await page.waitForSelector(".positions-board-row");

    for (const mode of ["me", "rank", "admin"]) {
      await page.locator("#fixture-mode").selectOption(mode);
      await page.waitForLoadState("networkidle");
      for (const [width, height] of [[1440, 900], [1280, 800], [390, 844], [320, 844]]) {
        await page.setViewportSize({ width, height });
        const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
        geometry.push({ mode, ...overflow });
        assert.equal(overflow.scrollWidth, width, `${mode} overflows ${width}px`);
        await capture(`${mode}-${width}`);
      }
    }
    await page.locator("#fixture-mode").selectOption("me");
    await check("choose").click();
    await page.waitForSelector(".positions-picker-row");
    for (const [width, height] of [[1440, 900], [1280, 800], [390, 844], [320, 844]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.equal(await page.locator(".positions-pagination").evaluate((el) => el.getBoundingClientRect().bottom <= el.closest("dialog").getBoundingClientRect().bottom), true);
      await capture(`picker-${width}`);
    }
    assert.equal(await page.locator("#positions-search").evaluate((el) => document.activeElement === el), true);
    await page.locator("#positions-search").fill("税务");
    await page.locator("#positions-search").press("Enter");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator("#positions-search").evaluate((el) => document.activeElement === el), true);
    await page.locator(".positions-picker-row").last().scrollIntoViewIfNeeded();
    await capture("picker-last-row-320");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    await page.keyboard.press("Escape");
    // Chromium's native search field consumes the first Escape to clear a nonempty query.
    if (await page.locator("dialog").evaluate((el) => el.open)) await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector('dialog').open);
    assert.equal(await check("choose").evaluate((el) => document.activeElement === el), true);

    await page.locator("#fixture-mode").selectOption("admin");
    await page.locator(".positions-import-details summary").click();
    for (const [width, height] of [[1440, 900], [1280, 800], [390, 844], [320, 844]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      await capture(`import-form-${width}`);
    }
    const p = { exam: "shengkao", year: 2028, region: "江苏", code: "000007", departmentCode: "001", department: "验收部门", unit: "", title: "浏览器导入验收岗位", location: "江苏", education: "本科", major: "不限", recruits: 1, sourceId: "browser-import-2028", sourceSheet: "岗位表", sourceRow: 2 };
    p.id = positionId(p);
    const dataset = { schemaVersion: 1, source: { id: p.sourceId, label: "浏览器验收省考目录", year: 2028, exam: "shengkao", region: "江苏", publisher: "用户提供文件", sourceType: "user-file", sourcePage: "", downloadUrl: "", retrievedAt: "2026-11-14", sha256: "a".repeat(64), fileName: "browser-test.xlsx", count: 1 }, positions: [p] };
    await page.locator("[data-position-file]").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("invalid JSON") });
    await page.locator("[data-position-import-submit]").click();
    await page.getByRole("status").filter({ hasText: "岗位目录 JSON 格式无效" }).waitFor();
    assert.equal(await page.locator("[data-position-file]").evaluate((el) => el.files[0].name), "bad.json");
    await page.setViewportSize({ width: 390, height: 844 });
    await capture("import-failure-390");
    await page.setViewportSize({ width: 320, height: 844 });
    await capture("import-failure-320");
    await page.locator("[data-position-file]").setInputFiles({ name: "province.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(dataset)) });
    await page.locator("[data-position-import-submit]").click();
    await page.getByText("浏览器验收省考目录", { exact: true }).waitFor();
    const imported = await request("positions/catalog?year=2028&exam=shengkao&region=江苏");
    assert.equal(imported.total, 1);
    assert.equal(imported.items[0].code, "000007");
    await capture("import-success-320");
    api = await createApi({ dataDirectory });
    assert.equal((await currentProfile()).positionId, chosen);
    assert.equal((await request("positions/catalog?year=2028")).total, 1);

    if (process.env.POSITIONS_PYTHON) {
      const xlsx = join(directory, "browser-import.xlsx");
      execFileSync(process.env.POSITIONS_PYTHON, ["-c", "import openpyxl,sys; b=openpyxl.Workbook(); s=b.active; s.append(['岗位代码','招录单位','岗位名称']); s.append(['000008','Excel验收部门','Excel上传验收岗位']); b.save(sys.argv[1])", xlsx], { stdio: "pipe" });
      await page.locator(".positions-import-details summary").click();
      await page.locator("[data-position-file]").setInputFiles(xlsx);
      await page.locator('[data-position-field="exam"]').selectOption("shengkao");
      await page.locator('[data-position-field="year"]').fill("2029");
      await page.locator('[data-position-field="region"]').fill("浙江");
      await page.locator('[data-position-field="label"]').fill("浏览器验收 Excel 省考目录");
      await page.locator('[data-position-field="retrievedAt"]').fill("2026-11-14");
      await page.locator("[data-position-import-submit]").click();
      await page.getByText("浏览器验收 Excel 省考目录", { exact: true }).waitFor();
      const excel = await request("positions/catalog?year=2029&region=浙江");
      assert.equal(excel.total, 1);
      assert.equal(excel.items[0].code, "000008");
      await capture("excel-import-success-320");
      excelBrowser = true;
    }

    await page.locator("#fixture-mode").selectOption("rank");
    await page.waitForSelector(".positions-board-row");
    await request("positions/withdraw", { guestId });
    await page.locator("#fixture-mode").selectOption("me");
    await page.locator("#fixture-mode").selectOption("rank");
    await page.waitForSelector(".positions-empty h3");
    assert.equal((await currentProfile()).participation.attemptIds.length, 0);
    assert.equal((await request("attempts/sync", { guestId })).attempts.length, 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(await hashes(), implementation, "Feature implementation changed during validation; rerun for current evidence.");
    await writeFile(join(evidence, "browser-validation.json"), JSON.stringify({ fixture: "isolated module shell, real createApi, official catalog, real graded receipts in temporary catalog.json", runtime: { node: process.version, chromium: browser.version() }, implementation, geometry, screenshots, excelBrowser, browserErrors: errors,
      checks: ["first-submission explicit skip", "formal submission automatically ranks", "official directory search", "paging", "empty search", "failed selection preserves input", "selection retry", "selection reload", "atomic receipt inclusion", "browse never changes selection", "zero type score", "nationwide/selected scopes", "board failure/retry", "desktop/mobile geometry", "last catalog row", "search keyboard focus", "Escape/focus return", "source-carrying JSON upload", "service restart persistence", "withdraw retains private receipt"] }, null, 2));
  } catch (error) { await capture("browser-failure"); throw error; }
});
