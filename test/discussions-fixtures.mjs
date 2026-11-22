import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, writeFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { createDiscussionsService } from "../server/discussions.mjs";

export const scope = { paperId: "discussion-paper-a", guestId: "guest-discussions-123", attemptId: "attempt-discussions-123" };
export const otherScope = { paperId: "discussion-paper-b", guestId: scope.guestId, attemptId: "attempt-discussions-456" };
export const guestScope = { paperId: scope.paperId, guestId: "guest-discussions-456", attemptId: "attempt-discussions-789" };
export const revisionScope = { paperId: scope.paperId, guestId: scope.guestId, attemptId: "attempt-discussions-revision" };

function receipt(target, version = "1.0") {
  return { id: target.attemptId, versionId: `${target.paperId}:v${version}`, paperId: target.paperId, versionLabel: version,
    paperTitle: "行测练习 · 讨论测试卷", institution: "测试机构", project: "测试", period: "一期", variant: "通用", createdAt: 1794656000000,
    isSample: false, answers: ["A"], report: { totalCents: 6700, maxCents: 10000, rate: .67, correct: 87, wrong: 40, blank: 3, accuracy: 87 / 130,
      breakdown: [{ id: "reasoning", name: "判断推理", centsEarned: 6700, maxCents: 10000, count: 130, correct: 87 }], rows: [] } };
}
export function initialCatalog() {
  return { versions: [], receipts: Object.fromEntries([scope, otherScope, guestScope, revisionScope].map((target) => [`${target.guestId}:${target.attemptId}`, receipt(target, target === revisionScope ? "2.0" : "1.0")])),
    audit: [{ id: "untouched-audit" }], features: { positions: { sentinel: "preserve" }, corrections: { sentinel: "preserve" } } };
}

export function pngChunk(type, data) {
  const bytes = Buffer.alloc(12 + data.length);
  bytes.writeUInt32BE(data.length, 0); bytes.write(type, 4); data.copy(bytes, 8);
  let crc = 0xffffffff;
  for (const byte of bytes.subarray(4, 8 + data.length)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
  return bytes;
}
export function pngBytes({ width = 2, height = 2, decoded, ancillary = false, compressed } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const pixels = decoded ?? Buffer.concat(Array.from({ length: height }, () => Buffer.from([0, ...Array.from({ length: width }, () => [165, 125, 185, 255]).flat()])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header),
    ...(ancillary ? [pngChunk("tEXt", Buffer.from("note\0<script>alert(1)</script>"))] : []),
    pngChunk("IDAT", compressed ?? deflateSync(pixels)), pngChunk("IEND", Buffer.alloc(0))]);
}
export const pngUri = (options) => `data:image/png;base64,${pngBytes(options).toString("base64")}`;
export function wavBytes(seconds = .25) {
  const data = Buffer.alloc(44 + Math.floor(seconds * 16000) * 2);
  data.write("RIFF", 0); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(16000, 24);
  data.writeUInt32LE(32000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36); data.writeUInt32LE(data.length - 44, 40);
  for (let i = 0; i < (data.length - 44) / 2; i++) data.writeInt16LE(Math.sin(i / 16000 * 440 * Math.PI * 2) * 4000, 44 + i * 2);
  return data;
}
export const wavUri = (seconds) => `data:audio/wav;base64,${wavBytes(seconds).toString("base64")}`;
export const commentInput = (overrides = {}) => ({ ...scope, clientId: "comment-discussions-123", nickname: "小卷同学", text: "资料分析有点难，大家怎么分配时间？", links: [], images: [], audio: null, ...overrides });

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const assetRoot = process.env.ROLLIERANK_DISCUSSIONS_DIST === "1" ? resolve(repoRoot, "dist") + "/" : repoRoot;

function harnessHtml() {
  return `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>试卷讨论模块验证</title><link rel="stylesheet" href="/styles.css"/><link rel="stylesheet" href="/src/features/discussions.css"/><body><div id="app"></div><dialog id="modal" aria-label="讨论配图"></dialog><script type="module">
  import {createDiscussionsFeature} from '/src/features/discussions.js';
  import {shell} from '/src/ui.js'; import {reportView} from '/src/views-practice.js';
  const original = ${JSON.stringify(receipt(scope))};
  const saved = JSON.parse(localStorage.getItem('discussions-test-state') || 'null');
  const state = saved || {guestId: ${JSON.stringify(scope.guestId)}, profile:null, attempts:[original]};
  let route={page:'report',id:original.id}; const modal=document.querySelector('#modal');
  const attempt=()=>route.id==='sample' ? {...original,id:'sample',paperId:'sample-preview',isSample:true} : original;
  const feature=createDiscussionsFeature({state:()=>state,attempt,catalog:()=>[],route:()=>route,
    async api(path,data) { try { const response=await fetch('/api/'+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},...(data?{body:JSON.stringify(data)}:{})}); const result=await response.json(); if(!response.ok) throw new Error(result.error); return result; } catch(error) { throw new Error(error.message==='Failed to fetch'?'连接失败，编辑内容仍保留，请重试。':error.message); } },
    persist:()=>localStorage.setItem('discussions-test-state',JSON.stringify(state)),toast:()=>{},
    openModal(title,body){modal.innerHTML='<h2>'+title+'</h2><button type="button" id="close-test-modal">关闭图片</button>'+body;modal.showModal();document.querySelector('#close-test-modal').onclick=()=>modal.close();},closeModal:()=>modal.close(),render,navigate(path){location.hash='#/'+path;}});
  function render(){document.querySelector('#app').innerHTML=shell(route.page==='report'?reportView({attempt:attempt(),state})+'<div data-feature="discussions"></div>':'<section class="card"><h1>我的记录</h1><a href="#/report/'+original.id+'" class="button primary">查看成绩报告</a><a href="#/report/sample" class="button">查看示例报告</a></section>',{state,active:route.page==='report'?'home':'me'});feature.afterRender();}
  async function onRoute(){const parts=location.hash.replace(/^#\\//,'').split('/');route={page:parts[0]||'report',id:parts[1]||original.id};render();await feature.onRoute();}
  window.addEventListener('hashchange',onRoute);window.__discussionsHarness={feature,render,state,attempt};await onRoute();
  </script></body></html>`;
}

export async function createDiscussionHost({ directory: existingDirectory } = {}) {
  const directory = existingDirectory ?? await mkdtemp(join(tmpdir(), "rollierank-discussions-"));
  const catalogPath = join(directory, "catalog.json");
  let catalog;
  try { catalog = JSON.parse(await readFile(catalogPath, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; catalog = initialCatalog(); }
  let queue = Promise.resolve(), failWrite = false;
  const mutateCatalog = (operation) => {
    const pending = queue.catch(() => {}).then(async () => {
      const before = structuredClone(catalog);
      try {
        const result = operation(catalog);
        if (failWrite) throw new Error("模拟磁盘写入失败，编辑内容仍保留。");
        await writeFile(join(directory, "catalog.tmp"), JSON.stringify(catalog));
        await rename(join(directory, "catalog.tmp"), catalogPath);
        return result;
      } catch (error) { catalog = before; throw error; }
    });
    queue = pending;
    return pending;
  };
  const service = createDiscussionsService({ readCatalog: () => catalog, mutateCatalog, dataDirectory: new URL(`file://${directory}/`) });
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const send = (status, body) => { response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)); };
    try {
      if (url.pathname.startsWith("/api/")) {
        let input = {};
        if (request.method === "GET") await queue.catch(() => {});
        if (request.method === "POST") {
          const chunks = []; let length = 0;
          for await (const chunk of request) { length += chunk.length; if (length > 8 * 1024 * 1024) throw Object.assign(new Error("请求过大。"), { statusCode: 413 }); chunks.push(chunk); }
          input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        }
        if (await service({ pathname: url.pathname, method: request.method, input, query: url.searchParams, request, response, send })) return;
        send(404, { error: "接口不存在。" }); return;
      }
      if (url.pathname === "/") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(harnessHtml()); return; }
      const resource = resolve(assetRoot, "." + url.pathname);
      if (!resource.startsWith(assetRoot) || !(url.pathname.startsWith("/src/") || ["/styles.css", "/favicon.svg"].includes(url.pathname))) { response.writeHead(404).end(); return; }
      const content = await readFile(resource);
      response.writeHead(200, { "Content-Type": resource.endsWith(".js") ? "text/javascript" : resource.endsWith(".css") ? "text/css" : "image/svg+xml", "Cache-Control": "no-store" });
      response.end(content);
    } catch (error) { send(error.statusCode || 400, { error: error.message }); }
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  return { directory, base, service, get catalog() { return catalog; }, setFailWrite(value) { failWrite = value; },
    async request(input, queryScope = scope, cursor) {
      const params = new URLSearchParams(queryScope);
      if (cursor) params.set("before", cursor);
      const response = await fetch(base + "/api/discussions" + (input ? "" : `?${params}`), input ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : {});
      return { status: response.status, body: await response.json() };
    },
    async close({ remove = !existingDirectory } = {}) { await queue.catch(() => {}); server.closeAllConnections(); await new Promise((resolveClose) => server.close(resolveClose)); if (remove) await rm(directory, { recursive: true, force: true }); },
  };
}
