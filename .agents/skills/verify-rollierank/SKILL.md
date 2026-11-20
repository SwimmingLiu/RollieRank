---
name: verify-rollierank
description: "Drive RollieRank end to end on its real mobile and foundation web surfaces, verify catalog and records, jobs and ranks, media discussions, analytics, correction regrading, sharing, visual layout and CI evidence. Use before completion, for regression triage, or when maintaining the project verification map."
---

# Verify RollieRank

Use this Skill whenever a change can affect a user path or the business state behind it. The maintained feature map is [features/README.md](features/README.md); read the matching feature files before driving the app. The command is the same locally and in GitHub Actions.

## Launch

From the repository root, run:

```bash
npm run verify -- all
```

The CLI builds browser assets, typechecks and builds the beUI components, creates a temporary data directory, starts `scripts/serve.mjs` on an unused loopback port, waits for both a public catalog and real `/api/positions/hierarchy`, drives the user interfaces, and tears down only the process it created. It does not use the persistent 4781 data. To inspect a running preview without mutations:

```bash
uv run --frozen --group verify python scripts/verify-rollierank.py visual --output test-results/verification-live
```

For a complete proof, use the first command. A service that answers but cannot return published papers and an official position source is not ready.

## Doctor

```bash
npm run verify -- doctor
```

This is read-only. It checks Node 20+, npm, Python 3.10+, both Node and Python Playwright with launched Chromium, beUI dependencies and source entrypoints. `doctor.json` lists false checks and remediation. The CLI rejects a successful test-process exit if its summary contains skips, cancellations, TODOs or no executed tests.

Dependencies can be installed with:

```bash
npm ci --prefix docs/ui-exploration/ios-v3/ui
npm ci
uv sync --frozen --group verify
uv run --frozen --group verify python -m playwright install --with-deps chromium
```

## Drive

Run `.agents/skills/verify-rollierank/scripts/verify.sh <scenario>` or `npm run verify -- <scenario>`.

| Scenario | Surface and proof |
| --- | --- |
| `all` | Every project check below plus all browser journeys. |
| `visual` | Real `/ios-v3/` pages at desktop, 430, 390 and 320 widths; screenshots, runtime errors, overflow, target sizes, theme font and hidden scrollbars. |
| `journeys` | Base app, connected features, iOS user flows and the complete Node test suite. |
| `feature <id>` | The matching feature id from the map. |
| `core`, `catalog-admin`, `practice-history`, `positions-rank`, `discussion`, `analytics`, `corrections`, `sharing`, `insights`, `timing-practice` | Focused service, component and browser regressions. |

Stable handles are the gallery `.page-picker [data-page]`, the mobile iframe `.view[data-page]`, feature buttons' accessible names and the application routes. Feature files define exact preconditions and side effects. Do not replace a missing real entry with an internal setter, a temporary fixture page, or a direct local-storage write.

## Evidence

Default evidence is `test-results/verification/`:

- `results.json` records scenario, commands, durations, server readiness, visual findings and failures.
- `visual/` contains full-resolution phone screenshots and desktop gallery screenshots for pixel inspection.
- `journeys/` contains the real browser result JSON, downloadable PNG/JSON artifacts, and stdout/stderr for every command.
- `doctor.json`, `build.log`, typecheck/build logs and visual server logs support diagnosis.

Every business journey checks visible state and the server or downloaded side effect. Inspect the new screenshots at the intrinsic phone size before claiming visual completion. Check the paper theme, hierarchy, spacing, text wrapping, type scale, redundant copy and controls, target sizes, icon clearance, hidden scrollbars and overflow. The automated probe detects measurable defects; its pass is not an aesthetic review. Use the user's approved design references and the current project screenshots for the human judgment.

A failed command exits non-zero. Preserve its evidence, diagnose with the feature map, and re-run after a fix. Never delete a failed run to make the next run appear clean.

## Cleanup

The CLI terminates its own Node process in `finally`, even after a failed visual drive. Journey scripts own their isolated service processes. Temporary data directories are removed after teardown; evidence remains. Never kill processes by name. `--base` is available only for isolated or explicitly approved read-only checks; do not point mutating journeys at the shared preview.

## Extension

When a user-facing feature or entrypoint changes, update the corresponding feature file, the CLI scenario, and the existing GitHub Actions job in the same task. Run the changed feature, then `npm run verify -- all` before declaring completion. To audit drift across the whole map, use the installed `$maintain-verification-skill` workflow and follow the project rules in `AGENTS.md`.

For position UI changes, check both exam sources, the empty provincial catalog, regional isolation and the single-title submission prompt. Judgment reasoning is one global subject; validate its weighted total and whole-attempt personal best. Scrollbars use a 2px native mark and a visible track no longer than 56px; inspect actual pixels and native scroll/drag behavior, not only a pseudo-element computed width.
