import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createFixture, guestId } from "./ios-positions-fixtures.mjs";
import { positionId } from "../server/positions.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const ios = join(root, "docs/ui-exploration/ios-v3");
const requireUI = createRequire(join(ios, "ui/package.json"));
const html = (versionId) => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="vendor/beui.css"><link rel="stylesheet" href="modern.css"><link rel="stylesheet" href="refined.css"><link rel="stylesheet" href="editorial.css"><link rel="stylesheet" href="typography.css"><link rel="stylesheet" href="features/positions.css"><link rel="stylesheet" href="features/position-picker.css"><body class="beui-island"><div id="app"><header id="top"><label style="grid-column:1/-1;font-size:12px">岗位模块验收 <select id="scenario"><option value="rank">练习榜</option><option value="me">我的岗位</option><option value="report">真实报告名次</option><option value="practice">提交提醒</option><option value="admin">岗位目录</option></select></label></header><main id="stage"></main></div><div id="sheet-host"></div><p id="test-toast" role="status" style="position:fixed;bottom:4px;font-size:11px"></p><script src="test-beui.js"></script><script type="module">
import{createIOSPositionsFeature}from'./features/positions.js';
const api=async(path,data)=>{const res=await fetch('/api/'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const body=await res.json();if(!res.ok)throw new Error(body.error);return body};
const catalog=(await api('catalog')).versions;const version=catalog.find(v=>v.id===${JSON.stringify(versionId)});const saved=localStorage.getItem('ios-positions-fixture');const state=saved?JSON.parse(saved):{guestId:${JSON.stringify(guestId)},profile:{id:${JSON.stringify(guestId)},name:'验收甲'},attempts:(await api('attempts/sync',{guestId:${JSON.stringify(guestId)}})).attempts,drafts:{}};
let current={page:'rank',id:version.id},dimension='total',sheet={open:false,title:'',html:''};
function closeModal(){sheet={...sheet,open:false};window.RollieUI.mountSheet(document.querySelector('#sheet-host'),{...sheet,onClose:closeModal})}
const ctx={state:()=>state,catalog:()=>[version],version:()=>version,attempt:()=>state.attempts[0],route:()=>current,dimension:()=>dimension,setDimension:id=>{dimension=id},api,persist:()=>localStorage.setItem('ios-positions-fixture',JSON.stringify(state)),render,toast:message=>document.querySelector('#test-toast').textContent=message,openModal(title,body,actions=''){sheet={open:true,title,html:body+actions};window.RollieUI.mountSheet(document.querySelector('#sheet-host'),{...sheet,onClose:closeModal})},closeModal,navigate:path=>{current={page:path.split('/')[0],id:path.split('/')[1]||version.id};render()},submitAttempt:async()=>{if(await feature.beforeSubmit()!==false){closeModal();document.querySelector('#test-toast').textContent='已明确跳过岗位提醒';}},syncAttempts:()=>api('attempts/sync',{guestId:state.guestId})};
const feature=createIOSPositionsFeature(ctx);
function render(){const old=document.querySelector('#stage');window.RollieUI.cleanup(old);const page=current.page;document.querySelector('#scenario').value=page;old.innerHTML='<section class="view" data-page="'+page+'">'+(page==='rank'?feature.rankView():page==='me'?'<section style="padding:22px"><h1 style="font-size:22px;margin-bottom:18px">我的练习记录</h1><div data-feature="positions-profile" class="ios-feature-host"></div></section>':page==='report'?'<section style="padding:22px"><h1>真实报告名次</h1><p data-standing>'+JSON.stringify(feature.standing())+'</p></section>':page==='admin'?'<div style="padding:22px" data-feature="positions-admin" class="ios-feature-host"></div>':'<section style="padding:22px"><h1>提交答卷</h1><button id="test-before-submit" class="primary">提交前核对</button></section>')+'</section>';feature.afterRender();document.querySelector('#test-before-submit')?.addEventListener('click',()=>feature.beforeSubmit());}
document.querySelector('#scenario').addEventListener('change',async e=>{current={page:e.target.value,id:version.id};dimension='total';render();await feature.onRoute()});render();await feature.onRoute();window.testFeatureReady=true;
</script></body></html>`;

test("iOS wrapper renders real beUI paper podium cards and sheet controls inside the iOS iframe", { timeout: 90000 }, async (t) => {
  let chromium, build;
  try { ({ chromium } = await import("playwright")); ({ build } = requireUI("esbuild")); }
  catch { t.skip("Optional iOS browser checks need installed beUI dependencies and Chromium."); return; }
  const compiled = await build({ stdin: { contents: `import {Ranking} from ${JSON.stringify(join(ios, "ui/ranking.tsx"))};import {mountRoot} from ${JSON.stringify(join(ios, "ui/root-registry.tsx"))};export {cleanup} from ${JSON.stringify(join(ios, "ui/root-registry.tsx"))};export {mountSheet} from ${JSON.stringify(join(ios, "ui/sheet-bridge.tsx"))};export {mountPositionPicker,mountPositionSubmitPrompt,mountPositionDetail} from ${JSON.stringify(join(ios, "ui/position-picker.tsx"))};export {publisherName,publisherIcon} from ${JSON.stringify(join(ios, "ui/publishers.ts"))};export function mountRank(el,props){return mountRoot(el,<Ranking {...props}/>);}`, resolveDir: join(ios, "ui"), loader: "tsx" },
    bundle: true, write: false, format: "iife", globalName: "RollieUI", platform: "browser", jsx: "automatic", target: ["chrome120"], tsconfig: join(ios, "ui/tsconfig.json"), define: { "process.env.NODE_ENV": '"production"' } });
  const js = compiled.outputFiles[0].text;
  let versionId;
  const app = await createFixture(t, async (request, response, pathname) => {
    if (pathname === "/ios-v3/app.html") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html(versionId)); return; }
    if (pathname === "/ios-v3/test-beui.js") { response.writeHead(200, { "Content-Type": "text/javascript" }).end(js); return; }
    const relative = pathname.startsWith("/ios-v3/") ? "docs/ui-exploration/ios-v3/" + (pathname.slice(8) || "index.html") : pathname.slice(1);
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep) || relative.includes("..") || /(^|\/)(?:\.git|\.local|node_modules|data)(?:\/|$)/.test(relative)) { response.writeHead(404).end(); return; }
    try {
      const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".woff2") ? "font/woff2" : path.endsWith(".html") ? "text/html" : "application/octet-stream";
      // Read before committing headers so a missing preview asset can return an ordinary 404.
      const body = await readFile(path);
      response.writeHead(200, { "Content-Type": type }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  versionId = app.version.id;
  // Province sources are imported through the real service and must remain separate by year and region.
  const provincial = (region, suffix) => {
    const source = { id: `province-2027-${suffix}`, exam: "shengkao", year: 2027, region, label: `${region}省考岗位表`,
      publisher: "测试来源", sourcePage: "https://example.gov.cn/positions", downloadUrl: "https://example.gov.cn/positions.xlsx",
      retrievedAt: "2026-11-15", fileName: `${suffix}.xlsx`, sha256: "b".repeat(64), count: 1 };
    const position = { sourceId: source.id, exam: source.exam, year: source.year, region, code: "000001", departmentCode: "0001",
      department: `${region}测试部门`, unit: `${region}测试单位`, title: "综合管理岗位", location: region, education: "本科", major: "不限", recruits: 1,
      sourceSheet: "岗位表", sourceRow: 2 };
    return { schemaVersion: 1, source, positions: [{ ...position, id: positionId(position) }] };
  };
  const province = provincial("浙江", "zj");
  await app.receipt();
  for (const [index, answers] of [[1, ["A", "B"]], [2, ["A", null]], [3, [null, null]]]) {
    const id = `guest-ios-rank-other-${index}`, aid = `attempt-ios-rank-other-${index}`;
    await app.receipt(id, aid, answers);
    await app.request("positions/selection", { guestId: id, positionId: app.positions[0].id });
    await app.request("positions/participation", { guestId: id, name: ["", "验收满分", "验收半分", "验收零分"][index], attemptIds: [aid] });
  }
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(12000);
  const evidence = join(root, ".beauye/tasks/ios-positions/evidence");
  await mkdir(evidence, { recursive: true });
  const sourcePaths = ["src/features/positions.js", "docs/ui-exploration/ios-v3/features/positions.js", "docs/ui-exploration/ios-v3/features/positions.css", "docs/ui-exploration/ios-v3/ui/ranking.tsx"];
  const hashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async (p) => [p, createHash("sha256").update(await readFile(join(root, p))).digest("hex")])));
  const sources = await hashes();
  const screenshots = [], geometry = [];
  const capture = async (frame, name) => { const path = join(evidence, `${name}.png`); await frame.locator("body").screenshot({ path }); screenshots.push(path); };
  try {
    await page.goto(app.origin + "/ios-v3/", { waitUntil: "networkidle" });
    const frame = page.frameLocator("#phone");
    await frame.locator(".rr6-ranking").waitFor();
    await frame.locator(".rr6-winner-card").first().waitFor();
    assert.equal(await frame.getByText("未参与排名", { exact: false }).count(), 0);
    assert.equal((await frame.locator(".rr6-ranking").innerText()).includes("4582"), false);
    assert.equal(await frame.getByRole("tab", { name: "自定义判断", exact: true }).count(), 1);
    assert.equal(await frame.getByRole("tab", { name: "政治", exact: true }).count(), 0);
    assert.equal(await frame.getByRole("button", { name: "榜单规则", exact: true }).innerText(), "");
    assert.equal(await frame.getByRole("button", { name: "上榜设置", exact: true }).count(), 0);
    assert.equal((await frame.locator(".rr6-rank-context").innerText()).includes("v1.0"), false);
    assert.equal((await frame.locator(".rr6-rank-context").getAttribute("aria-label")).includes("v1.0"), false);
    assert.equal(await frame.locator(".rr6-rank-place").count(), 1);
    await capture(frame, "automatically-ranked-390");

    await frame.locator("#scenario").selectOption("practice");
    await frame.locator("#test-before-submit").click();
    await frame.getByText("选岗查看同岗排名", { exact: true }).waitFor();
    assert.equal(await frame.locator(".rr-position-prompt p").count(), 0);
    await capture(frame, "before-submit-sheet-390");
    await frame.locator('[data-position-action="skip-submit"]').click();
    await frame.getByText("已明确跳过岗位提醒", { exact: true }).waitFor();
    await frame.locator("#sheet-title").waitFor({ state: "hidden" });
    assert.equal((await app.request(`positions/profile?guestId=${guestId}`)).participation.attemptIds.length, 1);
    await frame.locator("#scenario").selectOption("rank");
    await frame.locator(".rr6-winner-card").first().waitFor();

    // Import after the session has cached a national-only catalog, as another maintainer would.
    await app.request("positions/import", { dataset: province });
    await app.request("positions/import", { dataset: provincial("广东", "gd") });
    // 未选岗默认全国；岗位入口此时应打开真实选岗，而非先选中一个全国回退范围。
    await frame.getByRole("button", { name: "我的岗位", exact: true }).click();
    // The native picker now follows real hierarchy branches instead of a flat search form.
    await frame.getByRole("group", { name: "报考考试", exact: true }).waitFor();
    await frame.getByRole("button", { name: "省考", exact: true }).click();
    await expectCount(frame.locator(".rr-position-option"), 2);
    await frame.locator(`[data-position-choice="${province.source.id}"]`).click();
    await frame.getByRole("group", { name: "选择招录部门", exact: true }).waitFor();
    assert.ok((await frame.locator(".rr-position-options").innerText()).includes("浙江测试部门"));
    assert.ok(!(await frame.locator(".rr-position-options").innerText()).includes("广东"));
    await frame.locator(".rr-position-source").click();
    await frame.getByRole("button", { name: "国考", exact: true }).click();
    assert.equal(await frame.locator(".rr-position-picker select").count(), 0);
    await choosePosition(frame, app, app.positions[0]);
    await frame.locator("#sheet-title").waitFor({ state: "hidden" });
    const selected = (await app.request(`positions/profile?guestId=${guestId}`)).positionId;
    assert.equal(selected, app.positions[0].id);
    assert.ok((await app.request(`positions/profile?guestId=${guestId}`)).participation.attemptIds.includes("attempt-ios-positions-111"));
    await expectCount(frame.locator('.rr6-winner-card[aria-label^="第1名"]'), 2);
    assert.equal(await frame.locator(".rr6-winner-card").count(), 3);
    assert.equal(await frame.locator(".rr6-rank-row").count(), 1);
    assert.equal(await frame.locator(".rr6-self-card").count(), 0, "a visible top-three card must not be repeated as a self card");
    const appearance = await frame.locator(".rr6-winner-card.place-1").evaluate((el) => {
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, radius: style.borderRadius, shadow: style.boxShadow, font: style.fontFamily };
    });
    assert.equal(appearance.radius, "22px");
    assert.notEqual(appearance.shadow, "none");
    assert.equal(appearance.background, "rgb(241, 219, 169)");
    await capture(frame, "real-tied-podium-390");

    await frame.getByRole("tab", { name: "资料分析", exact: true }).click();
    await frame.locator('.rr6-winner-card[aria-label*="100.00%"]:not([hidden])').first().waitFor();
    assert.ok((await frame.locator(".rr6-row-score").innerText()).includes("0.00"));
    await frame.getByRole("tab", { name: "总分", exact: true }).click();
    await frame.locator('.rr6-winner-card[aria-label*="2.00分"]').first().waitFor();
    await frame.getByRole("button", { name: "其他岗位", exact: true }).click();
    await frame.locator("[data-position-leaf]").first().waitFor();
    await choosePosition(frame, app, app.positions[1]);
    await frame.getByText("暂无真实成绩", { exact: true }).waitFor();
    assert.equal((await app.request(`positions/profile?guestId=${guestId}`)).positionId, selected);
    assert.equal(await frame.locator(".rr6-winner-card").count(), 0);
    await capture(frame, "other-job-empty-390");
    await frame.getByRole("button", { name: "全国", exact: true }).click();
    await frame.locator(".rr6-winner-card").first().waitFor();

    await page.route("**/api/positions/leaderboard?**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"排行榜暂不可用"}' }));
    await frame.getByRole("button", { name: "我的岗位", exact: true }).click();
    await frame.getByRole("alert").filter({ hasText: "排行榜暂不可用" }).waitFor();
    assert.equal(await frame.locator(".rr6-winner-card").count(), 0);
    await capture(frame, "failed-board-390");
    await page.unroute("**/api/positions/leaderboard?**");
    await frame.getByRole("button", { name: "重新读取榜单", exact: true }).click();
    await frame.locator(".rr6-winner-card").first().waitFor();

    for (const size of ["390,844", "320,568", "430,932"]) {
      await page.locator("#size").selectOption(size);
      const [width, height] = size.split(",").map(Number);
      const result = await frame.locator("html").evaluate((el) => ({ width: innerWidth, scrollWidth: el.scrollWidth }));
      assert.equal(result.width, width);
      assert.equal(result.scrollWidth, width);
      geometry.push({ width, height, ...result });
      await capture(frame, `rank-${width}`);
    }
    await frame.locator("#scenario").selectOption("report");
    await expectText(frame.locator("[data-standing]"), '"rank":1,"count":4');
    await capture(frame, "report-standing-430");
    await frame.locator("#scenario").selectOption("me");
    await frame.getByRole("button", { name: "更换岗位", exact: true }).waitFor();
    await capture(frame, "profile-430");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal((await app.request(`positions/profile?guestId=${guestId}`)).positionId, selected);
    await frame.locator(".rr6-winner-card").first().waitFor();
    // Management withdrawal remains available through the compatibility API, not candidate UI.
    await app.request("positions/withdraw", { guestId });
    await frame.locator("#scenario").selectOption("rank");
    await expectText(frame.locator(".rr6-self-copy"), "未参与排名");
    assert.equal((await app.request("attempts/sync", { guestId })).attempts.length, 1);
    await frame.locator("#scenario").selectOption("me");
    await frame.getByRole("button", { name: "更换岗位", exact: true }).click();
    await choosePosition(frame, app, province.positions[0]);
    assert.equal((await app.request(`positions/profile?guestId=${guestId}`)).positionId, province.positions[0].id);
    assert.deepEqual(errors, []);
    assert.deepEqual(await hashes(), sources);
    await writeFile(join(evidence, "module-browser.json"), JSON.stringify({ sources, runtime: { chromium: browser.version(), node: process.version },
      environment: "isolated /ios-v3/ iframe with current ranking.tsx temporary build, actual beUI BottomSheet, actual positions API and temporary receipts", screenshots, geometry, appearance, errors,
      checks: ["real rows/self/count", "no static fixture people", "dynamic question types", "tied ranks kept in three paper cards", "exact original card CSS", "native search sheet", "selection persistence", "automatic receipt inclusion", "zero type score", "other job leaves saved selection unchanged", "empty board", "failed request hides rows and retries", "three device sizes", "report standing", "profile mount", "withdraw retains receipt"] }, null, 2));
  } catch (error) {
    const frame = page.frameLocator("#phone");
    await capture(frame, "failure");
    throw error;
  }
});

// The generic two-question fixture cannot catch city/provincial papers losing the same period and paper number.
test("actual second-period city and provincial rank identities retain their variant and truthful comparison scopes", { timeout: 90000 }, async t => {
  const { chromium } = await import("playwright");
  const { build } = requireUI("esbuild");
  const compiled = await build({ stdin: { contents: `import {Ranking} from ${JSON.stringify(join(ios, "ui/ranking.tsx"))};import {mountRoot} from ${JSON.stringify(join(ios, "ui/root-registry.tsx"))};export {cleanup} from ${JSON.stringify(join(ios, "ui/root-registry.tsx"))};export {mountSheet} from ${JSON.stringify(join(ios, "ui/sheet-bridge.tsx"))};export {mountPositionPicker,mountPositionSubmitPrompt,mountPositionDetail} from ${JSON.stringify(join(ios, "ui/position-picker.tsx"))};export {publisherName,publisherIcon} from ${JSON.stringify(join(ios, "ui/publishers.ts"))};export function mountRank(el,props){return mountRoot(el,<Ranking {...props}/>);}`, resolveDir: join(ios, "ui"), loader: "tsx" },
    bundle: true, write: false, format: "iife", globalName: "RollieUI", platform: "browser", jsx: "automatic", target: ["chrome120"], tsconfig: join(ios, "ui/tsconfig.json"), define: { "process.env.NODE_ENV": '"production"' } });
  let versionId = "sihai-2026-h2-p2-city-01:v1";
  const app = await createFixture(t, async (_request, response, pathname) => {
    if (pathname === "/ios-v3/app.html") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html(versionId)); return; }
    if (pathname === "/ios-v3/test-beui.js") { response.writeHead(200, { "Content-Type": "text/javascript" }).end(compiled.outputFiles[0].text); return; }
    const relative = pathname.startsWith("/ios-v3/") ? "docs/ui-exploration/ios-v3/" + (pathname.slice(8) || "index.html") : pathname.slice(1);
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep) || relative.includes("..") || /(^|\/)(?:\.git|\.local|node_modules|data)(?:\/|$)/.test(relative)) { response.writeHead(404).end(); return; }
    try {
      const body = await readFile(file);
      const type = file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".svg") ? "image/svg+xml" : file.endsWith(".woff2") ? "font/woff2" : file.endsWith(".html") ? "text/html" : "application/octet-stream";
      response.writeHead(200, { "Content-Type": type }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  const versions = (await app.request("catalog")).versions;
  const city = versions.find(version => version.id === versionId);
  const provincial = versions.find(version => version.institution === city?.institution && version.period === city.period && version.number === city.number && version.variant.includes("副省"));
  assert.ok(city && provincial, "published city/provincial counterparts must come from the real catalog");
  const evidence = join(root, "test-results/feedback-reaudit/results/ranking-fixed", `run-${Date.now()}-${process.pid}`);
  await mkdir(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  // A tall preview canvas keeps every phone screenshot at its original pixels instead of the gallery's desktop fit scale.
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  const errors = [], requests = [], screenshots = [], geometry = [];
  page.on("pageerror", error => errors.push(error.message));
  // Report standing has its own selected/pageSize=1 read; assert the board's paged request rather than that summary.
  page.on("request", request => { if (request.url().includes("/api/positions/leaderboard?") && new URL(request.url()).searchParams.has("page")) requests.push(request.url()); });
  const frame = page.frameLocator("#phone");
  const capture = async name => { const file = join(evidence, name + ".png"); await page.locator("#phone").screenshot({ path: file }); screenshots.push(file); };
  const returnToRank = async scope => {
    await frame.locator("#scenario").selectOption("report");
    const read = page.waitForResponse(response => {
      if (!response.url().includes("/api/positions/leaderboard?")) return false;
      const query = new URL(response.url()).searchParams;
      return query.has("page") && query.get("scope") === scope;
    });
    await frame.locator("#scenario").selectOption("rank");
    await read;
    await frame.locator('.rr6-rank-place').waitFor();
  };
  const lastQuery = () => new URL(requests.at(-1)).searchParams;
  try {
    await app.request("submit", { guestId, attemptId: "rank-city-real-111", versionId: city.id, answers: Array(city.questionCount).fill("A"), name: "地市考生" });
    await page.goto(app.origin + "/ios-v3/", { waitUntil: "networkidle" });
    await frame.locator(".rr6-winner-card").first().waitFor();
    assert.equal(await frame.getByRole("button", { name: "全国", exact: true }).getAttribute("aria-pressed"), "true");
    assert.equal(await frame.getByRole("button", { name: "我的岗位", exact: true }).getAttribute("aria-pressed"), "false");
    assert.equal(lastQuery().get("scope"), "nationwide");
    assert.match(await frame.locator(".rr6-rank-place").innerText(), /全国考生\s*不限报考岗位/);
    for (const size of ["320,568", "390,844", "430,932"]) {
      await page.locator("#size").selectOption(size);
      const context = await frame.locator(".rr6-rank-context").innerText();
      assert.match(context, /2026/); assert.match(context, /下半年/); assert.match(context, /二期/); assert.match(context, /地市/); assert.match(context, /01套/);
      const bounds = await frame.locator(".rr6-rank-context").evaluate(card => {
        const container = card.getBoundingClientRect();
        const identity = card.querySelector('.rr6-context-identity');
        return { width: innerWidth, document: document.documentElement.scrollWidth, identityLines:identity.getBoundingClientRect().height/parseFloat(getComputedStyle(identity).lineHeight),clipped: [...card.querySelectorAll("span")].filter(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < container.left - 1 || bounds.right > container.right + 1 || element.scrollWidth > element.clientWidth + 1;
        }).map(element => element.className) };
      });
      assert.equal(bounds.document, bounds.width); assert.deepEqual(bounds.clipped, []); assert.ok(bounds.identityLines<=1.05);
      geometry.push(bounds); await capture("city-national-" + bounds.width);
    }
    await frame.getByRole("button", { name: "我的岗位", exact: true }).click();
    await choosePosition(frame, app, app.positions[0]);
    await frame.locator("#sheet-title").waitFor({ state: "hidden" });
    assert.equal(await frame.getByRole("button", { name: "我的岗位", exact: true }).getAttribute("aria-pressed"), "true");
    assert.equal((await app.request(`positions/profile?guestId=${guestId}`)).positionId, app.positions[0].id);
    await frame.getByRole("button", { name: "全国", exact: true }).click(); await returnToRank("nationwide");
    assert.equal(await frame.getByRole("button", { name: "全国", exact: true }).getAttribute("aria-pressed"), "true");
    assert.equal(lastQuery().get("scope"), "nationwide");
    await frame.getByRole("button", { name: "其他岗位", exact: true }).click();
    await choosePosition(frame, app, app.positions[1]);
    await frame.getByText("暂无真实成绩", { exact: true }).waitFor(); await returnToRank("position");
    await frame.getByText("暂无真实成绩", { exact: true }).waitFor();
    assert.equal(await frame.getByRole("button", { name: "其他岗位", exact: true }).getAttribute("aria-pressed"), "true");
    assert.equal(lastQuery().get("positionId"), app.positions[1].id);
    assert.equal((await app.request(`positions/profile?guestId=${guestId}`)).positionId, app.positions[0].id);
    await capture("city-browsed-job-retained-430");
    await frame.getByRole("button", { name: "我的岗位", exact: true }).click();
    await frame.locator(".rr6-winner-card").first().waitFor();
    await app.request("positions/selection", { guestId, positionId: null }); await returnToRank("nationwide");
    await frame.getByRole("button", { name: "全国", exact: true }).waitFor();
    assert.equal(await frame.getByRole("button", { name: "全国", exact: true }).getAttribute("aria-pressed"), "true");
    versionId = provincial.id;
    await app.request("submit", { guestId, attemptId: "rank-provincial-real-111", versionId, answers: Array(provincial.questionCount).fill("A"), name: "副省考生" });
    await page.reload({ waitUntil: "networkidle" });
    await frame.locator(".rr6-winner-card").first().waitFor();
    assert.match(await frame.locator(".rr6-context-variant").innerText(), /副省/);
    assert.match(await frame.locator(".rr6-rank-context").innerText(), /二期/);
    await capture("provincial-national-390");
    // 用户给出的粉笔极致模考130题版也必须保留完整身份，并在三个目标宽度仅占一行。
    const fenbi = versions.find(version=>version.id==='fenbi-2027-guokao-01:v1');assert.ok(fenbi);
    versionId = fenbi.id;
    await app.request('submit',{guestId,attemptId:'rank-fenbi-real-111',versionId,answers:Array(fenbi.questionCount).fill('A'),name:'模考考生'});
    await page.reload({waitUntil:'networkidle'});await frame.locator('.rr6-winner-card').first().waitFor();
    for(const size of ['320,568','390,844','430,932']){
      await page.locator('#size').selectOption(size);
      const identity=frame.locator('.rr6-context-identity');const text=await identity.innerText();
      for(const value of ['粉笔','2027','极致模考6套卷','130题版','01套'])assert.ok(text.includes(value));
      const measure=await identity.evaluate(e=>({lines:e.getBoundingClientRect().height/parseFloat(getComputedStyle(e).lineHeight),width:e.clientWidth,scroll:e.scrollWidth,right:e.getBoundingClientRect().right,cardRight:e.closest('.rr6-rank-context').getBoundingClientRect().right}));
      assert.ok(measure.lines<=1.05&&measure.scroll<=measure.width+1&&measure.right<=measure.cardRight+1,JSON.stringify(measure));
      await capture('fenbi-one-line-'+size.split(',')[0]);
    }
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      const file = join(evidence, `rank-outer-${viewport.width}.png`);
      await page.screenshot({ path: file }); screenshots.push(file);
    }
    assert.deepEqual(errors, []);
    await writeFile(join(evidence, "results.json"), JSON.stringify({ passed: true, versions: [city.id, provincial.id], geometry, requests, screenshots, errors,
      checks: ["exact second-period city and provincial catalog entries", "nationwide default without a selected job", "job control opens real selection", "selected job survives comparisons", "nationwide and browsed scopes survive report navigation", "cleared job returns to nationwide", "visible year/half-year/period/variant/paper", "320/390/430 identity clipping"] }, null, 2));
  } catch (error) {
    await capture("failure");
    await writeFile(join(evidence, "failure.json"), JSON.stringify({ error: String(error.stack || error), errors, requests, screenshots, geometry }, null, 2));
    throw error;
  }
});

// Use the public hierarchy only to identify expected source nodes; selection still uses actual controls.
async function choosePosition(frame, app, target) {
  const path = await app.request("positions/hierarchy?positionId=" + encodeURIComponent(target.id));
  await frame.locator(".rr-position-picker").waitFor();
  await frame.locator('.rr-position-options[aria-busy="false"]').waitFor();
  const context = frame.locator(".rr-position-source");
  if (await context.count()) await context.click();
  await frame.getByRole("group", { name: "报考考试", exact: true }).waitFor();
  await frame.getByRole("button", { name: target.exam === "shengkao" ? "省考" : "国考", exact: true }).click();
  await frame.locator(`[data-position-choice="${target.sourceId}"]`).click();
  for (const crumb of path.breadcrumbs.filter(item => ["category", "department", "unit"].includes(item.level) && !item.automatic)) {
    await frame.locator(`[data-position-choice="${crumb.id}"]`).click();
  }
  await frame.locator(`[data-position-leaf="${target.id}"]`).click();
}

async function expectCount(locator, count) {
  for (let i = 0; i < 60; i++) { if (await locator.count() === count) return; await new Promise((resolve) => setTimeout(resolve, 30)); }
  assert.equal(await locator.count(), count);
}
async function expectText(locator, text) {
  for (let i = 0; i < 60; i++) { if ((await locator.innerText()).includes(text)) return; await new Promise((resolve) => setTimeout(resolve, 30)); }
  assert.ok((await locator.innerText()).includes(text));
}
