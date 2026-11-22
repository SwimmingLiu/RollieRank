---
name: rollierank-admin
description: "通过 CLI 管理 RollieRank 运营后台：查看运营总览、审查评论与敏感词策略、查看用户档案与禁言/解禁、发放或扣减用户积分、审核答案纠错并重算成绩、管理后台密码与操作审计日志。Use when 用户要求 AI 代操作后台运营、查评论/用户/积分、批处理审核、或管理线上/本地 RollieRank 数据。"
---

# RollieRank 运营管理 CLI 指南

所有运营后台操作都通过统一命令 `npm run admin -- <命令> --json` 执行。

## 运行模式

1. **本地直连（默认）**：直接读写本地 `.local/catalog.json`（可用 `--data-dir <目录>` 指定其他目录），不依赖运行中的服务，与后台 Web 共用同一套校验、事务落盘和审计日志。
2. **远程线上模式**：先登录获取会话令牌，再附带 `--url` 与 `--token`（或设置环境变量 `ROLLIERANK_CONSOLE_TOKEN`）。如果线上通过 `ROLLIERANK_ADMIN_PATH` 启用了隐蔽入口，直接把完整入口地址传给 `--url` 即可：
   ```bash
   npm run admin -- auth login --url https://rollie-rank.swimmingliu.cn/<隐蔽路径> --username admin --password '<密码>' --json
   export ROLLIERANK_CONSOLE_TOKEN='<返回的 token>'
   npm run admin -- overview --url https://rollie-rank.swimmingliu.cn/<隐蔽路径> --json
   ```

## 高频命令速查

| 场景 | 命令 |
| :--- | :--- |
| 运营总览 | `npm run admin -- overview --json` |
| 查看待复核评论 | `npm run admin -- comments list --status queue --json` |
| 查看全部评论 | `npm run admin -- comments list --status all --json` |
| 通过评论（可选奖积分） | `npm run admin -- comments approve <id1> <id2> --reward 10 --reason "优质分享" --json` |
| 屏蔽评论（可选禁言作者） | `npm run admin -- comments reject <id> --mute --reason "广告引流" --json` |
| 删除评论 | `npm run admin -- comments delete <id> --reason "违规内容" --json` |
| 切换严审/配敏感词 | `npm run admin -- comments settings --mode manual --keywords "加微卖课,内部原题" --json` |
| 查看用户列表 | `npm run admin -- users list --status all --json` |
| 查看用户详情 | `npm run admin -- users show <userId> --json` |
| 禁言 / 解除禁言 | `npm run admin -- users mute <userId> --reason "刷屏" --json` / `users unmute <userId> --json` |
| 查看积分流水与规则 | `npm run admin -- points list --json` |
| 给单人或全员发/扣积分 | `npm run admin -- points grant --users <id1,id2|all> --delta 50 --type activity --reason "模考奖励" --json` |
| 修改默认积分规则 | `npm run admin -- points rules --submit 5 --correction 20 --comment 10 --json` |
| 查看答案纠错工单 | `npm run admin -- corrections list --json` |
| 审核纠错并重算成绩 | `npm run admin -- corrections review <feedbackId> --questions 1,5 --decision approve --reason "核对原卷" --reward 20 --json` |
| 查看后台操作日志 | `npm run admin -- audit list --json` |
| 初始化 / 重置本地密码 | `npm run admin -- auth setup --username admin --password '<8位以上>'` / `auth reset-password --password '<新密码>'` |

## AI 执行安全护栏

- **读优先**：做任何写操作前，先用 `list` / `show` 加 `--json` 查清目标 ID 与当前状态。
- **高影响操作先核对**：执行 `comments delete`、`users mute`、`points grant --users all` 或 `corrections review --decision approve`（会重算该套卷所有历史答卷）前，先向用户明确受影响范围，确认后再执行。
- **严禁泄露凭据**：永远不要把密码或 `ROLLIERANK_CONSOLE_TOKEN` 写进仓库文件、日志或回复文本中。
