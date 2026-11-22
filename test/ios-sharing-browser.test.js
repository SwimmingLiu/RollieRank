import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidence = path.join(root, "test-results/sharing-browser");

// The real server and unmodified mobile page prove that the footer saves the selected view, not a standalone component fixture.
test("the actual mobile sharing page saves all four selected artifacts after a real submission", { timeout: 90000 }, async t => {
  await mkdir(evidence, { recursive: true });
  const directory = await mkdtemp(path.join(tmpdir(), "rollierank-sharing-browser-"));
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise(resolve => reservation.close(resolve));
  const service = spawn(process.execPath, ["scripts/serve.mjs"], { cwd: root, env: { ...process.env, PORT: String(port), ROLLIERANK_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "", browser;
  service.stdout.on("data", chunk => { log += chunk; }); service.stderr.on("data", chunk => { log += chunk; });
  t.after(async () => {
    await browser?.close();
    if (service.exitCode === null) {
      service.kill("SIGTERM");
      const fallback = setTimeout(() => service.kill("SIGKILL"), 10000);
      await once(service, "exit"); clearTimeout(fallback);
    }
    await writeFile(path.join(evidence, "server.log"), log);
    await rm(directory, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Sharing server did not start: " + log)), 20000);
    service.once("error", error => { clearTimeout(timer); reject(error); });
    service.stdout.on("data", () => { if (log.includes("RollieRank is ready")) { clearTimeout(timer); resolve(); } });
  });
  const base = `http://127.0.0.1:${port}`;
  const catalogResponse = await fetch(base + "/api/catalog", { signal: AbortSignal.timeout(10000) });
  assert.equal(catalogResponse.status,200);
  assert.ok((await catalogResponse.json()).versions.some(version => version.status === "published"));
  const hierarchy = await fetch(base + "/api/positions/hierarchy", { signal: AbortSignal.timeout(10000) });
  assert.equal(hierarchy.status,200);
  assert.ok((await hierarchy.json()).options.length,"official position source was not ready");

  browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ["--hide-scrollbars"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(12000);
  const errors = [], downloads = [], geometry = [], canvasResolution = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(base + "/ios-v3/?design=paper-cards-1114-v3", { waitUntil: "networkidle" });
    await page.locator('.page-picker [data-page="papers"]').click();
    const frame = page.frameLocator("#phone");
    await frame.locator('.view[data-page="papers"]').waitFor();
    await frame.locator('.rr3-paper-cover.new .rr-card-hit').first().click();
    await frame.locator('.view[data-page="entry"]').waitFor();
    const questionCount = await frame.locator(".answer-row").count();
    assert.ok(questionCount >= 120);
    await frame.getByRole("button", { name: "第 1 题，选 A", exact: true }).click();
    await frame.getByRole("button", { name: "第 2 题，选 C", exact: true }).click();
    await frame.locator('[data-action="confirm"]').click();
    await frame.getByRole("dialog").getByRole("button", { name: "留空交卷", exact: true }).waitFor();
    const submitted = page.waitForResponse(response => response.url() === base + "/api/submit" && response.request().method() === "POST");
    await frame.getByRole("button", { name: "留空交卷", exact: true }).click();
    await frame.getByRole("button", { name: "先提交", exact: true }).click();
    const response = await submitted;
    assert.equal(response.status(),200);
    const receipt = await response.json(), request = response.request().postDataJSON();
    assert.equal(receipt.isSample,false);
    assert.equal(receipt.answers[0],"A");assert.equal(receipt.answers[1],"C");
    assert.equal(receipt.report.blank,questionCount - 2);
    assert.equal(receipt.answers.filter(answer=>answer===null).length,questionCount - 2);
    const stored = JSON.parse(await readFile(path.join(directory,"catalog.json"),"utf8"));
    assert.deepEqual(stored.receipts[`${request.guestId}:${receipt.id}`].answers,receipt.answers);
    await frame.locator('.view[data-page="report"]').waitFor();
    assert.equal(await frame.locator('.rr-score-verification').count(),0);
    await frame.getByRole("button", { name: "分享成绩", exact: true }).click();
    await frame.locator('.view[data-page="share"] .rr-share-studio').waitFor();
    // 从实际保存按钮的离屏宿主读取像素，避免仅源码构建正确而共享bundle仍放大低分辨率画布。
    await frame.locator('body').evaluate(()=>{
      window.__shareExportCanvases=[];
      new MutationObserver(()=>{for(const canvas of document.querySelectorAll('.rr2-poster-host canvas[data-ready="true"]'))window.__shareExportCanvases.push({mode:canvas.closest('[data-share-mode]').dataset.shareMode,width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,artifactWidth:canvas.closest('[data-share-artwork]').offsetWidth,dpr:devicePixelRatio});}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['width','height','data-ready']});
    });
    assert.deepEqual(await frame.locator('.rr-share-outcomes b').allTextContents(),[String(receipt.report.correct),String(receipt.report.wrong),String(receipt.report.blank)]);
    assert.ok((await frame.locator('.rr-share-score').innerText()).includes((receipt.report.totalCents/100).toFixed(2)));
    assert.match(await frame.locator('.rr-share-standing').innerText(), /同卷排名\s*1\s*\/\s*1/);
    assert.equal(await frame.locator('.rr-share-zoom,.rr-share-fit').count(),0);
    assert.equal(await frame.getByRole('group',{name:'预览缩放',exact:true}).count(),0);
    for (const [mode,label] of [["report","长图"],["score","成绩卡"],["sections","题型"],["radar","雷达"]]) {
      await frame.getByRole("tab", { name: label, exact: true }).click();
      await frame.locator(`.rr-share-studio[data-share-mode="${mode}"]`).waitFor();
      if (mode === "report" || mode === "radar") await frame.locator('.rr-share-artifact canvas[data-ready="true"]').waitFor();
      const artifact = frame.locator('.rr-share-artifact');
      const naturalHeight = await artifact.evaluate(element=>Math.ceil(element.offsetHeight));
      assert.ok((await artifact.innerText()).includes((receipt.report.totalCents/100).toFixed(2)));
      // 四种下载均采用年份随卷身份、品牌为水印的新布局，不能只改一个预览样式。
      assert.equal(await artifact.locator('.rr-share-brand').count(),0);
      assert.equal(await artifact.locator('.rr-share-watermark').count(),1);
      assert.equal((await artifact.innerText()).includes('本次估分'),false);
      assert.match(await artifact.locator('.rr-share-paper').innerText(),/2026/);
      for (const [width,height] of [[320,568],[390,844],[430,932]]) {
        await page.locator('#size').selectOption(`${width},${height}`);
        await page.waitForFunction(()=>{const document=window.document.querySelector('#phone').contentDocument;return Math.abs(document.querySelector('.rr-share-preview-stage').getBoundingClientRect().width-document.querySelector('.rr-share-preview').clientWidth)<1;});
        const bounds = await frame.locator('body').evaluate(()=>{
          const artifact=document.querySelector('.rr-share-artifact'),paper=artifact.querySelector('.rr-share-paper'),watermark=artifact.querySelector('.rr-share-watermark');
          return {viewport:innerWidth,document:document.documentElement.scrollWidth,preview:document.querySelector('.rr-share-preview').getBoundingClientRect().toJSON(),footerTop:document.querySelector('#bottom').getBoundingClientRect().top,paperIdentity:paper.innerText,watermarkInside:watermark.getBoundingClientRect().right<=artifact.getBoundingClientRect().right&&watermark.getBoundingClientRect().bottom<=artifact.getBoundingClientRect().bottom,watermarkLogo:watermark.querySelector('img').getAttribute('src')};
        });
        assert.equal(bounds.viewport,width);assert.ok(bounds.document<=width+1,`${mode} page overflows ${width}`);
        assert.ok(bounds.preview.bottom<=bounds.footerTop+1,`${mode} preview extends behind the fixed footer at ${width}`);
        assert.ok(bounds.watermarkInside, `${mode} watermark escapes its artifact at ${width}`);
        assert.equal(bounds.watermarkLogo,'assets/brand/rollierank-logo-transparent.png');
        geometry.push({mode,width,...bounds});
        await frame.locator('.toast').waitFor({state:'hidden'});
        await page.locator('#phone').screenshot({path:path.join(evidence,`${mode}-${width}.png`)});
      }
      await page.locator('#size').selectOption('390,844');
      const downloadEvent = page.waitForEvent('download');
      await frame.locator('[data-action="save-poster"]').click();
      const download = await downloadEvent;
      const output = path.join(evidence,`${mode}.png`);await download.saveAs(output);
      const bytes=await readFile(output);
      assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
      assert.equal(width,900);assert.ok(Math.abs(height-naturalHeight*2)<=2,`${mode} exported a cropped or different view`);
      if(mode==='report'||mode==='radar'){
        const canvas=await frame.locator('body').evaluate(()=>window.__shareExportCanvases.at(-1));
        assert.equal(canvas?.mode,mode,'the selected artifact must own its prepared export canvas');
        const ratio=Math.max(canvas.dpr,width/canvas.artifactWidth);
        assert.ok(canvas.width+1>=canvas.cssWidth*ratio&&canvas.height+1>=canvas.cssHeight*ratio,`${mode} shared bundle exported an undersized radar canvas: ${JSON.stringify(canvas)}`);
        canvasResolution.push({mode,pngWidth:width,requiredRatio:ratio,...canvas});
      }
      downloads.push({mode,width,height,file:output,sha256:createHash('sha256').update(bytes).digest('hex')});
      assert.equal(await frame.locator('.rr2-poster-host').count(),0);
    }
    assert.equal(new Set(downloads.map(item=>item.sha256)).size,4);
    assert.ok(downloads.find(item=>item.mode==='report').height>downloads.find(item=>item.mode==='sections').height);
    assert.ok(downloads.find(item=>item.mode==='report').height>1800);
    await frame.getByRole('tab',{name:'长图',exact:true}).focus();await page.keyboard.press('ArrowRight');
    assert.equal(await frame.getByRole('tab',{name:'成绩卡',exact:true}).getAttribute('aria-selected'),'true');
    assert.deepEqual(errors,[]);
    await writeFile(path.join(evidence,'results.json'),JSON.stringify({passed:true,base,receipt:{id:receipt.id,versionId:receipt.versionId,totalCents:receipt.report.totalCents,maxCents:receipt.report.maxCents,correct:receipt.report.correct,wrong:receipt.report.wrong,blank:receipt.report.blank},downloads,geometry,canvasResolution,runtimeErrors:errors,checks:['real paper selection','real partial entry and explicit blank submission','actual persisted server receipt','report-to-share entry','four footer PNG downloads','actual values and no invented ranking','full uncropped long report','320/390/430 geometry','automatic viewport fit','year in paper identity and footer watermark','actual export canvas covers900px artifacts','keyboard tabs','export cleanup']},null,2)+'\n');
  } catch (error) {
    const layout=await page.locator('#phone').evaluate(element=>{const document=element.contentDocument,preview=document.querySelector('.rr-share-preview'),stage=document.querySelector('.rr-share-preview-stage'),canvas=document.querySelector('.rr-share-preview-canvas');return preview&&stage&&canvas?{preview:{rect:preview.getBoundingClientRect().toJSON(),clientWidth:preview.clientWidth,clientHeight:preview.clientHeight,scrollWidth:preview.scrollWidth,scrollHeight:preview.scrollHeight},stage:stage.getBoundingClientRect().toJSON(),canvas:{rect:canvas.getBoundingClientRect().toJSON(),transform:getComputedStyle(canvas).transform}}:null;}).catch(()=>null);
    await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true}).catch(()=>{});
    await writeFile(path.join(evidence,'failure.json'),JSON.stringify({error:String(error),runtimeErrors:errors,downloads,geometry,layout},null,2)+'\n');
    throw error;
  }
});
