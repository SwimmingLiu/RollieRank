---
name: verify-rollierank-omr
description: "Drive RollieRank answer-sheet recognition (OMR) end to end: upload real photos in three layouts through the live HTTP API, check the 140-answer contract, cache, blank handling and grading against a paper, and record cold/warm timing. Use when changing the OMR engine, its HTTP contract, grading, fixtures or the verification recipe."
---

# Verify answer-sheet recognition

Use this Skill when a change touches `server/omr*.mjs`, `scripts/omr.mjs`, `scripts/verify-omr.py`, the OMR fixtures, or the `/api/omr/*` contract. The maintained feature file is [omr.md](../verify-rollierank/features/omr.md).

## Launch

From the repository root:

```bash
node --test test/omr.test.js
npm run verify:omr -- --repeat 3
```

The first command proves the interface contract (rejects bad input, caches by digest, pads blanks, grades against a paper, refuses a question-count mismatch). The second starts a real `scripts/serve.mjs` on an unused loopback port with a temporary data directory, pushes the three fixture photos through `POST /api/omr/recognize` `--repeat` times each, records per-request latency, and tears down only the process it created.

Never point these at the shared 4781 preview: they mutate nothing, but a shared instance would mix its cache and timing into the evidence.

## What proves it works

- All three fixtures (`sheet-a.jpg`, `sheet-b.jpg`, `sheet-c.jpg`) return `200` and a layout with the option grid found.
- Each sheet resolves at least its measured baseline (sheet-a 99, sheet-b 123, sheet-c 101); the remainder may be genuinely blank or too faint.
- Each sheet's answers match the hand-transcribed key in `test/fixtures/omr/sheet-*.answers.json`: at least 118 / 132 / 110 correct, and at most 6 / 2 / 6 wrong. A mark invented where the key says blank counts as wrong.
- The three sheets — same layout, different pencil marks — must not produce an identical answer string.
- Non-answer-sheet negative images (printed text page, regular grid, QR code) must be rejected with HTTP 422 and never return 200 with fabricated answers.
- Average request latency stays under `--max-average-ms` (default 8000).
- `test/omr.test.js` passes in full (including EXIF orientation, full-frame/shadow robustness, and non-sheet rejection).

## Evidence

`test-results/omr/`:

- `omr.json` — per-sheet recognized count, correct/wrong/missed/extra against the key, average confidence, server `elapsedMs`, every request's latency, `layout`, `warnings`, and the answer array
- `<sheet>.answers.txt` — answers by question number, `—` for blank

Report cold start (first request per sheet) separately from warm requests; a cache hit is not a recognition timing.

## Timing baseline

Record the numbers you actually get, not a guess. State cold start, warm average, and the sample count, and note the machine and Node version. When a change makes recognition slower, say so and say why it is or is not acceptable — do not quietly relax `--max-average-ms`.

## Gotchas

- JPEG only. HEIC/PNG returning 415 is correct behavior, not a bug.
- The engine models a 140-question sheet: 4 options, 7 row blocks, 20 columns per block. A different sheet needs a new layout profile instead of silently reusing this one.
- Do not improve a "recognition rate" by loosening thresholds; when results look weak, inspect the photos and ask for a retake.
- Keep the three fixtures genuinely different. Replacing them with copies of one image defeats the identical-answer guard.
- The answer keys are hand transcriptions. If a fixture changes, re-transcribe and update `sheet-*.answers.json`; never edit a key to make a failing sheet pass.
- Photos with a long edge above ~2260px are re-read at 2048 and 1710 (best answer count wins); below ~1080px recognition degrades by design, not as a regression.
