// 使用 Playwright Chromium 批量渲染暖纸风微信公众号封面图（900×383）与小程序跳转卡片图（520×416）。

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readDataUri(filePath, mime) {
  if (!filePath || !fs.existsSync(filePath)) return "";
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function coverTemplateHtml(article, logoDataUri) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 900px;
    height: 383px;
    overflow: hidden;
    background: #FCF8F1;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color: #302B29;
    position: relative;
  }
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle at 86% 18%, rgba(201, 91, 66, 0.14), transparent 44%),
      radial-gradient(circle at 12% 90%, rgba(196, 150, 74, 0.12), transparent 42%),
      linear-gradient(to right, rgba(212, 198, 178, 0.22) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(212, 198, 178, 0.22) 1px, transparent 1px);
    background-size: 100% 100%, 100% 100%, 36px 36px, 36px 36px;
  }
  .card {
    position: relative;
    z-index: 2;
    margin: 26px 32px;
    height: 331px;
    background: rgba(255, 253, 248, 0.94);
    border: 1.5px solid #E7DCCB;
    border-radius: 22px;
    padding: 28px 34px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 12px 30px rgba(74, 54, 34, 0.06);
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .brand img {
    width: 34px;
    height: 34px;
    border-radius: 8px;
  }
  .brand-name {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.4px;
    color: #302B29;
  }
  .badge {
    background: #C95B42;
    color: #FFFDF8;
    font-size: 14px;
    font-weight: 600;
    padding: 5px 14px;
    border-radius: 999px;
    letter-spacing: 0.5px;
  }
  .center {
    margin: 6px 0;
  }
  .kicker {
    font-size: 15px;
    font-weight: 600;
    color: #B47832;
    margin-bottom: 10px;
    letter-spacing: 0.4px;
  }
  h1 {
    font-size: 40px;
    line-height: 1.18;
    font-weight: 800;
    color: #2B2522;
    letter-spacing: -0.5px;
    margin-bottom: 10px;
  }
  .subtitle {
    font-size: 20px;
    line-height: 1.4;
    color: #5C534C;
    font-weight: 500;
  }
  .bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 14px;
    border-top: 1px dashed #E4D7C5;
    font-size: 15px;
    color: #7D7368;
  }
  .cta {
    color: #C95B42;
    font-weight: 700;
  }
</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="card">
    <div class="top">
      <div class="brand">
        ${logoDataUri ? `<img src="${logoDataUri}" alt="卷卷小榜" />` : ""}
        <span class="brand-name">卷卷小榜 · RollieRank</span>
      </div>
      <span class="badge">${escapeHtml(article.badge || "行测估分")}</span>
    </div>
    <div class="center">
      <div class="kicker">${escapeHtml(article.coverKicker || "行测估分与同卷排名")}</div>
      <h1>${escapeHtml(article.coverTitle || article.title)}</h1>
      <div class="subtitle">${escapeHtml(article.coverSubtitle || "")}</div>
    </div>
    <div class="bottom">
      <span>${escapeHtml(article.coverMeta || "130 题地市卷 · 135 题副省卷")}</span>
      <span class="cta">微信搜「卷卷小榜」免费估分 →</span>
    </div>
  </div>
</body>
</html>`;
}

function miniprogramCardHtml(logoDataUri) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 520px;
    height: 416px;
    overflow: hidden;
    background: #FCF8F1;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
    color: #302B29;
    padding: 24px;
    display: flex;
  }
  .card {
    flex: 1;
    background: #FFFDF8;
    border: 1.5px solid #E6DAC8;
    border-radius: 20px;
    padding: 26px 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .head img { width: 44px; height: 44px; border-radius: 10px; }
  .name { font-size: 22px; font-weight: 800; }
  .sub { font-size: 13px; color: #7C7268; margin-top: 2px; }
  .title { font-size: 30px; line-height: 1.25; font-weight: 800; color: #2B2522; margin: 12px 0 10px; }
  .pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill {
    background: #F6EFE2;
    color: #5A5046;
    font-size: 14px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 999px;
  }
  .btn {
    background: #C95B42;
    color: #FFFDF8;
    text-align: center;
    padding: 13px 16px;
    border-radius: 12px;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.4px;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="head">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="卷卷小榜" />` : ""}
      <div>
        <div class="name">卷卷小榜</div>
        <div class="sub">免费 · 无需注册 · 62+ 套主流模考卷</div>
      </div>
    </div>
    <div>
      <div class="title">行测扫卡估分<br/>看同卷全国/岗位榜</div>
      <div class="pills">
        <span class="pill">拍照扫答题卡</span>
        <span class="pill">批量粘贴</span>
        <span class="pill">130/135 分值表</span>
        <span class="pill">跨机构成长曲线</span>
      </div>
    </div>
    <div class="btn">点击进入小程序立即估分 →</div>
  </div>
</body>
</html>`;
}

export function coverDigest(article) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      badge: article.badge,
      coverKicker: article.coverKicker,
      coverTitle: article.coverTitle,
      coverSubtitle: article.coverSubtitle,
      coverMeta: article.coverMeta,
    }))
    .digest("hex")
    .slice(0, 12);
}

export async function renderCovers({
  articles,
  outDir,
  logoPath,
  force = false,
}) {
  const coversDir = path.join(outDir, "covers");
  fs.mkdirSync(coversDir, { recursive: true });
  const manifestPath = path.join(coversDir, "manifest.json");
  const prevManifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : {};
  const nextManifest = { ...prevManifest };

  const logoDataUri = readDataUri(logoPath, "image/png");
  const jobs = [];
  const results = new Map();

  for (const article of articles) {
    const fileName = `${article.slug}.jpg`;
    const filePath = path.join(coversDir, fileName);
    const hash = coverDigest(article);
    results.set(article.slug, { fileName, filePath, hash });
    if (force || !fs.existsSync(filePath) || prevManifest[fileName] !== hash) {
      jobs.push({ type: "cover", article, fileName, filePath, hash });
    }
  }

  const mpCardFile = "miniprogram-card.jpg";
  const mpCardPath = path.join(coversDir, mpCardFile);
  const mpCardHash = "card-v1";
  if (force || !fs.existsSync(mpCardPath) || prevManifest[mpCardFile] !== mpCardHash) {
    jobs.push({ type: "mp-card", fileName: mpCardFile, filePath: mpCardPath, hash: mpCardHash });
  }

  if (jobs.length > 0) {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ deviceScaleFactor: 2 });
      for (const job of jobs) {
        if (job.type === "cover") {
          await page.setViewportSize({ width: 900, height: 383 });
          await page.setContent(coverTemplateHtml(job.article, logoDataUri), { waitUntil: "load" });
          await page.screenshot({ path: job.filePath, type: "jpeg", quality: 90 });
        } else {
          await page.setViewportSize({ width: 520, height: 416 });
          await page.setContent(miniprogramCardHtml(logoDataUri), { waitUntil: "load" });
          await page.screenshot({ path: job.filePath, type: "jpeg", quality: 90 });
        }
        nextManifest[job.fileName] = job.hash;
      }
    } finally {
      await browser.close();
    }
    fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2));
  }

  return {
    coversBySlug: results,
    mpCardPath,
    renderedCount: jobs.length,
  };
}
