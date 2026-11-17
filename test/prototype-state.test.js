import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  loadState,
  saveState,
  newDraft,
  recordAttempt,
} from "../src/prototype-state.js";
import { STORAGE_KEY } from "../src/storage.js";
import { PAPERS } from "../src/data/papers.js";
import { parseQuestionCsv, gradeVersion } from "../src/model.js";

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
};
const version = { id: "one:v1", paperId: "one", questionCount: 4 };

test("refresh restores independent version drafts and review marks", () => {
  const state = initialState(),
    storage = memoryStorage();
  state.drafts[version.id] = newDraft(version);
  state.drafts[version.id].answers[0] = "D";
  state.drafts[version.id].current = 2;
  state.drafts[version.id].marks = [1];
  saveState(storage, state);
  const restored = loadState(storage, [version]);
  assert.equal(restored.warning, false);
  assert.equal(restored.state.drafts[version.id].answers[0], "D");
  assert.equal(restored.state.drafts[version.id].current, 2);
  assert.deepEqual(restored.state.drafts[version.id].marks, [1]);
});

test("submission is idempotent, freezes results and creates a new independent retry", () => {
  const state = initialState();
  state.drafts[version.id] = newDraft(version);
  const id = state.drafts[version.id].id;
  const attempt = {
    id,
    versionId: version.id,
    answers: ["A", "B", null, "D"],
    report: { totalCents: 200 },
  };
  assert.equal(recordAttempt(state, attempt), true);
  assert.equal(recordAttempt(state, attempt), false);
  assert.equal(state.attempts.length, 1);
  assert.equal(state.drafts[version.id], undefined);
  attempt.answers[0] = "C";
  assert.equal(state.attempts[0].answers[0], "A");
  state.drafts[version.id] = newDraft(version);
  assert.notEqual(state.drafts[version.id].id, id);
  assert.equal(state.attempts.length, 1);
});

test("legacy 130-question drafts migrate without inventing submitted history", () => {
  const storage = memoryStorage();
  const paper = PAPERS[0];
  const answers = Array(130).fill(null);
  answers[5] = "C";
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      selectedId: paper.id,
      drafts: {
        [paper.id]: {
          answers,
          current: 7,
          reportReady: true,
          updatedAt: 12345,
        },
      },
    }),
  );
  const loaded = loadState(storage, [
    { id: `${paper.id}:v1`, paperId: paper.id, questionCount: 130 },
  ]);
  assert.equal(loaded.state.drafts[`${paper.id}:v1`].answers[5], "C");
  assert.equal(loaded.state.attempts.length, 0);
});

test("blocked storage reports failure and guest submissions cannot opt into rankings", () => {
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  const { state, warning } = loadState(storage, [version]);
  assert.equal(warning, true);
  recordAttempt(
    state,
    { id: "guest", versionId: version.id },
    { participate: true },
  );
  assert.equal(state.attempts[0].participate, false);
  assert.throws(() => saveState(storage, state));
});

test("restoring a backup recalculates the snapshot and rejects corrupt totals without dropping good drafts", () => {
  const state = initialState(),
    storage = memoryStorage();
  const questions = parseQuestionCsv(
    "题号,题型,答案,分值\n1,言语,A,0.8\n2,逻辑,B,0.85\n3,资料,C,1\n4,资料,D,1",
  );
  state.drafts[version.id] = newDraft(version);
  const attempt = {
    id: "valid-attempt-1234567",
    versionId: version.id,
    paperId: version.paperId,
    paperTitle: "备份测试卷",
    institution: "测试",
    project: "测试",
    period: "一期",
    variant: "通用",
    versionLabel: "1.0",
    createdAt: Date.now(),
    answers: ["A", null, "C", "D"],
    report: gradeVersion({ questions }, ["A", null, "C", "D"]),
  };
  state.attempts = [attempt];
  saveState(storage, state);
  assert.equal(
    loadState(storage, [version]).state.attempts[0].report.totalCents,
    280,
  );
  state.attempts[0].report.totalCents = 9999;
  saveState(storage, state);
  const restored = loadState(storage, [version]);
  assert.equal(restored.warning, true);
  assert.equal(restored.state.attempts.length, 0);
  assert.ok(restored.state.drafts[version.id]);
});
