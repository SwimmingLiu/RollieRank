#!/usr/bin/env node
// 卷卷小榜 · 微信公众号全自动运营引擎（生成 GEO 图文 + 暖纸封面 + 草稿箱同步 + 定时自动追新卷）
//
// 常用命令：
//   npm run mp:generate                       生成全部图文、暖纸封面、本地一键复制预览台与后台配置
//   npm run mp:check                          检查公众号 AppID/Secret、IP 白名单与草稿箱权限
//   npm run mp:sync                           将新增/有更新的文章自动上传素材并同步到微信公众号草稿箱
//   npm run mp:sync -- --only xingce-fenshu-zenme-suan
//   npm run mp:sync -- --publish              同步草稿箱并尝试调用官方发布接口（认证号可用）
//   npm run mp:autopilot                      定时任务总入口：拉取新卷 -> 生成图文封面 -> 同步草稿箱 -> 推送小程序搜一搜

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildAllArticles,
  buildBackendConfig,
  groupCatalogIntoSeries,
} from "./catalog-articles.mjs";
import {
  renderPreviewDashboardHtml,
  renderWechatArticleHtml,
} from "./render-html.mjs";
import { renderCovers } from "./render-covers.mjs";
import {
  createWechatMpClient,
  parseEnvFile,
  resolveMpCredentials,
  sha256File,
} from "./client.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_API_ORIGIN = "https://rollie-rank.swimmingliu.cn";
const DEFAULT_OUT_DIR = path.join(ROOT, ".local/wechat-mp");
const LOGO_PATH = path.join(ROOT, "assets/rollierank-logo-transparent.png");
const QRCODE_PATH = path.join(ROOT, "mini-program/assets/miniprogram-qrcode.jpg");

function parseArgs(argv) {
  const opts = {
    mode: "generate",
    api: DEFAULT_API_ORIGIN,
    outDir: DEFAULT_OUT_DIR,
    envFile: path.join(ROOT, ".env"),
    catalogFile: "",
    only: "",
    limit: 0,
    publish: false,
    syncMenu: false,
    forceCovers: false,
    skipCovers: false,
    withStats: false,
    includeNewPages: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--generate") opts.mode = "generate";
    else if (arg === "--check") opts.mode = "check";
    else if (arg === "--sync") opts.mode = "sync";
    else if (arg === "--autopilot") opts.mode = "autopilot";
    else if (arg === "--publish") opts.publish = true;
    else if (arg === "--sync-menu") opts.syncMenu = true;
    else if (arg === "--force-covers") opts.forceCovers = true;
    else if (arg === "--skip-covers") opts.skipCovers = true;
    else if (arg === "--with-stats") opts.withStats = true;
    else if (arg === "--include-new-pages") opts.includeNewPages = true;
    else if (arg === "--api" && argv[i + 1]) opts.api = argv[++i];
    else if (arg === "--out-dir" && argv[i + 1]) opts.outDir = path.resolve(argv[++i]);
    else if (arg === "--env-file" && argv[i + 1]) opts.envFile = path.resolve(argv[++i]);
    else if (arg === "--catalog-file" && argv[i + 1]) opts.catalogFile = path.resolve(argv[++i]);
    else if (arg === "--only" && argv[i + 1]) opts.only = argv[++i];
    else if (arg === "--limit" && argv[i + 1]) opts.limit = Number(argv[++i]) || 0;
  }
  return opts;
}

function loadState(statePath) {
  if (!fs.existsSync(statePath)) {
    return { permanentImages: {}, contentImages: {}, drafts: {}, knownSeriesKeys: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return {
      permanentImages: parsed.permanentImages || {},
      contentImages: parsed.contentImages || {},
      drafts: parsed.drafts || {},
      knownSeriesKeys: parsed.knownSeriesKeys || [],
      lastRunAt: parsed.lastRunAt || null,
    };
  } catch {
    return { permanentImages: {}, contentImages: {}, drafts: {}, knownSeriesKeys: [] };
  }
}

function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  state.lastRunAt = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

async function fetchCatalog(opts) {
  if (opts.catalogFile) {
    const raw = JSON.parse(fs.readFileSync(opts.catalogFile, "utf8"));
    return Array.isArray(raw) ? raw : raw.versions || raw.items || [];
  }
  const url = new URL("/api/catalog", opts.api);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`拉取套卷目录失败：${url} 返回 HTTP ${response.status}`);
  const payload = await response.json();
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.versions)) return payload.versions;
  if (Array.isArray(payload?.items)) return payload.items;
  throw new Error("套卷目录返回格式异常。");
}

async function fetchSeriesStats(apiOrigin, versions) {
  const stats = new Map();
  // 只采样每个系列的第 1 套卷，避免过多请求
  const sampled = versions.slice(0, 12);
  await Promise.all(sampled.map(async (version) => {
    try {
      const url = new URL("/api/positions/leaderboard", apiOrigin);
      url.searchParams.set("versionId", version.id);
      url.searchParams.set("scope", "nationwide");
      url.searchParams.set("dimension", "total");
      url.searchParams.set("page", "1");
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return;
      const data = await res.json();
      if (Number.isFinite(data?.count)) {
        stats.set(version.id, { count: data.count });
      }
    } catch {
      // 忽略单套统计拉取失败，不影响文章生成
    }
  }));
  return stats;
}

function buildCalendarMarkdown(articles) {
  const lines = [
    "# 卷卷小榜 · 微信公众号 GEO 内容排期表",
    "",
    "> 个人订阅号每日可群发 1 次。按以下节奏连续发布，优先占领微信搜索与微信 AI 搜索（GEO）的核心常青词和 4 大主流机构模考词。",
    "",
    "| 排期 | 类型 | 标题 | 目标搜索词 | 跳转小程序路径 |",
    "| :--- | :--- | :--- | :--- | :--- |",
  ];
  for (const a of articles) {
    lines.push(
      `| Day ${a.scheduleDay} | ${a.badge} | ${a.title} | ${a.keywords.slice(0, 3).join(" / ")} | \`${a.miniprogramPath}\` |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function contentSignature(article, html) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ title: article.title, digest: article.digest, html }))
    .digest("hex")
    .slice(0, 16);
}

async function runGenerate(opts) {
  fs.mkdirSync(opts.outDir, { recursive: true });
  const articlesDir = path.join(opts.outDir, "articles");
  fs.mkdirSync(articlesDir, { recursive: true });

  const versions = await fetchCatalog(opts);
  const seriesList = groupCatalogIntoSeries(versions);
  const statsByVersion = opts.withStats ? await fetchSeriesStats(opts.api, versions) : new Map();
  let articles = buildAllArticles(versions, { statsByVersion });
  if (opts.only) {
    articles = articles.filter(a => a.slug === opts.only || a.id === opts.only);
  }
  if (opts.limit > 0) {
    articles = articles.slice(0, opts.limit);
  }

  let coverResult = { coversBySlug: new Map(), mpCardPath: "", renderedCount: 0 };
  if (!opts.skipCovers) {
    coverResult = await renderCovers({
      articles,
      outDir: opts.outDir,
      logoPath: LOGO_PATH,
      force: opts.forceCovers,
    });
  }

  const localQrDataUri = fs.existsSync(QRCODE_PATH)
    ? `data:image/jpeg;base64,${fs.readFileSync(QRCODE_PATH).toString("base64")}`
    : "";

  const items = [];
  for (const article of articles) {
    const coverInfo = coverResult.coversBySlug.get(article.slug) || null;
    const previewHtml = renderWechatArticleHtml(article, {
      qrcodeUrl: localQrDataUri,
      includeMpTag: false,
    });
    const htmlPath = path.join(articlesDir, `${article.slug}.html`);
    const jsonPath = path.join(articlesDir, `${article.slug}.json`);
    fs.writeFileSync(htmlPath, previewHtml);
    fs.writeFileSync(jsonPath, JSON.stringify({
      ...article,
      coverFile: coverInfo?.fileName || "",
      coverPath: coverInfo?.filePath || "",
      htmlPath,
    }, null, 2));
    items.push({
      article,
      coverFile: coverInfo?.fileName || "",
      coverPath: coverInfo?.filePath || "",
      previewHtml,
    });
  }

  const backendConfig = buildBackendConfig(seriesList);
  const configPath = path.join(opts.outDir, "mp-backend-config.json");
  fs.writeFileSync(configPath, JSON.stringify(backendConfig, null, 2));

  const calendarPath = path.join(opts.outDir, "content-calendar.md");
  fs.writeFileSync(calendarPath, buildCalendarMarkdown(articles));

  const previewPath = path.join(opts.outDir, "preview.html");
  fs.writeFileSync(previewPath, renderPreviewDashboardHtml(items, backendConfig));

  const statePath = path.join(opts.outDir, "state.json");
  const state = loadState(statePath);
  const currentKeys = seriesList.map(s => s.key);
  const newlyDetected = currentKeys.filter(k => !state.knownSeriesKeys.includes(k));
  state.knownSeriesKeys = currentKeys;
  saveState(statePath, state);

  console.log(`已拉取套卷 ${versions.filter(v => v.status !== "draft").length} 套（${seriesList.length} 个系列）。`);
  console.log(`已生成 ${items.length} 篇微信公众号 GEO 图文（新渲染图片 ${coverResult.renderedCount} 张）。`);
  if (newlyDetected.length > 0) {
    console.log(`发现新增套卷系列 ${newlyDetected.length} 个：${newlyDetected.join("；")}`);
  }
  console.log(`本地预览与一键复制台：${previewPath}`);
  console.log(`公众号后台配置（菜单/自动回复）：${configPath}`);
  console.log(`内容发布排期表：${calendarPath}`);

  return {
    items,
    seriesList,
    backendConfig,
    mpCardPath: coverResult.mpCardPath,
    statePath,
  };
}

function getClient(opts) {
  const fileEnv = fs.existsSync(opts.envFile) ? parseEnvFile(fs.readFileSync(opts.envFile, "utf8")) : {};
  const creds = resolveMpCredentials(process.env, fileEnv);
  return { creds, client: createWechatMpClient(creds) };
}

async function runCheck(opts) {
  const { creds, client } = getClient(opts);
  if (!creds.appId || !creds.secret) {
    console.log("状态：尚未配置微信公众号凭证。");
    console.log("请在仓库根目录 .env 中添加以下两行后重新执行 npm run mp:check：");
    console.log("  WECHAT_MP_APP_ID=你的公众号AppID");
    console.log("  WECHAT_MP_APP_SECRET=你的公众号AppSecret");
    console.log("\n位置：微信公众平台 → 设置与开发 → 基本配置（同时把服务器 IP 118.25.65.206 或本机出口 IP 加进 IP 白名单）。");
    process.exitCode = 2;
    return false;
  }
  console.log(`已检测到公众号 AppID：${creds.appId.slice(0, 6)}...${creds.appId.slice(-4)}`);
  await client.getAccessToken();
  console.log("✓ access_token 获取成功（IP 白名单校验通过）");
  try {
    const drafts = await client.listDrafts({ offset: 0, count: 5 });
    console.log(`✓ 草稿箱接口可用（当前云端草稿总数：${drafts.total_count ?? 0}）`);
  } catch (error) {
    console.error(`✗ 草稿箱接口检查失败：${error.message}`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function ensurePermanentImage(client, state, filePath) {
  const hash = sha256File(filePath);
  if (state.permanentImages[hash]?.media_id) {
    return state.permanentImages[hash];
  }
  const res = await client.uploadPermanentImage(filePath);
  state.permanentImages[hash] = {
    media_id: res.media_id,
    url: res.url || "",
    fileName: path.basename(filePath),
    uploadedAt: new Date().toISOString(),
  };
  return state.permanentImages[hash];
}

async function ensureContentImage(client, state, filePath) {
  if (!filePath || !fs.existsSync(filePath)) return "";
  const hash = sha256File(filePath);
  if (state.contentImages[hash]?.url) {
    return state.contentImages[hash].url;
  }
  const res = await client.uploadContentImage(filePath);
  state.contentImages[hash] = {
    url: res.url,
    fileName: path.basename(filePath),
    uploadedAt: new Date().toISOString(),
  };
  return res.url;
}

async function runSync(opts, generated = null) {
  const { creds, client } = getClient(opts);
  if (!creds.appId || !creds.secret) {
    console.log("跳过草稿箱同步：.env 尚未配置 WECHAT_MP_APP_ID / WECHAT_MP_APP_SECRET。");
    console.log("你现在就可以直接打开 .local/wechat-mp/preview.html 一键复制富文本粘贴进公众号后台，或在 .env 配好公众号 AppID/Secret 后运行 npm run mp:sync 自动推送草稿箱。");
    return { synced: 0, skipped: 0, configured: false };
  }

  const data = generated || await runGenerate(opts);
  const state = loadState(data.statePath);

  const mpCardUrl = data.mpCardPath
    ? await ensureContentImage(client, state, data.mpCardPath)
    : "";
  const qrcodeUrl = await ensureContentImage(client, state, QRCODE_PATH);
  saveState(data.statePath, state);

  let synced = 0;
  let skipped = 0;

  for (const item of data.items) {
    const { article, coverPath } = item;
    if (!coverPath || !fs.existsSync(coverPath)) {
      throw new Error(`文章 ${article.slug} 缺少封面图，请先去掉 --skip-covers 重新生成。`);
    }
    const content = renderWechatArticleHtml(article, {
      miniprogramCardUrl: mpCardUrl,
      qrcodeUrl,
      includeMpTag: Boolean(mpCardUrl),
    });
    const sig = contentSignature(article, content);
    const existing = state.drafts[article.slug];

    if (existing && existing.signature === sig && !opts.publish) {
      skipped += 1;
      console.log(`- 跳过未变更草稿：${article.title}`);
      continue;
    }

    const thumb = await ensurePermanentImage(client, state, coverPath);
    const payload = {
      title: article.title.slice(0, 64),
      author: (article.author || "卷卷小榜").slice(0, 8),
      digest: article.digest.slice(0, 120),
      content,
      content_source_url: "https://rank.swimmingliu.cn/",
      thumb_media_id: thumb.media_id,
      need_open_comment: 1,
      only_fans_can_comment: 0,
    };

    let mediaId = existing?.media_id || "";
    if (mediaId) {
      try {
        await client.updateDraft(mediaId, payload, 0);
        console.log(`✓ 已更新草稿箱：${article.title}（media_id=${mediaId}）`);
      } catch {
        // 若用户在后台手动删掉了原草稿，则自动新建
        const created = await client.addDraft(payload);
        mediaId = created.media_id;
        console.log(`✓ 原草稿已移除，已重新写入草稿箱：${article.title}（media_id=${mediaId}）`);
      }
    } else {
      const created = await client.addDraft(payload);
      mediaId = created.media_id;
      console.log(`✓ 已写入草稿箱：${article.title}（media_id=${mediaId}）`);
    }

    state.drafts[article.slug] = {
      media_id: mediaId,
      signature: sig,
      title: article.title,
      updatedAt: new Date().toISOString(),
    };
    saveState(data.statePath, state);
    synced += 1;

    if (opts.publish && mediaId) {
      try {
        const pub = await client.submitPublish(mediaId);
        console.log(`  ↳ 已提交发布（publish_id=${pub.publish_id}）`);
      } catch (error) {
        console.log(`  ↳ 跳过自动发布：${error.message}（草稿已安全保存在公众号草稿箱，登录后台一键发布即可）`);
      }
    }
  }

  if (opts.syncMenu) {
    try {
      await client.createMenu(data.backendConfig.customMenu);
      console.log("✓ 已同步自定义菜单到公众号后台。");
    } catch (error) {
      console.log(`! 自定义菜单接口跳过：${error.message}`);
    }
  }

  console.log(`\n同步完成：本次写入/更新 ${synced} 篇，未变更跳过 ${skipped} 篇。`);
  return { synced, skipped, configured: true };
}

async function runAutopilot(opts) {
  console.log("=== [1/3] 拉取线上套卷与生成微信 GEO 图文/封面 ===");
  const generated = await runGenerate({ ...opts, withStats: true });

  console.log("\n=== [2/3] 同步微信公众号草稿箱 ===");
  await runSync(opts, generated);

  console.log("\n=== [3/3] 同步推送小程序公开页到微信搜一搜 ===");
  const submitScript = path.join(ROOT, "scripts/submit-wechat-search.mjs");
  const args = [submitScript, "--submit", "--api", opts.api];
  if (opts.includeNewPages) args.push("--include-new-pages");
  try {
    execFileSync(process.execPath, args, { stdio: "inherit" });
  } catch (error) {
    console.error(`! 微信搜一搜推送返回非零退出码：${error.message}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.mode === "check") {
    await runCheck(opts);
  } else if (opts.mode === "sync") {
    await runSync(opts);
  } else if (opts.mode === "autopilot") {
    await runAutopilot(opts);
  } else {
    await runGenerate(opts);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`执行失败：${error.message}`);
    process.exitCode = 1;
  });
}
