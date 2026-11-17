import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const ios = path.join(root, "docs/ui-exploration/ios-v3");
const ui = path.join(ios, "ui");
const requireUI = createRequire(path.join(ui, "package.json"));
const { build } = requireUI("esbuild");
const evidence = path.join(root, ".beauye/tasks/share-four-modes/evidence");
const fixture = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>分享验证</title>${["vendor/beui.css","modern.css","refined.css","editorial.css","typography.css","features/sharing.css"].map(file=>`<link rel="stylesheet" href="/ios-v3/${file}">`).join("")}<body class="beui-island"><main id="share"></main><script src="/share-test.js"></script><script>
const sections=[['政治理论',1000,1400],['常识判断',800,1050],['言语理解',1800,2400],['数量关系',650,800],['图形推理',400,800],['定义判断',400,800],['类比推理',200,400],['逻辑判断',750,850],['资料分析',2450,2500]].map(([name,earnedCents,maxCents])=>({name,earnedCents,maxCents}));
const props={logoSrc:'assets/brand/rollierank-logo-transparent.png',publisherLogoSrc:'assets/publishers/sihai-peanut.svg',institution:'四海',year:2026,period:2,paper:9,collectionLabel:'二期 · 地市',paperTitle:'行测第 09 套',total:84.5,maxScore:110,correct:104,wrong:21,blank:10,rank:2,participants:7,sections,comparison:{previousScore:75.2,currentScore:84.5},timing:{plannedMs:7200000,actualMs:7350000,modules:[{name:'政治理论',plannedMs:600000,actualMs:650000},{name:'常识判断',plannedMs:600000,actualMs:700000},{name:'言语理解',plannedMs:1800000,actualMs:1750000},{name:'数量关系',plannedMs:1200000,actualMs:1250000},{name:'判断推理',plannedMs:1800000,actualMs:1800000},{name:'资料分析',plannedMs:1200000,actualMs:1200000}]},answers:['PRIVATE-ANSWER']};
window.__shareProps=props;window.__shareChanges=[];window.__shareDispose=ShareTest.mountShareStudio(document.querySelector('#share'),{...props,onModeChange:mode=>window.__shareChanges.push(mode)});
window.exportMode=mode=>ShareTest.createModeSharePoster(props,mode);window.exportLegacy=()=>ShareTest.createSharePoster(props);
</script></body></html>`;

// 测量真实导出宿主的画布，防止900px PNG仅把低分辨率预览放大。
async function captureModeExport(page, mode) {
  return page.evaluate(async mode => {
    const canvases=[];
    const observer=new MutationObserver(()=>{for(const canvas of document.querySelectorAll('.rr2-poster-host canvas[data-ready="true"]'))canvases.push({width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,artifactWidth:canvas.closest('[data-share-artwork]').offsetWidth,dpr:devicePixelRatio});});
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['width','height','data-ready']});
    try { return {png:await window.exportMode(mode),canvas:canvases.at(-1)??null}; }
    finally {observer.disconnect();}
  },mode);
}

test("four share modes keep real values, accessible controls and complete distinct PNG exports", { timeout: 60000 }, async t => {
  const temporary = await mkdtemp(path.join(tmpdir(), "rollierank-share-modes-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const compiled = path.join(temporary, "share.js");
  await build({ stdin: { contents: 'export {mountShareStudio} from "./share-studio.tsx";export {createSharePoster,createModeSharePoster} from "./results.tsx";', resolveDir: ui, loader: "tsx" }, bundle: true, outfile: compiled, format: "iife", globalName: "ShareTest", platform: "browser", target: ["safari17","chrome120"], jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" });
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === "/ios-v3/share-fixture.html") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(fixture); return; }
      let file;
      if (pathname === "/share-test.js") file = compiled;
      else if (pathname.startsWith("/ios-v3/") && /\.(js|css|png|svg|woff2?)$/.test(pathname)) file = path.resolve(ios, "." + pathname.slice("/ios-v3".length));
      if (!file || (!file.startsWith(ios + path.sep) && file !== compiled)) { response.writeHead(404).end(); return; }
      const contentType = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff" }[path.extname(file)];
      response.writeHead(200, { "Content-Type": contentType }).end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await mkdir(evidence, { recursive: true });
  await page.goto(`http://127.0.0.1:${server.address().port}/ios-v3/share-fixture.html`, { waitUntil: "networkidle" });
  await page.locator('.rr-share-artifact canvas[data-ready="true"]').waitFor();
  assert.equal(await page.getByRole("tab").count(), 4);
  assert.equal(await page.locator(".rr-share-zoom,.rr-share-fit").count(), 0);
  assert.equal(await page.getByRole("group", { name: "预览缩放", exact: true }).count(), 0);
  assert.equal(await page.locator(".rr-share-subject").count(), 6);
  assert.deepEqual(await page.locator(".rr-share-outcomes b").allTextContents(), ["104","21","10"]);
  assert.ok((await page.locator(".rr-share-score").innerText()).includes("110 分"));
  assert.ok(!(await page.locator(".rr-share-artifact").innerText()).includes("PRIVATE-ANSWER"));
  const complete = await page.locator(".rr-share-artifact").evaluate(artwork => ({ bottom: artwork.getBoundingClientRect().bottom, last: artwork.querySelector(".rr-share-timing").getBoundingClientRect().bottom }));
  assert.ok(complete.last < complete.bottom - 8, "long report clips its final timing table");

  const dimensions = [], geometry = [], canvasResolution = [];
  for (const [mode,label] of [["report","长图"],["score","成绩卡"],["sections","题型"],["radar","雷达"]]) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await page.locator(`.rr-share-studio[data-share-mode="${mode}"]`).waitFor();
    if (mode === "report" || mode === "radar") await page.locator('.rr-share-artifact canvas[data-ready="true"]').waitFor();
    assert.equal(await page.getByRole("tab", { name: label, exact: true }).getAttribute("aria-selected"), "true");
    // 四条删除意见对应同一输出树；每种实物都须保留年份与分值，品牌只作水印。
    assert.equal(await page.locator('.rr-share-brand').count(), 0);
    assert.equal(await page.locator('.rr-share-watermark').count(), 1);
    assert.equal((await page.locator('.rr-share-artifact').innerText()).includes('本次估分'), false);
    assert.match(await page.locator('.rr-share-paper').innerText(), /2026/);
    assert.equal(await page.locator(".rr-share-subject").count(), mode === "report" || mode === "sections" ? 6 : 0);
    assert.equal(await page.locator(".rr-share-artifact canvas").count(), mode === "report" || mode === "radar" ? 1 : 0);
    for (const width of [320,390,430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForFunction(() => Math.abs(document.querySelector(".rr-share-preview-stage").getBoundingClientRect().width - document.querySelector(".rr-share-preview").clientWidth) < 1);
      const bounds = await page.locator(".rr-share-preview").evaluate(element => {
        const artifact=element.querySelector('.rr-share-artifact'),paper=artifact.querySelector('.rr-share-paper'),watermark=artifact.querySelector('.rr-share-watermark');
        return { viewport:innerWidth, document:document.documentElement.scrollWidth, right:element.getBoundingClientRect().right, width:element.clientWidth, watermarkInside:watermark.getBoundingClientRect().right<=artifact.getBoundingClientRect().right&&watermark.getBoundingClientRect().bottom<=artifact.getBoundingClientRect().bottom,paperIdentity:paper.innerText,watermarkLogo:watermark.querySelector('img').getAttribute('src') };
      });
      geometry.push({ mode, viewportWidth:width, ...bounds });
      await writeFile(path.join(evidence, `${mode}-${width}-layout.json`),JSON.stringify(bounds,null,2));
      await page.screenshot({ path: path.join(evidence, `${mode}-${width}.png`), fullPage: true });
      assert.ok(bounds.watermarkInside, `${mode} watermark escapes its artwork at ${width}`);
      assert.equal(bounds.watermarkLogo,'assets/brand/rollierank-logo-transparent.png');
      assert.ok(bounds.document <= width + 1, `${mode} leaks horizontal overflow at ${width}`);
      assert.ok(bounds.right <= width + 1);
      await page.screenshot({ path: path.join(evidence, `${mode}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const exported = await captureModeExport(page,mode);
    const bytes = Buffer.from(exported.png.split(",")[1], "base64");
    assert.equal(bytes.subarray(0,8).toString("hex"), "89504e470d0a1a0a");
    const size = { mode, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: createHash("sha256").update(bytes).digest("hex") };
    dimensions.push(size); assert.equal(size.width,900); assert.ok(size.height > 700);
    if(mode==='report'||mode==='radar'){
      assert.ok(exported.canvas,'export must expose a real prepared radar canvas');
      const ratio=Math.max(exported.canvas.dpr,size.width/exported.canvas.artifactWidth);
      assert.ok(exported.canvas.width+1>=exported.canvas.cssWidth*ratio&&exported.canvas.height+1>=exported.canvas.cssHeight*ratio,`${mode}: radar backing pixels are undersized for the exported PNG: ${JSON.stringify(exported.canvas)}`);
      canvasResolution.push({mode,pngWidth:size.width,requiredRatio:ratio,...exported.canvas});
    }
    await writeFile(path.join(evidence, `${mode}-export.png`), bytes);
    assert.equal(await page.locator(".rr2-poster-host").count(),0,"export temporary host leaked");
  }
  assert.equal(new Set(dimensions.map(item=>item.sha256)).size,4);
  assert.ok(dimensions.find(item=>item.mode==='report').height > dimensions.find(item=>item.mode==='sections').height);
  assert.ok(dimensions.find(item=>item.mode==='report').height > 1800,"long report retained the legacy 720px crop");
  assert.notEqual(dimensions.find(item=>item.mode==='sections').height,dimensions.find(item=>item.mode==='score').height);

  // 最低2倍不能把高DPR设备降回2倍；检查实际900px导出所用的3倍画布。
  const retina=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,reducedMotion:'reduce'});
  retina.on('pageerror',error=>errors.push(error.message));
  try {
    await retina.goto(`http://127.0.0.1:${server.address().port}/ios-v3/share-fixture.html`,{waitUntil:'networkidle'});
    await retina.locator('canvas[data-ready="true"]').waitFor();
    const exported=await captureModeExport(retina,'radar');
    const bytes=Buffer.from(exported.png.split(',')[1],'base64');
    assert.equal(bytes.readUInt32BE(16),900);
    assert.equal(exported.canvas?.dpr,3);
    assert.ok(exported.canvas.width+1>=exported.canvas.cssWidth*3&&exported.canvas.height+1>=exported.canvas.cssHeight*3);
    canvasResolution.push({mode:'radar-high-dpr',pngWidth:900,requiredRatio:3,...exported.canvas});
    await writeFile(path.join(evidence,'radar-high-dpr-export.png'),bytes);
  } finally {await retina.close();}

  await page.getByRole("tab", { name: "长图", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: "成绩卡", exact: true }).getAttribute("aria-selected"),"true");
  assert.ok((await page.evaluate(()=>window.__shareChanges)).includes("radar"));

  const legacyData = await page.evaluate(()=>window.exportLegacy());
  const legacy = Buffer.from(legacyData.split(",")[1],"base64");
  assert.deepEqual([legacy.readUInt32BE(16),legacy.readUInt32BE(20)],[900,1440]);
  assert.equal(await page.locator(".rr2-poster-host").count(),0);
  const failed = await page.evaluate(async()=>{try { await ShareTest.createModeSharePoster({...window.__shareProps,logoSrc:'/missing-logo.png'},'score');return false;}catch{return true;}});
  assert.equal(failed,true); assert.equal(await page.locator(".rr2-poster-host").count(),0,"failed export temporary host leaked");
  // Corrected or legacy snapshots must replace the preview in the existing mount, without a stale score or invented ranking.
  await page.evaluate(()=>{window.__shareProps={...window.__shareProps,total:88.75,rank:null,participants:0,verification:{kind:'legacy'}};ShareTest.mountShareStudio(document.querySelector('#share'),{...window.__shareProps,mode:'score'});});
  await page.locator('.rr-share-artifact-score').waitFor();
  assert.ok((await page.locator('.rr-share-score').innerText()).includes('88.75'));
  assert.equal(await page.locator('.rr-score-verification').innerText(),'示例估分');
  assert.equal(await page.locator('button.rr-score-verification').count(),0);
  assert.equal(await page.locator('.rr-share-standing').innerText(),'未参与排名');
  assert.deepEqual(errors,[]);
  await writeFile(path.join(evidence,"verification.json"), JSON.stringify({ modes:dimensions, geometry, canvasResolution,browserErrors:errors, checks:["four accessible modes", "same-component preview and PNG", "complete long report", "actual maximum and blank count", "weighted judgment merge", "no private answer text", "320/390/430 fit", "automatic viewport fit", "year in identity and footer watermark", "radar backing resolution covers actual export pixels", "keyboard tabs", "legacy export compatibility", "successful and failed export cleanup"] },null,2)+"\n");
});
