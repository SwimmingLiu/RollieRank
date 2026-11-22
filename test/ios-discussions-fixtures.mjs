import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createApi } from "../server/api.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const ios = resolve(repo, "docs/ui-exploration/ios-v3");
const ui = resolve(ios, "ui");
const uiRequire = createRequire(pathToFileURL(join(ui, "package.json")));
export async function buildIOSDiscussionBridge() {
  const { build } = uiRequire("esbuild");
  const output = await build({
    // Refined views compile privately; the shared vendor bundle remains coordinator-owned.
    stdin: { contents: 'export * from "./bridge.tsx"; export { mountDiscussionAvatar } from "./discussions-avatar.tsx"; export { mountDiscussionReportEntry, mountDiscussionPage, mountDiscussionEditor } from "./discussions.tsx";', resolveDir: ui, loader: "tsx" },
    bundle: true, write: false, format: "iife", globalName: "RollieUI", platform: "browser", jsx: "automatic",
    target: ["safari17", "chrome120"], tsconfig: join(ui, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' }, footer: { js: "window.RollieUI = RollieUI;" },
  });
  return Buffer.from(output.outputFiles[0].contents);
}

const entry = String.raw`
import {createIOSDiscussionsFeature} from './features/discussions.js';
const api=async(path,data)=>{const response=await fetch('/api/'+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},...(data?{body:JSON.stringify(data)}:{})});const body=await response.json();if(!response.ok)throw new Error(body.error||'操作失败');return body;};
const catalog=(await api('catalog')).versions;
let version=catalog.find(v=>v.status==='published');
const guestId='ios-discussion-guest-123456';
let attempt=await api('submit',{versionId:version.id,guestId,attemptId:'ios-discussion-attempt-123456',answers:Array(version.questionCount).fill('A')});
const state=JSON.parse(localStorage.getItem('ios-discussion-fixture')||'null')||{guestId,profile:null,attempts:[attempt],drafts:{}};
let sample=false,route={page:'report',id:attempt.id};
const stage=document.querySelector('#stage');const sheetHost=document.querySelector('#sheet-host');
let sheet={open:false,title:'',html:''};
// Mirror the shared modal-close contract without changing the public app or its bundle.
const closeSubscribers=new Set(),toasts=[];
function closeModal(reason='complete'){const content=document.querySelector('#sheet-content');if(content)window.RollieUI.cleanup(content);sheet={...sheet,open:false};window.RollieUI.mountSheet(sheetHost,{...sheet,onClose:()=>closeModal('dismiss')});for(const callback of closeSubscribers)callback({reason});}
function openModal(title,html,actions='',className=''){sheet={open:true,title,html:'<div class="ios-feature-sheet '+className+'">'+html+actions+'</div>'};window.RollieUI.mountSheet(sheetHost,{...sheet,onClose:()=>closeModal('dismiss'),onContentReady:el=>window.RollieUI.mountButtons(el)});}
const navigations=[];
const currentAttempt=()=>sample?{...attempt,id:'legacy-sample',isSample:true}:attempt;
const feature=createIOSDiscussionsFeature({state:()=>state,catalog:()=>catalog,version:()=>version,attempt:currentAttempt,route:()=>route,dimension:()=> 'total',uiState:()=>({page:route.page}),api,persist:()=>localStorage.setItem('ios-discussion-fixture',JSON.stringify(state)),openModal,closeModal,onModalClose(callback){closeSubscribers.add(callback);return()=>closeSubscribers.delete(callback);},toast:message=>toasts.push(message),render,navigate(path){navigations.push(path);const[page,id]=path.split('/');route={page,id};render();void feature.onRoute();}});
function render(){
 window.RollieUI.cleanup(stage);
 document.querySelector('#app').dataset.page=route.page;
 document.querySelector('#top').innerHTML='<button type="button" id="fixture-records" aria-label="返回">‹</button><h1>'+ (route.page==='report'?'练习估分':route.page==='discussion'?'本卷交流':'练习记录') +'</h1>';
 document.querySelector('#fixture-records').onclick=()=>{route={page:route.page==='discussion'?'report':'me',id:attempt.id};render();void feature.onRoute();};
  document.querySelector('#bottom').innerHTML='';
 if(route.page==='report'){
   // Match the product: comments live in the fixed report action bar, never at the page tail.
   stage.innerHTML='<div class="view" data-page="report"><div id="score-ui"></div></div>';
   document.querySelector('#bottom').innerHTML='<div class="row-actions"><button type="button" class="primary">复盘错题</button><span class="rr-report-comment-host">'+feature.reportEntryView('compact')+'</span></div>';
   window.RollieUI.mountScore(document.querySelector('#score-ui'),{total:attempt.report.totalCents/100,maxScore:attempt.report.maxCents/100,correct:attempt.report.correct,wrong:attempt.report.wrong,rank:null,participants:0,sections:attempt.report.breakdown.map(t=>({name:t.name,earnedCents:t.centsEarned,maxCents:t.maxCents})),onRank:()=>{},onReview:()=>{}});
 }else if(route.page==='discussion'){
   stage.innerHTML='<div class="view" data-page="discussion">'+feature.discussionView()+'</div>';
 }else{
   stage.innerHTML='<div class="view" data-page="'+route.page+'"><div style="padding:24px"><p>'+(route.page==='practice'?'录入答案后即可交卷。':'已提交的练习记录')+'</p><button type="button" id="fixture-report" class="primary">查看成绩报告</button></div></div>';
   document.querySelector('#fixture-report').onclick=()=>{route={page:'report',id:attempt.id};render();void feature.onRoute();};
 }
 feature.afterRender();
}
window.__iosDiscussions={feature,state,get attempt(){return attempt;},get version(){return version;},navigations,toasts,api,async enter(page){route={page,id:attempt.id};render();await feature.onRoute();},async sample(value){sample=value;route={page:'report',id:value?'legacy-sample':attempt.id};render();await feature.onRoute();},async paper(index){version=catalog.filter(v=>v.status==='published')[index];attempt=await api('submit',{versionId:version.id,guestId,attemptId:'ios-discussion-paper-'+index+'-123456',answers:Array(version.questionCount).fill('A')});route={page:'report',id:attempt.id};render();await feature.onRoute();},render,async list(){return api('discussions?'+new URLSearchParams({paperId:attempt.paperId,guestId,attemptId:attempt.id}));}};
render();await feature.onRoute();document.body.dataset.discussionsReady='true';
`;

export async function createIOSDiscussionHost(bridge, { directory: prior } = {}) {
  const directory = prior ?? await mkdtemp(join(tmpdir(), "rollierank-ios-discussions-"));
  const api = await createApi({ dataDirectory: pathToFileURL(directory + "/") });
  const types = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".html": "text/html; charset=utf-8", ".json": "application/json" };
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (await api(request, response, pathname)) return;
      if (pathname === "/ios-v3/vendor/beui.js") { response.writeHead(200, { "Content-Type": "text/javascript" }); response.end(bridge); return; }
      if (pathname === "/ios-v3/discussions-fixture.js") { response.writeHead(200, { "Content-Type": "text/javascript" }); response.end(entry); return; }
      if (pathname === "/ios-v3/app.html") {
        let html = await readFile(join(ios, "app.html"), "utf8");
        html = html.replace(/src="app\.js[^\"]*"/, 'src="discussions-fixture.js"');
        html = html.replace("</head>", '<link rel="stylesheet" href="features/discussions.css"></head>');
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(html); return;
      }
      const relative = pathname.startsWith("/ios-v3/") ? "docs/ui-exploration/ios-v3/" + (pathname.slice(8) || "index.html") : pathname.startsWith("/src/") ? pathname.slice(1) : "";
      if (!relative) { response.writeHead(404).end(); return; }
      const path = resolve(repo, relative);
      if (!path.startsWith(repo)) { response.writeHead(404).end(); return; }
      const bytes = await readFile(path);
      response.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream", "Cache-Control": "no-store" }); response.end(bytes);
    } catch (error) { response.writeHead(500, { "Content-Type": "text/plain" }); response.end(error.message); }
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  return { base: `http://127.0.0.1:${server.address().port}`, directory,
    async close({ remove = !prior } = {}) { server.closeAllConnections(); await new Promise((resolveClose) => server.close(resolveClose)); if (remove) await rm(directory, { recursive: true, force: true }); },
  };
}
