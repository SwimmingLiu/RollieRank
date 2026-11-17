import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogAttempt } from "./analytics-catalog-fixtures.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const iosDirectory = path.join(root, "docs/ui-exploration/ios-v3");
const uiDirectory = path.join(iosDirectory, "ui");
const requireUI = createRequire(path.join(uiDirectory, "package.json"));
const { build } = requireUI("esbuild");
const scenes = { first: "首刷", second: "二刷", all: "完整板块", wide: "高分值", missing: "缺指标", third: "三刷", stats: "整体", categories: "考试类别", "report-anchor": "报告入口", "category-empty": "空卷型", long: "长序列", empty: "空记录", share: "分享", entry: "入口", sample: "样例", pending: "示例估分", "pending-share": "示例分享" };
const actualCategoryRecords = [
  catalogAttempt({ paperId: "sihai-2026-h2-p2-city-01", id: "category-flower", createdAt: new Date(2026, 10, 10, 9).getTime() }),
  catalogAttempt({ paperId: "fenbi-2027-guokao-01", id: "category-fenbi", createdAt: new Date(2026, 10, 11, 9).getTime(), answer: "B" }),
  catalogAttempt({ paperId: "chaoge-2027-01", id: "category-generic", createdAt: new Date(2026, 10, 12, 9).getTime(), answer: "C" }),
  catalogAttempt({ paperId: "sihai-2026-h2-p2-province-01", id: "category-province", createdAt: new Date(2026, 10, 13, 9).getTime(), answer: "D" }),
];
const index = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>iOS 分析专项验证</title><style>body{margin:0;background:#f7f7f6}nav{display:flex;height:34px;overflow:auto;gap:5px;align-items:center;padding:0 8px}nav button{white-space:nowrap}iframe{display:block;border:0;width:100%;max-width:430px;height:calc(100vh - 34px);margin:auto}</style><nav>${Object.entries(scenes).map(([id,label])=>`<button data-scene="${id}">${label}</button>`).join("")}</nav><iframe title="iOS 练习页面" src="/ios-v3/analytics-fixture.html"></iframe><script>document.querySelector('nav').addEventListener('click',e=>{const mode=e.target.dataset.scene;if(mode)document.querySelector('iframe').contentWindow.postMessage({mode},location.origin)});</script></html>`;
const fixture = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>iOS 图表化分析验证</title>${["vendor/beui.css", "modern.css", "refined.css", "editorial.css", "typography.css", "features/base.css", "features/analytics.css"].map((file)=>`<link rel="stylesheet" href="/ios-v3/${file}">`).join("")}<body class="beui-island"><div id="app"><header id="top"><span></span><h1>练习估分</h1><span></span></header><main id="stage"></main><footer id="bottom"></footer></div><button id="fixture-correct" hidden>订正上一刷</button><output id="last-action" hidden></output><script src="/ios-v3/analytics-test-ui.js"></script><script type="module">
import {createIOSAnalyticsFeature} from '/ios-v3/features/analytics.js';
import {gradeVersion} from '/src/model.js';
const questions=[1000,2000,1000,2000,1000].map((cents,i)=>({number:i+1,type:i<3?'言语理解':'数量关系',typeId:i<3?'verbal':'quant',cents,correctAnswer:'A'}));
function attempt(id,day,answers=['A','B',null,'A','A'],extra={}){return {id,paperId:'paper-alpha',versionId:'paper-alpha:v1',paperTitle:'机构甲五题练习',institution:'机构甲',period:'一期',versionLabel:'1.0',createdAt:new Date(2026,10,day,9,0,0,123).getTime(),answers,report:gradeVersion({questions},answers),...extra};}
const records=[attempt('first',10,Array(5).fill('B')),attempt('second',11),attempt('third',12,['A','A','B','A','A']),attempt('other-paper',13,['A','B','B','B','B'],{paperId:'paper-bravo',versionId:'paper-bravo:v1',paperTitle:'机构乙同规则五题卷',institution:'机构乙'}),attempt('different-rule',9,Array(5).fill('A'),{paperId:'paper-other',paperTitle:'另一评分规则五题卷',report:gradeVersion({questions:questions.map((q,i)=>({...q,type:i<3?'资料分析':q.type,cents:[2000,1000,1000,2000,1000][i]}))},Array(5).fill('A'))})];
// 真实花生、粉笔和135题数据验证单卷型聚合，权重来自各自的真实题库。
const categoryRecords=${JSON.stringify(actualCategoryRecords)};
const sixNames=['政治理论','常识判断','言语理解','数量关系','图形推理','定义判断','类比推理','逻辑判断','资料分析'];
const sixQuestions=sixNames.map((type,i)=>({number:i+1,type,typeId:'six-'+i,cents:100,correctAnswer:'A'}));
const sixAttempt=(id,day,answers)=>({id,paperId:'six-subjects',versionId:'six-subjects:v1',paperTitle:'六板块练习',institution:'机构甲',createdAt:new Date(2026,10,day,9).getTime(),answers,report:gradeVersion({questions:sixQuestions},answers)});
const sixRecords=[sixAttempt('six-before',10,['A','B','B','A','A','B','A','B','B']),sixAttempt('six-current',11,['B','A','A','A','A','A','B','B','A'])];
const wideRecords=sixRecords.map((record,index)=>{const answers=Array(9).fill('A');if(index)answers[0]='B';return {...record,id:'wide-'+index,paperId:'wide',versionId:'wide:v1',answers,report:gradeVersion({questions:sixQuestions.map(question=>({...question,cents:2000}))},answers)};});
const missingAttempt=sixAttempt('six-missing',12,['B','A','A','A','A','A','B','B','A']);missingAttempt.report.rows[0].cents=undefined;
const longRecords=Array.from({length:25},(_,i)=>attempt('long-'+String(i).padStart(2,'0'),i+1,undefined,{paperId:'long-paper-'+(i%8),versionId:'long-paper-'+(i%8)+':v1',paperTitle:'长卷 '+(i%8)}));longRecords[2].createdAt=longRecords[1].createdAt;
let mode='first',current=records[0],dispose;const state={attempts:records};const catalog=[{id:'paper-alpha:v1',paperId:'paper-alpha',title:'机构甲五题练习',status:'published'}];
const ctx={state:()=>state,catalog:()=>catalog,attempt:()=>mode==='sample'?attempt('legacy',16):current,document,render,navigate(path){document.querySelector('#last-action').textContent=path;if(path==='stats'){mode='stats';}else if(path.startsWith('stats/')){mode='paper';}else if(path==='me'){mode='entry';}else if(path.startsWith('report/')){current=records.find(a=>a.id===decodeURIComponent(path.slice(7)))??current;mode='report';}render(true);}};
const feature=createIOSAnalyticsFeature(ctx);window.RollieUI=AnalyticsIOSFixture;
function render(reset=false){const stage=document.querySelector('#stage');const scroll=reset?0:stage.querySelector('.view')?.scrollTop??0;dispose?.();dispose=null;state.attempts=mode==='categories'||mode==='report-anchor'?categoryRecords:mode==='category-empty'?categoryRecords.filter(record=>record.report.rows.length===130):mode==='wide'?wideRecords:mode==='all'?sixRecords:mode==='missing'?[...sixRecords,missingAttempt]:mode==='long'?longRecords:mode==='empty'?[]:records;const view=document.createElement('section');view.className='view';view.dataset.fixtureScene=mode;stage.replaceChildren(view);document.querySelector('#top h1').textContent=['stats','categories','report-anchor','category-empty','long','empty','paper'].includes(mode)?'成长分析':mode==='share'?'成绩分享':'练习估分';if(['stats','categories','report-anchor','category-empty','long','empty','paper'].includes(mode))view.innerHTML=feature.statsView(mode==='paper'?{catalog,version:catalog[0],versionId:catalog[0].id}:mode==='report-anchor'?{versionId:categoryRecords[0].versionId}:{});else if(mode==='entry')view.innerHTML='<section style="padding:18px"><div class="ios-feature-host" data-feature="analytics-entry"></div></section>';else{const host=document.createElement('div');view.append(host);const report=current.report;const props={verification:mode.startsWith('pending')?{kind:'legacy'}:{kind:'verified'},total:report.totalCents/100,maxScore:report.maxCents/100,correct:report.correct,wrong:report.wrong,rank:null,participants:0,sections:report.breakdown.map(t=>({name:t.name,earnedCents:t.centsEarned,maxCents:t.maxCents})),onRank:()=>{},onReview:()=>{},logoSrc:'assets/brand/rollierank-logo-transparent.png',publisherLogoSrc:'assets/brand/rollierank-logo-transparent.png',institution:'四海',year:2026,period:1,paper:1,paperTitle:'五题练习'};window.__iosAnalyticsFixtureProps=props;dispose=(mode==='share'||mode==='pending-share')?AnalyticsIOSFixture.mountShare(host,props):AnalyticsIOSFixture.mountScore(host,props);}feature.afterRender();view.scrollTop=scroll;}
window.addEventListener('message',e=>{if(e.origin!==location.origin||!e.data.mode)return;mode=e.data.mode;if(mode==='first')current=records[0];if(mode==='second')current=records[1];if(mode==='third')current=records[2];if(mode==='wide')current=wideRecords[1];if(mode==='all')current=sixRecords[1];if(mode==='missing')current=missingAttempt;render(true);});
document.querySelector('#fixture-correct').addEventListener('click',()=>{records[1]={...records[1],report:gradeVersion({questions},Array(5).fill('A'))};render();});render();
</script></body></html>`;

test("compact native iOS analysis renders the real first/second/third states and all working dashboard controls", { timeout: 60000 }, async (t) => {
  const { chromium } = await import("playwright");
  const temporary = await mkdtemp(path.join(tmpdir(), "rollierank-ios-analytics-refinement-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const compiled = path.join(temporary, "results.js");
  const inputs=['features/analytics.js','features/analytics.css','ui/analytics.tsx','ui/results.tsx'];
  const inputHashes=async()=>Object.fromEntries(await Promise.all(inputs.map(async(file)=>[file,createHash('sha256').update(await readFile(path.join(iosDirectory,file))).digest('hex')])));
  const implementation=await inputHashes();
  await build({ stdin: { contents: 'import React from "react";import {mountRoot} from "./root-registry.tsx";import {ScoreOverview,ShareResult} from "./results.tsx";export {mountAnalyticsReport,mountAnalyticsStats} from "./analytics.tsx";export {createSharePoster} from "./results.tsx";export const mountScore=(host,props)=>mountRoot(host,<ScoreOverview {...props}/>);export const mountShare=(host,props)=>mountRoot(host,<ShareResult {...props}/>);', loader: "tsx", resolveDir: uiDirectory }, bundle: true, outfile: compiled, format: "iife", globalName: "AnalyticsIOSFixture", platform: "browser", target: ["safari17", "chrome120"], jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" });
  const server = createServer(async (request,response)=>{
    try {
      const pathname=new URL(request.url,"http://localhost").pathname;
      if(pathname==='/ios-v3/'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(index);return;}
      if(pathname==='/ios-v3/analytics-fixture.html'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(fixture);return;}
      let file;
      if(pathname==='/ios-v3/analytics-test-ui.js')file=compiled;
      else if(pathname.startsWith('/ios-v3/')&&/\.(css|js|svg|png|woff2?)$/.test(pathname))file=path.resolve(iosDirectory,'.'+pathname.slice('/ios-v3'.length));
      else if(pathname.startsWith('/src/')&&!pathname.startsWith('/src/data/')&&/\.(css|js)$/.test(pathname))file=path.resolve(root,'.'+pathname);
      if(!file||(!file.startsWith(root)&&file!==compiled)){response.writeHead(404).end();return;}
      const contentType={'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'}[path.extname(file)];
      response.writeHead(200,{'Content-Type':contentType}).end(await readFile(file));
    }catch{response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:878},reducedMotion:'reduce'});page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  t.after(async()=>{if(errors.length)await writeFile(path.join(root,'.beauye/tasks/ios-analytics-refinement/evidence/browser-runtime-errors.json'),JSON.stringify(errors,null,2));});
  const evidence=path.join(root,'.beauye/tasks/ios-analytics-refinement/evidence');await mkdir(evidence,{recursive:true});
  await page.goto(`http://127.0.0.1:${server.address().port}/ios-v3/`,{waitUntil:'networkidle'});
  const frame=page.frameLocator('iframe');
  const scene=async(mode)=>{await page.locator(`[data-scene="${mode}"]`).click();await frame.locator(`[data-fixture-scene="${mode}"]`).waitFor();};
  const shot=async(name)=>page.locator('iframe').screenshot({path:path.join(evidence,name)});
  const plot=()=>frame.locator('.ios-analysis-plot');
  await frame.locator('[data-slot="score-report"]').waitFor();
  assert.equal(await frame.locator('[data-feature="analytics-comparison"]').getAttribute('hidden'),'');
  assert.equal(await frame.locator('.ios-analysis-vs').count(),0);
  assert.equal(await frame.locator('select').count(),0);
  await shot('report-first-390.png');
  await scene('second');await frame.locator('.ios-analysis-vs').waitFor();
  const analysisEntry = await frame.getByRole('button',{name:'查看完整成长分析',exact:true}).boundingBox();
  assert.ok(analysisEntry.width >= 32 && analysisEntry.height >= 32);
  assert.equal(await frame.locator('.ios-analysis-delta strong').innerText(),'+40.00');assert.equal(await frame.locator('.ios-analysis-delta').getAttribute('aria-label'),'进步 40 分');
  assert.equal(await plot().count(),0);
  assert.deepEqual(await frame.locator('.ios-vs-subject h3').allTextContents(),['言语理解','数量关系']);assert.equal(await frame.locator('.ios-analysis-vs table').count(),0);
  const reportCopy=await frame.locator('.ios-analysis-vs').innerText();
  assert.ok(!/R-[0-9A-F]|键盘|方向键|09:00|\.123|筛选|逐次记录/.test(reportCopy));
  await frame.locator('.ios-analysis-vs').scrollIntoViewIfNeeded();await shot('report-second-390.png');
  await frame.getByRole('button',{name:/上一刷 .*查看报告/}).focus();await page.keyboard.press('Enter');assert.equal(await frame.locator('#last-action').textContent(),'report/first');assert.equal(await frame.locator('.ios-analysis-vs').count(),0);
  await scene('third');assert.equal(await frame.locator('.ios-analysis-mini circle').count(),3);
  await frame.locator('#fixture-correct').evaluate(button=>button.click());
  assert.equal(await frame.locator('.ios-analysis-delta strong').innerText(),'−10.00');assert.equal(await frame.locator('.ios-analysis-delta').getAttribute('aria-label'),'退步 10 分');
  await frame.locator('.ios-analysis-vs').scrollIntoViewIfNeeded();await shot('report-third-390.png');
  await frame.getByRole('button',{name:'查看完整成长分析',exact:true}).click();
  assert.equal(await frame.locator('#last-action').textContent(),'stats/paper-alpha%3Av1');
  await frame.locator('.ios-analysis-dashboard').waitFor();
  assert.equal(await frame.getByRole('tab').count(),3);
  assert.equal(await frame.locator('select').count(),0);
  await scene('stats');
  assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),5);
  await frame.getByRole('button',{name:'选择第 3 次，机构甲五题练习',exact:true}).click();assert.equal(await plot().getAttribute('data-selected-id'),'second');
  await frame.getByRole('button',{name:'查看第 3 次报告',exact:true}).click();assert.equal(await frame.locator('#last-action').textContent(),'report/second');await scene('stats');
  const metric=frame.getByRole('tab',{name:'得分率',exact:true});await metric.focus();await page.keyboard.press('ArrowRight');
  assert.equal(await frame.getByRole('tab',{name:'得分',exact:true}).getAttribute('aria-selected'),'true');
  await frame.getByRole('tab',{name:'正确率',exact:true}).click();
  assert.equal(await frame.locator('.ios-analysis-records thead th').nth(2).innerText(),'正确率');
  await frame.getByRole('tab',{name:'得分率',exact:true}).click();
  await frame.getByRole('button',{name:'行测整体',exact:true}).click();
  await frame.getByRole('dialog',{name:'选择题型',exact:true}).waitFor();
  await frame.getByRole('dialog').getByRole('button',{name:'言语理解',exact:true}).click();
  await frame.locator('.ios-analysis-dimension').waitFor();
  assert.ok((await frame.locator('.ios-analysis-records').innerText()).includes('75%'));
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();
  const dialog=()=>frame.getByRole('dialog');
  await dialog().getByRole('button',{name:/来源套卷/}).click();
  await dialog().getByRole('button',{name:/机构乙同规则五题卷/}).click();
  assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),1);
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();
  await dialog().getByRole('button',{name:/来源套卷/}).click();
  await dialog().getByRole('button',{name:/另一评分规则五题卷/}).click();
  assert.ok((await frame.locator('.ios-analysis-records').innerText()).includes('此卷未包含该题型'));
  assert.equal(await plot().locator('circle').count(),0);
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();
  assert.equal(await dialog().getByRole('button',{name:/同类分值/}).count(),0);
  await dialog().getByRole('button',{name:/考试类别/}).click();await dialog().getByRole('button',{name:'计分说明',exact:true}).click();
  assert.ok((await dialog().innerText()).includes('每份成绩沿用自己的分值和满分'));
  assert.equal(await dialog().locator('table').count(),0);
  await shot('category-help-390.png');
  await dialog().getByRole('button',{name:'返回筛选',exact:true}).click();await dialog().getByRole('button',{name:/来源套卷/}).click();
  await dialog().getByRole('button',{name:'全部套卷',exact:true}).click();
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();
  await dialog().getByRole('button',{name:/练习日期/}).click();
  assert.equal(await dialog().locator('input[type=date]').count(),0);await dialog().getByRole('button',{name:'2026年11月13日',exact:true}).click();await dialog().getByRole('button',{name:'2026年11月11日',exact:true}).click();
  await dialog().getByRole('button',{name:'应用',exact:true}).click();assert.ok((await dialog().getByRole('alert').innerText()).includes('开始日期'));
  await dialog().getByRole('button',{name:'开始日期',exact:true}).click();await dialog().getByRole('button',{name:'2026年11月11日',exact:true}).click();await dialog().getByRole('button',{name:'2026年11月12日',exact:true}).click();await shot('calendar-390.png');
  await dialog().getByRole('button',{name:'应用',exact:true}).click();assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),2);
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();await dialog().getByRole('button',{name:/练习日期/}).click();await dialog().getByRole('button',{name:'上个月',exact:true}).click();await dialog().getByRole('button',{name:'下个月',exact:true}).click();await dialog().getByRole('button',{name:'2026年11月12日',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await dialog().getByRole('button',{name:'2026年11月13日',exact:true}).evaluate(el=>el===el.ownerDocument.activeElement),true);await dialog().getByRole('button',{name:'清除',exact:true}).click();
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();await dialog().waitFor();await page.keyboard.press('Escape');
  await dialog().waitFor({state:'hidden'});assert.equal(await frame.getByRole('button',{name:'筛选分析记录',exact:true}).evaluate(el=>el===el.ownerDocument.activeElement),true);
  await scene('long');
  assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),1);
  await frame.getByRole('button',{name:'4 / 4',exact:true}).click();await dialog().getByRole('button',{name:'第 1–8 次',exact:true}).click();
  assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),8);
  await plot().focus();await page.keyboard.press('Home');assert.equal(await plot().getAttribute('data-selected-id'),'long-00');
  await page.keyboard.press('ArrowRight');assert.equal(await plot().getAttribute('data-selected-id'),'long-01');
  await page.keyboard.press('ArrowRight');assert.equal(await plot().getAttribute('data-selected-id'),'long-02');
  assert.equal(await plot().evaluate(el=>el===el.ownerDocument.activeElement),true);
  await page.keyboard.press('End');assert.equal(await plot().getAttribute('data-selected-id'),'long-07');
  await frame.getByRole('button',{name:'晚一页',exact:true}).click();assert.ok((await frame.locator('.ios-analysis-pages').innerText()).includes('2 / 4'));
  await frame.getByRole('button',{name:'早一页',exact:true}).click();
  assert.equal(await frame.getByRole('button',{name:'1 / 4',exact:true}).evaluate(el=>el===el.ownerDocument.activeElement),true);
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();await dialog().getByRole('button',{name:/来源套卷/}).click();
  await dialog().getByRole('textbox',{name:'搜索来源套卷',exact:true}).fill('长卷 7');
  await dialog().getByRole('button',{name:/长卷 7/}).click();assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),3);
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();await dialog().getByRole('button',{name:/来源套卷/}).click();await dialog().getByRole('button',{name:'全部套卷',exact:true}).click();
  const geometry=[];
  for(const mode of ['second','third','stats','share']){
    await scene(mode);
    for(const width of [320,390,430,1280]){
      await page.setViewportSize({width,height:width>430?834:878});
      await page.waitForFunction(()=>{const view=document.querySelector('iframe').contentDocument.querySelector('.view');return [...view.querySelectorAll('canvas')].every(canvas=>canvas.getBoundingClientRect().right<=view.getBoundingClientRect().right+1);},undefined,{timeout:3000});
      const size=await frame.locator('.view').evaluate(el=>({viewport:innerWidth,available:el.clientWidth,content:el.scrollWidth}));geometry.push({mode,outerWidth:width,...size});
      assert.ok(size.content<=size.available+1,`${mode} overflows at ${width}`);
      if(mode==='second'||mode==='third')await frame.locator('.ios-analysis-vs').scrollIntoViewIfNeeded();
      await shot(`${mode}-${width}.png`);
    }
  }
  await scene('all');
  assert.deepEqual(await frame.locator('.ios-vs-subject h3').allTextContents(),['政治理论','常识判断','言语理解','数量关系','判断推理','资料分析']);
  const political=frame.locator('[data-analysis-subject="政治理论"]');
  assert.equal(await political.locator('.ios-vs-subject-values strong').innerText(),'0%');
  assert.equal(await political.locator('.ios-vs-subject-values small').innerText(),'100%');
  assert.equal(await political.locator('.ios-vs-points').getAttribute('aria-label'),'退步 100 个百分点');
  assert.equal(await frame.locator('[data-analysis-subject="数量关系"] .ios-vs-points').innerText(),'持平');
  assert.equal(await frame.locator('[data-analysis-subject="判断推理"] .ios-vs-subject-values strong').innerText(),'50%');
  for(const width of [320,390,430]) {
    await page.setViewportSize({width,height:878});
    await frame.locator('.ios-analysis-vs').scrollIntoViewIfNeeded();
    const subjects=await frame.locator('.ios-analysis-vs').evaluate(element=>({width:element.clientWidth,content:element.scrollWidth,cards:[...element.querySelectorAll('.ios-vs-subject')].map(card=>({available:card.clientWidth,content:card.scrollWidth})),scores:[...element.querySelectorAll('.ios-vs-score')].map(card=>({available:card.clientWidth,content:card.scrollWidth}))}));
    assert.ok(subjects.content<=subjects.width+1,`six-subject VS overflows at ${width}`);
    assert.ok(subjects.cards.every(card=>card.content<=card.available+1),`subject values overflow at ${width}`);
    assert.ok(subjects.scores.every(card=>card.content<=card.available+1),`score tile overflows at ${width}`);
    geometry.push({mode:'all',outerWidth:width,...subjects});
    await shot(`vs-all-${width}.png`);
    await frame.locator('.ios-analysis-vs').screenshot({path:path.join(evidence,`vs-all-card-${width}.png`)});
  }
  await scene('wide');await page.setViewportSize({width:320,height:878});
  assert.deepEqual(await frame.locator('.ios-vs-score strong').allTextContents(),['180.00','160.00']);
  assert.ok((await frame.locator('.ios-vs-score').evaluateAll(cards=>cards.map(card=>({available:card.clientWidth,content:card.scrollWidth})))).every(card=>card.content<=card.available+1));
  await frame.locator('.ios-analysis-vs').scrollIntoViewIfNeeded();await shot('vs-wide-320.png');
  await page.setViewportSize({width:430,height:878});
  await scene('missing');
  assert.equal(await frame.locator('[data-analysis-subject="政治理论"] .ios-vs-subject-values strong').innerText(),'—');
  assert.equal(await frame.locator('[data-analysis-subject="政治理论"] .ios-vs-points').innerText(),'—');
  assert.equal(await frame.locator('[data-analysis-subject="政治理论"] .ios-vs-rate-fill').count(),0);
  assert.match(await frame.locator('[data-analysis-subject="政治理论"] .ios-vs-rate-glyph').getAttribute('aria-label'),/本次未记录/);
  await shot('vs-missing-430.png');
  await scene('stats');await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();await dialog().waitFor();
  await scene('share');await dialog().waitFor({state:'hidden'});assert.equal(await frame.locator('body').evaluate(el=>el.style.position),'');
  await scene('pending');
  assert.equal(await frame.locator('.rr3-score-label .rr-score-verification').innerText(),'示例估分');
  assert.equal(await frame.locator('button.rr-score-verification').count(),0);
  await shot('pending-score-390.png');
  await scene('pending-share');assert.equal(await frame.locator('button.rr-score-verification').count(),0);
  await shot('pending-share-390.png');
  const exported=await frame.locator('body').evaluate(async()=>{
    document.querySelector('#last-action').textContent='before-export';
    const promise=AnalyticsIOSFixture.createSharePoster(window.__iosAnalyticsFixtureProps);
    const marker=document.querySelector('.rr2-poster-host .rr-score-verification');
    const tag=marker?.tagName;const buttons=document.querySelectorAll('.rr2-poster-host button.rr-score-verification').length;
    const png=await promise;return {tag,buttons,png,action:document.querySelector('#last-action').textContent};
  });
  assert.equal(exported.tag,'SPAN');assert.equal(exported.buttons,0);assert.equal(exported.action,'before-export');assert.ok(exported.png.startsWith('data:image/png;base64,'));
  await writeFile(path.join(evidence,'pending-share-export.png'),Buffer.from(exported.png.split(',')[1],'base64'));
  await scene('entry');await frame.locator('[data-ios-analytics-entry]').click();await frame.locator('.ios-analysis-dashboard').waitFor();
  await scene('sample');assert.equal(await frame.locator('.ios-analysis-vs').count(),0);assert.equal(await frame.locator('[data-feature="analytics-comparison"]').getAttribute('hidden'),'');
  await scene('empty');assert.ok((await frame.getByRole('status').innerText()).includes('还没有练习记录'));
  // 只有卷型一个分组入口；花生和粉笔不同权重的130题成绩必须同屏可见。
  await scene('categories');await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();
  assert.equal(await dialog().locator('.ios-analysis-filters > button b').first().innerText(),'考试类别');
  assert.equal(await dialog().getByRole('button',{name:/同类分值/}).count(),0);
  await dialog().getByRole('button',{name:/考试类别/}).click();
  assert.deepEqual(await dialog().locator('.ios-analysis-options button b').allTextContents(),['地市卷（130题）','副省卷（135题）']);
  assert.deepEqual(await dialog().locator('.ios-analysis-options button small').allTextContents(),['3 次练习','1 次练习']);
  await shot('exam-categories-390.png');
  await dialog().getByRole('button',{name:/地市卷/}).click();
  await frame.locator('.ios-analysis-dimension').click();await dialog().getByRole('button',{name:'行测整体',exact:true}).click();
  assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),3);
  assert.equal(await plot().locator('circle').count(),3);
  assert.deepEqual(await frame.locator('.ios-analysis-records tbody tr td:nth-child(2)').allTextContents(),actualCategoryRecords.slice(0,3).map(record=>`${Number((record.report.totalCents/100).toFixed(2))} / 100`));
  await shot('all-city-records-390.png');
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();await dialog().getByRole('button',{name:/考试类别/}).click();await dialog().getByRole('button',{name:/副省卷/}).click();
  assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),1);
  await scene('category-empty');assert.equal(await frame.locator('.ios-analysis-records').count(),0);
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();await dialog().getByRole('button',{name:/考试类别/}).click();
  assert.equal(await dialog().getByRole('button',{name:/副省卷/}).getAttribute('aria-pressed'),'true');
  assert.ok((await dialog().getByRole('button',{name:/副省卷/}).innerText()).includes('0 次练习'));
  await shot('empty-province-stays-selected-390.png');
  await dialog().getByRole('button',{name:'关闭筛选',exact:true}).click();
  // 与报告完整分析相同的versionId调用，入口卷可见，但类别范围仍覆盖完整历史。
  await scene('report-anchor');assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),1);
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();
  assert.ok((await dialog().getByRole('button',{name:/来源套卷/}).innerText()).includes(actualCategoryRecords[0].paperTitle));
  await shot('report-anchor-visible-source-390.png');
  await dialog().getByRole('button',{name:/考试类别/}).click();
  assert.deepEqual(await dialog().locator('.ios-analysis-options button small').allTextContents(),['3 次练习','1 次练习']);
  await dialog().getByRole('button',{name:/副省卷/}).click();
  assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),1);
  assert.ok((await frame.locator('.ios-analysis-records').innerText()).includes(actualCategoryRecords[3].paperTitle));
  await frame.getByRole('button',{name:'筛选分析记录',exact:true}).click();
  assert.equal((await dialog().getByRole('button',{name:/来源套卷/}).innerText()).includes('全部套卷'),true);
  await dialog().getByRole('button',{name:/考试类别/}).click();await dialog().getByRole('button',{name:/地市卷/}).click();
  assert.equal(await frame.locator('.ios-analysis-records tbody tr').count(),3);
  assert.equal(await plot().locator('circle').count(),3);
  await shot('report-anchor-all-city-390.png');
  assert.deepEqual(errors,[]);
  assert.deepEqual(await inputHashes(),implementation,'Owned module sources changed during browser verification');
  await writeFile(path.join(evidence,'browser-validation.json'),JSON.stringify({fixture:'Isolated temporary /ios-v3/ iframe; fresh native analytics and results bundles; public bridge/vendor/port unchanged',runtime:{node:process.version,chromium:browser.version()},implementation,geometry,browserErrors:errors,checks:['first hidden without gap','second paired score papers without table or filters', 'all six subjects in paper order and zero/negative changes', 'missing subject metrics remain unavailable','third short real plot','actual correction refresh','no report technical text or timestamps','native metric Tabs and arrow keys','native BottomSheet lists','type and source filters','rule isolation and missing type','on-demand rule weights','date validation/inclusion/clear','Escape and focus return','all history pages','boundary pagination focus','tied timestamps and chart keyboard','record selection and report navigation','source list search','panel route cleanup','320/390/430/desktop iframe','legacy sample hidden','native result/share preservation','legacy result/share static status without manual scoring','pending poster static marker and actual PNG export']},null,2));
});
