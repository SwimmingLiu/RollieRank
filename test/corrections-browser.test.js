import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createCorrectionsService } from "../server/corrections.mjs";
import { gradeVersion, publicVersion } from "../src/model.js";

// 独立挂载三个模块区域；不改公共入口，也不使用日常 catalog.json。
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>答案反馈验收</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/src/features/corrections.css"><body><div id="app"></div><dialog id="modal" aria-labelledby="modal-title"></dialog><div id="toast" role="status" hidden></div><script type="module">
import { createCorrectionsFeature } from '/src/features/corrections.js';
import { shell, esc, score } from '/src/ui.js';
let route = { page: 'report' };
let { state, catalog } = await (await fetch('/fixture/bootstrap' + location.search)).json();
const modal = document.querySelector('#modal');
let modalOpener = null;
window.syncCount = 0; window.refreshCount = 0;
const api = async (path, data) => { const response = await fetch('/api/' + path, data ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) } : {}); const value = await response.json(); if(!response.ok) throw new Error(value.error); return value; };
const ctx = { state:()=>state, catalog:()=>catalog, route:()=>route, attempt:()=>state.attempts[0],
 api, render, toast(message) { const node=document.querySelector('#toast'); node.textContent=message; node.hidden=false; },
 openModal(title, body, actions, className='') { const wasOpen=modal.open; if(!wasOpen){ const target=document.activeElement; modalOpener={target,action:target?.dataset.correctionAction}; } modal.className=className; modal.innerHTML='<div class="modal-heading"><h2 id="modal-title">'+title+'</h2><button class="icon-button" data-correction-action="close" aria-label="关闭弹窗">×</button></div><div class="modal-body">'+body+'</div><div class="modal-actions">'+actions+'</div>'; if(!modal.open)modal.showModal(); if(wasOpen){ const target=modal.querySelector('[autofocus]')??modal.querySelector('.modal-body input:not([type=hidden]):not(:disabled), .modal-body textarea:not(:disabled), .modal-body select:not(:disabled), .modal-body button:not(:disabled)')??modal.querySelector('.modal-actions button:not(:disabled), .modal-heading button'); target?.focus({preventScroll:true}); } },
 closeModal() { modal.close(); const target=modalOpener?.target?.isConnected?modalOpener.target:modalOpener?.action?document.querySelector('[data-correction-action='+CSS.escape(modalOpener.action)+']'):null; target?.focus({preventScroll:true}); modalOpener=null; }, navigate(path) { location.hash='#/'+path; }, persist(){},
 async syncAttempts() { window.syncCount++; state.attempts=(await api('attempts/sync',{guestId:state.guestId})).attempts; },
 async refreshCatalog() { window.refreshCount++; catalog=(await api('catalog')).versions; },
};
const feature=createCorrectionsFeature(ctx);
function render() { const attempt=state.attempts[0]; const content=route.page==='admin' ? '<h1>套卷管理</h1><div data-feature="corrections-admin"></div>' : route.page==='me' ? '<h1>我的记录</h1><div data-feature="corrections-user"></div>' : '<h1>'+esc(attempt.paperTitle)+'</h1><p>正式成绩 <b data-test-score>'+score(attempt.report.totalCents)+'</b> 分</p><div data-feature="corrections-report"></div>'; document.querySelector('#app').innerHTML=shell(content,{state,active:route.page==='report'?'home':route.page}); feature.afterRender(); }
async function navigate() { route={page:location.hash.replace(/^#\\/?/,'').split('/')[0]||'report'}; if(['me','report'].includes(route.page))await ctx.syncAttempts(); render(); await feature.onRoute(); }
window.addEventListener('hashchange',navigate); await navigate(); window.ready=true;
</script></body></html>`;

const browserScript = String.raw`
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ['CORRECTIONS_TEST_BASE']
output = Path(os.environ['CORRECTIONS_TEST_OUTPUT'])
output.mkdir(parents=True, exist_ok=True)
credential = os.environ['CORRECTIONS_TEST_CREDENTIAL']
checks = []
errors = []
def width_check(page, width):
    assert page.evaluate('document.documentElement.scrollWidth') == width, f'overflow {width}'
def capture(page, name):
    page.screenshot(path=str(output / (name + '.png')), full_page=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1440,'height':900}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base, wait_until='networkidle')
    page.wait_for_function('window.ready')
    expect(page.locator('[data-test-score]')).to_have_text('0.85')
    for route in ['report','me','admin']:
        for width,height in [(1440,900),(1280,800),(390,844)]:
            page.set_viewport_size({'width':width,'height':height})
            page.goto(base+'#/'+route,wait_until='networkidle')
            width_check(page,width)
            capture(page,f'{route}-default-{width}')
    page.set_viewport_size({'width':1440,'height':900})
    page.goto(base+'#/report',wait_until='networkidle')
    other = context.new_page()
    other.goto(base + '?guest=other', wait_until='networkidle')
    other.wait_for_function('window.ready')
    expect(other.locator('[data-test-score]')).to_have_text('3.35')
    page.locator('[data-correction-action=feedback]').click()
    expect(page.locator('[name=question]')).to_be_focused()
    page.locator('[name=question]').fill('1')
    page.locator('[name=suggestedAnswer]').select_option('B')
    page.locator('[name=evidence]').fill('原题第 1 页的条件对应 B。<img src=x onerror=alert(1)>')
    expect(page.locator('[data-correction-reference]')).to_contain_text('A')
    page.locator('[data-correction-action=add-row]').click()
    rows = page.locator('[data-correction-row]')
    rows.nth(1).locator('[name=question]').fill('2')
    rows.nth(1).locator('[name=suggestedAnswer]').select_option('A')
    rows.nth(1).locator('[name=evidence]').fill('参考解析第 2 页给出的结论为 A。')
    page.locator('[data-correction-action=add-row]').click()
    page.locator('[data-correction-action=remove-row]').nth(2).click()
    expect(rows).to_have_count(2)
    expect(rows.nth(0).locator('[name=evidence]')).to_contain_text('原题第 1 页')
    for width, height in [(1280,800),(390,844),(320,780)]:
        page.set_viewport_size({'width':width,'height':height})
        width_check(page,width)
        capture(page, f'feedback-form-{width}')
    page.set_viewport_size({'width':1440,'height':900})
    page.route('**/api/corrections/submit', lambda route: route.abort())
    page.get_by_role('button',name='提交反馈',exact=True).click()
    expect(page.locator('[data-correction-modal-error]')).not_to_be_empty()
    expect(rows.nth(1).locator('[name=evidence]')).to_have_value('参考解析第 2 页给出的结论为 A。')
    page.unroute('**/api/corrections/submit')
    page.get_by_role('button',name='提交反馈',exact=True).click()
    expect(page.locator('#modal-title')).to_have_text('反馈处理详情')
    expect(page.locator('dialog .correction-status')).to_have_count(2)
    expect(page.locator('dialog img')).to_have_count(0)
    page.locator('[data-correction-action=preview]').click()
    expect(page.locator('.correction-preview')).to_contain_text('若建议答案成立')
    expect(page.locator('.correction-preview')).to_contain_text('2.15')
    expect(page.locator('[data-test-score]')).to_have_text('0.85')
    capture(page,'preview-1440')
    checks.append('multi-question feedback, escaped evidence, failed-submit input retention and hypothetical preview')
    for _ in range(14):
        page.keyboard.press('Tab')
        # Native dialogs may yield to browser chrome; background page controls must remain inert.
        assert page.evaluate("document.activeElement === document.body || document.querySelector('dialog').contains(document.activeElement)"), 'background control received focus'
    page.keyboard.press('Escape')
    expect(page.locator('dialog')).not_to_be_visible()
    page.locator('[data-correction-action=feedback]').click()
    page.get_by_role('button',name='取消',exact=True).click()
    expect(page.locator('dialog')).not_to_be_visible()
    expect(page.locator('[data-correction-action=feedback]')).to_be_focused()
    capture(page,'report-pending-1440')
    checks.append('native dialog Escape, reopen/cancel and keyboard controls')
    page.goto(base + '#/admin',wait_until='networkidle')
    expect(page.locator('.correction-count')).to_contain_text('1 待审核')
    capture(page,'admin-default-1440')
    page.locator('[data-correction-action=unlock]').click()
    expect(page.locator('[name=reviewToken]')).to_have_attribute('type', 'pass' + 'word')
    page.locator('[name=reviewToken]').fill('invalid-credential')
    page.get_by_role('button',name='进入审核',exact=True).click()
    expect(page.locator('[data-correction-modal-error]')).to_contain_text('维护者凭证无效')
    expect(page.locator('[name=reviewToken]')).to_have_value('')
    page.locator('[name=reviewToken]').fill(credential)
    page.get_by_role('button',name='进入审核',exact=True).click()
    expect(page.locator('[data-correction-action=review]')).to_be_visible()
    assert credential not in page.content()
    assert credential not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})')
    capture(page,'admin-authorized-1440')
    page.locator('[data-correction-action=review]').click()
    page.locator('[name=questionNumbers][value="2"]').uncheck()
    page.locator('[name=reason]').fill('按原题核对，第 1 题订正为 B。')
    page.get_by_role('button',name='核对处理范围',exact=True).click()
    expect(page.locator('dialog')).to_contain_text('2 份答卷')
    capture(page,'review-confirm-1440')
    sync_before = page.evaluate('window.syncCount')
    catalog_before = page.evaluate('window.refreshCount')
    page.route('**/api/attempts/sync', lambda route: route.abort())
    page.locator('[data-correction-action=confirm-review]').click()
    expect(page.locator('dialog')).not_to_be_visible()
    expect(page.locator('[data-correction-action=sync]')).to_be_visible()
    assert page.evaluate('window.syncCount') == sync_before + 1
    assert page.evaluate('window.refreshCount') == catalog_before + 1
    page.unroute('**/api/attempts/sync')
    page.locator('[data-correction-action=sync]').click()
    expect(page.locator('[data-correction-action=sync]')).to_have_count(0)
    reviewed = page.request.post(base+'api/corrections/admin',data={'reviewToken':credential}).json()
    assert len(reviewed['reviews']) == 1, 'sync retry repeated the approved review'
    expect(page.locator('.correction-count')).to_contain_text('1 待审核')
    assert page.evaluate('window.syncCount') >= 1
    assert page.evaluate('window.refreshCount') >= 1
    page.locator('[data-correction-action=review]').click()
    page.locator('[name=decision]').select_option('reject')
    page.locator('[name=reason]').fill('第 2 题原参考答案 B 成立，建议依据不足。')
    page.get_by_role('button',name='核对处理范围',exact=True).click()
    page.locator('[data-correction-action=confirm-review]').click()
    expect(page.locator('.correction-count')).to_contain_text('0 待审核')
    checks.append('server-verified credentials, partial approval, rejection, sync failure recovery without repeated review and both refresh callbacks')
    page.goto(base+'#/me',wait_until='networkidle')
    expect(page.locator('[data-feature=corrections-user]')).to_contain_text('标准答案已订正')
    page.locator('[data-correction-action=notice]').click()
    expect(page.locator('dialog')).to_contain_text('0.85 → 1.35 分')
    capture(page,'notice-1440')
    page.locator('[data-correction-action=open-report]').click()
    expect(page.locator('[data-test-score]')).to_have_text('1.35')
    other.goto(base+'?guest=other#/me',wait_until='networkidle')
    other.locator('[data-correction-action=notice]').click()
    expect(other.locator('dialog')).to_contain_text('3.35 → 2.85 分')
    checks.append('feedback owner and another affected candidate receive revision reason and score changes')
    for route in ['report','me','admin']:
        for width,height in [(1440,900),(1280,800),(390,844),(320,780)]:
            page.set_viewport_size({'width':width,'height':height})
            page.goto(base+'#/'+route,wait_until='networkidle')
            width_check(page,width)
            capture(page,f'{route}-reviewed-{width}')
    page.goto(base+'#/admin',wait_until='networkidle')
    # A page refresh clears the maintainer credential and the queue details.
    page.reload(wait_until='networkidle')
    expect(page.locator('[data-correction-action=unlock]')).to_be_visible()
    expect(page.locator('[data-correction-action=review]')).to_have_count(0)
    assert not errors, errors
    checks.append('320/390/1280/1440px route sweep, session credential clearing and no browser runtime errors')
    browser.close()
result={'passed':len(checks),'checks':checks,'browser_errors':errors}
(output/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False))
`;

test("corrections isolated browser flow", { skip: process.env.ROLLIERANK_BROWSER_TEST !== "1", timeout: 120000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-corrections-browser-"));
  const output = resolve(process.env.ROLLIERANK_CORRECTIONS_OUTPUT ?? join(root, "test-results/corrections"));
  await mkdir(output, { recursive: true });
  const configured = process.env.ROLLIERANK_REVIEW_TOKEN;
  const credential = randomUUID();
  process.env.ROLLIERANK_REVIEW_TOKEN = credential;
  const version = { id: "browser:v1", paperId: "browser", title: "答案反馈 · 四题验收卷", institution: "测试",
    project: "验收", period: "一期", variant: "通用", versionLabel: "1.0", status: "published",
    questions: ["A", "B", "C", "D"].map((correctAnswer, i) => ({ number: i + 1, correctAnswer, type: "言语", typeId: "verbal", cents: [50, 80, 85, 120][i] })) };
  let store = { versions: [version], receipts: {}, audit: [], features: {} };
  for (const [guestId, attemptId, answers] of [["candidate-00000001", "attempt-00000001", ["B", "A", "C", null]],
    ["candidate-00000002", "attempt-00000002", ["A", "B", "C", "D"]]])
    store.receipts[`${guestId}:${attemptId}`] = { id: attemptId, versionId: version.id, paperId: version.paperId,
      paperTitle: version.title, versionLabel: "1.0", answers, report: gradeVersion(version, answers),
      createdAt: 1794600000000, answerRevision: 0, isSample: false };
  let queue = Promise.resolve();
  const service = createCorrectionsService({ readCatalog: () => store, mutateCatalog(operation) {
    const task = queue.catch(() => {}).then(async () => {
      const before = structuredClone(store);
      try {
        const result = operation(store);
        await writeFile(join(directory, "catalog.tmp"), JSON.stringify(store));
        await rename(join(directory, "catalog.tmp"), join(directory, "catalog.json"));
        return result;
      } catch (error) { store = before; throw error; }
    });
    queue = task;
    return task;
  }, dataDirectory: directory });
  const owned = (guestId) => Object.entries(store.receipts).filter(([key]) => key.startsWith(`${guestId}:`)).map(([, receipt]) => receipt);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const send = (status, data) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(data)); };
    try {
      if (url.pathname === "/") { response.setHeader("Content-Type", "text/html"); response.end(html); return; }
      if (url.pathname === "/fixture/bootstrap") {
        const guestId = url.searchParams.get("guest") === "other" ? "candidate-00000002" : "candidate-00000001";
        send(200, { state: { guestId, profile: null, attempts: owned(guestId) }, catalog: store.versions.map(publicVersion) }); return;
      }
      if (url.pathname.startsWith("/api/")) {
        let body = "";
        for await (const chunk of request) body += chunk;
        const input = body ? JSON.parse(body) : {};
        if (await service({ request, response, pathname: url.pathname, method: request.method, input, query: url.searchParams, send })) return;
        await queue.catch(() => {});
        if (url.pathname === "/api/attempts/sync") { send(200, { attempts: owned(input.guestId) }); return; }
        if (url.pathname === "/api/catalog") { send(200, { versions: store.versions.map(publicVersion) }); return; }
        send(404, { error: "接口不存在。" }); return;
      }
      const path = resolve(root, "." + url.pathname);
      if (!path.startsWith(root + "/") || ![".css", ".js", ".svg"].includes(extname(path))) { response.writeHead(404); response.end(); return; }
      response.setHeader("Content-Type", { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" }[extname(path)]);
      response.end(await readFile(path));
    } catch (error) { send(error.statusCode ?? 500, { error: error.message }); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise((resolveClose) => server.close(resolveClose));
    await rm(directory, { recursive: true, force: true });
    if (configured === undefined) delete process.env.ROLLIERANK_REVIEW_TOKEN; else process.env.ROLLIERANK_REVIEW_TOKEN = configured; });
  const child = spawn(process.env.ROLLIERANK_BROWSER_PYTHON ?? "python3", ["-c", browserScript], {
    env: { ...process.env, CORRECTIONS_TEST_BASE: `http://127.0.0.1:${server.address().port}/`, CORRECTIONS_TEST_OUTPUT: output, CORRECTIONS_TEST_CREDENTIAL: credential },
  });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, stderr || stdout);
  const result = JSON.parse(stdout.trim());
  assert.equal(result.passed, 5);
  assert.deepEqual(result.browser_errors, []);
  console.log(stdout.trim());
});
