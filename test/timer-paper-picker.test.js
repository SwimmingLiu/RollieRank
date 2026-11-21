import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const directory = resolve("docs/ui-exploration/ios-v3/ui");
const requireUI = createRequire(resolve(directory, "package.json"));
const { build } = requireUI("esbuild");
const compiled = await build({ entryPoints: [resolve(directory, "timer-paper-model.ts")], bundle: true, write: false, platform: "node", format: "cjs", tsconfig: resolve(directory, "tsconfig.json"), logLevel: "silent" });
const module = { exports: {} };
new Function("module", "exports", compiled.outputFiles[0].text)(module, module.exports);
const { timerCollections, timerPaperTitle, timerPaperSearchText } = module.exports;
const paper = (id, period, variant, number = 1) => ({ id, institution: "四海", title: `四海 · ${period} · 第 ${number} 套`, questionCount: 130, number, project: "2026 下半年 · 国考行测", period, variant });

test("flower-peanut first period and both second-period variants remain distinct", () => {
  const papers = [paper("one", "一期", "地市级 / 行政执法类"), paper("two", "二期", "地市级 / 行政执法类"), paper("three", "二期", "副省级"), paper("four", "一期", "地市级 / 行政执法类", 2)];
  const collections = timerCollections(papers);
  assert.deepEqual(collections.map(collection => collection.label), ["第1期 · 地市 / 执法", "第2期 · 地市 / 执法", "第2期 · 副省"]);
  assert.deepEqual(collections[0].papers.map(item => item.id), ["one", "four"]);
  assert.equal(timerPaperTitle(papers[0]), "花生 · 一期 · 第 1 套");
  assert.equal(timerPaperTitle(papers[0], true), "第 1 套");
  assert.ok(!collections.map(collection => collection.label + collection.detail).join(" ").includes("四海"));
  assert.ok(timerPaperSearchText(papers[0]).includes("花生"));
});

test("catalogs without optional metadata keep all real papers in one skippable collection", () => {
  const rows = [{ id: "a", institution: "粉笔", title: "练习甲", number: 1, questionCount: 130 }, { id: "b", institution: "粉笔", title: "练习乙", number: 2, questionCount: 135 }];
  const collections = timerCollections(rows);
  assert.equal(collections.length, 1);
  assert.equal(collections[0].label, "套卷");
  assert.deepEqual(collections[0].papers.map(item => item.id), ["a", "b"]);
  assert.equal(timerPaperTitle(rows[0], true), "练习甲");
});

test("timer collections use numeric issue order instead of lexicographic text", () => {
  const rows = [
    paper("ten", "第10期", "地市级 / 行政执法类"), paper("three", "第3期", "地市级 / 行政执法类"),
    paper("eight", "第8期", "地市级 / 行政执法类"), paper("two", "二期", "地市级 / 行政执法类"),
  ];
  assert.deepEqual(timerCollections(rows).map(collection => collection.label),
    ["第2期 · 地市 / 执法", "第3期 · 地市 / 执法", "第8期 · 地市 / 执法", "第10期 · 地市 / 执法"]);
});

test("question-count labels stay inside one raw mock-exam collection", () => {
  const rows = [
    paper("one", "10套卷", "130题版", 1),
    paper("two", "10套卷", "130题版", 2),
    paper("seven", "10套卷", "120题版", 7),
    paper("ten", "10套卷", "120题版", 10),
  ];
  const collections = timerCollections(rows);
  assert.equal(collections.length, 1);
  assert.equal(collections[0].label, "10套卷");
  assert.deepEqual(collections[0].papers.map(item => item.number), [1, 2, 7, 10]);
});
