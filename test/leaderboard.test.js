import test from "node:test";
import assert from "node:assert/strict";
import { rankEntries, demoEntries } from "../src/leaderboard.js";

const entry = (
  userId,
  totalCents,
  createdAt,
  versionId = "v1",
  centsEarned = 50,
) => ({
  userId,
  totalCents,
  createdAt,
  versionId,
  breakdown: [{ id: "verbal", maxCents: 100, centsEarned }],
});

test("demonstration scores remain attainable under the actual per-question weights", () => {
  const questions = Array.from({ length: 10 }, (_, index) => ({
    number: index + 1,
    typeId: "logic",
    cents: 85,
  }));
  const entries = demoEntries({ id: "weighted:v1", questions, maxCents: 850 });
  for (const row of entries) {
    assert.equal(row.totalCents % 85, 0);
    assert.equal(row.breakdown[0].centsEarned, row.totalCents);
  }
});

test("best attempts deduplicate users, isolate versions and use competition ranks", () => {
  const board = rankEntries(
    [
      entry("a", 70, 1),
      entry("a", 90, 2),
      entry("b", 90, 3),
      entry("c", 80, 4),
      entry("d", 100, 5, "v2"),
    ],
    { versionId: "v1", minimum: 3 },
  );
  assert.equal(board.count, 3);
  assert.equal(board.visible, true);
  assert.deepEqual(
    board.rows.map((row) => [row.userId, row.value, row.rank]),
    [
      ["a", 90, 1],
      ["b", 90, 1],
      ["c", 80, 3],
    ],
  );
});

test("type best can come from another attempt; zeros do not inflate its denominator", () => {
  const entries = [
    entry("a", 90, 1, "v1", 20),
    entry("a", 60, 2, "v1", 80),
    entry("b", 100, 3, "v1", 0),
  ];
  const board = rankEntries(entries, {
    versionId: "v1",
    dimension: "verbal",
    minimum: 10,
  });
  assert.equal(board.count, 1);
  assert.equal(board.visible, false);
  assert.equal(board.rows[0].createdAt, 2);
  assert.equal(board.rows[0].score, 0.8);
  assert.equal(board.rows[0].totalCents, 60);
});

test("withdrawing a user recalculates remaining ranks atomically", () => {
  const entries = [entry("a", 90, 1), entry("b", 80, 2), entry("c", 70, 3)];
  const board = rankEntries(
    entries.filter((row) => row.userId !== "b"),
    { versionId: "v1" },
  );
  assert.deepEqual(
    board.rows.map((row) => row.rank),
    [1, 2],
  );
  assert.equal(board.count, 2);
});
