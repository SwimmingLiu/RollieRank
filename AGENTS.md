# RollieRank Engineering Rules

## 回复风格

- 在本仓库工作时，用中文回复。用词简单，回答简短、清楚、直接。

## 小程序环境与首次上线

- 按微信 `envVersion` 选择环境。开发版 `develop`、体验版 `trial` 和真机预览连接 `https://rollie-rank-test.swimmingliu.cn`，写入 `/var/lib/rollierank-test/catalog.json`。只有正式版 `release` 连接 `https://rollie-rank.swimmingliu.cn`，写入 `/var/lib/rollierank/catalog.json`。未知版本按测试环境处理。
- 测试包使用独立的本地存储。本机调试和真机联调直接访问测试 API，无需网页测试站口令。写入前校验测试响应标识。本机自动化使用隔离实例与回环地址。真机联调使用开发版或体验版，并配置测试域名的 `request` 和 `downloadFile` 权限。生产验收只做只读检查。
- 第一次正式发布前，按 [首次上线检查](deploy/README.md#首次上线检查) 运行只读门禁。生产答卷、评论、选岗、小程序资料、反馈与其他用户记录必须为零。发现数据先核对来源并保留可恢复备份。正式上线后，真实用户记录按正常生产数据维护。

## 小程序版本管理

- 小程序版本号遵循语义化格式 `MAJOR.MINOR.PATCH`（当前版本记录在 `mini-program/package.json` 的 `version` 字段）。
- 日常迭代默认发小版本，每次上传递增修订号 `PATCH`（例如 `1.1.1` → `1.1.2` → `1.1.3`），适用于界面优化、体验微调与问题修复。
- 只有大版本更新（新增核心功能模块、主要业务流程或架构级改动）才递增次版本号 `MINOR` 并将 `PATCH` 归零（例如 `1.1.x` → `1.2.0`，后续小版本依次为 `1.2.1`、`1.2.2`）。
- 每次上传微信开发版 / 体验版前，先读取并更新 `mini-program/package.json` 中的 `version`，再用同一版本号执行上传，避免版本重复或跳号。

## Verification gate

- Before completing a user-visible feature or business-logic change, run `npm run verify -- all`. This command must fail when Node, Python, Playwright, Chromium or beUI dependencies are missing; missing environment capabilities are never a skip.
- Inspect the original-resolution UI screenshots in `test-results/verification/visual/`. Check the paper-card theme, hierarchy and spacing, typography, wrapping, buttons, inputs, icon clearance, scrollbars, redundant elements and the 320/390/430/desktop layouts. Automated checks do not replace this visual review.
- Fix every confirmed problem caused by the current task, then rerun the affected scenario and the complete command. Keep failed logs, result JSON and screenshots.
- A feature entrypoint and its verification recipe live in `.agents/skills/verify-rollierank/features/`. When an entrypoint changes, update its feature file, the CLI scenario, `scripts/verify-rollierank.py` and `.github/workflows/verification.yml` together.
- After adding or modifying any feature in this project, run `/maintain-verification-skill` (`$maintain-verification-skill`) to update the verification skill, feature map, and harness so they stay in sync with the app. Also use it for periodic and post-merge audits: read each feature from source, drive every mapped feature live, and update only verification files during maintenance. Report product regressions separately; never weaken an assertion or hide a regression in documentation.
- The GitHub Actions `RollieRank verification` job is the full gate. It retains evidence for 14 days. Claim completion only when logs and user-visible business results are complete, with zero failures and zero environment skips.
- Remote pushes and PR creation require explicit current user authorization; a local verification run or PR draft does not publish anything.


## Current mobile verification

- The canonical UI is `paper-cards-1114-v3`. Keep alternate design material in recoverable local archives; refresh only the canonical gallery assets.
- Verify cohorts from the same version and complete best real attempt per person. Count blank choices in the denominator; empty cohorts have no measured percentage or average. Formal submissions enter the ranking automatically; keep private answer choices out of public summaries.
- Drive explicit timing start, pause, reload, module switch, finish and answer entry. Keep solving time separate from entry time and preserve the current question and review marks on reload.
- Drive all four share modes through the actual mobile report and save controls. Check the downloaded PNG, full long-report content, automatic fitting and the preview boundary above the fixed footer.
- Keep confirmed visual regressions in browser assertions, including icon clearance, long-name rank wrapping and footer overlap. Inspect original-resolution evidence after the final build.
- Match original feedback to its actual route, state and current screenshot. Check source switching, returning from a scrolled panel, long reply targets, reload recovery and 320×568; a wide or unusually tall screenshot cannot certify a short phone layout.

## Mobile design contract

- Follow the approved `paper-cards-1114-v3` UI: warm ivory paper, restrained coral and ochre, current fonts, thin icons, rounded cards and existing beUI controls. Use the provided `assets/rollierank-logo-transparent.png` for the product mark.
- Design for 320/390/430 first. Keep one clear main action, short labels, aligned values and adequate icon clearance. Avoid duplicate headings, explanatory paragraphs, empty containers and repeated technical states.
- Keep the report concise. Put detailed comparison, distributions, feedback and planning in a secondary page or themed panel. Theme search, calendars, inputs and scrollbars; retain keyboard and touch behavior.
- Timing belongs on the home page. Paper selection and custom timing are separate choices; module planning is optional, uses integer minutes, reconciles with the total and supports user ordering.
- Timer picker hierarchy supports one-level back from both its content and the close backdrop. Keep concise paper rows at normal reading size. Custom timing uses integer entry and steppers; do not restore the removed whole/half/section preset row.
- Preserve each timer source's selected paper and edited plan on round trips. Keep the running clock visible when leaving setup, name whole and module plans separately, and reserve real layout space below focused inputs for the action bar.
- Use a compact mobile comment composer with text, photos, automatic links, likes and threaded replies. Keep author identity in the comment, text and send aligned, and drafts reliable. Allow long text to grow and expand to fullscreen; replies must identify their target and support expand/collapse.
- Share previews fit the screen automatically. Preserve the four real export artifacts, consistent identity alignment and the fixed save bar boundary.
- Share year belongs to the paper identity, the product mark is a discreet watermark, and exported charts must have enough backing pixels for the actual PNG scale.
- Keep gallery motion assets current with the actual built UI and designated logo; record them with `node scripts/record-ios-preview.mjs` before refreshing gallery assets.
- Mark uncertain answers with clear short labels. Single-answer mode uses the paper theme, horizontal gestures and automatic advance after a choice. Maintain actual answers, mark state and position through reloads.
- Remove known design/test history through a recoverable migration; retain real receipts and authored drafts. Do not expose obsolete estimate labels in user history.

- Rankings automatically use each person's best formal result. Do not reintroduce participation settings, manual answer selection for ranking, or visible version identifiers.
- Growth uses a single product exam-category filter: national/public-exam mock papers with 130 questions are city papers and 135 are provincial papers. Aggregate all corresponding attempts across publishers and weight signatures, computing every point from its own saved earned/max/rate; do not reintroduce a scoring-subgroup filter. Preserve separate formats for genuinely custom/nonstandard papers.
