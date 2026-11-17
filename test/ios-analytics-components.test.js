import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const uiDirectory = fileURLToPath(new URL("../docs/ui-exploration/ios-v3/ui/", import.meta.url));
const requireUI = createRequire(path.join(uiDirectory, "package.json"));
const { build } = requireUI("esbuild");
const { Window } = await import(pathToFileURL(requireUI.resolve("happy-dom")));
const temporary = await mkdtemp(path.join(tmpdir(), "rollierank-ios-analytics-components-"));
after(() => rm(temporary, { recursive: true, force: true }));
const bundle = path.join(temporary, "results.cjs");
await build({
  stdin: { contents: 'import React from "react"; import {renderToStaticMarkup} from "react-dom/server"; import {ScoreOverview, ShareArtwork} from "./results.tsx"; export const scoreHTML = props => renderToStaticMarkup(<ScoreOverview {...props}/>); export const shareHTML = props => renderToStaticMarkup(<ShareArtwork {...props} exportMode/>); export const shareLiveHTML = props => renderToStaticMarkup(<ShareArtwork {...props}/>);', resolveDir: uiDirectory, loader: "tsx" },
  bundle: true, platform: "node", format: "cjs", outfile: bundle, jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
});
const { scoreHTML, shareHTML, shareLiveHTML } = requireUI(bundle);
const sections = [{ name: "言语理解", earnedCents: 2000, maxCents: 3000 }, { name: "数量关系", earnedCents: 1000, maxCents: 2000 }];
const props = { total: 30, maxScore: 70, correct: 3, wrong: 1, rank: null, participants: 0, sections, onRank() {}, onReview() {}, logoSrc: "logo.png", publisherLogoSrc: "publisher.png", institution: "机构甲", year: 2026, period: 1, paper: 1 };

function dom(t, html) {
  const window = new Window();
  window.document.body.innerHTML = html;
  t.after(() => window.happyDOM.close());
  return window.document;
}

test("native results and share show unranked without inventing 18/236 or an empty denominator", (t) => {
  for (const data of [{ rank: null, participants: 236 }, { rank: 18, participants: 0 }, { rank: 0, participants: 30 }]) {
    const score = dom(t, scoreHTML({ ...props, ...data }));
    const share = dom(t, shareHTML({ ...props, ...data }));
    for (const element of [score.querySelector(".rr3-rank-link"), share.querySelector(".rr5-poster-rank")]) {
      assert.ok(element.textContent.includes("未参与排名"));
      assert.ok(!element.textContent.includes("236"));
      assert.ok(!element.textContent.includes("18"));
      assert.ok(!element.textContent.includes(" / 0"));
      assert.ok(!element.getAttribute("aria-label").includes("null"));
    }
  }
});

test("actual non-default maximum is shared by result, poster and accessible score summary", (t) => {
  for (const maximum of [70, 120, 37.5]) {
    const score = dom(t, scoreHTML({ ...props, maxScore: maximum }));
    const share = dom(t, shareHTML({ ...props, maxScore: maximum }));
    assert.ok(score.querySelector(".rr3-total").textContent.includes(`/ ${maximum} 分`));
    assert.ok(score.querySelector(".rr3-total").getAttribute("aria-label").includes(`满分${maximum}分`));
    assert.equal(share.querySelector(".rr5-poster-total small").textContent, `满分 ${maximum} 分`);
  }
});

test("omitting maxScore keeps the documented old 100-point call compatible", (t) => {
  const { maxScore, ...legacy } = props;
  assert.ok(dom(t, scoreHTML(legacy)).querySelector(".rr3-total").textContent.includes("/ 100 分"));
  assert.equal(dom(t, shareHTML(legacy)).querySelector(".rr5-poster-total small").textContent, "满分 100 分");
});

test("real ranked attempts retain the native ranking presentation", (t) => {
  const data = { ...props, rank: 2, participants: 9 };
  const score = dom(t, scoreHTML(data));
  const share = dom(t, shareHTML(data));
  assert.equal(score.querySelector(".rr3-rank-link b").textContent, "2");
  assert.equal(score.querySelector(".rr3-rank-link small").textContent, " / 9");
  assert.ok(share.querySelector(".rr5-poster-rank").getAttribute("aria-label").includes("第2名，共9人"));
});

test("analysis host follows the native score summary and precedes the native radar and subjects", (t) => {
  const document = dom(t, scoreHTML(props));
  const host = document.querySelector('[data-feature="analytics-comparison"].ios-feature-host');
  assert.ok(host);
  assert.equal(host.hidden, true);
  // 答案状态已按最新页面要求收进成绩卡，分析仍紧随同一成绩摘要。
  const scoreCard = host.previousElementSibling.querySelector(".rr3-score-card");
  assert.ok(scoreCard);
  assert.equal(scoreCard.querySelectorAll('[data-feature="corrections-status"]').length, 1);
  assert.equal(scoreCard.querySelector('[data-feature="corrections-status"]').children.length, 0);
  assert.ok(host.nextElementSibling.classList.contains("rr6-radar-card"));
  assert.ok(document.querySelector(".rr3-featured-sections"));
});

test("short-paper counts and actual subject count do not inherit 130-question or six-section assumptions", (t) => {
  const score = dom(t, scoreHTML(props));
  const share = dom(t, shareHTML(props));
  assert.deepEqual([...score.querySelectorAll(".rr3-outcomes b")].map((element) => element.textContent), ["3", "1"]);
  assert.equal(score.querySelectorAll(".rr3-subject-card").length, 2);
  assert.equal(share.querySelectorAll(".rr6-rate-row").length, 2);
  assert.ok(share.querySelector(".rr6-share-rates").getAttribute("aria-label").startsWith("2 个板块"));
  assert.ok(!share.body.textContent.includes("130"));
});

// 示例身份在报告、实时分享和导出中都保持静态，正式交卷已自动计分。
test("legacy estimates stay static in the native result and both share surfaces", (t) => {
  const legacy = { ...props, verification: { kind: "legacy" } };
  for (const [html, selector] of [[scoreHTML(legacy), '.rr3-score-label'], [shareLiveHTML(legacy), '.rr5-poster-total'], [shareHTML(legacy), '.rr5-poster-total']]) {
    const document = dom(t, html);
    const status = document.querySelector(`${selector} .rr-score-verification`);
    assert.equal(status.tagName, "SPAN");
    assert.equal(status.textContent, "示例估分");
    assert.equal(document.querySelectorAll('button.rr-score-verification').length, 0);
    assert.ok(!document.body.textContent.includes("核分"));
    assert.ok(!document.body.textContent.includes("答案有误"));
  }
});

test("old and explicitly verified calls retain the original unranked and score presentation", (t) => {
  for (const verification of [undefined, { kind: "verified" }]) {
    const document = dom(t, scoreHTML({ ...props, verification }));
    assert.equal(document.querySelectorAll('.rr-score-verification').length, 0);
    assert.ok(document.querySelector('.rr3-rank-link').textContent.includes("未参与排名"));
    assert.ok(document.querySelector('.rr3-total').textContent.includes("/ 70 分"));
  }
});
