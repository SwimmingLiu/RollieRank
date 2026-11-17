# Add project verification CLI and CI gate

RollieRank's checks were split across optional scripts, and the basic browser journey still assumed 12 catalog cards before imports. Missing Playwright or Excel dependencies could turn real coverage into skips, while the existing UI additions had no maintained feature map.

This adds `.agents/skills/verify-rollierank` with launch, doctor, drive, evidence, cleanup and maintenance instructions. Seven feature files map every user entrypoint to observable business outcomes. `scripts/verify-rollierank.py` creates an isolated service, checks the catalog and official position source, captures 44 original-resolution screenshots, tests theme and geometry, then runs the basic app, connected features, mobile journeys and all Node tests. Missing dependencies fail with remediation.

Visual review found two real issues: the 23px verification badge had an undersized click target, and first reports contained an empty VS card plus a single-point trend form before a comparison existed. The badge now has a 32px interactive state, and report analysis appears as VS at two attempts and a curve at three. Verification also covers the shared warm-gray 3px scrollbar and search icon clearance.

GitHub Actions installs locked Node, Python and browser dependencies and runs the same full command. Logs, JSON results, source hashes and screenshots are uploaded even on failure for 14 days. `AGENTS.md` requires this gate, original-resolution visual review and `$maintain-verification-skill` audits when entrypoints change.

Local run: 8 stages passed, 176 Node tests passed with zero skips, 44 visual screenshots had no runtime or geometry findings, and the three browser suites passed 8, 15 and 12 journey groups. Physical microphone and Safari hardware behavior remain outside headless Chromium and are not claimed as verified.
