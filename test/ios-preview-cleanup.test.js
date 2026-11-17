import test from "node:test";
import assert from "node:assert/strict";
import { prunePreviewHistory } from "../docs/ui-exploration/ios-v3/preview-history.js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("preview cleanup removes seeded estimates while retaining receipts and authored drafts", () => {
  const seed = { institution: "四海", period: 1, paper: 3, answers: ["A", ""], complete: false };
  const untouched = { ...seed, id: "legacy-四海|1|3-0" };
  const authored = { ...untouched, answers: ["B", "C"] };
  const completedSeed = { ...seed, period: 3, paper: 2, complete: true };
  const estimate = { ...completedSeed, id: "legacy-四海|3|2-1" };
  const receipt = { ...estimate, id: "actual-receipt", serviceBacked: true };
  const result = prunePreviewHistory([untouched, authored, estimate, receipt], [seed, completedSeed]);
  assert.deepEqual(result.records, [authored, receipt]);
  assert.deepEqual(result.removed, [untouched, estimate]);
  assert.deepEqual(prunePreviewHistory(result.records, [seed, completedSeed]).removed, []);
});

// A refreshed gallery used to serve an animation with the old logo, navigation and fake history.
test("the shipped motion preview comes from the current built app and designated product logo", async () => {
  const manifest = JSON.parse(await readFile("docs/ui-exploration/ios-v3/motion/interaction-current.json", "utf8"));
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  const gif = await readFile(`docs/ui-exploration/ios-v3/${manifest.gif}`);
  assert.equal(gif.subarray(0, 6).toString(), "GIF89a");
  assert.equal(gif.readUInt16LE(6), 390);
  assert.equal(gif.readUInt16LE(8), 844);
  assert.equal(hash(gif), manifest.gifSha256);
  assert.deepEqual(manifest.errors, []);
  assert.ok(manifest.actions.includes("home-first-use") && manifest.actions.includes("timer-custom") && manifest.actions.includes("single-question"));
  for (const [file, sha] of Object.entries(manifest.sources)) assert.equal(hash(await readFile(file)), sha, `Re-record the actual mobile motion preview after changing ${file}`);
  const logo = "docs/ui-exploration/ios-v3/assets/brand/rollierank-logo-transparent.png";
  assert.equal(manifest.sources[logo], hash(await readFile("assets/rollierank-logo-transparent.png")));
});
