import test from "node:test";
import assert from "node:assert/strict";
import { primarySectionScores } from "../score-groups.js";

test("judgment reasoning is one weighted radar axis while preserving total scores", () => {
  const sections = [
    { name: "言语理解", earnedCents: 1920, maxCents: 2400 },
    { name: "图形推理", earnedCents: 560, maxCents: 800 },
    { name: "定义判断", earnedCents: 560, maxCents: 800 },
    { name: "类比推理", earnedCents: 320, maxCents: 400 },
    { name: "逻辑判断", earnedCents: 340, maxCents: 850 },
    { name: "资料分析", earnedCents: 1700, maxCents: 2000 },
  ];
  const before = structuredClone(sections);
  const axes = primarySectionScores(sections);
  assert.deepEqual(axes.map(axis => axis.name), ["言语理解", "判断推理", "资料分析"]);
  const judgment = axes.find(axis => axis.name === "判断推理");
  assert.equal(judgment.earnedCents, 1780);
  assert.equal(judgment.maxCents, 2850);
  assert.equal(Math.round(judgment.earnedCents / judgment.maxCents * 1000) / 10, 62.5);
  assert.equal(axes.reduce((sum, axis) => sum + axis.earnedCents, 0), sections.reduce((sum, section) => sum + section.earnedCents, 0));
  assert.equal(axes.reduce((sum, axis) => sum + axis.maxCents, 0), sections.reduce((sum, section) => sum + section.maxCents, 0));
  assert.deepEqual(sections, before);
});
