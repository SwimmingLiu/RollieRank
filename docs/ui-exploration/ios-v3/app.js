const $=(s)=>document.querySelector(s);
// 手机所有页面和后续挂载的抽屉都使用同一原生短轨道。
import "../../../src/scrollbars.js";
import { prunePreviewHistory, recoverPreviewHistory } from "./preview-history.js";
import { selectPreviousAttempt } from "../../../src/analytics.js";
import { createPracticeTimer, createCustomPracticeTimer, bindPracticeTimer, setTimerMode, reorderTimerModules, balanceTimerModules, resolveTimerLimit, restorePracticeTimer, timerSectionsForQuestions, timerView, changeTimerPlan, startPracticeTimer, pausePracticeTimer, switchTimerModule, finishPracticeTimer, resumeEntryTimer, pauseEntryTimer, timingSummary, validateTimingSummary } from "../../../src/practice-timer.js";
// 页面与资源预览共享同一图标定义，避免重复维护造成线宽或造型漂移。
// The iframe may keep an older icon module cached across design revisions.
const {icons}=await import("./icon-data.js?v="+encodeURIComponent(new URLSearchParams(location.search).get("design")||"easy-lang-1114-v4"));
import {primarySectionScores, isJudgmentSection} from "./score-groups.js";
import {paperKey, latestAttempt, attemptTarget, saveAttempt, recentAttempts} from "./practice-model.js";
const {previewCatalog,periodsFor,papersFor,isInstitution,isPeriodNumber,isAvailablePeriod,collectionsFor,collectionFor}=await import("./catalog-data.js?v="+encodeURIComponent(new URLSearchParams(location.search).get("design")||"current"));
const I=(name)=>'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
const esc=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n2=n=>String(n).padStart(2,'0');
const TYPE_DATA=[['政治理论',1,20,50,15],['常识判断',21,35,50,12],['言语理解',36,65,80,24],['数量关系',66,75,100,5],['图形推理',76,85,80,7],['定义判断',86,95,80,7],['类比推理',96,100,80,4],['逻辑判断',101,110,85,4],['资料分析',111,130,100,17]];
const typeFor=n=>TYPE_DATA.find(t=>n>=t[1]&&n<=t[2]);
// Visible main sections group judgment questions without changing their per-question scoring weights.
const VIEW_TYPES=[];for(const [name,start,end] of TYPE_DATA){const label=isJudgmentSection(name)?'判断推理':name,last=VIEW_TYPES.at(-1);if(last?.[0]===label)last[2]=end;else VIEW_TYPES.push([label,start,end])}
const reference=Array.from({length:130},(_,i)=>'ABCD'[i%4]);
const sample=reference.map((v,i)=>{const t=typeFor(i+1);return i+1-t[1]<t[4]?v:'ABCD'[('ABCD'.indexOf(v)+1)%4]});
// 当前预览与已完成的服务共享真实答卷；旧版设计记录继续单独保留。
let serviceClient=null,iosFeatures=[],iosPositions=null,iosAnalytics=null,iosDiscussions=null,iosCorrections=null,serviceError='',featureGeneration=0;
const testSession=new URLSearchParams(location.search).get('session');
// 导航保留当前设计版本，避免刷新后沿用旧HTML外壳。
const designRevision=new URLSearchParams(location.search).get('design');
const storageName=['rollierank','ios','design','v3',testSession&&/^[a-z0-9-]{1,40}$/.test(testSession)?testSession:''].filter(Boolean).join(':');
const state={page:'home',paper:3,current:126,start:1,answers:Array(130).fill(''),drafts:{},history:[],institution:'四海',period:1,variant:'地市 / 执法',query:'',search:false,paperFilter:'all',recentIndex:0,report:[],detailFilter:'all',rankType:'总分',allTypes:false,saved:true,from:'home',saving:false,reportReturn:'papers',activeAttemptId:null,detailType:null,publisherPeriods:{},catalogPositions:{},recordsView:{query:'',filter:'all',scrollTop:0},entryMode:'list',reviewMarks:{},practiceTimers:{},submittedTiming:{},blankConsent:null,shareMode:'report'};
// 预览入口可回到同一份预置草稿，避免前一次验收完成后无法再体验续录。
const freshPreview=new URLSearchParams(location.search).has('fresh');
// 外部存储需校验完整选项数组；机构上下文随草稿恢复，旧草稿沿用默认元数据。
let restoredRecents=null,restoredHistory=null,hadStoredSession=false,restoredQuestion=null;
const validAnswers=a=>Array.isArray(a)&&a.length>0&&a.length<=300&&a.every(v=>['','A','B','C','D'].includes(v));
// Scope belongs to the draft model, independent of chart/renderer code removed in this redesign.
function scopeKey(n=state.paper){return paperKey({...state,paper:n})}
// Browsing a period never rewrites the active answer sheet; each institution retains its last selection.
// Collection selection is UI metadata; existing numeric preview keys remain stable, including separate city/province editions.
function changeScope(institution,period){const selected=isAvailablePeriod(institution,period)?period:periodsFor(institution)[0];state.institution=institution;state.period=selected;state.variant=collectionFor(institution,selected)?.variant||'';state.publisherPeriods[institution]=selected;state.paperFilter='all';writeStore()}

const validRecord=r=>r&&isInstitution(r.institution)&&isPeriodNumber(r.period)&&Number.isSafeInteger(r.paper)&&r.paper>=1&&validAnswers(r.answers)&&typeof r.complete==='boolean'&&(r.id===undefined||typeof r.id==='string');
try{
  const p=freshPreview?null:JSON.parse(localStorage.getItem(storageName)||'null');
  if(p&&validAnswers(p.answers)){
    hadStoredSession=true;state.answers=p.answers;state.activeAttemptId=typeof p.activeAttemptId==='string'?p.activeAttemptId:null;
    for(const name of Object.keys(previewCatalog))if(isAvailablePeriod(name,p.publisherPeriods?.[name]))state.publisherPeriods[name]=p.publisherPeriods[name];
    if(p.catalogPositions&&typeof p.catalogPositions==='object')for(const [key,value] of Object.entries(p.catalogPositions))if(Number.isFinite(value)&&value>=0)state.catalogPositions[key]=value;
    if(isInstitution(p.institution))state.institution=p.institution;
    if(isPeriodNumber(p.period))state.period=p.period;
    if(Number.isSafeInteger(p.paper)&&p.paper>=1)state.paper=p.paper;
    state.current=Number.isInteger(p.current)&&p.current>=1&&p.current<=state.answers.length?p.current:state.answers.findIndex(v=>!v)+1||Math.max(1,state.answers.length);
    state.entryMode=p.entryMode==='single'?'single':'list';
    restoredQuestion={attemptId:state.activeAttemptId,key:paperKey(state),current:state.current};
    if(p.reviewMarks&&typeof p.reviewMarks==='object')for(const [id,marks]of Object.entries(p.reviewMarks))if(Array.isArray(marks))state.reviewMarks[id]=[...new Set(marks.filter(n=>Number.isInteger(n)&&n>=1&&n<=300))];
    if(p.practiceTimers&&typeof p.practiceTimers==='object')for(const [id,raw]of Object.entries(p.practiceTimers)){const timer=restorePracticeTimer(raw);if(timer&&timer.attemptId===id)state.practiceTimers[id]=timer;}
    if(p.submittedTiming&&typeof p.submittedTiming==='object')for(const [id,raw]of Object.entries(p.submittedTiming)){try{state.submittedTiming[id]=validateTimingSummary(raw,{attemptId:id});}catch{/* Invalid optional timing leaves the answer sheet intact. */}}
    if(Array.isArray(p.recents)&&p.recents.length===3&&p.recents.every(validRecord))restoredRecents=p.recents;
    if(Array.isArray(p.history)&&p.history.every(validRecord))restoredHistory=p.history;
  }
}catch{}


const params=new URLSearchParams(location.search);
state.statsVersionId=params.get('version')||null;
if(['home','papers','entry','report','details','rank','me','share','stats','admin','discussion'].includes(params.get('page')))state.page=params.get('page');
if(isInstitution(params.get('institution'))){state.institution=params.get('institution');if(isAvailablePeriod(state.institution,Number(params.get('period'))))state.period=Number(params.get('period'));if(papersFor(state.institution,state.period).includes(Number(params.get('paper'))))state.paper=Number(params.get('paper'));}
const recordKey=paperKey;
function previewHistory(){
 const first=[{institution:'四海',period:1,paper:3,answers:Array(130).fill(''),complete:false},{institution:'四海',period:1,paper:1,answers:[...sample],complete:true},{institution:'超格',period:2,paper:2,answers:[...sample.slice(0,52),...Array(78).fill('')],complete:false}];
 const extra=[['四海',1,2,true],['超格',1,4,true],['四海',2,5,false],['超格',2,6,true],['四海',3,2,true],['超格',3,8,false],['四海',2,9,true],['超格',1,10,true],['四海',3,12,true]];
 return [...first,...extra.map(([institution,period,paper,complete],i)=>{const a=sample.map((v,n)=>n%23===i?reference[n]:v);const answered=complete?130:64+i*3;return {institution,period,paper,complete,answers:a.map((v,n)=>n<answered?v:'')}})];
}
// Legacy per-paper records gain stable attempt IDs without losing their saved choices.
// Older previews stored only the active answer sheet. Keep it discoverable as a draft during migration.
const legacyDraft=hadStoredSession&&state.answers.some(Boolean)?[{institution:state.institution,period:state.period,paper:state.paper,answers:[...state.answers],complete:false}]:[];
state.history=(restoredHistory||(hadStoredSession?restoredRecents||legacyDraft:[])).map((r,i)=>({...r,id:r.id||'legacy-'+recordKey(r)+'-'+i}));
// 已知设计样例迁到可恢复档案，页面只留下真实练习和用户改写过的草稿。
const previewExamples=previewHistory();
// A prior cleanup matched every completed legacy id; recover authored entries from its saved archive before matching exact seeds.
try{const archived=JSON.parse(localStorage.getItem(storageName+':preview-archive:v1')||'[]');if(Array.isArray(archived))state.history=recoverPreviewHistory(state.history,archived.filter(record=>validRecord(record)&&typeof record.id==='string'),previewExamples);}catch{/* An unreadable archive must not prevent existing practice records from opening. */}
const cleanedPreview=prunePreviewHistory(state.history,previewExamples);
if(cleanedPreview.removed.length){try{const key=storageName+':preview-archive:v1';const previous=JSON.parse(localStorage.getItem(key)||'[]');const all=new Map([...previous,...cleanedPreview.removed].map(record=>[record.id,record]));localStorage.setItem(key,JSON.stringify([...all.values()]));state.history=cleanedPreview.records;if(cleanedPreview.removed.some(record=>record.id===state.activeAttemptId)){state.activeAttemptId=null;state.answers=Array(state.answers.length||130).fill('');state.report=[];state.current=1;}}catch{/* 保留原记录，存储可用后再次迁移，不静默丢失内容。 */}}
if(params.has('empty')){state.history=[];state.activeAttemptId=null;state.answers=Array(130).fill('');}
state.recents=recentAttempts(state.history);
const requestedId=params.get('attempt')||state.activeAttemptId;
let initialRecord=state.history.find(r=>r.id===requestedId)||latestAttempt(state.history,state);
if(['report','details','rank','share','discussion'].includes(state.page)&&!initialRecord?.complete)initialRecord=state.history.find(r=>r.complete);
if(['report','details','rank','share','discussion'].includes(state.page)&&!initialRecord?.complete)state.page='home';
if(initialRecord){state.activeAttemptId=initialRecord.id;state.institution=initialRecord.institution;state.period=initialRecord.period;state.paper=initialRecord.paper;state.answers=[...initialRecord.answers];if(initialRecord.complete){state.report=[...initialRecord.answers];if(state.page==='entry')state.page='report';}}
if(params.get('page')==='papers'&&isInstitution(params.get('institution'))){state.institution=params.get('institution');state.period=isAvailablePeriod(state.institution,Number(params.get('period')))?Number(params.get('period')):state.publisherPeriods[state.institution]||1;}
for(const r of [...state.history].reverse())state.drafts[recordKey(r)]=[...r.answers];
const count=()=>state.answers.filter(Boolean).length;
const pct=n=>Math.round(n*100)+'%';
function legacyScore(a=state.report){const rows=a.map((v,i)=>({n:i+1,answer:v,ref:reference[i],type:typeFor(i+1)[0],cents:v===reference[i]?typeFor(i+1)[3]:0,status:!v?'blank':v===reference[i]?'correct':'wrong'}));return {rows,cents:rows.reduce((s,r)=>s+r.cents,0),correct:rows.filter(r=>r.status==='correct').length,wrong:rows.filter(r=>r.status==='wrong').length,blank:rows.filter(r=>r.status==='blank').length,types:TYPE_DATA.map(t=>{const r=rows.slice(t[1]-1,t[2]);const earned=r.reduce((s,q)=>s+q.cents,0);return {name:t[0],rate:earned/((t[2]-t[1]+1)*t[3]),earned,max:(t[2]-t[1]+1)*t[3]}})}}
function writeStore(){try{localStorage.setItem(storageName,JSON.stringify({answers:state.answers,institution:state.institution,period:state.period,paper:state.paper,activeAttemptId:state.activeAttemptId,recents:state.recents,history:state.history,publisherPeriods:state.publisherPeriods,catalogPositions:state.catalogPositions,current:state.current,entryMode:state.entryMode,reviewMarks:state.reviewMarks,practiceTimers:state.practiceTimers,submittedTiming:state.submittedTiming}));state.saved=true}catch{state.saved=false}}
function persist(complete=false){
 const current={id:state.activeAttemptId||(state.activeAttemptId=crypto.randomUUID()),marks:[...currentMarks()],institution:state.institution,period:state.period,paper:state.paper,answers:[...state.answers],complete,updatedAt:serviceClient?.currentAttempt()?.createdAt||Date.now(),...(serviceClient?.currentVersion()?{versionId:serviceClient.currentVersion().id}:{}),...(complete&&serviceClient?.currentAttempt()?{serviceBacked:true}:{})};
 state.history=saveAttempt(state.history,current);state.recents=recentAttempts(state.history);state.recentIndex=Math.max(0,state.recents.findIndex(r=>r.id===current.id));state.drafts[scopeKey()]=[...state.answers];writeStore();
}
// 空结果可沿用同一按钮外观并禁用动作，避免复制空内容后显示成功。
function button(action,label,cls='icon-button',name='',disabled=false){return '<button class="'+cls+'" data-action="'+action+'"'+(name?' aria-label="'+esc(name)+'" title="'+esc(name)+'"':'')+(disabled?' disabled':'')+'>'+label+'</button>'}
// 模态与焦点交由官方 BottomSheet；业务只提供本地内容与操作，保持原来的委托入口。
let sheetState={open:false,title:'',html:''};
const sheetCloseListeners=new Set();
// Portal 内容在提交后才出现；业务组件在该次内容就绪时挂载，避免挂到已经关闭的弹层。
function drawSheet(){window.RollieUI.mountSheet($('#sheet-host'),{...sheetState,onClose:()=>closeSheet('dismiss'),onContentReady:el=>{window.RollieUI.mountButtons(el);if(sheetState.open)sheetState.onReady?.(el)}})}
function openSheet(title,body,onReady){const old=$('#sheet-content');if(old)window.RollieUI?.cleanup(old);sheetState={open:true,title,html:body,onReady};drawSheet()}
// 关闭动作区分用户取消与业务完成，避免取消选岗后意外提交，并释放交流编辑器的录音。
function closeSheet(reason='dismiss'){const wasOpen=sheetState.open,old=$('#sheet-content');if(old)window.RollieUI?.cleanup(old);sheetState={...sheetState,open:false};drawSheet();if(wasOpen)for(const listener of sheetCloseListeners)listener({reason});if(wasOpen&&state.page==='home'){mountHomeDashboard();requestAnimationFrame(()=>{if(state.page==='home')$('.rr-home-timer button')?.focus({preventScroll:true})})}}
function toast(message){$('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;$('#app').append(el);setTimeout(()=>el.remove(),1600)}
// 相同卷身份只维护一处格式；短标识保留机构、年份、期号、卷型与套号。
const brandLogo='assets/brand/rollierank-logo-transparent.png';
// Publisher labels are visual aliases; saved institution keys stay stable across the rename.
const publisherName=id=>window.RollieUI.publisherName(id);
const publisherLogo=()=>window.RollieUI.publisherIcon(state.institution);
// Full identity follows the selected collection, so named series never acquire a fabricated period.
const paperLabel=()=>{const c=collectionFor(state.institution,state.period);return publisherName(state.institution)+' · '+(c?c.meta+(c.displayPeriod?'':' · '+c.title):'2026年 · '+n2(state.period)+'期')+' · '+(c?.paperNames?.[state.paper]||'行测'+n2(state.paper)+'套')};
function paperIdentity(){return '<span class="paper-identity"><img src="'+publisherLogo()+'" alt=""><span>'+esc(paperLabel())+'</span></span>'}
// 录答只需卷身份和完成数；题量直接来自当前答卷，省去重复计数行与信息按钮。
function paperInfoBar(){return '<div class="identity">'+paperIdentity()+'<span class="entry-count num" id="answer-count" role="status" aria-live="polite" aria-label="已填 '+count()+' 题，共 '+questionCount()+' 题">'+count()+'<small> / '+questionCount()+'</small></span></div>'}
// 草稿同样保留真实题量，135题不能退回列表默认的130题。
function recordViewModel(r){const c=collectionFor(r.institution,r.period),matches=state.history.filter(other=>recordKey(other)===recordKey(r));return {id:r.id,...(matches.length>1?{attemptNumber:matches.length-matches.findIndex(other=>other.id===r.id)}:{}),year:c?.year||2026,institution:r.institution,period:c?.displayPeriod||r.period,paper:r.paper,...(c&&!c.displayPeriod?{editionLabel:c.title}:{}),...(c?.variant?{variantLabel:c.variant}:{}),...(c?.paperNames?.[r.paper]?{paperTitle:c.paperNames[r.paper]}:{}),answered:r.answers.filter(Boolean).length,totalQuestions:r.answers.length,complete:!!r.complete,...(r.updatedAt?{updatedAt:r.updatedAt}:{}),...(r.complete?{score:score(r.answers,r).cents/100,totalQuestions:r.answers.length,serviceBacked:!!serviceClient?.forRecord(r)}:{})}}
// 空白准备不算练习进度；首次先选卷，有真实答案后再显示继续练习。
function recentViewModels(){return state.recents.filter(record=>record.complete||record.answers.some(Boolean)).map(recordViewModel)}
// 四种分享读取当前同一份服务端快照；用时和VS只在真实记录具备依据时加入。
// Named series retain their actual period and variant, rather than the gallery's shortened marketing label.
function shareProps(){const result=score(),c=collectionFor(state.institution,state.period),version=serviceClient?.currentVersion(),standing=iosPositions?.standing?.()||{rank:null,count:0},attempt=serviceClient?.currentAttempt(),previous=attempt?selectPreviousAttempt(attempt,serviceClient.state().attempts):null;return {logoSrc:brandLogo,publisherLogoSrc:publisherLogo(),institution:state.institution,year:c?.year||2026,period:c?.displayPeriod||state.period,paper:state.paper,...(c?{collectionLabel:c.displayPeriod?c.meta.replace(/^\d{4} /,''):[version?.period,version?.variant].filter(Boolean).join(' · ')||c.title}:{}),...(c?.paperNames?.[state.paper]?{paperTitle:c.paperNames[state.paper]}:{}),total:result.cents/100,maxScore:(result.maxCents||10000)/100,verification:scoreVerification(),correct:result.correct,wrong:result.wrong,blank:result.blank,...(attempt?.timing?{timing:attempt.timing}:{}),...(previous?{comparison:{previousScore:previous.report.totalCents/100,currentScore:attempt.report.totalCents/100}}:{}),rank:standing.rank,participants:standing.count,sections:result.types.map(t=>({name:t.name,earnedCents:t.earned,maxCents:t.max}))}}
function mountSharePreview(host){window.RollieUI.mountShareStudio(host,{...shareProps(),mode:state.shareMode,onModeChange:mode=>{state.shareMode=mode;mountSharePreview(host)}})}


function track(value){return '<div class="track"><i style="width:'+Math.max(0,Math.min(100,value*100))+'%"></i></div>'}
function tabs(){return '<nav class="tabbar" aria-label="底部导航">'+[['home','papers','首页'],['me','review','练习记录']].map(([p,i,label])=>'<button data-root="'+p+'" class="'+((state.page===p||(p==='home'&&state.page==='papers')||(p==='me'&&['stats','admin'].includes(state.page)))?'selected':'')+'" aria-current="'+((state.page===p||(p==='home'&&state.page==='papers')||(p==='me'&&['stats','admin'].includes(state.page)))?'page':'false')+'">'+I(i)+label+'</button>').join('')+'</nav>'}
function top(){
  window.RollieUI?.cleanup($('#top'));window.RollieUI?.cleanup($('#bottom'));
  const deep=['papers','entry','report','details','share','stats','admin','discussion'].includes(state.page);
  const title={home:'',papers:publisherName(state.institution)+'套卷',entry:'录答案',report:'练习估分',details:state.detailFilter==='marked'?'待检查':state.detailFilter==='wrong'?'错题复盘':'逐题对照',rank:'',me:'练习记录',share:'成绩分享',stats:'成长分析',admin:'反馈审核',discussion:'本卷交流'}[state.page];
  $('#top').classList.toggle('publisher-top',['home','rank'].includes(state.page));
  // The review header is a single navigation row; its removed identity and info controls add no replacement strip.
  $('#top').classList.remove('paper-top');
  const heading=title?'<h1>'+title+'</h1>':'<span></span>';
  $('#top').innerHTML=(deep?button('back',I('back'),'icon-button','返回'):'<span></span>')+heading+(state.page==='report'?button('restart',I('restart'),'icon-button','重新练习本卷'):state.page==='details'?button('answer-feedback','反馈','icon-button rr-detail-feedback','反馈参考答案',!serviceClient?.currentAttempt()):'<span></span>');
  // 未填满时主动作指向补录，填满后才表达估分；缺题弹层仍说明具体数量和位置。
  $('#bottom').style.display=['rank','discussion'].includes(state.page)?'none':'';
  $('#bottom').innerHTML=state.page==='entry'?'<div class="entry-footer">'+button('grid',I('grid'),'icon-button','答题卡')+button('confirm',count()<questionCount()?'交卷 · 未答 '+(questionCount()-count()):'提交估分','primary')+'</div>':state.page==='report'?'<div class="row-actions">'+button('details',I('review')+(score().wrong?'复盘错题 '+score().wrong:'查看答卷'),'primary')+'<span class="rr-report-comment-host">'+(iosDiscussions?.reportEntryView?.('compact')||'')+'</span>'+button('share',I('share'),'icon-button','分享成绩')+'</div>':state.page==='share'?'<div class="row-actions">'+button('save-poster',I('download')+'保存海报','primary')+button('invite',I('share')+'邀请好友','secondary','邀请同卷好友')+'</div>':state.page==='details'?'<div class="row-actions">'+button('copy-wrong','复制错题号','primary','',reviewRows().every(q=>q.status!=='wrong'))+'</div>':tabs();
}
// 卷目需要扫描状态；列表合并共同规格，避免重复封面占满手机首屏。
// 名称承载唯一套号，年份期数作为完整身份保留；状态与右侧操作对齐支持逐行扫视。
// 年份/期号常驻于卷组，行内套号只写一次；未开始与已录进度保持可辨。
// Paper list, recents and history derive their action from the same submitted/draft state.
// Covers show their unique identity/state; repeated exam specifications live once in the period header.
function paperViewModels(){const c=collectionFor(state.institution,state.period);return papersFor(state.institution,state.period).map(number=>{const name=c?.paperNames?.[number];const r=latestAttempt(state.history,{...state,paper:number}),answered=r?.answers.filter(Boolean).length||0;return r?.complete?{number,name,status:'complete',score:score(r.answers,r).cents/100}:answered?{number,name,status:'draft',answered,totalQuestions:serviceBindings?.versionForScope(serviceClient.catalog(),{institution:state.institution,period:state.period,paper:number})?.questionCount||r?.answers.length||130}:{number,name,status:'new'}})}
// 首页仅选择出版机构，套卷与期数进入机构后再呈现。
// 三张近期练习以竖向叠卡呈现；仅当前卡可点击，手势与上下键负责翻页。
// 首页用真实 beUI 组件承接手势；业务状态留在当前模块，避免组件重复维护答题草稿。
// 计时状态改变后只更新首页组件，保持当前面板与答案不受整页重挂载影响。
function mountHomeDashboard(host=$('#home-ui')){const ui=window.RollieUI;if(!host||!ui)return;ui.mountHome(host,{timer:homeTimerModel(),onTimer:openHomeTimer,recents:recentViewModels(),initialIndex:state.recentIndex,onIndexChange:index=>{state.recentIndex=index},onOpen:openRecent,onPublisher:name=>{changeScope(name,state.publisherPeriods[name]||1);go('papers')},logoSrc:brandLogo,publishers:ui.publishers})}
function home(){return '<div id="home-ui" class="home-mount"></div>'}
function papers(){return '<div id="catalog-ui"></div>'}
// 全卷一次渲染，选中时只更新对应行；保留用户滚动位置和完整题目访问能力。
// 完成数移至卷名右侧；自动保存仅在失败时呈现必要反馈。
// 存疑使用可见短标签，手机触屏无需依赖书签悬浮提示来理解用途。
function entry(){
 const body=viewTypes().map(t=>'<section class="answer-section" data-start="'+t[1]+'" data-end="'+t[2]+'" aria-label="'+t[0]+'"><div class="type-heading"><b>'+t[0]+'</b><span>'+t[1]+'–'+t[2]+'</span></div>'+Array.from({length:t[2]-t[1]+1},(_,i)=>t[1]+i).map(n=>'<div id="question-'+n+'" class="answer-row '+(n===state.current?'current':'')+'" role="group" aria-label="第 '+n+' 题'+(n===state.current?'，当前题':'')+'"><strong class="num">'+n+'</strong>'+['A','B','C','D'].map(o=>'<button class="choice '+(state.answers[n-1]===o?'selected':'')+'" data-n="'+n+'" data-option="'+o+'" aria-label="第 '+n+' 题，选 '+o+'" aria-pressed="'+(state.answers[n-1]===o)+'">'+o+'</button>').join('')+'<button class="entry-mark-button '+(currentMarks().includes(n)?'is-marked':'')+'" data-mark="'+n+'" aria-label="'+(currentMarks().includes(n)?'取消存疑':'存疑')+'第 '+n+' 题" title="存疑的题可从待检查集中回看"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg><span class="entry-mark-label">'+(currentMarks().includes(n)?'已存疑':'存疑')+'</span></button></div>').join('')+'</section>').join('');
 return '<div class="entry-sticky">'+paperInfoBar()+'<div id="entry-tools-ui"></div><div class="entry-progress"><div id="save-state" role="alert"'+(state.saved?' hidden':'')+'>'+(state.saved?'':I('info')+'保存失败，请重试')+'</div><div id="answer-progress">'+track(count()/questionCount())+'</div></div></div><div id="single-answer-ui"></div><div class="answer-content">'+body+'</div>';
}
// 成绩参考的弧形刻度只编码总分，次要计数在同一区域，避免分数和百分比反复占主视觉。
function report(){return '<div id="score-ui"></div>'}
// 130题对照用常驻列头标明答案归属，替代每行重复的微小标签；筛选后列关系保持一致。
// 连续题型用一个常驻组标题表达，避免130行反复写同一专业板块。
// Replacing the native table must retain the selected mature Tab as the keyboard target.
function refreshReview(){render();$('.view').scrollTop=0;$('#detail-tabs [role=tab][aria-selected=true]')?.focus({preventScroll:true});rememberRoute()}
const matchesReviewType=(question,type)=>!type||(type==='判断推理'?isJudgmentSection(question.type):question.type===type);
function reviewRows(){return score().rows.filter(q=>matchesReviewType(q,state.detailType))}
// Uncertain answers remain reviewable after submission; section titles are real jump controls, not inert labels.
function details(){
 const marks=new Set(currentMarks()),scoped=reviewRows(),filtered=scoped.filter(q=>state.detailFilter==='all'||(state.detailFilter==='marked'?marks.has(q.n):q.status===state.detailFilter));
 const groups=viewTypes().map(t=>({name:t[0],rows:filtered.filter(q=>matchesReviewType(q,t[0]))})).filter(g=>g.rows.length);
 const picker='<div class="rr-detail-toolbar">'+button('review-sections',esc(state.detailType||'全部板块')+I('back'),'rr-detail-section-button','选择复盘板块')+'</div>';
 const body=groups.map(g=>'<tbody aria-label="'+g.name+'"><tr class="detail-type-row"><th colspan="5" scope="rowgroup">'+button('review-sections',esc(g.name)+I('back'),'rr-detail-section-button','切换复盘板块，当前'+g.name)+'</th></tr>'+g.rows.map(q=>'<tr class="detail-answer-row '+(marks.has(q.n)?'is-marked':'')+'" aria-label="第'+q.n+'题，'+q.type+'"><th scope="row" class="num">'+n2(q.n)+'</th><td class="detail-answer '+(q.status==='wrong'?'wrong':'')+'">'+(q.answer||'—')+'</td><td class="detail-answer correct">'+q.ref+'</td><td class="detail-result '+(q.status==='correct'?'correct':'wrong')+'" aria-label="'+(q.status==='correct'?'正确':'错误')+'">'+I(q.status==='correct'?'check':'error')+'</td><td class="detail-stat" data-insight-row="'+q.n+'">—</td></tr>').join('')+'</tbody>').join('');
 return picker+'<div id="detail-tabs" class="detail-tabs segmented"></div><table class="detail-table" aria-label="逐题答案对照"><colgroup><col class="detail-number-col"><col class="detail-answer-col"><col class="detail-answer-col"><col class="detail-result-col"><col class="detail-stat-col"></colgroup><thead><tr><th scope="col">题号</th><th scope="col">我的</th><th scope="col">参考</th><th scope="col">结果</th><th scope="col">答对率</th></tr></thead>'+body+(groups.length?'':'<tbody><tr><td colspan="5" class="detail-empty">'+(state.detailFilter==='marked'?'没有待检查题':state.detailFilter==='wrong'?'这里没有错题':'暂无题目')+'</td></tr></tbody>')+'</table>';
}
function reviewSectionPicker(){
 const types=[{name:'全部板块',value:''},...viewTypes().map(type=>({name:type[0],value:type[0]}))];
 openSheet('选择复盘板块','<div class="rr-review-sections">'+types.map(type=>'<button type="button" class="rr-review-section '+((state.detailType||'')===type.value?'is-selected':'')+'" data-review-section="'+esc(type.value)+'" aria-label="复盘'+esc(type.name)+'"><span>'+esc(type.name)+'</span>'+I((state.detailType||'')===type.value?'check':'arrow')+'</button>').join('')+'</div>');
}
// 按用户选定的榜单参考重组为领奖台和分值列表，3D高度只表达名次，准确分数始终以文字显示。
// The complete ranking, dimension controls and podium are now one typed component root.
function rank(){return iosPositions?.rankView?.()||'<div id="rank-ui"></div>'}
function discussion(){return iosDiscussions?.discussionView?.()||'<p class="empty">暂时无法读取本卷交流。</p>'}
function me(){return '<div id="records-ui"></div><div data-feature="corrections-user" class="ios-feature-host"></div>'}
function stats(){return '<div class="ios-feature-host ios-feature-page">'+(iosAnalytics?.statsView?.({state:serviceClient.state(),catalog:serviceClient.catalog(),versionId:state.statsVersionId||undefined})||'<p class="empty">请连接练习服务后查看成长分析。</p>')+'</div>'}
function admin(){return '<div class="ios-feature-host ios-feature-page">'+(iosCorrections?.adminView?.()||'<div data-feature="corrections-admin"></div><div data-feature="positions-admin"></div>')+'</div>'}

// 分享页以完整练习身份和总分建立传播焦点，板块分值与页面报告共用同一数据源。
function share(){return '<div id="share-ui"></div>'}
// Rasterize the same static React score sheet that users see; fonts, identity and all nine
// sections stay in one UI composition rather than a separate hand-drawn canvas implementation.
async function posterBlob(mode=state.shareMode){
  const dataUrl=await window.RollieUI.createModeSharePoster(shareProps(),mode);
  $('#poster-output')?.remove();const output=document.createElement('img');output.id='poster-output';output.hidden=true;output.alt='生成的成绩海报';output.src=dataUrl;$('.view[data-page="share"]')?.append(output);
  return (await fetch(dataUrl)).blob();
}
let posterSaving=false;
async function savePoster(){
  // Async rendering may finish after navigation; keep the filename tied to the captured answer sheet.
  if(posterSaving)return;posterSaving=true;const filenameLabel=paperLabel(),mode=state.shareMode,b=$('[data-action="save-poster"]');setActionButton(b,'生成中',true);
  try{const blob=await posterBlob(mode);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='卷卷小榜-'+filenameLabel.replace(/[· /]/g,'-')+'-'+mode+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('成绩海报已生成')}
  catch(error){console.error('Score poster export failed',error);toast('海报生成失败，请重试')}
  finally{posterSaving=false;if(b&&!window.RollieUI.updateButton(b,{labelHtml:I('download')+'保存海报',disabled:false})){b.innerHTML=I('download')+'保存海报';b.disabled=false}}
}

// 原生宿主提供业务回调，beUI只拥有局部控件状态与动画，计分和草稿仍共享一个来源。
function setActionButton(b,label,disabled){if(!b)return;if(window.RollieUI?.updateButton(b,{labelHtml:esc(label),...(disabled===undefined?{}:{disabled})}))return;b.innerHTML=esc(label);if(disabled!==undefined)b.disabled=disabled}
// 领奖台仍由原 beUI 组件渲染，所有人数和分数改由真实服务提供。
function updateRank(){iosPositions?.mountRank?.()}
function mountInterfaces(root){
  const ui=window.RollieUI;if(!ui){const home=root.querySelector('#home-ui');if(home)home.innerHTML='<p class="empty">组件未能加载，请刷新页面</p>';return}
  const home=root.querySelector('#home-ui');if(home)mountHomeDashboard(home);
  const catalog=root.querySelector('#catalog-ui');if(catalog)ui.mountCatalog(catalog,{institution:state.institution,year:collectionFor(state.institution,state.period)?.year||2026,period:state.period,variant:state.variant,canSwitch:collectionsFor(state.institution).length>1,collectionTitle:(collectionFor(state.institution,state.period)?.displayPeriod?collectionFor(state.institution,state.period).meta:collectionFor(state.institution,state.period)?.title)||'行测套卷',collectionMeta:collectionFor(state.institution,state.period)?.displayPeriod?'':collectionFor(state.institution,state.period)?.meta||'',papers:paperViewModels(),onPeriods:()=>actions.periods(),onOpen:openPaper});
  const records=root.querySelector('#records-ui');if(records)ui.mountRecords(records,{records:state.history.map(recordViewModel),onOpen:openHistory,viewState:state.recordsView,onViewStateChange:value=>{state.recordsView=value},user:{name:serviceClient?.state().profile?.name||'卷友',avatarSrc:'assets/avatars/rank-8.svg'}});
  const result=score(),standing=iosPositions?.standing?.()||{rank:null,count:0};const scoreHost=root.querySelector('#score-ui');if(scoreHost)ui.mountScore(scoreHost,{total:result.cents/100,maxScore:(result.maxCents||10000)/100,verification:scoreVerification(),correct:result.correct,wrong:result.wrong,blank:result.blank,rank:standing.rank,participants:standing.count,sections:result.types.map(t=>({name:t.name,earnedCents:t.earned,maxCents:t.max})),initialAll:state.allTypes,onAllChange:all=>{state.allTypes=all},onRank:()=>go('rank'),onReview:openReview});
  if(scoreHost){const timing=serviceClient?.currentAttempt()?.timing,card=scoreHost.querySelector('.rr3-report > div');if(timing&&card&&ui.mountTimingReport){const host=document.createElement('div');host.className='rr-session-report-host';card.after(host);ui.mountTimingReport(host,{timing});}}
  if(root.querySelector('#entry-tools-ui')){mountEntryTools();updateEntryVisibility();}
  const shareHost=root.querySelector('#share-ui');if(shareHost)mountSharePreview(shareHost);
  const detail=root.querySelector('#detail-tabs');if(detail)ui.mountTabs(detail,{value:state.detailFilter,items:[{value:'wrong',label:'错题 '+reviewRows().filter(q=>q.status==='wrong').length},{value:'all',label:'全部 '+reviewRows().length},{value:'marked',label:'待检查 '+reviewRows().filter(q=>currentMarks().includes(q.n)).length}],variant:'segment',className:'rr-detail-tabs',indicatorClassName:'rr-tab-highlight',onChange:value=>{state.detailFilter=value;refreshReview()}});
  if(root.querySelector('#rank-ui'))updateRank();
  ui.mountButtons($('#top'));ui.mountButtons($('#bottom'));ui.mountButtons(root);root.dataset.components='ready';
}

// 同一份服务端报告供原生纸卡、讨论、榜单与分析使用，避免两套计分来源。
let serviceBindings=null;
function mountPracticeTools(){
 const host=$('#practice-tools-ui'),ui=window.RollieUI;if(!host||!ui?.mountPracticeTools)return;
 const snapshot=iosPositions?.snapshot?.(),job=snapshot?.profile?.position;
 const position=job?{kind:'selected',title:job.title,department:job.department}:snapshot?.profileError?{kind:'error'}:snapshot?.profileLoaded?{kind:'unselected'}:{kind:'loading'};
 ui.mountPracticeTools(host,{position,attemptCount:serviceClient?.state().attempts.filter(attempt=>!attempt.isSample).length||0,onPosition:()=>iosPositions?.openPicker?.(),onAnalysis:()=>navigateFeature('stats')});
}
function questionCount(){return serviceClient?.currentVersion()?.questionCount||state.answers.length||130}
function viewTypes(){
  const version=serviceClient?.currentVersion();if(!version)return VIEW_TYPES;
  const result=[];for(const question of version.questions){const name=isJudgmentSection(question.type)?'判断推理':question.type,last=result.at(-1);if(last?.[0]===name&&last[2]+1===question.number)last[2]=question.number;else result.push([name,question.number,question.number])}return result;
}
// 计时与复查按练习凭证隔离，不从提交时间或其他套卷的草稿推测。
function currentMarks(){return state.reviewMarks[state.activeAttemptId]||[]}
function currentTimer(){return state.practiceTimers[state.activeAttemptId]||null}
function timerSections(){const version=serviceClient?.currentVersion();return version?timerSectionsForQuestions(version.questions):viewTypes().map(([name,start,end])=>({id:'section-'+start,name,start,end}))}
function pauseCurrentEntry(){const timer=currentTimer();if(timer){state.practiceTimers[state.activeAttemptId]=pauseEntryTimer(timer);writeStore()}}
function resumeCurrentEntry(){const timer=currentTimer();if(timer&&!serviceClient?.currentAttempt()){state.practiceTimers[state.activeAttemptId]=resumeEntryTimer(timer);writeStore()}}
function freezeCurrentTiming(){const id=state.activeAttemptId;if(state.submittedTiming[id])return;pauseCurrentEntry();const timing=timingSummary(currentTimer());if(timing){state.submittedTiming[id]=timing;writeStore()}}
function mountEntryTools(){const host=$('#entry-tools-ui'),ui=window.RollieUI;if(!host||!ui?.mountEntryTools)return;ui.mountEntryTools(host,{mode:state.entryMode,sections:viewTypes().map(([name,start,end])=>({name,start,end})),answers:state.answers,current:state.current,marks:currentMarks(),onMode:mode=>{state.entryMode=mode;writeStore();mountEntryTools();updateEntryVisibility();scrollToQuestion(state.current,true)},onJump:jumpToAnswer})}
function updateEntryVisibility(){
 const single=state.entryMode==='single',locked=['running','paused'].includes(currentTimer()?.status),content=$('.answer-content'),host=$('#single-answer-ui');if(content)content.hidden=single;if(host){host.hidden=!single;if(single)window.RollieUI.mountSingleAnswer(host,{question:state.current,total:questionCount(),section:viewTypes().find(t=>state.current>=t[1]&&state.current<=t[2])?.[0]||'',answer:state.answers[state.current-1]||'',marked:currentMarks().includes(state.current),onAnswer:option=>recordAnswer(state.current,option),onJump:jumpToAnswer,onMark:()=>toggleReviewMark(state.current)})}
 for(const section of document.querySelectorAll('.answer-section'))section.hidden=single&&!(state.current>=Number(section.dataset.start)&&state.current<=Number(section.dataset.end));
 for(const row of document.querySelectorAll('.answer-row')){const n=Number(row.id.slice(9)),marked=currentMarks().includes(n);row.hidden=single&&n!==state.current;row.classList.toggle('is-review-marked',marked);const mark=row.querySelector('[data-mark]');if(mark){mark.classList.toggle('is-marked',marked);mark.setAttribute('aria-label',(marked?'取消存疑':'存疑')+'第 '+n+' 题');mark.dataset.marked=String(marked);mark.setAttribute('aria-pressed',String(marked));const label=mark.querySelector('.entry-mark-label');if(label)label.textContent=marked?'已存疑':'存疑'}for(const option of row.querySelectorAll('[data-option]'))if(option.disabled!==locked){if(!window.RollieUI?.updateButton(option,{disabled:locked}))option.disabled=locked;}}
}
// A first mark can precede the first answer on a direct route; create its stable draft identity before indexing marks.
function toggleReviewMark(n){if(!state.activeAttemptId)state.activeAttemptId=crypto.randomUUID();const marks=new Set(currentMarks());if(marks.has(n))marks.delete(n);else marks.add(n);state.reviewMarks[state.activeAttemptId]=[...marks].sort((a,b)=>a-b);persist();mountEntryTools();updateEntryVisibility()}
function paintPracticeTimer(){const host=$('#practice-timer-ui'),timer=currentTimer(),ui=window.RollieUI;if(!host||!timer||!ui?.mountPracticeTimer)return;
 const update=next=>{state.practiceTimers[state.activeAttemptId]=next;writeStore();updateEntryVisibility();paintPracticeTimer()};
 ui.mountPracticeTimer(host,{model:timerView(timer),paperLabel:timer.origin==='paper'?paperLabel():undefined,onSource:source=>source==='paper'?beginPaperTimer():beginCustomTimer(),onChoosePaper:()=>openTimerSelection(),onPlan:(minutes,moduleId)=>{try{update(changeTimerPlan(currentTimer(),{minutes,moduleId}))}catch(error){toast(error.message)}},onMode:mode=>update(setTimerMode(currentTimer(),mode)),onReorder:ids=>update(reorderTimerModules(currentTimer(),ids)),onBalance:()=>update(balanceTimerModules(currentTimer())),onStart:()=>{try{update(startPracticeTimer(currentTimer()))}catch(error){toast(error.message)}},onPause:()=>update(pausePracticeTimer(currentTimer())),onModule:id=>update(switchTimerModule(currentTimer(),id)),onAssociate:timer.origin==='custom'&&!timer.versionId?()=>openTimerSelection(currentTimer()):undefined,onFinish:()=>{try{update(finishPracticeTimer(currentTimer()));if(currentTimer().origin==='custom'&&!currentTimer().versionId)return;closeSheet('complete');if(state.page!=='entry')go('entry',{refresh:true});else{resumeCurrentEntry();updateEntry();requestAnimationFrame(()=>scrollToQuestion(state.current,true))}}catch(error){toast(error.message)}}});
}
function showPracticeTimer(){
 if(serviceClient?.currentAttempt()){toast('请新建一次练习后计时');return;}
 if(!/^[\w-]{10,80}$/.test(state.activeAttemptId||'')){const marks=currentMarks();state.activeAttemptId=crypto.randomUUID();state.reviewMarks[state.activeAttemptId]=[...marks];persist();}
 if(!currentTimer()||(currentTimer().schema===1&&currentTimer().status==='ready')){const version=serviceClient?.currentVersion();if(!version){toast('请先选择已发布套卷');return;}state.practiceTimers[state.activeAttemptId]=createPracticeTimer({attemptId:state.activeAttemptId,versionId:version.id,sections:timerSections(),limit:resolveTimerLimit(version)});writeStore()}
 if(currentTimer().status==='finished'&&currentTimer().origin!=='custom'){toast('做题计时已结束，录答时间单独记录');return;}
 openSheet('做题计时','<div id="practice-timer-ui" class="rr-session-sheet"></div>',paintPracticeTimer);
}
// 首页计时独立于录答入口；先选真实套卷，再分配计划，已有进行中会话可以直接继续。
function activeHomeTimer(){const submitted=new Set(serviceClient?.state().attempts.map(item=>item.id)||[]);const timers=Object.values(state.practiceTimers).filter(timer=>!submitted.has(timer.attemptId)&&(['running','paused'].includes(timer.status)));return [...timers].reverse().find(timer=>timer.status==='running')||[...timers].reverse().find(timer=>timer.status==='paused')||timers.at(-1)||null}
function homeTimerModel(){const timer=activeHomeTimer();return {...(timer?timerView(timer):{status:'ready',plannedMs:120*60000,actualMs:0}),measuredAt:Date.now()}}
// 来源往返恢复刚选套卷的分钟与顺序；首页新建仍从机构选择开始，避免自动预选。
function beginPaperTimer(){
 const submitted=new Set(serviceClient?.state().attempts.map(item=>item.id)||[]),timer=Object.values(state.practiceTimers).reverse().find(item=>item.schema===2&&item.origin==='paper'&&item.status==='ready'&&!submitted.has(item.attemptId)),version=serviceClient?.catalog().find(item=>item.id===timer?.versionId);
 if(!timer||!version){openTimerSelection();return;}
 pauseCurrentEntry();const record=state.history.find(item=>item.id===timer.attemptId);Object.assign(state,serviceBindings.scopeForVersion(version));state.activeAttemptId=timer.attemptId;state.answers=record?[...record.answers]:Array(version.questionCount).fill('');state.current=Math.min(state.current,state.answers.length)||1;persist();showPracticeTimer();
}
// 显式选择自定义时才恢复其未开始的配置；新建入口不会替用户预选试卷。
function beginCustomTimer(){pauseCurrentEntry();const ready=Object.values(state.practiceTimers).reverse().find(timer=>timer.schema===2&&timer.origin==='custom'&&!timer.versionId&&timer.status==='ready');state.activeAttemptId=ready?.attemptId||crypto.randomUUID();if(!ready)state.practiceTimers[state.activeAttemptId]=createCustomPracticeTimer({sessionId:state.activeAttemptId});writeStore();showPracticeTimer();}
// 选卷根层左滑关闭面板；子层返回由选择器按实际层级处理。
function openTimerSelection(associate=null){
 const versions=serviceClient?.catalog().filter(version=>version.status==='published')||[];
 if(!versions.length){toast('请稍后重试，套卷正在读取');return;}
 openSheet(associate?'关联计时套卷':'做题计时','<div id="timer-paper-picker-ui"></div>',content=>{const host=content.querySelector('#timer-paper-picker-ui');if(host)window.RollieUI.mountTimerPaperPicker(host,{papers:versions.map(version=>({id:version.id,institution:version.institution,title:version.title,project:version.project||'',period:version.period||'',variant:version.variant||'',questionCount:version.questionCount,number:version.number,...(version.timeLimitMinutes?{timeLimitMinutes:version.timeLimitMinutes,timeLimitKind:version.timeLimitKind}:{} )})),allowCustom:!associate,onExit:()=>closeSheet('dismiss'),onCustom:beginCustomTimer,onPick:id=>{const version=versions.find(item=>item.id===id);if(!version)return;const attemptId=crypto.randomUUID();let linked;try{if(associate)linked=bindPracticeTimer(associate,{attemptId,versionId:version.id,sections:timerSectionsForQuestions(version.questions)});}catch(error){toast(error.message);return;}Object.assign(state,serviceBindings.scopeForVersion(version));newAttempt(version.number,attemptId);if(associate){state.practiceTimers[state.activeAttemptId]=linked;delete state.practiceTimers[associate.attemptId];writeStore();closeSheet('complete');go('entry',{refresh:true});}else showPracticeTimer();}})});
}
function openHomeTimer(){
 const timer=activeHomeTimer();
 if(timer?.origin==='custom'&&!timer.versionId){pauseCurrentEntry();state.activeAttemptId=timer.attemptId;writeStore();showPracticeTimer();return;}
 if(timer){const version=serviceClient.catalog().find(item=>item.id===timer.versionId);if(version){pauseCurrentEntry();const record=state.history.find(item=>item.id===timer.attemptId);Object.assign(state,serviceBindings.scopeForVersion(version));state.activeAttemptId=timer.attemptId;state.answers=record?[...record.answers]:Array(version.questionCount).fill('');state.current=Math.min(state.current,state.answers.length)||1;persist();showPracticeTimer();return;}}
 openTimerSelection();
}
function score(answers=state.report,record=state.history.find(item=>item.id===state.activeAttemptId)){
  const actual=serviceClient?.scoreForRecord(record);return actual||legacyScore(answers);
}
// 正式提交和审核订正自动计分；旧示例只显示静态来源，避免多一个手动步骤。
function scoreVerification(){return serviceClient?.currentAttempt()?{kind:'verified'}:{kind:'legacy'}}
function persistServiceHistory(){
  state.recents=recentAttempts(state.history);for(const record of [...state.history].reverse())state.drafts[recordKey(record)]=[...record.answers];
  const active=serviceClient?.currentAttempt();if(active&&['report','details','share','rank','discussion'].includes(state.page)){state.answers=active.answers.map(answer=>answer||'');state.report=[...state.answers]}writeStore();
}
function renderFeatures(){
  const view=$('.view'),scroll=view?.scrollTop||0,active=document.activeElement,id=active?.id;
  const start=typeof active?.selectionStart==='number'?active.selectionStart:null,end=typeof active?.selectionEnd==='number'?active.selectionEnd:null;
  render();if($('.view'))$('.view').scrollTop=scroll;
  const next=id?document.getElementById(id):null;if(next){next.focus({preventScroll:true});if(start!==null&&typeof next.setSelectionRange==='function')next.setSelectionRange(start,end??start)}
}
function featureAttempt(){
  const actual=serviceClient?.currentAttempt();if(actual)return actual;
  if(!['report','details','share','rank','discussion'].includes(state.page))return null;
  const result=legacyScore(state.report);return {id:state.activeAttemptId||'legacy-preview',versionId:'sample-preview:v1',paperId:'sample-preview',paperTitle:paperLabel(),versionLabel:'旧版估分',createdAt:0,answers:[...state.report],isSample:true,report:{rows:result.rows.map(row=>({question:row.n,answer:row.answer,correctAnswer:row.ref,type:row.type,status:row.status})),breakdown:[],totalCents:result.cents,maxCents:10000}};
}
function navigateFeature(path){
  const [page,id]=String(path).replace(/^#?\/?/,'').split('/').map(decodeURIComponent);
  if(page==='report'&&id){if(['rank','details','share','discussion'].includes(state.page)&&state.activeAttemptId===id&&routeTrail.at(-1)?.page==='report'){actions.back();return;}const record=state.history.find(item=>item.id===id);if(record){openRecord(record);if(state.page==='report')renderFeatures()}return}
  if((page==='practice'||page==='rank')&&id){const version=serviceClient?.catalog().find(item=>item.id===id);if(!version){toast('找不到对应套卷，请刷新目录');return}const targetScope=serviceBindings.scopeForVersion(version);Object.assign(state,{institution:targetScope.institution,period:targetScope.period,paper:targetScope.paper});if(page==='practice'){newAttempt(version.number);go('entry',{refresh:true});return}const attempt=serviceClient.state().attempts.find(item=>item.versionId===id);if(attempt){state.activeAttemptId=attempt.id;state.report=attempt.answers.map(answer=>answer||'')}else state.activeAttemptId=null;go('rank',{refresh:true});return}
  if(page==='stats'){state.statsVersionId=id||null;go('stats',{refresh:true});return}
  if(views[page])go(page,{refresh:true});
}
async function refreshFeatures(){
  const generation=++featureGeneration;
  // 先通知离页释放录音，再进行可能失败的网络同步。
  const pending=Promise.allSettled(iosFeatures.map(feature=>feature.onRoute?.()));
  if(serviceClient&&['report','details','rank','me','stats','discussion'].includes(state.page)){
    try{await serviceClient.syncAttempts();if(generation===featureGeneration)renderFeatures()}catch(error){if(generation===featureGeneration)toast(error.message)}
  }
  await pending;
}
async function initializeFeatures(){
  try{
    serviceBindings=await import('./service-client.js?v=ios-features-1');
    serviceClient=serviceBindings.createIOSServiceClient({storage:localStorage,storageName,getUIState:()=>state,persistUI:persistServiceHistory});
    await serviceClient.initialize();
    const ctx={state:serviceClient.state,catalog:serviceClient.catalog,attempt:featureAttempt,version:serviceClient.currentVersion,
      route:()=>({page:state.page==='entry'?'practice':state.page,id:['entry','rank'].includes(state.page)?serviceClient.currentVersion()?.id:state.activeAttemptId}),
      dimension:()=>state.rankDimension||'total',setDimension:id=>{state.rankDimension=id},uiState:()=>state,feedbackQuestion:question=>iosCorrections?.openFeedback?.(question),
      api:serviceClient.api,positionsSnapshot:()=>iosPositions?.snapshot(),persist:()=>{serviceClient.persist();persistServiceHistory()},render:renderFeatures,toast,
      openModal:(title,body,actions='',className='')=>openSheet(title,'<div class="ios-feature-host ios-feature-sheet '+esc(className)+'">'+body+(actions?'<div class="modal-actions">'+actions+'</div>':'')+'</div>'),closeModal:()=>closeSheet('complete'),onModalClose:callback=>{sheetCloseListeners.add(callback);return()=>sheetCloseListeners.delete(callback)},
      navigate:navigateFeature,refreshCatalog:serviceClient.refreshCatalog,syncAttempts:serviceClient.syncAttempts,submitAttempt:()=>actions.submit(),modalSelector:'.rr-sheet'};
    const definitions=[['positions','createIOSPositionsFeature'],['analytics','createIOSAnalyticsFeature'],['discussions','createIOSDiscussionsFeature'],['corrections','createIOSCorrectionsFeature'],['insights','createIOSInsightsFeature']];
    for(const [name,factory]of definitions){try{const module=await import('./features/'+name+'.js?v=ios-features-1'),feature=module[factory](ctx);iosFeatures.push(feature);if(name==='positions')iosPositions=feature;if(name==='analytics')iosAnalytics=feature;if(name==='discussions')iosDiscussions=feature;if(name==='corrections')iosCorrections=feature}catch{serviceError='部分练习功能暂时不可用，请刷新重试。'}}
  }catch{serviceError='练习服务暂时不可用，录入内容仍可保存在本机。'}
}
document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#/"]');if(!link||link.closest('[data-ios-analytics]'))return;event.preventDefault();navigateFeature(link.getAttribute('href').slice(2))});
const views={home,papers,entry,report,details,rank,me,share,stats,admin,discussion};
// 转场保持新页不透明，并先清理旧DOM；快速切换不能残留重复ID或叠印文字。
function render(animate=false,reverse=false){
  $('#app').dataset.page=state.page;const stage=$('#stage');for(const old of stage.querySelectorAll('.view')){window.RollieUI?.cleanup(old);old.remove()}
  const el=document.createElement('div');el.className='view';el.dataset.page=state.page;el.innerHTML=views[state.page]();stage.append(el);top();mountInterfaces(el);for(const feature of iosFeatures)feature.afterRender?.();mountPracticeTools();
  if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate([{transform:'translateX('+(reverse?-16:20)+'px)'},{transform:'translateX(0)'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
}
// Native navigation carries paper/attempt context and return positions, including browser back/forward.
const pageScrollPositions={};
// Reload keeps the existing return trail; a fresh gallery fixture starts a new journey.
let routeTrail=!freshPreview&&history.state?.rollie?history.state.trail||[]:[];
function positionKey(){return state.page==='papers'?'papers|'+state.institution+'|'+state.period:state.page+'|'+(state.activeAttemptId||'')}
function rememberPosition(){const y=$('.view')?.scrollTop||0;pageScrollPositions[positionKey()]=y;if(state.page==='papers'){state.catalogPositions[positionKey()]=y;writeStore()}}
function restorePosition(value){const view=$('.view');if(view)view.scrollTop=value??pageScrollPositions[positionKey()]??state.catalogPositions[positionKey()]??0}
function routeSnapshot(){return {page:state.page,institution:state.institution,period:state.period,paper:state.paper,attemptId:state.activeAttemptId,scroll:$('.view')?.scrollTop||0,detailFilter:state.detailFilter,detailType:state.detailType,rankType:state.rankType,statsVersionId:state.statsVersionId||null,focus:document.activeElement?.getAttribute('aria-label')}}
function routeUrl(){const q=new URLSearchParams({page:state.page,institution:state.institution,period:String(state.period),paper:String(state.paper)});if(state.activeAttemptId)q.set('attempt',state.activeAttemptId);if(state.page==='stats'&&state.statsVersionId)q.set('version',state.statsVersionId);if(testSession)q.set('session',testSession);if(designRevision)q.set('design',designRevision);return location.pathname+'?'+q}
function rememberRoute(){rememberPosition();history.replaceState({rollie:true,route:routeSnapshot(),trail:routeTrail},'',routeUrl())}
function focusRoute(label){requestAnimationFrame(()=>{const candidates=[...document.querySelectorAll('button')];const previous=label&&candidates.find(el=>el.getAttribute('aria-label')===label);const target=previous||$('#top h1')||$('.view h1')||$('.view');if(target){if(!previous)target.tabIndex=-1;target.focus({preventScroll:true})}})}
function go(page,options={}){if(state.page===page&&!options.refresh)return;if(state.page==='entry'&&page!=='entry')pauseCurrentEntry();if(sheetState.open)closeSheet('dismiss');rememberRoute();const before=routeSnapshot();routeTrail=options.root?[]:options.replace?routeTrail:[...routeTrail,before];state.page=page;if(page==='entry')resumeCurrentEntry();render(true);if(page==='entry')requestAnimationFrame(()=>scrollToQuestion(state.current,true));else restorePosition();history[options.replace?'replaceState':'pushState']({rollie:true,route:routeSnapshot(),trail:routeTrail},'',routeUrl());focusRoute();void refreshFeatures()}
function applyRoute(route){pauseCurrentEntry();if(sheetState.open)closeSheet('dismiss');const r=state.history.find(r=>r.id===route.attemptId);Object.assign(state,{page:route.page,institution:route.institution,period:route.period,paper:route.paper,activeAttemptId:route.attemptId,detailFilter:route.detailFilter||'wrong',detailType:route.detailType||null,rankType:route.rankType||'总分',statsVersionId:route.statsVersionId||null});if(r){state.answers=[...r.answers];if(r.complete)state.report=[...r.answers]}if(r?.complete&&state.page==='entry')state.page='report';state.current=state.answers.findIndex(v=>!v)+1||Math.max(1,state.answers.length);if(state.page==='entry')resumeCurrentEntry();render(true,true);restorePosition(route.scroll);focusRoute(route.focus);void refreshFeatures()}
window.addEventListener('popstate',event=>{if(event.state?.rollie&&views[event.state.route?.page]){routeTrail=event.state.trail||[];applyRoute(event.state.route)}else{location.reload()}});
function newAttempt(n,attemptId=crypto.randomUUID()){pauseCurrentEntry();state.blankConsent=null;state.paper=n;state.activeAttemptId=attemptId;state.answers=Array(questionCount()).fill('');state.current=1;persist()}
function openPaper(n){const r=latestAttempt(state.history,{...state,paper:n});if(r)openRecord(r);else{newAttempt(n);go('entry')}}
function openReview(type=null){state.detailType=type;const rows=score().rows.filter(q=>matchesReviewType(q,type));state.detailFilter=rows.some(q=>q.status==='wrong')?'wrong':'all';pageScrollPositions['details|'+state.activeAttemptId]=0;go('details')}
// 题号、答案和定位由原生答题卡负责，宿主只在用户选择后关闭并跳到真实题号。
function displayGrid(){openSheet('答题卡','<div id="answer-sheet-ui"></div>',content=>{const host=content.querySelector('#answer-sheet-ui');if(host)window.RollieUI.mountAnswerSheet(host,{sections:viewTypes().map(([name,start,end])=>({name,start,end})),answers:state.answers,current:state.current,marks:currentMarks(),onJump:jumpToAnswer})})}
function jumpToAnswer(question){state.current=Math.min(questionCount(),Math.max(1,question));writeStore();closeSheet('complete');if(state.page!=='entry')go('entry');else updateEntry();requestAnimationFrame(()=>scrollToQuestion(question))}

function scrollToQuestion(n,instant=false){const view=$('.view[data-page="entry"]'),row=$('#question-'+n);if(!view)return;if(state.entryMode==='single'){view.scrollTo({top:0,behavior:'instant'});return}if(!row)return;const header=$('.entry-sticky');const y=row.getBoundingClientRect().top-view.getBoundingClientRect().top+view.scrollTop-(header?.offsetHeight||0)-14;view.scrollTo({top:Math.max(0,y),behavior:instant||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
function updateEntry(){if(state.page!=='entry')return;const total=count();const counter=$('#answer-count');counter.innerHTML=total+'<small> / '+questionCount()+'</small>';counter.setAttribute('aria-label','已填 '+total+' 题，共 '+questionCount()+' 题');$('#answer-progress').innerHTML=track(total/questionCount());const saveError=$('#save-state');saveError.hidden=state.saved;saveError.innerHTML=state.saved?'':I('info')+'保存失败，请重试';for(const row of document.querySelectorAll('.answer-row')){const n=Number(row.id.slice(9));row.classList.toggle('current',n===state.current);row.setAttribute('aria-label','第 '+n+' 题'+(n===state.current?'，当前题':''))}const b=$('[data-action="confirm"]');setActionButton(b,total<questionCount()?'交卷 · 未答 '+(questionCount()-total):'提交估分');mountEntryTools();updateEntryVisibility()}
// 键盘续录把焦点交给下一题；回改仍留在原题，避免快捷键作用到别的答案。
function recordAnswer(n,option,keyboard=false){if(['running','paused'].includes(currentTimer()?.status)){showPracticeTimer();return;}const wasBlank=!state.answers[n-1],autoNext=wasBlank||state.entryMode==='single';state.answers[n-1]=option;if(autoNext)state.current=Math.min(questionCount(),n+1);persist();for(const b of document.querySelectorAll('[data-n="'+n+'"]')){const selected=b.dataset.option===option;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))}updateEntry();const target=$('[data-n="'+n+'"][data-option="'+option+'"]');target?.classList.remove('flash');requestAnimationFrame(()=>target?.classList.add('flash'));if(autoNext&&n<questionCount()){scrollToQuestion(n+1);if(keyboard)requestAnimationFrame(()=>$('[data-n="'+(n+1)+'"][data-option="A"]')?.focus({preventScroll:true}))}}

// 新成绩先展示总分；返回同一成绩仍由 go() 恢复位置，避免跨卷继承上一份长报告的滚动位置。
function resetResultPosition(){for(const page of ['report','share','details','rank'])pageScrollPositions[page+'|'+state.activeAttemptId]=0}
// 原设计用固定答案和延时生成成绩；真实提交确认后才建立完成记录。
function reportFromDraft(attempt){const oldId=state.activeAttemptId;state.history=state.history.filter(record=>record.id!==oldId||record.complete||oldId===attempt.id);state.activeAttemptId=attempt.id;state.answers=attempt.answers.map(answer=>answer||'');state.report=[...state.answers];persist(true);serviceClient.mergeHistory();state.saving=false;closeSheet();resetResultPosition();go('report',{replace:true,refresh:true})}
const actions={
'answer-feedback'(){iosCorrections?.openFeedback?.()},
'review-sections':reviewSectionPicker,
'save-poster':savePoster,
async invite(){const url=new URL(location.href);url.search='?open=paper&institution='+encodeURIComponent(state.institution)+'&period='+state.period+'&paper='+state.paper;if(navigator.share){try{await navigator.share({title:'卷卷小榜 · '+paperLabel(),text:'同一套卷，看看你的分数',url:url.href})}catch{}}else{try{await navigator.clipboard.writeText(url.href);toast('同卷链接已复制')}catch{toast('请使用浏览器分享此页面')}}},
// 报告是本次练习的根结果，返回首页，不能把刚退回的榜单再次压栈。
back(){if(state.page==='report'){go('home',{replace:true,root:true});return;}if(routeTrail.length){rememberRoute();history.back()}else go(['details','share','rank','discussion'].includes(state.page)?'report':'home',{replace:true,root:true})},

// 套卷信息使用公开版本规格，避免副省等不同题量继续显示固定130题。
info(){const c=collectionFor(state.institution,state.period);openSheet('套卷信息',[['机构',publisherName(state.institution)],['套卷',c?.displayPeriod?c.meta:c?.title||'行测套卷'],['版本',c?.meta||'2026 第'+state.period+'期'],['试卷',c?.paperNames?.[state.paper]||'第'+n2(state.paper)+'套'],['题量 / 满分',questionCount()+'题 / '+((serviceClient?.currentVersion()?.maxCents||10000)/100)+'分']].map(([a,b])=>'<div class="meta-row"><span>'+a+'</span><span>'+esc(b)+'</span></div>').join(''))},
// Real collection names replace the old fabricated 1–24 period keypad.
periods(){openSheet('选择套卷','<div class="rr5-collection-options">'+collectionsFor(state.institution).map(c=>'<button type="button" class="rr5-collection-option '+(c.number===state.period?'selected':'')+'" data-period="'+c.number+'" aria-label="'+esc(c.displayPeriod?c.meta:c.title+'，'+c.meta)+'" aria-pressed="'+(c.number===state.period)+'"><span><strong>'+esc(c.displayPeriod?c.meta:c.title)+'</strong>'+(c.displayPeriod?'':'<small>'+esc(c.meta)+'</small>')+'</span>'+I(c.number===state.period?'check':'arrow')+'</button>').join('')+'</div>')},
grid:displayGrid,
// 漏答须由考生明确选择补答或留空，不能强迫把每题填满后才允许交卷。
confirm(){if(['running','paused'].includes(currentTimer()?.status)){showPracticeTimer();return;}const missing=state.answers.filter(v=>!v).length;if(missing){openSheet(missing+' 题未答','<div class="sheet-actions rr-blank-actions">'+button('fill-missing','继续补答','secondary')+button('submit-blank','留空交卷','primary')+'</div>');return}actions.submit()},
'fill-missing'(){state.current=state.answers.findIndex(v=>!v)+1||state.current;closeSheet('complete');updateEntry();scrollToQuestion(state.current)},
'submit-blank'(){state.blankConsent=JSON.stringify(state.answers);closeSheet('complete');void actions.submit()},
'timer'(){showPracticeTimer()},
continue:closeSheet,
async submit(){if(state.saving)return;if(state.answers.some(v=>!v)&&state.blankConsent!==JSON.stringify(state.answers)){actions.confirm();return;}if(!serviceClient){toast('练习服务暂时不可用，请稍后重试');return;}serviceClient.prepareDraft();for(const feature of iosFeatures)if(await feature.beforeSubmit?.()===false)return;state.saving=true;freezeCurrentTiming();const b=$('[data-action="confirm"]');setActionButton(b,'正在估分',true);try{const attempt=await serviceClient.submit();await Promise.allSettled(iosFeatures.map(feature=>feature.afterSubmit?.(attempt)));reportFromDraft(attempt)}catch(error){toast(error.message)}finally{state.saving=false;if(b?.isConnected)setActionButton(b,'提交估分',false)}},
details(){openReview()},
share(){go('share')},
restart(){openSheet('再练一次','<div class="sheet-actions">'+button('continue','取消','secondary')+button('new-attempt','开始','primary')+'</div>')},
'new-attempt'(){newAttempt(state.paper);closeSheet();go('entry',{replace:true})},
'copy-wrong'(){const text=reviewRows().filter(r=>r.status==='wrong').map(r=>r.n).join('、');navigator.clipboard?.writeText(text).then(()=>toast('错题号已复制')).catch(()=>toast('请在浏览器中复制'))},

};

// Every origin opens the same attempt target; only an explicit redo can replace the editing context.
function openRecord(r){if(!r)return;pauseCurrentEntry();state.activeAttemptId=r.id;state.institution=r.institution;state.period=r.period;state.paper=r.paper;state.answers=[...r.answers];if(!state.reviewMarks[r.id]&&Array.isArray(r.marks))state.reviewMarks[r.id]=[...r.marks];writeStore();if(attemptTarget(r).page==='report'){state.report=[...r.answers];resetResultPosition();go('report')}else{state.current=state.answers.findIndex(v=>!v)+1||Math.max(1,state.answers.length);go('entry')}}
function openRecent(index){state.recentIndex=index;openRecord(state.recents[index])}
function openHistory(id){openRecord(state.history.find(r=>r.id===id))}

document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.record){openRecent(Number(b.dataset.record));return}if(b.hasAttribute('data-record')){openRecent(Number(b.dataset.record));return}if(b.hasAttribute('data-review-section')){const type=b.dataset.reviewSection;if(type&&!viewTypes().some(item=>item[0]===type))return;state.detailType=type||null;closeSheet('complete');refreshReview();return}if(b.dataset.root){go(b.dataset.root,{root:true});return}if(b.dataset.page){go(b.dataset.page);return}if(b.dataset.institution){changeScope(b.dataset.institution,state.publisherPeriods[b.dataset.institution]||1);go('papers');return}if(b.dataset.paper){openPaper(Number(b.dataset.paper));return}if(b.dataset.mark){toggleReviewMark(Number(b.dataset.mark));return}if(b.dataset.option){recordAnswer(Number(b.dataset.n),b.dataset.option,e.detail===0);return}if(b.dataset.period){const n=Number(b.dataset.period);if(!isAvailablePeriod(state.institution,n))return;rememberPosition();changeScope(state.institution,n);closeSheet();render();restorePosition();rememberRoute();requestAnimationFrame(()=>$('#period-picker')?.focus({preventScroll:true}));return}if(b.dataset.paperFilter){state.paperFilter=b.dataset.paperFilter;render();return}if(b.dataset.detail){state.detailFilter=b.dataset.detail;render();return}if(b.dataset.rank){state.rankType=b.dataset.rank;render();return}if(b.dataset.action)actions[b.dataset.action]?.()});
document.addEventListener('keydown',e=>{if(state.page==='entry'&&!sheetState.open&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&/^[abcd]$/i.test(e.key)){e.preventDefault();const row=e.target.closest('.answer-row');const question=row?Number(row.id.slice(9)):state.current;$('[data-n="'+question+'"][data-option="'+e.key.toUpperCase()+'"]')?.click()}});
// A shared paper URL resolves the recipient's own saved state, never the sender's private report.
if(params.get('open')==='paper'){const exact={institution:params.get('institution'),period:Number(params.get('period')),paper:Number(params.get('paper'))};if(isInstitution(exact.institution)&&isAvailablePeriod(exact.institution,exact.period)&&papersFor(exact.institution,exact.period).includes(exact.paper)){Object.assign(state,exact);const r=latestAttempt(state.history,exact);if(r){state.activeAttemptId=r.id;state.answers=[...r.answers];if(r.complete)state.report=[...r.answers];state.page=attemptTarget(r).page}else{newAttempt(exact.paper);state.page='entry'}}}
// 同卷单题模式刷新应停在原题，不能被首个未答题重新覆盖。
state.current=restoredQuestion&&restoredQuestion.attemptId===state.activeAttemptId&&restoredQuestion.key===paperKey(state)&&restoredQuestion.current<=state.answers.length?restoredQuestion.current:state.answers.findIndex(v=>!v)+1||Math.max(1,state.answers.length);
if(params.has('empty'))writeStore();
await initializeFeatures();
if(state.page==='entry')resumeCurrentEntry();
render();void refreshFeatures();if(state.page==='entry')requestAnimationFrame(()=>scrollToQuestion(state.current,true));else restorePosition();rememberRoute();
