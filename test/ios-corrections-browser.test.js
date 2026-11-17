import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve, join, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createApi } from "../server/api.mjs";
import { createCorrectionsService } from "../server/corrections.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.ROLLIERANK_BROWSER_PYTHON ?? "/tmp/rollierank-corrections-browser-env/bin/python";
const available = spawnSync(python, ["-c", "import playwright"], { encoding: "utf8" }).status === 0;

// The refinement host keeps corrections in details and uses the actual beUI sheet in an iframe.
const frameHtml = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>iOS 纠错专项</title>
${["vendor/beui.css", "modern.css", "refined.css", "editorial.css", "typography.css", "features/corrections.css"].map((path) => `<link rel="stylesheet" href="/ios-v3/${path}">`).join("")}
<style>#fixture-stage{padding:20px;display:grid;gap:20px}.fixture-nav{display:flex;gap:12px;padding:16px;border-bottom:1px solid #eee}.fixture-nav button{min-height:44px}#fixture-toast{position:fixed;bottom:8px;background:#27272a;color:white;padding:10px;z-index:999;pointer-events:none}/* An unused fixture toast must not appear as a blank block in the screenshot. */#fixture-toast:empty{display:none}</style>
<body class="beui-island"><nav class="fixture-nav"><button data-host-page="report">结果</button><button data-host-page="me">我的记录</button></nav><main id="fixture-stage"></main><div id="sheet-host"></div><div id="fixture-toast" role="status"></div><script src="/ios-v3/vendor/beui.js"></script><script type="module">
import { createIOSCorrectionsFeature } from '/ios-v3/features/corrections.js';
import { esc, score } from '/src/ui.js';
const boot=await (await fetch('/fixture/bootstrap'+location.search)).json();
let state=boot.state, catalog=boot.catalog, route={page:'report'}, selected=state.attempts[0];
if(new URLSearchParams(location.search).has('sample'))selected={...selected,id:'sample-ios-record',isSample:true};
let sheetState={open:false,title:'',html:''};
function closeSheet(){const old=document.querySelector('#sheet-content');if(old)window.RollieUI.cleanup(old);sheetState={...sheetState,open:false};drawSheet();}
function drawSheet(){window.RollieUI.mountSheet(document.querySelector('#sheet-host'),{...sheetState,onClose:closeSheet,onContentReady(el){window.RollieUI.mountButtons(el);const target=el.querySelector('[autofocus]')??el.querySelector('input,select,textarea,button');target?.focus({preventScroll:true});}});}
const ctx={state:()=>state,catalog:()=>catalog,attempt:()=>selected,version:()=>catalog.find(v=>v.id===selected.versionId),route:()=>route,
async api(path,data){const response=await fetch('/api/'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;},
persist(){},render,toast(message){document.querySelector('#fixture-toast').textContent=message;},
openModal(title,body,actions=''){const old=document.querySelector('#sheet-content');if(old)window.RollieUI.cleanup(old);sheetState={open:true,title,html:body+actions};drawSheet();},closeModal:closeSheet,
navigate(path){location.hash='#/'+path;},async syncAttempts(){const result=await ctx.api('attempts/sync',{guestId:state.guestId});state.attempts=result.attempts;if(!selected.isSample)selected=state.attempts.find(a=>a.id===selected.id)??selected;},async refreshCatalog(){catalog=(await ctx.api('catalog')).versions;}};
const feature=createIOSCorrectionsFeature(ctx);
function render(){
 const stage=document.querySelector('#fixture-stage');window.RollieUI.cleanup(stage);
 const scoreLine='<p>正式成绩 <strong data-score>'+score(selected.report.totalCents)+'</strong> 分</p>';
 if(route.page==='admin')stage.innerHTML=feature.adminView();
 else if(route.page==='me')stage.innerHTML='<h1>我的记录</h1><div class="ios-feature-host" data-feature="corrections-user"></div>';
 else if(route.page==='details')stage.innerHTML='<div class="fixture-nav"><h1>逐题对照</h1><button data-host-correction="" '+(selected.isSample?'disabled':'')+'>答案纠错</button></div>'+scoreLine+selected.report.rows.map(row=>'<p>第 '+row.question+' 题 · 我的答案 '+(row.answer??'未答')+' · 参考 '+row.correctAnswer+' <button data-host-correction="'+row.question+'" '+(selected.isSample?'disabled':'')+'>纠错第 '+row.question+' 题</button></p>').join('');
 else stage.innerHTML='<h1>'+esc(selected.paperTitle)+'</h1>'+scoreLine+'<button data-host-page="details">逐题对照</button><div class="ios-feature-host" data-feature="corrections-status">'+feature.reportStatusView()+'</div><div class="ios-feature-host" data-feature="corrections-report"></div>';
 feature.afterRender();window.RollieUI.mountButtons(stage);
}
async function navigate(){route={page:location.hash.replace(/^#\\/?/,'').split('/')[0]||'report'};if(['me','report','details'].includes(route.page))await ctx.syncAttempts();render();await feature.onRoute();}
document.addEventListener('click',event=>{const button=event.target.closest('[data-host-page]');if(button)ctx.navigate(button.dataset.hostPage);const correction=event.target.closest('[data-host-correction]');if(correction&&!correction.disabled)feature.openFeedback(correction.dataset.hostCorrection===''?undefined:Number(correction.dataset.hostCorrection));});window.addEventListener('hashchange',navigate);window.fixture={rerender(){feature.afterRender();feature.afterRender();},state:()=>state,openFeedback:feature.openFeedback,reportStatusView:feature.reportStatusView};await navigate();window.ready=true;
</script></body></html>`;

const browserScript = String.raw`
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
base=os.environ['IOS_CORRECTIONS_BASE']
output=Path(os.environ['IOS_CORRECTIONS_OUTPUT']);output.mkdir(parents=True,exist_ok=True)
credential=os.environ['IOS_CORRECTIONS_CREDENTIAL']
checks=[];errors=[]
def capture(page,name):
    for child in page.frames[1:]:
        sheet=child.locator('.rr-sheet:not([inert])')
        if sheet.count() and sheet.is_visible():expect(sheet).to_have_css('opacity','1')
        exiting=child.locator('.rr-sheet[inert]')
        if exiting.count():expect(exiting).not_to_be_visible()
    page.screenshot(path=str(output/(name+'.png')),full_page=True,animations='disabled')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(base+'ios-v3/',wait_until='networkidle')
    frame=page.frames[1];frame.wait_for_function('window.ready')
    expect(frame.locator('[data-score]')).to_have_text('0.85')
    expect(frame.locator('.correction-card')).to_have_count(0)
    expect(frame.locator('[data-correction-action=feedback]')).to_have_count(0)
    expect(frame.locator('[data-feature=corrections-report]')).to_be_empty()
    assert frame.evaluate('window.fixture.reportStatusView()')==''
    capture(page,'refined-report-before')
    other=context.new_page();other.goto(base+'ios-v3/?guest=other',wait_until='networkidle');other_frame=other.frames[1];other_frame.wait_for_function('window.ready')
    frame.locator('[data-host-page=me]').click()
    expect(frame.locator('.correction-card')).to_have_count(0)
    expect(frame.locator('[data-ios-correction-action=admin]')).to_be_visible()
    capture(page,'refined-empty-notifications')
    frame.locator('[data-host-page=report]').click();frame.locator('[data-host-page=details]').click()
    before=page.request.post(base+'api/attempts/sync',data={'guestId':'ios-candidate-0001'}).json()
    assert frame.evaluate('window.fixture.openFeedback(99)') is False
    frame.locator('[data-host-correction="2"]').click()
    expect(frame.locator('[name=question]')).to_have_value('2')
    frame.locator('[data-suggested-answer][value=A]').check();frame.locator('[name=evidence]').fill('取消的草稿不得改变答卷。')
    frame.get_by_role('button',name='取消',exact=True).click();expect(frame.locator('.rr-sheet')).not_to_be_visible()
    assert page.request.post(base+'api/attempts/sync',data={'guestId':'ios-candidate-0001'}).json()==before
    assert page.request.get(base+'api/corrections/summary').json()['pendingCount']==0
    frame.locator('[data-host-correction=""]').click();expect(frame.locator('.rr-feedback-question-grid')).to_be_visible()
    page.keyboard.press('Escape');expect(frame.locator('.rr-sheet')).not_to_be_visible()
    assert page.request.get(base+'api/corrections/summary').json()['pendingCount']==0
    frame.locator('[data-host-correction=""]').click()
    frame.get_by_role('button',name='反馈第 3 题',exact=True).click();frame.locator('[data-suggested-answer][value=D]').check();frame.locator('[name=evidence]').fill('点遮罩取消也不发送这份反馈。')
    frame.locator('button[aria-label="关闭面板"]:not(#sheet-close)').click(position={'x':5,'y':5})
    expect(frame.locator('.rr-sheet')).not_to_be_visible()
    assert page.request.post(base+'api/attempts/sync',data={'guestId':'ios-candidate-0001'}).json()==before
    assert page.request.get(base+'api/corrections/summary').json()['pendingCount']==0
    frame.locator('[data-host-correction="1"]').click()
    expect(frame.locator('.rr-sheet')).to_be_visible()
    expect(frame.locator('dialog')).to_have_count(0)
    expect(frame.locator('.rr-sheet .correction-dialog')).to_have_count(0)
    expect(frame.locator('[name=question]')).to_have_value('1')
    expect(frame.locator('[data-correction-row]')).to_have_count(1)
    frame.locator('[data-suggested-answer][value=B]').check();frame.locator('[name=evidence]').fill('原题第 1 页的条件对应 B。')
    frame.locator('[data-correction-action=add-row]').click()
    frame.get_by_role('button',name='反馈第 2 题',exact=True).click()
    rows=frame.locator('[data-correction-row]');expect(rows).to_have_count(2)
    rows.nth(1).locator('[data-suggested-answer][value=A]').check();rows.nth(1).locator('[name=evidence]').fill('解析第 2 页结论为 A。')
    frame.locator('[data-correction-action=add-row]').click();frame.get_by_role('button',name='反馈第 3 题',exact=True).click();frame.locator('[data-correction-action=remove-row]').nth(2).click();expect(rows).to_have_count(2)
    for width in [390,320,430]:
        page.set_viewport_size({'width':width,'height':844})
        assert frame.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
        capture(page,'ios-feedback-'+str(width))
    page.set_viewport_size({'width':390,'height':844})
    page.route('**/api/corrections/submit',lambda route:route.abort())
    frame.locator('button[form=correction-feedback-form]').click()
    expect(frame.locator('[data-correction-modal-error]')).not_to_be_empty()
    expect(rows.nth(1).locator('[name=evidence]')).to_have_value('解析第 2 页结论为 A。')
    page.unroute('**/api/corrections/submit')
    page.request.post(base+'fixture/gate/start')
    frame.locator('button[form=correction-feedback-form]').click()
    expect(frame.locator('button[form=correction-feedback-form]')).to_be_disabled()
    expect(frame.locator('[data-correction-action=add-row]')).to_be_disabled()
    expect(frame.locator('#sheet-close')).to_be_disabled()
    assert frame.evaluate('window.fixture.openFeedback(4)') is False
    expect(frame.locator('[data-correction-row]').nth(0).locator('[name=question]')).to_have_value('1')
    expect(frame.locator('[data-correction-row]')).to_have_count(2)
    page.request.post(base+'fixture/gate/release')
    expect(frame.locator('#sheet-title')).to_have_text('反馈处理详情')
    frame.locator('[data-correction-action=preview]').click();expect(frame.locator('[data-correction-preview]')).to_contain_text('2.15')
    expect(frame.locator('[data-score]')).to_have_text('0.85')
    capture(page,'ios-preview')
    for _ in range(8):
        page.keyboard.press('Tab')
        assert frame.evaluate('document.activeElement===document.body || document.querySelector(".rr-sheet").contains(document.activeElement)'), 'background received keyboard focus'
    page.keyboard.press('Escape');expect(frame.locator('.rr-sheet')).not_to_be_visible()
    frame.locator('[data-host-page=report]').click()
    assert frame.evaluate('window.fixture.reportStatusView()')==''
    expect(frame.locator('.ios-corrections-report-status')).to_have_count(0)
    expect(frame.locator('.correction-card')).to_have_count(0)
    checks.append('details-only correction entry, valid question prefill, fresh cancelled drafts and no effects on feedback or receipts')
    checks.append('actual beUI BottomSheet: multi-question input, real button form attributes, busy controls, failure retention and hypothetical preview')
    frame.locator('[data-host-page=me]').click()
    expect(frame.locator('[data-ios-correction-action=admin]')).to_be_visible()
    frame.evaluate('window.fixture.rerender()');expect(frame.locator('[data-ios-correction-action=admin]')).to_have_count(1)
    frame.locator('[data-ios-correction-action=admin]').click();expect(frame.locator('[data-feature=corrections-admin]')).to_be_visible();expect(frame.locator('[data-feature=positions-admin]')).to_have_count(1)
    expect(frame.locator('.correction-count')).to_contain_text('1 待审核')
    frame.locator('[data-correction-action=unlock]').click()
    frame.locator('[name=reviewToken]').fill('invalid-ios-maintainer');frame.locator('button[form=correction-credential-form]').click()
    expect(frame.locator('[data-correction-modal-error]')).to_contain_text('凭证无效')
    expect(frame.locator('[name=reviewToken]')).to_have_value('')
    frame.locator('[name=reviewToken]').fill(credential);frame.locator('button[form=correction-credential-form]').click()
    expect(frame.locator('[data-correction-action=review]')).to_be_visible()
    assert credential not in frame.content()
    assert credential not in frame.evaluate('JSON.stringify({...localStorage,...sessionStorage})')
    checks.append('discoverable maintainer navigation, duplicate-safe mounts and server-verified credentials in BottomSheet')
    frame.locator('[data-correction-action=review]').click()
    frame.locator('[name=questionNumbers][value="2"]').uncheck()
    frame.locator('[name=reason]').fill('原题核对后，第 1 题参考答案订正为 B。')
    frame.locator('button[form=correction-review-form]').click()
    expect(frame.locator('#sheet-title')).to_have_text('确认订正并重算')
    expect(frame.locator('#sheet-content')).to_contain_text('2 份答卷')
    capture(page,'ios-review-confirm')
    frame.locator('[data-correction-action=back-review]').click();expect(frame.locator('[name=reason]')).to_have_value('原题核对后，第 1 题参考答案订正为 B。')
    frame.locator('button[form=correction-review-form]').click();frame.locator('[data-correction-action=confirm-review]').click()
    expect(frame.locator('.rr-sheet')).not_to_be_visible()
    frame.locator('[data-correction-action=review]').click();frame.locator('[name=decision]').select_option('reject');frame.locator('[name=reason]').fill('第 2 题原答案 B 成立。');frame.locator('button[form=correction-review-form]').click();frame.locator('[data-correction-action=confirm-review]').click()
    expect(frame.locator('.correction-count')).to_contain_text('0 待审核')
    checks.append('BottomSheet approval confirmation, return-to-review input retention, partial approve/reject and atomic regrading')
    frame.locator('[data-host-page=me]').click();frame.locator('[data-correction-action=notice]').click();expect(frame.locator('#sheet-content')).to_contain_text('0.85 → 1.35 分')
    capture(page,'ios-notification');frame.locator('[data-correction-action=open-report]').click();expect(frame.locator('[data-score]')).to_have_text('1.35')
    expect(frame.locator('.correction-card')).to_have_count(0)
    expect(frame.locator('.ios-corrections-report-status')).to_have_count(1)
    expect(frame.locator('.ios-corrections-report-status')).to_contain_text('答案已订正')
    expect(frame.locator('.ios-corrections-report-status')).not_to_contain_text('修订')
    expect(frame.locator('.ios-corrections-report-status')).not_to_contain_text('v1.0')
    capture(page,'refined-report-after')
    frame.locator('.ios-corrections-report-status').click();expect(frame.locator('#sheet-content')).to_contain_text('原题核对后，第 1 题参考答案订正为 B。')
    frame.locator('[data-correction-action=close]').click();expect(frame.locator('.rr-sheet')).not_to_be_visible()
    checks.append('report status stays empty for pending feedback and becomes a lightweight working detail link only after real correction')
    other_frame.locator('[data-host-page=me]').click();other_frame.locator('[data-correction-action=notice]').click();expect(other_frame.locator('#sheet-content')).to_contain_text('3.35 → 2.85 分')
    checks.append('feedback owner and another affected candidate see current correction reason and personal score changes')
    for width,height in [(320,780),(390,844),(430,932),(1280,800)]:
        page.set_viewport_size({'width':width,'height':height})
        for route in ['report','me','admin']:
            frame.evaluate('(route)=>{location.hash="#/"+route}',route)
            if route=='report':expect(frame.locator('.ios-corrections-report-status')).to_be_visible()
            else:expect(frame.locator('[data-feature=corrections-'+('user' if route=='me' else 'admin')+']')).to_be_visible()
            assert frame.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
            capture(page,'ios-'+route+'-'+str(width))
    sample=context.new_page();sample.goto(base+'ios-v3/?sample=1',wait_until='networkidle');sample_frame=sample.frames[1];sample_frame.wait_for_function('window.ready')
    assert sample_frame.evaluate('window.fixture.reportStatusView()')==''
    sample_frame.locator('[data-host-page=details]').click()
    expect(sample_frame.locator('[data-host-correction=""]')).to_be_disabled()
    assert sample_frame.evaluate('window.fixture.openFeedback(1)') is False
    expect(sample_frame.locator('#sheet-content')).to_have_count(0)
    page.reload(wait_until='networkidle');frame=page.frames[1];frame.wait_for_function('window.ready')
    frame.locator('[data-host-page=me]').click();frame.locator('[data-ios-correction-action=admin]').click()
    expect(frame.locator('[data-correction-action=unlock]')).to_be_visible();expect(frame.locator('[data-correction-action=review]')).to_have_count(0)
    assert not errors,errors
    checks.append('responsive iframe layouts, sample guard, session credential clearing and no browser runtime errors')
    browser.close()
result={'passed':len(checks),'checks':checks,'browser_errors':errors,'surface':'/ios-v3/ iframe, actual vendor beUI BottomSheet, real createApi with isolated catalog'}
(output/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
`;

test("iOS correction refinement keeps entry in details and shows report status only after real revision", { skip: available ? false : "Set ROLLIERANK_BROWSER_PYTHON to a Python environment with Playwright.", timeout: 120000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-ios-corrections-"));
  const output = resolve(root, "test-results/ios-corrections-refinement");
  await mkdir(output, { recursive: true });
  const configured = process.env.ROLLIERANK_REVIEW_TOKEN;
  const credential = randomUUID();
  process.env.ROLLIERANK_REVIEW_TOKEN = credential;
  const api = await createApi({ dataDirectory: pathToFileURL(directory + "/"), featureFactories: [createCorrectionsService] });
  const boot = {};
  let gate = null, releaseGate;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const send = (status, body) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(body)); };
    try {
      if (url.pathname === "/fixture/gate/start") { gate = new Promise((resolveGate) => { releaseGate = resolveGate; }); send(200, {}); return; }
      if (url.pathname === "/fixture/gate/release") { releaseGate?.(); gate = null; send(200, {}); return; }
      if (url.pathname === "/api/corrections/submit" && gate) await gate;
      if (await api(request, response, url.pathname)) return;
      if (url.pathname === "/fixture/bootstrap") { send(200, boot[url.searchParams.get("guest") === "other" ? "other" : "owner"]); return; }
      if (url.pathname === "/ios-v3/") { response.setHeader("Content-Type", "text/html"); response.end(`<!doctype html><html><style>html,body{margin:0;background:#f1f1f2;height:100%}iframe{display:block;width:min(100%,430px);height:100svh;margin:auto;border:0;background:white}</style><iframe id="ios-frame" title="iOS 应用" src="/ios-v3/corrections-fixture.html${url.search}"></iframe></html>`); return; }
      if (url.pathname === "/ios-v3/corrections-fixture.html") { response.setHeader("Content-Type", "text/html"); response.end(frameHtml); return; }
      const relative = url.pathname.startsWith("/ios-v3/") ? "docs/ui-exploration/ios-v3/" + url.pathname.slice("/ios-v3/".length) : "." + url.pathname;
      const path = resolve(root, relative);
      const mime = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" }[extname(path)];
      if (!path.startsWith(root + "/") || !mime) { response.writeHead(404); response.end(); return; }
      response.setHeader("Content-Type", mime); response.end(await readFile(path));
    } catch (error) { send(error.statusCode ?? 500, { error: error.message }); }
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { releaseGate?.(); server.closeAllConnections(); await new Promise((done) => server.close(done));
    await rm(directory, { recursive: true, force: true });
    if (configured === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = configured; });
  const base = `http://127.0.0.1:${server.address().port}/`;
  const call = async (path, data) => {
    const response = await fetch(base + "api/" + path, data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {});
    const result = await response.json(); assert.equal(response.status, 200, result.error); return result;
  };
  const version = await call("admin/import", { title: "iOS 四题核对卷", institution: "专项", project: "iOS", period: "一期", variant: "通用",
    csv: "题号,题型,答案,分值\n1,言语,A,0.5\n2,言语,B,0.8\n3,判断,C,0.85\n4,判断,D,1.2" });
  await call("admin/status", { versionId: version.id, status: "published" });
  for (const [key, guestId, attemptId, answers] of [["owner", "ios-candidate-0001", "ios-attempt-000001", ["B", "A", "C", null]], ["other", "ios-candidate-0002", "ios-attempt-000002", ["A", "B", "C", "D"]]]) {
    const attempt = await call("submit", { versionId: version.id, guestId, attemptId, answers });
    boot[key] = { state: { guestId, profile: null, attempts: [attempt], drafts: {} }, catalog: (await call("catalog")).versions };
  }
  const child = spawn(python, ["-c", browserScript], { env: { ...process.env, IOS_CORRECTIONS_BASE: base, IOS_CORRECTIONS_OUTPUT: output, IOS_CORRECTIONS_CREDENTIAL: credential } });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
  const [code] = await once(child, "exit"); assert.equal(code, 0, stderr || stdout);
  const result = JSON.parse(stdout.trim()); assert.equal(result.passed, 7); assert.deepEqual(result.browser_errors, []);
  console.log(stdout.trim());
});
