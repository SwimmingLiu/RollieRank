import test from "node:test";
import assert from "node:assert/strict";
import { gradeVersion } from "../src/model.js";
import { createAnalyticsFeature } from "../src/features/analytics.js";
import { catalogAttempt } from "./analytics-catalog-fixtures.mjs";

function attempt(id, time, { paperId = "paper", institution = "机构甲", answers = ["A", "B"], types = ["言语理解", "数量关系"], weights = [50, 100] } = {}) {
  return { id, createdAt: time, paperId, versionId: `${paperId}:v1`, institution, paperTitle: `${institution}套卷`, period: "一期", versionLabel: "1.0", report: gradeVersion({ questions: weights.map((cents, i) => ({ number: i + 1, type: types[i], typeId: `t${i}`, cents, correctAnswer: "A" })) }, answers) };
}

function harness(attempts, selected = attempts.at(-1)) {
  const events = new Map();
  const mounts = { entry: { innerHTML: "" }, report: { innerHTML: "" } };
  let state = { attempts };
  let renders = 0;
  let html = "";
  const document = {
    activeElement: null,
    addEventListener: (name, handler) => { assert.equal(events.has(name), false); events.set(name, handler); },
    removeEventListener: (name) => events.delete(name),
    querySelectorAll: (selector) => selector.includes("analytics-entry") ? [mounts.entry] : [mounts.report],
    getElementById: () => null,
  };
  const ctx = { document, state: () => state, catalog: () => [], attempt: () => selected, render: () => { renders++; html = feature.statsView(); feature.afterRender(); } };
  const feature = createAnalyticsFeature(ctx);
  function control(field, value, scope = "overall") {
    const root = { dataset: { analyticsScope: scope } };
    const target = { value, dataset: { analyticsControl: field }, closest: (selector) => selector === "[data-analytics-scope]" ? root : target };
    events.get("change")({ target });
  }
  function action(action, data, scope = "overall") {
    const root = { dataset: { analyticsScope: scope } };
    const target = { dataset: { analyticsAction: action, ...data }, closest: (selector) => selector === "[data-analytics-scope]" ? root : target };
    events.get("click")({ target });
  }
  return { feature, events, mounts, control, action, get html() { return html; }, get renders() { return renders; }, replaceAttempts: (attempts) => { state = { attempts }; } };
}

test("stats render all requested controls, equivalent data and source/report links", () => {
  const h = harness([attempt("a", 1000), attempt("b", 2000, { paperId: "other", institution: "机构乙" })]);
  const html = h.feature.statsView();
  for (const field of ["examCategory", "dimension", "metric", "sourceId", "from", "to"]) assert.ok(html.includes(`data-analytics-control="${field}"`));
  assert.ok(html.includes("每次练习数据"));
  assert.equal(html.includes('data-analytics-control="ruleSignature"'), false);
  assert.equal(html.includes("评分依据"), false);
  assert.ok(html.includes("机构甲套卷"));
  assert.ok(html.includes("机构乙套卷"));
  assert.ok(html.includes('#/report/a'));
  assert.ok(html.includes('tabindex="0" role="group"'));
  assert.ok(!html.includes("用时"));
  assert.ok(!html.includes("data-action="));
});

test("delegated filters update actual records and retain a missing type as unavailable", () => {
  const h = harness([attempt("a", 1000), attempt("b", 2000, { paperId: "other", institution: "机构乙" })]);
  h.control("sourceId", "other");
  assert.ok(!h.html.includes('#/report/a'));
  assert.ok(h.html.includes('#/report/b'));
  h.control("dimension", "name:资料分析");
  assert.ok(h.html.includes("此卷未包含该题型"));
  assert.ok(!h.html.includes('class="analytics-point '));
  h.action("reset", {});
  assert.ok(h.html.includes('#/report/a'));
  assert.equal(h.renders, 3);
});

test("foundation report entry exposes its source anchor and keeps other categories reachable", () => {
  const flower = catalogAttempt({ paperId: "sihai-2026-h2-p2-city-01", id: "flower", createdAt: 1 });
  const fenbi = catalogAttempt({ paperId: "fenbi-2027-guokao-01", id: "fenbi", createdAt: 2 });
  const province = catalogAttempt({ paperId: "sihai-2026-h2-p2-province-01", id: "province", createdAt: 3 });
  const h = harness([flower, fenbi, province]);
  const options = { versionId: flower.versionId };
  let html = h.feature.statsView(options);
  assert.ok(html.includes(`value="${flower.paperId}" selected`));
  assert.ok(html.includes("副省卷（135题） · 1 次"));
  assert.ok(html.includes('#/report/flower'));
  assert.equal(html.includes('#/report/fenbi'), false);
  h.control("examCategory", "guokao-subprovincial", `paper:${flower.paperId}`);
  html = h.feature.statsView(options);
  assert.ok(html.includes('#/report/province'));
  h.control("examCategory", "guokao-city", `paper:${flower.paperId}`);
  html = h.feature.statsView(options);
  assert.ok(html.includes('#/report/flower'));
  assert.ok(html.includes('#/report/fenbi'));
});

test("result VS and inline chart exclude future attempts and reuse fresh synchronized report scores", () => {
  const old = attempt("old", 1000, { answers: ["B", "B"] });
  const current = attempt("current", 2000);
  const future = attempt("future", 3000, { answers: ["A", "A"] });
  const h = harness([old, current, future], current);
  h.feature.afterRender();
  assert.ok(h.mounts.report.innerHTML.includes("上一刷 VS 本次"));
  assert.ok(h.mounts.report.innerHTML.includes('#/report/old'));
  assert.ok(!h.mounts.report.innerHTML.includes('#/report/future'));
  assert.ok(h.mounts.report.innerHTML.includes("进步 0.5 分"));
  assert.ok(!h.mounts.report.innerHTML.includes("同卷多刷"), "two compatible attempts show VS without a redundant chart");
  const updated = attempt("old", 1000, { answers: ["A", "A"] });
  h.replaceAttempts([updated, current, future]);
  h.feature.afterRender();
  assert.ok(h.mounts.report.innerHTML.includes("退步 1 分"));
  h.replaceAttempts([updated, attempt("current", 2000, { answers: ["A", "A"] }), future]);
  h.feature.afterRender();
  assert.ok(h.mounts.report.innerHTML.includes("持平"));
  assert.ok(!h.mounts.report.innerHTML.includes("退步 1 分"));
});

test("empty, first, sample and incomplete reports have explicit states", () => {
  const first = attempt("first", 1000);
  const h = harness([first]);
  h.feature.afterRender();
  assert.equal(h.mounts.report.innerHTML, "", "a first report does not reserve an empty comparison card");
  h.replaceAttempts([]);
  assert.ok(h.feature.statsView().includes("还没有可分析的练习记录"));
  const sample = harness([first], { ...first, isSample: true });
  sample.feature.afterRender();
  assert.ok(sample.mounts.report.innerHTML.includes("示例报告不计入"));
  assert.ok(!sample.mounts.report.innerHTML.includes("同卷多刷"));
  const broken = harness([{ ...first, report: { totalCents: 100, rows: [] } }]);
  assert.ok(broken.feature.statsView().includes("缺少逐题评分记录"));
});

test("long histories have all pages reachable by buttons and range selection", () => {
  const records = Array.from({ length: 60 }, (_, i) => attempt(`a${i}`, i + 1));
  const h = harness(records);
  let html = h.feature.statsView();
  assert.ok(html.includes('#/report/a59'));
  assert.ok(!html.includes('#/report/a0"'));
  h.action("page", { page: "0" });
  assert.ok(h.html.includes('#/report/a0"'));
  assert.ok(!h.html.includes('#/report/a59'));
  h.control("page", "1");
  assert.ok(h.html.includes('#/report/a24'));
  assert.ok(!h.html.includes('#/report/a0"'));
});

test("keyboard selects individual timestamp ties and prevents page scrolling", () => {
  const h = harness([attempt("a", 1000), attempt("b", 1000)]);
  let prevented = 0;
  const root = { dataset: { analyticsScope: "overall" } };
  const chart = { dataset: { analyticsIds: '["a","b"]', analyticsSelected: "b" }, closest: (selector) => selector === "[data-analytics-scope]" ? root : chart };
  h.events.get("keydown")({ target: chart, key: "ArrowLeft", preventDefault: () => prevented++ });
  assert.ok(h.html.includes('data-analytics-selected="a"'));
  h.events.get("keydown")({ target: chart, key: "End", preventDefault: () => prevented++ });
  assert.ok(h.html.includes('data-analytics-selected="b"'));
  assert.equal(prevented, 2);
});

test("record entry and repeated afterRender calls use current attempts without duplicate event registration", () => {
  const h = harness([attempt("a", 1000)]);
  h.feature.afterRender();
  assert.ok(h.mounts.entry.innerHTML.includes('href="#/stats"'));
  assert.ok(h.mounts.entry.innerHTML.includes("1 次练习"));
  h.replaceAttempts([attempt("a", 1000), attempt("b", 2000)]);
  h.feature.afterRender();
  assert.ok(h.mounts.entry.innerHTML.includes("2 次练习"));
  assert.equal(h.events.size, 3);
  h.feature.destroy();
  assert.equal(h.events.size, 0);
});

test("titles, institutions and rule/type text are escaped", () => {
  const record = attempt("a", 1000, { institution: '<img src=x onerror="bad()">', types: ['<script>bad()</script>', "数量关系"] });
  const h = harness([record]);
  const html = h.feature.statsView();
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
});
