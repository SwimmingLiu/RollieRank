import test from "node:test";
import assert from "node:assert/strict";
import { prunePreviewHistory, recoverPreviewHistory } from "../docs/ui-exploration/ios-v3/preview-history.js";

const seed = { institution: "四海", period: 2, paper: 9, complete: true, answers: ["A", "B", "C"] };
const known = { ...seed, id: "legacy-四海|2|9-0" };

test("completed offline answers with an old identifier remain visible unless they exactly match a known demonstration", () => {
  const authored = { ...known, answers: ["C", "B", "A"] };
  const unrelated = { ...seed, id: "legacy-personal-practice-1", paper: 5 };
  const result = prunePreviewHistory([known, authored, unrelated], [seed]);
  assert.deepEqual(result.records, [authored, unrelated]);
  assert.deepEqual(result.removed, [known]);
});

test("the old cleanup archive restores authored work once and never replaces a newer current record", () => {
  const older = { ...known, answers: ["D", "B", "A"] };
  const current = { ...older, answers: ["C", "C", "A"] };
  const archived = { ...seed, id: "legacy-personal-practice-2", paper: 5 };
  const recovered = recoverPreviewHistory([current], [known, older, archived, archived], [seed]);
  assert.deepEqual(recovered, [current, archived]);
  assert.deepEqual(recoverPreviewHistory(recovered, [known, older, archived], [seed]), recovered);
});
