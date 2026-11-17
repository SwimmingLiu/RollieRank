import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { gradeVersion } from "../src/model.js";
import { describeScoringRule } from "../src/analytics.js";
import { catalogAttempt } from "./analytics-catalog-fixtures.mjs";
import { buildIOSReportAnalysis, buildIOSStatsAnalysis, createIOSAnalyticsFeature } from "../docs/ui-exploration/ios-v3/features/analytics.js";

const requireUI = createRequire(new URL("../docs/ui-exploration/ios-v3/ui/package.json", import.meta.url));
const { Window } = await import(pathToFileURL(requireUI.resolve("happy-dom")));
function attempt(id, day, { paperId = "paper", institution = "机构甲", weights = [1000, 2000, 1000, 2000, 1000], answers = ["A", "B", null, "A", "A"] } = {}) {
  const questions = weights.map((cents, index) => ({ number: index + 1, type: index < 3 ? "言语理解" : "数量关系", typeId: index < 3 ? "verbal" : "quant", cents, correctAnswer: "A" }));
  return { id, createdAt: new Date(2026, 10, day, 9).getTime(), paperId, versionId: `${paperId}:v1`, paperTitle: `${institution}五题卷`, institution, period: "一期", versionLabel: "1.0", answers, report: gradeVersion({ questions }, answers) };
}
const filters = (extra = {}) => ({ dimension: "total", metric: "rate", sourceId: "all", from: "", to: "", page: "latest", ...extra });

// 只选择卷型，花生与粉笔的不同真实权重也须全部进入地市成长记录。
test("iOS city growth contains all130-question records and never restores a hidden signature subgroup", () => {
  const flower = catalogAttempt({ paperId: "sihai-2026-h2-p2-city-01", id: "flower", createdAt: 1 });
  const fenbi = catalogAttempt({ paperId: "fenbi-2027-guokao-01", id: "fenbi", createdAt: 2 });
  const province = catalogAttempt({ paperId: "sihai-2026-h2-p2-province-01", id: "province", createdAt: 3 });
  assert.notEqual(describeScoringRule(flower).signature, describeScoringRule(fenbi).signature);
  const records = [flower, fenbi, province];
  const city = buildIOSStatsAnalysis(records, {}, filters({ examCategory: "guokao-city", ruleSignature: describeScoringRule(flower).signature }));
  assert.deepEqual(city.rows.map(row => row.id), ["flower", "fenbi"]);
  assert.equal(city.total, 2);
  assert.equal(city.chart.nodes.length, 2);
  assert.deepEqual(city.rows.map(row => row.score), [flower, fenbi].map(record => `${Number((record.report.totalCents / 100).toFixed(2))} / 100`));
  assert.equal(Object.hasOwn(city, "rules"), false);
  assert.equal(Object.hasOwn(city, "ruleId"), false);
  assert.deepEqual(city.categories.map(item => [item.label, item.detail]), [["地市卷（130题）", "2 次练习"], ["副省卷（135题）", "1 次练习"]]);
  const provincial = buildIOSStatsAnalysis(records, {}, filters({ examCategory: "guokao-subprovincial" }));
  assert.deepEqual(provincial.rows.map(row => row.id), ["province"]);
  const empty = buildIOSStatsAnalysis([flower, fenbi], {}, filters({ examCategory: "guokao-subprovincial" }));
  assert.equal(empty.categoryId, "guokao-subprovincial");
  assert.equal(empty.categoryLabel, "副省卷（135题）");
  assert.equal(empty.total, 0);
  assert.equal(empty.categories[1].detail, "0 次练习");
});

// 报告入口只能成为可见来源筛选，不能让其他卷型和“全部套卷”都被隐形截断。
test("a report anchor cannot prefilter category counts or all-paper growth", () => {
  const flower = catalogAttempt({ paperId: "sihai-2026-h2-p2-city-01", id: "flower", createdAt: 1 });
  const fenbi = catalogAttempt({ paperId: "fenbi-2027-guokao-01", id: "fenbi", createdAt: 2 });
  const province = catalogAttempt({ paperId: "sihai-2026-h2-p2-province-01", id: "province", createdAt: 3 });
  const options = { paperId: flower.paperId, versionId: flower.versionId };
  const provincial = buildIOSStatsAnalysis([flower, fenbi, province], options, filters({ examCategory: "guokao-subprovincial", sourceId: "all" }));
  assert.deepEqual(provincial.rows.map(row => row.id), ["province"]);
  assert.deepEqual(provincial.categories.map(category => category.detail), ["2 次练习", "1 次练习"]);
  const city = buildIOSStatsAnalysis([flower, fenbi, province], options, filters({ examCategory: "guokao-city", sourceId: "all" }));
  assert.deepEqual(city.rows.map(row => row.id), ["flower", "fenbi"]);
});

test("report entry initializes a visible source once and category changes clear it", async () => {
  const window = new Window({ url: "http://localhost/ios-v3/app.html" });
  const flower = catalogAttempt({ paperId: "sihai-2026-h2-p2-city-01", id: "flower", createdAt: 1 });
  const fenbi = catalogAttempt({ paperId: "fenbi-2027-guokao-01", id: "fenbi", createdAt: 2 });
  const province = catalogAttempt({ paperId: "sihai-2026-h2-p2-province-01", id: "province", createdAt: 3 });
  let mounted;
  window.RollieUI = { mountAnalyticsStats(_host, props) { mounted = props; return () => {}; } };
  const feature = createIOSAnalyticsFeature({ document: window.document, state: () => ({ attempts: [flower, fenbi, province] }), catalog: () => [], attempt: () => flower, navigate() {} });
  try {
    window.document.body.innerHTML = feature.statsView({ versionId: flower.versionId });
    feature.afterRender();
    assert.equal(mounted.model.categoryId, "guokao-city");
    assert.equal(mounted.model.sourceId, flower.paperId);
    assert.equal(mounted.model.sourceLabel, flower.paperTitle);
    assert.deepEqual(mounted.model.rows.map(row => row.id), ["flower"]);
    mounted.onChange({ examCategory: "guokao-subprovincial" });
    assert.equal(mounted.model.sourceId, "all");
    assert.deepEqual(mounted.model.rows.map(row => row.id), ["province"]);
    mounted.onChange({ examCategory: "guokao-city" });
    assert.deepEqual(mounted.model.rows.map(row => row.id), ["flower", "fenbi"]);
    mounted.onChange({ metric: "accuracy" });
    assert.equal(mounted.model.sourceId, "all");
    assert.equal(mounted.model.total, 2);
  } finally { feature.destroy(); await window.happyDOM.close(); }
});

test("first, sample, incompatible and future-only history create no report analysis", () => {
  const first = attempt("first", 12);
  assert.equal(buildIOSReportAnalysis(first, [first]), null);
  assert.equal(buildIOSReportAnalysis({ ...first, isSample: true }, [first]), null);
  assert.equal(buildIOSReportAnalysis(first, [first, attempt("future", 13)]), null);
  assert.equal(buildIOSReportAnalysis(first, [first, attempt("different", 11, { weights: [2000, 1000, 1000, 2000, 1000] })]), null);
  assert.equal(buildIOSReportAnalysis(first, []), null);
});

test("second practice keeps exact VS metrics and every actual subject", () => {
  const previous = attempt("old", 11, { answers: Array(5).fill("B") });
  const current = attempt("current", 12);
  const model = buildIOSReportAnalysis(current, [current, previous]);
  assert.equal(model.previousScore, 0);
  assert.equal(model.currentScore, 4000);
  assert.equal(model.delta, 4000);
  assert.equal(model.count, 2);
  assert.equal(model.chart, null);
  assert.deepEqual(model.types.map((type) => type.name), ["言语理解", "数量关系"]);
  assert.equal(model.rates.find((metric) => metric.key === "accuracy").after, 0.6);
});

// 全量板块的顺序来自卷内题号；合并判断推理后仍保留自定义板块。
test("VS preserves all six main subjects and additional real subjects with exact signed changes", () => {
  const names = ["政治理论", "常识判断", "言语理解", "数量关系", "图形推理", "定义判断", "类比推理", "逻辑判断", "资料分析", "自定义板块"];
  const questions = names.map((type, index) => ({ number: index + 1, type, typeId: `type-${index}`, cents: 100, correctAnswer: "A" }));
  const record = (id, day, answers) => ({ id, paperId: "all-subjects", versionId: "all-subjects:v1", paperTitle: "完整板块卷", institution: "机构甲", createdAt: new Date(2026, 10, day).getTime(), answers, report: gradeVersion({ questions }, answers) });
  const previous = record("previous", 10, ["A", "B", "B", "A", "A", "B", "A", "B", "B", "A"]);
  const current = record("current", 11, ["B", "A", "A", "A", "A", "A", "B", "B", "A", "A"]);
  const model = buildIOSReportAnalysis(current, [previous, current]);
  assert.deepEqual(model.types.map((type) => type.name), ["政治理论", "常识判断", "言语理解", "数量关系", "判断推理", "资料分析", "自定义板块"]);
  assert.equal(model.types.find((type) => type.name === "政治理论").delta, -1);
  assert.equal(model.types.find((type) => type.name === "常识判断").delta, 1);
  assert.equal(model.types.find((type) => type.name === "数量关系").delta, 0);
  assert.deepEqual(model.types.find((type) => type.name === "判断推理"), { key: "name:判断推理", name: "判断推理", before: .5, after: .5, delta: 0 });
  assert.equal(model.types.find((type) => type.name === "自定义板块").after, 1);
  const missing = structuredClone(current);
  missing.report.rows[0].cents = undefined;
  const unavailable = buildIOSReportAnalysis(missing, [previous, missing]).types[0];
  assert.equal(unavailable.before, 1);
  assert.equal(unavailable.after, null);
  assert.equal(unavailable.delta, null);
});

test("three or more compatible practices add a short real curve ending at current submission", () => {
  const records = [attempt("one", 10), attempt("two", 11), attempt("current", 12), attempt("future", 13)];
  const model = buildIOSReportAnalysis(records[2], records);
  assert.equal(model.count, 3);
  assert.deepEqual(model.chart.nodes.map((point) => point.id), ["one", "two", "current"]);
  assert.equal(model.chart.nodes.at(-1).value, "40");
  assert.equal(model.chart.lines.length, 1);
  const ambiguous = { ...attempt("same-time", 12), createdAt: records[2].createdAt };
  assert.equal(buildIOSReportAnalysis(records[2], [...records, ambiguous]).count, 3);
});

test("custom formats compare their own normalized metrics while preserving raw scores", () => {
  const model = buildIOSStatsAnalysis([attempt("a", 11), attempt("b", 12, { paperId: "other", institution: "机构乙" }), attempt("c", 10, { weights: [2000, 1000, 1000, 2000, 1000] })]);
  assert.equal(model.total, 3);
  assert.equal(model.sources.length, 3);
  assert.deepEqual(model.rows.map(row => row.score), ["50 / 70", "40 / 70", "40 / 70"]);
  assert.equal(Object.hasOwn(model, "ruleLabel"), false);
  const otherFormat = attempt("other-format", 13, { weights: [2000, 2000, 1000, 2000, 1000] });
  const separate = buildIOSStatsAnalysis([attempt("same-format", 11), otherFormat]);
  assert.equal(separate.total, 1);
  assert.equal(separate.rows[0].score, "50 / 80");
});

test("overall and type metrics retain weighted score, accuracy and actual maxima", () => {
  const records = [attempt("a", 11)];
  const rate = buildIOSStatsAnalysis(records, {}, filters({ dimension: "name:言语理解" }));
  assert.equal(rate.rows[0].value, "25%");
  assert.equal(rate.rows[0].score, "10 / 40");
  assert.equal(buildIOSStatsAnalysis(records, {}, filters({ dimension: "name:言语理解", metric: "accuracy" })).rows[0].value, "33.3%");
  assert.equal(buildIOSStatsAnalysis(records, {}, filters({ metric: "totalCents" })).rows[0].value, "40");
  assert.equal(buildIOSStatsAnalysis(records, {}, filters({ dimension: "name:资料分析" })).rows[0].value, "—");
});

test("source and inclusive date bounds select actual snapshots", () => {
  const records = [attempt("a", 11), attempt("b", 12), attempt("c", 12, { paperId: "other" }), attempt("d", 13)];
  const model = buildIOSStatsAnalysis(records, {}, filters({ sourceId: "paper", from: "2026-11-12", to: "2026-11-12" }));
  assert.deepEqual(model.rows.map((row) => row.id), ["b"]);
  assert.equal(buildIOSStatsAnalysis(records, {}, filters({ from: "2026-11-13", to: "2026-11-12" })).boundsValid, false);
});

test("all long-history pages and timestamp ties remain reachable in compact records", () => {
  const records = Array.from({ length: 27 }, (_, index) => attempt(`r${String(index).padStart(2, "0")}`, index + 1));
  records[2].createdAt = records[1].createdAt;
  const all = [];
  for (let page = 0; page < 4; page++) all.push(...buildIOSStatsAnalysis(records, {}, filters({ page })).rows.map((row) => row.id));
  assert.equal(new Set(all).size, 27);
  assert.equal(all.length, 27);
  assert.equal(buildIOSStatsAnalysis(records).rows.length, 3);
  assert.deepEqual(buildIOSStatsAnalysis(records, {}, filters({ page: 0 })).chart.nodes.slice(1, 3).map((node) => node.x), [buildIOSStatsAnalysis(records, {}, filters({ page: 0 })).chart.nodes[1].x, buildIOSStatsAnalysis(records, {}, filters({ page: 0 })).chart.nodes[1].x]);
});

test("corrected reports update VS and full analysis without a score cache", () => {
  const current = attempt("current", 12);
  const old = attempt("old", 11, { answers: Array(5).fill("B") });
  assert.equal(buildIOSReportAnalysis(current, [old, current]).delta, 4000);
  const corrected = attempt("old", 11, { answers: Array(5).fill("A") });
  assert.equal(buildIOSReportAnalysis(current, [corrected, current]).delta, -3000);
  assert.equal(buildIOSStatsAnalysis([corrected, current]).rows[0].value, "100%");
});

test("controller fully hides first and legacy report hosts, and keeps the compact entry navigable", async () => {
  const window = new Window({ url: "http://localhost/ios-v3/app.html" });
  const first = attempt("first", 12);
  let selected = first;
  window.document.body.innerHTML = '<div data-feature="analytics-comparison"></div><div data-feature="analytics-entry"></div>';
  const navigations = [];
  const feature = createIOSAnalyticsFeature({ document: window.document, state: () => ({ attempts: [first] }), catalog: () => [], attempt: () => selected, navigate: (path) => navigations.push(path) });
  try {
    feature.afterRender();
    const host = window.document.querySelector('[data-feature="analytics-comparison"]');
    assert.equal(host.hidden, true);
    assert.equal(host.children.length, 0);
    selected = attempt("legacy", 13);
    feature.afterRender();
    assert.equal(host.hidden, true);
    window.document.querySelector('[data-ios-analytics-entry]').click();
    assert.deepEqual(navigations, ["stats"]);
    assert.ok(!window.document.body.textContent.includes("首次"));
  } finally { feature.destroy(); await window.happyDOM.close(); }
});
