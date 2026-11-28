import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  MINIPROGRAM_APP_ID,
  buildAllArticles,
  buildBackendConfig,
  extractScoreRows,
  groupCatalogIntoSeries,
} from "../scripts/wechat-mp/catalog-articles.mjs";
import {
  renderPreviewDashboardHtml,
  renderWechatArticleHtml,
} from "../scripts/wechat-mp/render-html.mjs";
import {
  createWechatMpClient,
  explainWechatError,
  resolveMpCredentials,
} from "../scripts/wechat-mp/client.mjs";

const SAMPLE_VERSIONS = [
  {
    id: "sihai-2026-h2-01:v1",
    paperId: "sihai-2026-h2-01",
    number: 1,
    institution: "四海",
    project: "2026 下半年 · 国考行测",
    period: "一期",
    variant: "地市级 / 行政执法类",
    status: "published",
    questionCount: 130,
    timeLimitMinutes: 120,
    maxCents: 10000,
    questions: [
      ...Array.from({ length: 20 }, (_, i) => ({ number: i + 1, type: "政治理论", cents: 50 })),
      ...Array.from({ length: 20 }, (_, i) => ({ number: i + 111, type: "资料分析", cents: 100 })),
    ],
  },
  {
    id: "chaoge-2027-01:v1",
    paperId: "chaoge-2027-01",
    number: 1,
    institution: "超格",
    project: "2027 公考 · 行测",
    period: "10套卷",
    variant: "130题版",
    status: "published",
    questionCount: 130,
    timeLimitMinutes: 120,
    maxCents: 10000,
    questions: [
      ...Array.from({ length: 30 }, (_, i) => ({ number: i + 1, type: "言语理解", cents: 80 })),
    ],
  },
  {
    id: "draft-hidden:v1",
    institution: "粉笔",
    status: "draft",
    questionCount: 130,
  },
];

test("catalog-articles groups published series, extracts exact score rows, and skips drafts", () => {
  const series = groupCatalogIntoSeries(SAMPLE_VERSIONS);
  assert.equal(series.length, 2);
  assert.equal(series[0].publisher, "花生十三（四海）");

  const rows = extractScoreRows(SAMPLE_VERSIONS[0]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].type, "政治理论");
  assert.equal(rows[0].totalText, "10 分");
  assert.equal(rows[1].type, "资料分析");
  assert.equal(rows[1].totalText, "20 分");

  const articles = buildAllArticles(SAMPLE_VERSIONS);
  // 4 evergreen + 2 series = 6
  assert.equal(articles.length, 6);
  assert.ok(articles.every(a => a.title.length <= 64));
  assert.ok(articles.every(a => a.digest.length <= 120));
  assert.ok(articles.every(a => a.summary.length >= 40));
  assert.ok(articles.every(a => Array.isArray(a.faqs) && a.faqs.length >= 2));
  assert.ok(articles.every(a => !/套卷.*套卷/.test(a.title)), "titles must not repeat 套卷");
});

test("render-html produces WeChat-safe inline HTML with mp-miniprogram tag and preview dashboard", () => {
  const articles = buildAllArticles(SAMPLE_VERSIONS);
  const article = articles[0];
  const html = renderWechatArticleHtml(article, {
    miniprogramCardUrl: "https://mmbiz.qpic.cn/mmbiz_jpg/demo/0",
    qrcodeUrl: "https://mmbiz.qpic.cn/mmbiz_jpg/qr/0",
    includeMpTag: true,
  });

  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("<style"), false);
  assert.ok(html.includes("先说结论"));
  assert.ok(html.includes("<table"));
  assert.ok(html.includes("<mp-miniprogram"));
  assert.ok(html.includes(`data-miniprogram-appid="${MINIPROGRAM_APP_ID}"`));
  assert.ok(html.includes("https://mmbiz.qpic.cn/mmbiz_jpg/demo/0"));

  const series = groupCatalogIntoSeries(SAMPLE_VERSIONS);
  const config = buildBackendConfig(series);
  assert.equal(config.customMenu.button.length, 3);
  assert.ok(config.customMenu.button.every(b => !b.sub_button || b.sub_button.length <= 5));
  assert.equal(config.customMenu.button[0].appid, MINIPROGRAM_APP_ID);

  const dashboard = renderPreviewDashboardHtml(
    [{ article, coverFile: "demo.jpg", previewHtml: html }],
    config,
  );
  assert.ok(dashboard.includes("一键复制微信排版"));
  assert.ok(dashboard.includes(article.title));
});

test("wechat-mp client authenticates, uploads media, adds/updates drafts, and translates errors", async () => {
  const calls = [];
  const tmpImg = path.join(os.tmpdir(), `rollierank-mp-test-${Date.now()}.jpg`);
  fs.writeFileSync(tmpImg, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  const mockFetch = async (url, init = {}) => {
    const href = String(url);
    calls.push({ href, method: init.method || "GET" });
    if (href.includes("/cgi-bin/stable_token")) {
      return { ok: true, json: async () => ({ access_token: "tok_123", expires_in: 7200 }) };
    }
    if (href.includes("/cgi-bin/material/add_material")) {
      return { ok: true, json: async () => ({ media_id: "thumb_abc", url: "https://mmbiz.qpic.cn/thumb" }) };
    }
    if (href.includes("/cgi-bin/media/uploadimg")) {
      return { ok: true, json: async () => ({ url: "https://mmbiz.qpic.cn/body_img" }) };
    }
    if (href.includes("/cgi-bin/draft/add")) {
      return { ok: true, json: async () => ({ media_id: "draft_001" }) };
    }
    if (href.includes("/cgi-bin/freepublish/submit")) {
      return { ok: true, json: async () => ({ errcode: 48001, errmsg: "api unauthorized" }) };
    }
    throw new Error(`unexpected url ${href}`);
  };

  try {
    const client = createWechatMpClient({
      appId: "wxmp123456",
      secret: "secret789",
      fetchImpl: mockFetch,
    });
    const token = await client.getAccessToken();
    assert.equal(token, "tok_123");

    const perm = await client.uploadPermanentImage(tmpImg);
    assert.equal(perm.media_id, "thumb_abc");

    const img = await client.uploadContentImage(tmpImg);
    assert.equal(img.url, "https://mmbiz.qpic.cn/body_img");

    const draft = await client.addDraft({ title: "test", content: "<p>hi</p>", thumb_media_id: "thumb_abc" });
    assert.equal(draft.media_id, "draft_001");

    await assert.rejects(
      () => client.submitPublish("draft_001"),
      (err) => err.errcode === 48001 && err.message.includes("个人未认证订阅号"),
    );

    // token should be cached after first fetch
    assert.equal(calls.filter(c => c.href.includes("stable_token")).length, 1);
  } finally {
    fs.rmSync(tmpImg, { force: true });
  }

  assert.match(explainWechatError(40164, "invalid ip 1.2.3.4"), /1\.2\.3\.4/);
  assert.deepEqual(
    resolveMpCredentials({}, { WECHAT_MP_APP_ID: "wx_mp", WECHAT_MP_APP_SECRET: "sec_mp" }),
    { appId: "wx_mp", secret: "sec_mp" },
  );
});
