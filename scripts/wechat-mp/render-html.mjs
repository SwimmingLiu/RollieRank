// 将结构化文章渲染为 100% 微信公众号兼容的内联 CSS 富文本 HTML，以及本地运营预览与一键复制中心。
// 遵循 paper-cards-1114-v3 暖纸美学：象牙纸底 #FCF8F1、暖墨色 #302B29、克制珊瑚红 #C95B42。

import { MINIPROGRAM_APP_ID } from "./catalog-articles.mjs";

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderScoreTable(table) {
  const rowsHtml = table.rows.map((row, idx) => {
    const bg = idx % 2 === 1 ? "#FAF5EC" : "#FFFFFF";
    return (
      `<tr style="background:${bg};">` +
      `<td style="padding:8px 6px;border-bottom:1px solid #EFE7DA;color:#302B29;font-weight:600;text-align:left;">${escapeHtml(row.type)}</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #EFE7DA;color:#6E665F;text-align:center;">${escapeHtml(row.count)} 题</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #EFE7DA;color:#6E665F;text-align:center;">${escapeHtml(row.unitText)}</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #EFE7DA;color:#C95B42;font-weight:600;text-align:right;">${escapeHtml(row.totalText)}</td>` +
      `</tr>`
    );
  }).join("");

  return (
    `<section style="margin:18px 0 22px 0;border:1px solid #E9E0D2;border-radius:12px;overflow:hidden;background:#FFFFFF;">` +
    `<section style="padding:10px 12px;background:#F6EFE2;border-bottom:1px solid #E9E0D2;font-size:13px;font-weight:700;color:#302B29;">${escapeHtml(table.caption)}</section>` +
    `<table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5;">` +
    `<thead><tr style="background:#FCF8F1;">` +
    `<th style="padding:8px 6px;border-bottom:1px solid #E9E0D2;color:#7D746B;font-weight:600;text-align:left;">板块</th>` +
    `<th style="padding:8px 6px;border-bottom:1px solid #E9E0D2;color:#7D746B;font-weight:600;text-align:center;">题量</th>` +
    `<th style="padding:8px 6px;border-bottom:1px solid #E9E0D2;color:#7D746B;font-weight:600;text-align:center;">单题</th>` +
    `<th style="padding:8px 6px;border-bottom:1px solid #E9E0D2;color:#7D746B;font-weight:600;text-align:right;">小计</th>` +
    `</tr></thead>` +
    `<tbody>${rowsHtml}</tbody>` +
    `<tfoot><tr style="background:#FCF8F1;">` +
    `<td style="padding:9px 6px;color:#302B29;font-weight:700;text-align:left;">合计</td>` +
    `<td style="padding:9px 6px;color:#302B29;font-weight:700;text-align:center;">${escapeHtml(table.totalQuestions)} 题</td>` +
    `<td style="padding:9px 6px;color:#7D746B;text-align:center;">按卷折算</td>` +
    `<td style="padding:9px 6px;color:#C95B42;font-weight:700;text-align:right;">${escapeHtml(table.totalScore)}</td>` +
    `</tr></tfoot>` +
    `</table>` +
    `</section>`
  );
}

function renderMiniprogramBlock(article, { miniprogramCardUrl = "", qrcodeUrl = "", includeMpTag = false } = {}) {
  const parts = [];
  if (includeMpTag && miniprogramCardUrl) {
    parts.push(
      `<p style="margin:18px 0;text-align:center;">` +
      `<mp-miniprogram` +
      ` data-miniprogram-appid="${escapeHtml(MINIPROGRAM_APP_ID)}"` +
      ` data-miniprogram-path="${escapeHtml(article.miniprogramPath || "pages/home/home")}"` +
      ` data-miniprogram-nickname="卷卷小榜"` +
      ` data-miniprogram-title="${escapeHtml(article.miniprogramTitle || "卷卷小榜 · 行测估分与同卷排名")}"` +
      ` data-miniprogram-imageurl="${escapeHtml(miniprogramCardUrl)}"` +
      ` data-miniprogram-type="image"` +
      ` data-miniprogram-servicetype=""` +
      `><img src="${escapeHtml(miniprogramCardUrl)}" alt="${escapeHtml(article.miniprogramTitle || "卷卷小榜")}" style="max-width:100%;border-radius:10px;" /></mp-miniprogram>` +
      `</p>`,
    );
  }

  const qrImgHtml = qrcodeUrl
    ? `<p style="margin:12px 0 8px 0;text-align:center;"><img src="${escapeHtml(qrcodeUrl)}" alt="卷卷小榜微信小程序码" style="width:156px;height:156px;border-radius:10px;border:1px solid #E9E0D2;" /></p>`
    : "";

  parts.push(
    `<section style="margin:22px 0 12px 0;padding:16px 14px;background:#FCF8F1;border:1px solid #E6D9C5;border-radius:12px;text-align:center;">` +
    `<p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#302B29;">微信搜索小程序「卷卷小榜」免费使用</p>` +
    `<p style="margin:0 0 4px 0;font-size:13px;color:#6E665F;line-height:1.65;">拍照/相册扫答题卡 · 手工点选 · 整段批量粘贴<br/>按各套卷分值表算分 · 看同卷全国榜与岗位榜</p>` +
    qrImgHtml +
    `<p style="margin:6px 0 0 0;font-size:12px;color:#8D8378;">直达路径：${escapeHtml(article.miniprogramPath || "pages/home/home")}（免费 · 无需注册）</p>` +
    `</section>`,
  );

  return parts.join("");
}

export function renderWechatArticleHtml(article, options = {}) {
  const sectionsHtml = (article.sections || []).map(section => {
    const paragraphs = (section.paragraphs || [])
      .map(p => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.8;color:#3B3531;letter-spacing:0.2px;">${escapeHtml(p)}</p>`)
      .join("");
    return (
      `<section style="margin:22px 0 0 0;">` +
      `<section style="margin:0 0 12px 0;padding-left:10px;border-left:3.5px solid #C95B42;font-size:16px;font-weight:700;color:#302B29;line-height:1.4;">${escapeHtml(section.heading)}</section>` +
      paragraphs +
      `</section>`
    );
  }).join("");

  const tablesHtml = (article.scoreTables || []).map(renderScoreTable).join("");

  const stepsHtml = (article.steps || []).length
    ? `<section style="margin:22px 0 0 0;">` +
      `<section style="margin:0 0 12px 0;padding-left:10px;border-left:3.5px solid #C95B42;font-size:16px;font-weight:700;color:#302B29;line-height:1.4;">3 步快速估分与复盘</section>` +
      `<section style="padding:14px 14px 6px 14px;background:#FCF8F1;border:1px solid #EFE5D5;border-radius:10px;">` +
      article.steps.map((step, idx) =>
        `<p style="margin:0 0 10px 0;font-size:14.5px;line-height:1.75;color:#3B3531;">` +
        `<strong style="color:#C95B42;">第 ${idx + 1} 步：</strong>${escapeHtml(step)}</p>`,
      ).join("") +
      `</section></section>`
    : "";

  const faqsHtml = (article.faqs || []).length
    ? `<section style="margin:24px 0 0 0;">` +
      `<section style="margin:0 0 12px 0;padding-left:10px;border-left:3.5px solid #C95B42;font-size:16px;font-weight:700;color:#302B29;line-height:1.4;">常见问题速答</section>` +
      article.faqs.map(item =>
        `<section style="margin:0 0 12px 0;padding:12px 14px;background:#FFFFFF;border:1px solid #EFE7DA;border-radius:10px;">` +
        `<p style="margin:0 0 6px 0;font-size:14.5px;font-weight:700;color:#302B29;line-height:1.55;">Q：${escapeHtml(item.q)}</p>` +
        `<p style="margin:0;font-size:14px;color:#5A534D;line-height:1.72;">A：${escapeHtml(item.a)}</p>` +
        `</section>`,
      ).join("") +
      `</section>`
    : "";

  const summaryHtml =
    `<section style="margin:0 0 20px 0;padding:14px 15px;background:#FCF8F1;border:1px solid #E9DEC9;border-radius:12px;">` +
    `<p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#C95B42;letter-spacing:0.6px;">先说结论</p>` +
    `<p style="margin:0;font-size:15px;line-height:1.78;color:#302B29;">${escapeHtml(article.summary)}</p>` +
    `</section>`;

  const footerNote =
    `<p style="margin:14px 0 0 0;font-size:12px;color:#9A9086;text-align:center;line-height:1.6;">` +
    `估分依据各套卷对应参考答案与分值表计算，实际考试成绩以官方公布为准。` +
    `</p>`;

  return (
    `<section style="padding:4px 2px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#302B29;">` +
    summaryHtml +
    sectionsHtml +
    tablesHtml +
    stepsHtml +
    renderMiniprogramBlock(article, options) +
    faqsHtml +
    footerNote +
    `</section>`
  );
}

export function renderPreviewDashboardHtml(items, backendConfig) {
  const cardsHtml = items.map((item, idx) => {
    const coverRel = item.coverFile ? `./covers/${encodeURIComponent(item.coverFile)}` : "";
    return `
      <article class="card" id="article-${idx + 1}">
        <div class="card__meta">
          <span class="tag">Day ${item.article.scheduleDay}</span>
          <span class="tag tag--soft">${escapeHtml(item.article.badge)}</span>
          <span class="slug">${escapeHtml(item.article.slug)}</span>
        </div>
        <h2>${escapeHtml(item.article.title)}</h2>
        <p class="digest">${escapeHtml(item.article.digest)}</p>
        ${coverRel ? `<img class="cover" src="${coverRel}" alt="封面图" />` : ""}
        <div class="actions">
          <button type="button" onclick="copyText(${JSON.stringify(item.article.title)}, this)">复制标题</button>
          <button type="button" onclick="copyText(${JSON.stringify(item.article.digest)}, this)">复制摘要</button>
          <button type="button" class="primary" onclick="copyRichHtml('rich-${idx}', this)">一键复制微信排版</button>
          <button type="button" onclick="copyText(${JSON.stringify(item.article.miniprogramPath)}, this)">复制小程序路径</button>
        </div>
        <details>
          <summary>展开预览微信正文排版（内联样式）</summary>
          <div class="rich-preview" id="rich-${idx}">${item.previewHtml}</div>
        </details>
      </article>
    `;
  }).join("\n");

  const replyRows = (backendConfig.keywordReplies || []).map(rule => `
    <div class="reply-card">
      <div class="reply-head">
        <strong>${escapeHtml(rule.ruleName)}</strong>
        <span class="kw">${escapeHtml(rule.keywords.join(" / "))}</span>
      </div>
      <pre>${escapeHtml(rule.reply)}</pre>
      <button type="button" onclick="copyText(${JSON.stringify(rule.reply)}, this)">复制回复文案</button>
    </div>
  `).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>卷卷小榜 · 微信公众号自动化运营台</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; background: #FCF8F1; color: #302B29; line-height: 1.6; }
    header { max-width: 960px; margin: 0 auto; padding: 28px 20px 12px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .lead { margin: 0; color: #6E665F; font-size: 14px; }
    main { max-width: 960px; margin: 0 auto; padding: 16px 20px 60px; display: grid; gap: 18px; }
    .card, .reply-card { background: #FFFDF8; border: 1px solid #E9E0D2; border-radius: 14px; padding: 18px; }
    .card__meta { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
    .tag { background: #C95B42; color: #FFF; font-size: 12px; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
    .tag--soft { background: #F2E7D5; color: #5D5248; }
    .slug { font-size: 12px; color: #9A9086; font-family: ui-monospace, monospace; }
    h2 { margin: 4px 0 8px; font-size: 18px; }
    .digest { margin: 0 0 12px; font-size: 13.5px; color: #5D554E; }
    .cover { width: 100%; max-width: 540px; border-radius: 10px; border: 1px solid #E9E0D2; display: block; margin-bottom: 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    button { border: 1px solid #DDD1BE; background: #FFF; color: #302B29; padding: 7px 12px; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 500; }
    button.primary { background: #C95B42; border-color: #C95B42; color: #FFF; }
    button:hover { opacity: 0.9; }
    details summary { cursor: pointer; font-size: 13.5px; color: #C95B42; font-weight: 600; padding: 6px 0; }
    .rich-preview { max-width: 580px; margin: 12px auto 0; background: #FFF; padding: 16px; border: 1px solid #EFE7DA; border-radius: 12px; }
    .reply-head { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .kw { font-size: 12px; color: #C95B42; }
    pre { white-space: pre-wrap; background: #FCF8F1; padding: 12px; border-radius: 8px; font-size: 13px; font-family: inherit; margin: 0 0 10px; }
  </style>
</head>
<body>
  <header>
    <h1>卷卷小榜 · 微信公众号自动化运营台</h1>
    <p class="lead">共生成 ${items.length} 篇微信 GEO 图文与暖纸风封面图。已配公众号 AppID/Secret 时可运行 <code>npm run mp:sync</code> 自动推送草稿箱；也可点下方按钮一键复制微信富文本直接粘进公众号后台。</p>
  </header>
  <main>
    <section class="card">
      <h2>一、公众号关注欢迎语与关键词自动回复</h2>
      <div class="reply-card" style="margin-top:10px;">
        <div class="reply-head"><strong>关注后自动回复</strong><span class="kw">用户首次关注触发</span></div>
        <pre>${escapeHtml(backendConfig.welcomeReply)}</pre>
        <button type="button" onclick="copyText(${JSON.stringify(backendConfig.welcomeReply)}, this)">复制欢迎语</button>
      </div>
      <div style="display:grid;gap:10px;margin-top:10px;">${replyRows}</div>
    </section>
    ${cardsHtml}
  </main>
  <script>
    async function copyText(text, btn) {
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = "已复制";
      setTimeout(() => (btn.textContent = old), 1500);
    }
    async function copyRichHtml(id, btn) {
      const node = document.getElementById(id);
      const html = node.innerHTML;
      const text = node.innerText;
      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      const old = btn.textContent;
      btn.textContent = "已复制排版（直接去公众号粘贴）";
      setTimeout(() => (btn.textContent = old), 2000);
    }
  </script>
</body>
</html>`;
}
