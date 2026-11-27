import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("site/llms.txt and site/index.html keep unified OMR + manual entry GEO messaging", () => {
  const llms = fs.readFileSync(path.join(ROOT, "site/llms.txt"), "utf8");
  const indexHtml = fs.readFileSync(path.join(ROOT, "site/index.html"), "utf8");

  assert.equal(llms.includes("不依赖拍照识别"), false);
  assert.equal(indexHtml.includes("不依赖图像识别"), false);
  assert.match(llms, /拍照|扫答题卡/);
  assert.match(indexHtml, /拍照.*扫.*答题卡|扫答题卡/);
});

test("SEO/GEO site pages preserve full crawlable semantic SEO content in visually-hidden layer and valid JSON-LD", () => {
  const css = fs.readFileSync(path.join(ROOT, "site/styles.css"), "utf8");
  const seoRuleMatch = css.match(/\.seo-content\s*\{([^}]+)\}/);
  assert.ok(seoRuleMatch, "site/styles.css should define .seo-content visually-hidden rule");
  const seoRule = seoRuleMatch[1];
  assert.match(seoRule, /width:\s*1px/);
  assert.match(seoRule, /height:\s*1px/);
  assert.match(seoRule, /overflow:\s*hidden/);
  assert.match(seoRule, /clip-path:\s*inset\(50%\)/);
  assert.equal(/display:\s*none/.test(seoRule), false, ".seo-content must not use display:none");
  assert.equal(/visibility:\s*hidden/.test(seoRule), false, ".seo-content must not use visibility:hidden");

  const pages = [
    {
      file: "site/index.html",
      types: ["WebSite", "Organization", "WebPage", "SoftwareApplication", "HowTo", "FAQPage"],
      mustInclude: [
        "行测小助手",
        "行测分数计算器",
        "130 题",
        "135 题",
        "留空的题计入分母",
        "zenme-suan-fen.html",
        "gu-fen-zhun-ma.html",
        "shua-ti-ji-fen.html",
      ],
      minSeoChars: 2500,
    },
    {
      file: "site/zenme-suan-fen.html",
      types: ["WebPage", "BreadcrumbList", "FAQPage"],
      mustInclude: ["130 题", "135 题", "政治理论", "数量关系", "资料分析", "百分制分数"],
      minSeoChars: 1200,
    },
    {
      file: "site/gu-fen-zhun-ma.html",
      types: ["WebPage", "BreadcrumbList", "FAQPage"],
      mustInclude: ["答案版本不同", "分值表版本不同", "留空", "没有固定差值"],
      minSeoChars: 1000,
    },
    {
      file: "site/shua-ti-ji-fen.html",
      types: ["WebPage", "BreadcrumbList", "FAQPage"],
      mustInclude: ["不是题库", "做题计时", "录答", "120 题"],
      minSeoChars: 900,
    },
  ];

  for (const spec of pages) {
    const html = fs.readFileSync(path.join(ROOT, spec.file), "utf8");
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(ldMatch, `${spec.file} should include JSON-LD`);
    const ld = JSON.parse(ldMatch[1]);
    const graphTypes = new Set((ld["@graph"] || []).map((node) => node["@type"]));
    for (const type of spec.types) {
      assert.ok(graphTypes.has(type), `${spec.file} JSON-LD should include ${type}`);
    }

    const seoMatch = html.match(/<section class="seo-content"[^>]*>([\s\S]*?)<\/section>/);
    assert.ok(seoMatch, `${spec.file} should include .seo-content crawlable section`);
    const seoText = seoMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    assert.ok(
      seoText.length >= spec.minSeoChars,
      `${spec.file} .seo-content length (${seoText.length}) should be >= ${spec.minSeoChars}`,
    );
    for (const phrase of spec.mustInclude) {
      assert.ok(seoMatch[1].includes(phrase), `${spec.file} .seo-content should include "${phrase}"`);
    }

    for (const assetMatch of html.matchAll(/(?:src|url\()['"]?(\/assets\/[^'")\s]+)/g)) {
      const assetRel = assetMatch[1].replace(/^\//, "");
      assert.ok(
        fs.existsSync(path.join(ROOT, "site", assetRel)),
        `${spec.file} references missing local asset site/${assetRel}`,
      );
    }
  }
});
