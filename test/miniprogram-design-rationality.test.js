import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import catalog from "../mini-program/utils/catalog.js";
import reportUtil from "../mini-program/utils/report.js";
import { IMPORTED_PAPERS } from "../src/data/imported-papers.js";
import { PAPERS } from "../src/data/papers.js";
import { gradeVersion } from "../src/model.js";

const readMp = rel => readFileSync(new URL("../mini-program/" + rel, import.meta.url), "utf8");

test("miniprogram charts render offscreen canvas to image to prevent native layer overlap", () => {
  const radarWxml = readMp("components/rr-radar/rr-radar.wxml");
  const radarWxss = readMp("components/rr-radar/rr-radar.wxss");
  assert.match(radarWxml, /<image[^>]*class="radar"/);
  assert.match(radarWxss, /\.radar__canvas\s*\{[^}]*left:\s*-9999px/);

  const analyticsWxml = readMp("pages/analytics/analytics.wxml");
  const analyticsWxss = readMp("pages/analytics/analytics.wxss");
  assert.match(analyticsWxml, /<image[^>]*class="analytics__trend"/);
  assert.match(analyticsWxss, /\.analytics__trend-canvas\s*\{[^}]*left:\s*-9999px/);
});

test("WeChat button defaults do not break segmented tabs, filter chips, action rows or mark dots", () => {
  const pickerWxss = readMp("components/rr-position-picker/rr-position-picker.wxss");
  assert.match(pickerWxss, /\.positions__exam\s*\{[^}]*width:\s*100%\s*!important/);
  assert.match(pickerWxss, /\.positions__clear\s*\{[^}]*width:\s*100%\s*!important/);

  const timerWxss = readMp("components/rr-timer-sheet/rr-timer-sheet.wxss");
  assert.match(timerWxss, /\.timer__breadcrumb button\s*\{[^}]*width:\s*auto\s*!important/);
  assert.match(timerWxss, /\.timer__breadcrumb button\s*\{[^}]*align-items:\s*center/);

  const analyticsWxml = readMp("pages/analytics/analytics.wxml");
  const analyticsWxss = readMp("pages/analytics/analytics.wxss");
  assert.match(analyticsWxml, /<page-meta\s+page-style=/);
  assert.match(analyticsWxml, /class="analytics__date-field"/);
  assert.match(analyticsWxss, /\.analytics__source-chip\s*\{[^}]*width:\s*auto\s*!important/);
  assert.match(analyticsWxss, /\.analytics__filter-actions button\s*\{[^}]*align-items:\s*center/);
  assert.doesNotMatch(analyticsWxss, /\.analytics__page-back\s*\{[^}]*rotate\(180deg\)/);

  const practiceWxml = readMp("pages/practice/practice.wxml");
  assert.match(practiceWxml, /class="practice__sheet-dot"/);
  assert.match(practiceWxml, /class="practice__sheet-answered"/);
  assert.doesNotMatch(readMp("pages/practice/practice.wxss"), /practice__sheet-cell--marked::after/);
});

test("UI design rationality: no redundant publisher/exam wording or internal 四海 leak across all shipped papers", () => {
  const firstPeriod = PAPERS.map(paper => ({
    ...paper, institution: "四海", project: "2026 下半年 · 国考行测",
    period: "一期", variant: "地市级 / 行政执法类",
  }));
  const versions = [...firstPeriod, ...IMPORTED_PAPERS].map((paper, index) => ({
    ...paper, id: paper.id + ":audit-" + index, status: "published",
  }));
  const groups = catalog.groupByInstitution(versions);
  for (const group of groups) {
    for (const project of group.projects) {
      const title = catalog.projectTitle(project, group.projects);
      assert.doesNotMatch(title, /四海/, `内部代号泄露: ${title}`);
      assert.doesNotMatch(title, /([^\s·]{2,})\s*·\s*\1/, `系列标题重复词: ${title}`);
      for (const version of project.versions) {
        const card = catalog.paperCardParts(version);
        assert.doesNotMatch(card.primary, /四海|上岸村|超格|粉笔|花生/, `卷卡主标重复机构名: ${card.primary}`);
        assert.ok(card.numeric, `所有套卷卡应保持统一数字卡片格式: ${version.title} -> ${JSON.stringify(card)}`);
        const idText = catalog.practiceIdentity(version);
        assert.doesNotMatch(idText, /四海/, `套卷身份泄露四海: ${idText}`);
        assert.doesNotMatch(idText, /([^\s·]{2,})\s*·\s*\1/, `套卷身份重复词: ${idText}`);
      }
    }
  }
});

test("UI design rationality: clear labels, parameter fidelity and aligned social/report controls", () => {
  const reportWxml = readMp("pages/report/report.wxml");
  assert.match(reportWxml, /summary\.identity/);

  const reviewJs = readMp("pages/review/review.js");
  const reviewWxml = readMp("pages/review/review.wxml");
  assert.match(reviewJs, /decodeURIComponent\(query\.type/);
  assert.match(reviewWxml, /复制错题号/);
  assert.doesNotMatch(reviewWxml, /<button[^>]*review__group-label/);

  const rankWxml = readMp("pages/rank/rank.wxml");
  const rankJs = readMp("pages/rank/rank.js");
  assert.match(rankWxml, /\{\{item\.short\}\}/);
  assert.match(rankJs, /判断推理:\s*"判断"/);
  assert.match(rankWxml, /该岗位暂无考生参与/);

  const discWxml = readMp("pages/discussion/discussion.wxml");
  const discWxss = readMp("pages/discussion/discussion.wxss");
  assert.match(discWxml, /disc__send--ready/);
  assert.match(discWxml, /like-on/);
  assert.match(discWxss, /\.disc__reply-action\s*\{[^}]*align-items:\s*center/);
  assert.match(discWxss, /\.disc__like\s*\{[^}]*margin:\s*0 0 0 auto\s*!important/);

  const posterJs = readMp("utils/poster.js");
  assert.match(posterJs, /"right"/);
  assert.match(posterJs, /"卷卷小榜"/);
  assert.match(posterJs, /drawTiming/);
  assert.match(posterJs, /DEFAULT_STYLE\s*=\s*"ticket"/);
  assert.match(posterJs, /drawDonut/);
  assert.match(posterJs, /drawMiniRing/);
  assert.match(posterJs, /drawRichRadar/);
  assert.doesNotMatch(posterJs, /已核分/);
  const shareWxml = readMp("pages/share/share.wxml");
  assert.match(shareWxml, /share__style-chip/);
  assert.match(shareWxml, /asset\.qrcode/);
  assert.doesNotMatch(shareWxml, /已核分/);
});

test("pages supporting pull-to-refresh wire scroll-view refresher cleanly without root page scrollbar", () => {
  for (const page of ["home", "catalog", "report", "records"]) {
    const js = readMp(`pages/${page}/${page}.js`);
    const wxml = readMp(`pages/${page}/${page}.wxml`);
    const cfg = JSON.parse(readMp(`pages/${page}/${page}.json`));
    assert.equal(cfg.disableScroll, true, `${page}.json 应启用 disableScroll: true 以禁用根页面滚动条`);
    assert.match(js, /\bonRefresherRefresh\s*\(/, `${page}.js 缺少 onRefresherRefresh`);
    assert.match(wxml, /refresher-enabled="\{\{true\}\}"[\s\S]*bindrefresherrefresh="onRefresherRefresh"/, `${page}.wxml 缺少 scroll-view 下拉刷新绑定`);
  }
});

test("scoring precision and repeat-attempt VS comparison: no long float decimals, exact 100-point guokao weights, VS card present", () => {
  const dirtyBands = reportUtil.reportBands([
    { name: "政治理论", centsEarned: 402.0100502512563, maxCents: 1005.0251256281406 },
    { name: "常识判断", centsEarned: 250, maxCents: 750 },
  ]);
  assert.equal(dirtyBands[0].earned, "4.02");
  assert.equal(dirtyBands[0].max, "10.05");
  assert.equal(dirtyBands[1].earned, "2.5");
  assert.equal(dirtyBands[1].max, "7.5");

  for (const paper of IMPORTED_PAPERS) {
    const rawSum = paper.sections.reduce((n, s) => n + (s.end - s.start + 1) * s.cents, 0);
    assert.equal(rawSum, 10000, `${paper.id} 原始分值合计应为 100 分`);
    assert.equal(paper.scoringRule?.normalizationMaxCents, undefined, `${paper.id} 不应再使用除不尽折算`);
    const questions = [...paper.answerKey].map((correctAnswer, i) => {
      const s = paper.sections.find(sec => i + 1 >= sec.start && i + 1 <= sec.end);
      return { number: i + 1, type: s.name, typeId: s.id, correctAnswer, cents: s.cents };
    });
    const graded = gradeVersion({ questions, scoringRule: paper.scoringRule }, [...paper.answerKey]);
    const bands = reportUtil.reportBands(graded.breakdown);
    for (const band of bands) {
      assert.doesNotMatch(String(band.earned), /\.\d{3,}/, `${paper.id} ${band.name} 得分小数位数异常`);
      assert.doesNotMatch(String(band.max), /\.\d{3,}/, `${paper.id} ${band.name} 满分小数位数异常`);
    }
  }

  const prev = {
    id: "att-1", paperId: "chaoge-2027-02", versionId: "chaoge-2027-02:v1",
    questionCount: 130, totalCents: 2240, maxCents: 10000, correct: 30, createdAt: 1000,
    subjects: [{ name: "政治理论", centsEarned: 350, maxCents: 1000 }],
  };
  const curr = {
    id: "att-2", paperId: "chaoge-2027-02", versionId: "chaoge-2027-02:v1",
    answers: Array(130).fill("A"), createdAt: 2000,
    report: {
      totalCents: 2500, maxCents: 10000, correct: 34, rate: 0.25,
      breakdown: [{ name: "政治理论", centsEarned: 450, maxCents: 1000 }],
    },
  };
  assert.equal(reportUtil.buildComparison(curr, []), null);
  const vs = reportUtil.buildComparison(curr, [prev]);
  assert.equal(vs.previousId, "att-1");
  assert.equal(vs.attemptCount, 2);
  assert.equal(vs.previousScore, "22.40");
  assert.equal(vs.currentScore, "25.00");
  assert.equal(vs.deltaText, "+2.60");
  assert.equal(vs.deltaTone, "up");
  assert.equal(vs.subjects[0].deltaText, "+10");

  const reportWxml = readMp("pages/report/report.wxml");
  assert.match(reportWxml, /class="report__vs report__vs--compact"/);
  assert.match(reportWxml, /class="sheet-panel report__vs-sheet"/);
  assert.match(reportWxml, /上次/);
  assert.match(reportWxml, /VS/);
  assert.match(reportWxml, /答案已订正/);
  assert.match(reportWxml, /report__correction-delta/);

  const catalogWxml = readMp("pages/catalog/catalog.wxml");
  assert.match(catalogWxml, /class="cat__paper-top"/);
  assert.match(catalogWxml, /class="cat__paper-foot"/);

  const practiceWxml = readMp("pages/practice/practice.wxml");
  assert.match(practiceWxml, /class="practice__single-badge/);
  assert.match(practiceWxml, /上一题/);
  assert.match(practiceWxml, /下一题/);
});
