#!/usr/bin/env node
// 主动向微信搜一搜推送「卷卷小榜」小程序公开页面（/wxa/search/wxaapi_submitpages）。
//
// 用法：
//   node scripts/submit-wechat-search.mjs --dry-run
//   node scripts/submit-wechat-search.mjs --api https://rollie-rank.swimmingliu.cn --dry-run
//   node scripts/submit-wechat-search.mjs --submit
//
// 参数：
//   --dry-run           仅拉取套卷目录并输出待推送页面清单（默认安全模式，不调用微信写入接口）
//   --submit            实际调用微信 /wxa/search/wxaapi_submitpages 推送页面
//   --api <origin>      套卷 API 地址（默认 https://rollie-rank.swimmingliu.cn）
//   --include-new-pages 附带需要新版小程序发布后才生效的公开页（rank?versionId / discussion?paperId）
//   --batch-size <n>    单次提交条数（默认 100，微信单次上限 1000）
//   --limit <n>         最多提交页面数（调试用）
//   --env-file <path>   指定 .env 文件路径（默认仓库根目录 .env）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WECHAT_API = "https://api.weixin.qq.com";
const DEFAULT_API_ORIGIN = "https://rollie-rank.swimmingliu.cn";
const DEFAULT_BATCH_SIZE = 100;

export function parseEnvFile(text) {
  const result = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function resolveWechatCredentials(env = process.env, fileEnv = {}) {
  const merged = { ...fileEnv, ...env };
  const appId = (
    merged.ROLLIERANK_WECHAT_APP_ID ||
    merged.WECHAT_APP_ID ||
    merged.weixin_app_id ||
    ""
  ).trim();
  const secret = (
    merged.ROLLIERANK_WECHAT_APP_SECRET ||
    merged.WECHAT_APP_SECRET ||
    merged.weixin_app_secret ||
    ""
  ).trim();
  return { appId, secret };
}

export function buildSearchPages(versions, { includeNewPages = false } = {}) {
  const pages = [];
  const seen = new Set();
  const add = (pagePath, query = "") => {
    const normalizedPath = String(pagePath || "").replace(/^\/+/, "");
    const normalizedQuery = String(query || "").replace(/^\?+/, "");
    if (!normalizedPath) return;
    const key = `${normalizedPath}?${normalizedQuery}`;
    if (seen.has(key)) return;
    seen.add(key);
    pages.push({ path: normalizedPath, query: normalizedQuery });
  };

  add("pages/home/home");
  add("pages/positions/positions");
  add("pages/timer/timer");

  const institutions = new Set();
  const paperIds = new Set();
  for (const version of Array.isArray(versions) ? versions : []) {
    if (!version || version.status === "draft") continue;
    if (version.institution) institutions.add(version.institution);
  }

  for (const institution of [...institutions].sort((a, b) => a.localeCompare(b, "zh"))) {
    add("pages/catalog/catalog", `institution=${encodeURIComponent(institution)}`);
  }

  for (const version of Array.isArray(versions) ? versions : []) {
    if (!version || version.status === "draft" || !version.id) continue;
    add("pages/practice/practice", `versionId=${encodeURIComponent(version.id)}`);
    if (includeNewPages) {
      add("pages/rank/rank", `versionId=${encodeURIComponent(version.id)}`);
      const paperId = version.paperId || version.id;
      if (paperId && !paperIds.has(paperId)) {
        paperIds.add(paperId);
        add("pages/discussion/discussion", `paperId=${encodeURIComponent(paperId)}`);
      }
    }
  }

  return pages;
}

export function chunkPages(pages, batchSize = DEFAULT_BATCH_SIZE) {
  const size = Math.max(1, Math.min(1000, Number(batchSize) || DEFAULT_BATCH_SIZE));
  const chunks = [];
  for (let i = 0; i < pages.length; i += size) {
    chunks.push(pages.slice(i, i + size));
  }
  return chunks;
}

export async function fetchWechatAccessToken({ appId, secret, fetchImpl = globalThis.fetch }) {
  if (!appId || !secret) {
    throw new Error("缺少微信小程序 AppID 或 AppSecret（请配置 ROLLIERANK_WECHAT_APP_ID / ROLLIERANK_WECHAT_APP_SECRET 或 .env 中的 weixin_app_id / weixin_app_secret）。");
  }
  const response = await fetchImpl(new URL("/cgi-bin/stable_token", WECHAT_API), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credential",
      appid: appId,
      secret,
      force_refresh: false,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`获取微信 access_token 失败：HTTP ${response.status}`);
  const result = await response.json();
  if (result?.errcode || !result?.access_token) {
    const error = new Error(`获取微信 access_token 失败：${result?.errcode ?? "未知"} ${result?.errmsg ?? ""}`.trim());
    error.errcode = result?.errcode;
    throw error;
  }
  return result.access_token;
}

export async function submitPagesBatch({ accessToken, pages, fetchImpl = globalThis.fetch }) {
  const url = new URL("/wxa/search/wxaapi_submitpages", WECHAT_API);
  url.searchParams.set("access_token", accessToken);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pages }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`微信收录推送接口返回 HTTP ${response.status}`);
  const result = await response.json();
  return result;
}

function parseArgs(argv) {
  const options = {
    submit: false,
    dryRun: false,
    api: DEFAULT_API_ORIGIN,
    includeNewPages: false,
    batchSize: DEFAULT_BATCH_SIZE,
    limit: 0,
    envFile: path.join(ROOT, ".env"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--submit") options.submit = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--include-new-pages") options.includeNewPages = true;
    else if (arg === "--api" && argv[i + 1]) options.api = argv[++i];
    else if (arg === "--batch-size" && argv[i + 1]) options.batchSize = Number(argv[++i]) || DEFAULT_BATCH_SIZE;
    else if (arg === "--limit" && argv[i + 1]) options.limit = Number(argv[++i]) || 0;
    else if (arg === "--env-file" && argv[i + 1]) options.envFile = argv[++i];
  }
  if (!options.submit) options.dryRun = true;
  return options;
}

async function fetchCatalog(apiOrigin) {
  const url = new URL("/api/catalog", apiOrigin);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`拉取套卷目录失败：${url} 返回 HTTP ${response.status}`);
  const payload = await response.json();
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.versions)) return payload.versions;
  if (Array.isArray(payload?.items)) return payload.items;
  throw new Error("套卷目录响应格式异常，未找到版本数组。");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fileEnv = fs.existsSync(options.envFile) ? parseEnvFile(fs.readFileSync(options.envFile, "utf8")) : {};
  const versions = await fetchCatalog(options.api);
  let pages = buildSearchPages(versions, { includeNewPages: options.includeNewPages });
  if (options.limit > 0) pages = pages.slice(0, options.limit);

  const summary = pages.reduce((acc, item) => {
    acc[item.path] = (acc[item.path] || 0) + 1;
    return acc;
  }, {});

  console.log(`套卷来源: ${options.api}/api/catalog（已发布 ${versions.filter(v => v.status !== "draft").length} 套）`);
  console.log(`待提交页面总数: ${pages.length}`);
  for (const [pagePath, count] of Object.entries(summary)) {
    console.log(`  - ${pagePath}: ${count} 条`);
  }

  if (options.dryRun) {
    console.log("\n[dry-run] 前 12 条示例：");
    for (const item of pages.slice(0, 12)) {
      console.log(`  ${item.path}${item.query ? `?${item.query}` : ""}`);
    }
    console.log("\n确认无误后执行：node scripts/submit-wechat-search.mjs --submit");
    if (!options.includeNewPages) {
      console.log("待新版小程序发布上线后，可追加 --include-new-pages 一并推送公开同卷榜和讨论区页。");
    }
    return;
  }

  const creds = resolveWechatCredentials(process.env, fileEnv);
  const accessToken = await fetchWechatAccessToken(creds);
  const batches = chunkPages(pages, options.batchSize);
  let okCount = 0;

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const result = await submitPagesBatch({ accessToken, pages: batch });
    if (result?.errcode && result.errcode !== 0) {
      console.error(`第 ${index + 1}/${batches.length} 批提交失败：errcode=${result.errcode} errmsg=${result.errmsg || ""}`);
      if (result.errcode === 48001) {
        console.error("提示：当前小程序账号暂无 wxaapi_submitpages 权限（常见于未认证或个人主体限制），可优先依赖 sitemap.json + 页面访问与分享自然收录。");
      }
      process.exitCode = 1;
      return;
    }
    okCount += batch.length;
    console.log(`第 ${index + 1}/${batches.length} 批提交成功（${batch.length} 条）`);
  }

  console.log(`\n完成：共推送 ${okCount} 个页面到微信搜一搜。`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`执行失败：${error.message}`);
    process.exitCode = 1;
  });
}
