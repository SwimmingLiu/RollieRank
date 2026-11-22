# iOS v3 功能接入

## 问题与目标

用户实际使用 `http://127.0.0.1:4781/ios-v3/`。此前四项功能只接入根应用；该地址仍由 Python 静态服务器提供，缺少 API 和新增功能。已用真实浏览器复现：练习记录页的「我的岗位」数量为 0，`/api/catalog` 返回 404。

本轮直接接入这套白色、深灰、浅珊瑚色 beUI 界面，保留已有字体、纸卡、排行榜前三名、导航和原记录。使用已有真实 API；设计样例不能冒充真实提交、参与排名或发送正式反馈。

## 共享约定

沿用前轮各模块，不重复实现服务端计分、权限、媒体校验或分析算法。实际服务在同源 `/api/`。协调对话负责把 4781 静态服务切换为可同时服务 `/ios-v3/` 和 API 的 Node 服务。

原记录继续按原 key 保存。服务端答卷另用稳定本机凭证保存，真实提交后建立同 ID 的显示记录；旧样例可查看，并明确引导按当前答案重新核分。不能直接把旧样例分数上传到榜单。

## 文件归属

| 对话 | 负责文件 |
| --- | --- |
| 选岗与榜单 | `features/positions.js`、`features/positions.css`、`ui/ranking.tsx`；需要时为 `src/features/positions.js` 增加只读状态出口；`test/ios-positions*` |
| 讨论 | `features/discussions.js`、`features/discussions.css`、可选独立头像组件及 `test/ios-discussions*`；需要的公共 bridge 导出写在交接说明中 |
| 成长分析 | `features/analytics.js`、`features/analytics.css`、`ui/results.tsx`、`test/ios-analytics*` |
| 纠错 | `features/corrections.js`、`features/corrections.css`、`test/ios-corrections*`；必要时给原纠错模块增加兼容的弹层容器配置 |
| 协调对话 | iOS `app.js`、`service-client.js`、`features/base.css`、`app.html`、`index.html`、`ui/bridge.tsx`、`ui/records.tsx`、服务入口、端口切换与完整验证 |

上表的 `features/`、`ui/` 均相对 `docs/ui-exploration/ios-v3/`。共享工作区已有改动，不能撤回他人的修改。各模块不要同时修改 bridge、vendor 编译文件或公共 app.js；由协调对话统一构建。

## 工厂与上下文

新包装分别导出 `createIOSPositionsFeature(ctx)`、`createIOSDiscussionsFeature(ctx)`、`createIOSAnalyticsFeature(ctx)`、`createIOSCorrectionsFeature(ctx)`。工厂只调用一次。优先直接组合此前 `src/features/` 下的工厂与纯函数。

`ctx` 保持此前约定：`state()` 返回兼容 prototype-state 的服务状态，含 `guestId/profile/attempts/drafts`；`catalog()` 返回真实公开目录；`attempt()` 返回当前真实答卷或带 `isSample:true` 的旧样例；`version()` 返回对应公开版本；`route()` 返回标准 `{page,id}`（iOS entry 映射为 practice）；`dimension()` 返回总分 `total` 或真实题型 ID。

提供 `api(path,data?)`、`persist()`、`render()`、`toast()`、`openModal(title,body,actions?,className?)`、`closeModal()`、`navigate(path)`、`refreshCatalog()`、`syncAttempts()`、`submitAttempt()`。弹层由现有 beUI BottomSheet 承载；body 和 actions 都是已转义的业务 HTML。另提供 `setDimension(id)` 和 `uiState()`（只读 iOS 导航上下文）。`navigate` 识别 `stats`、`admin`、`me`、`rank/:versionId`、`report/:attemptId`、`practice/:versionId`。

包装可返回原有 `afterRender/onRoute/beforeSubmit/afterSubmit`。分析还返回 `statsView`。纠错可返回 `adminView`（管理页挂载自己的审核区域）。选岗返回 `rankView` 和 `mountRank`：前者提供原有原生排名组件的宿主，后者调用 `window.RollieUI.mountRank`，以真实榜单数据保留当前纸卡和前三名。可额外暴露 `standing()`，返回当前真实总分榜 `{rank: number|null, count: number}`，供成绩及分享使用。

## 挂载与设计

个人记录组件的身份区域后提供 `positions-profile`、`analytics-entry`，历史后提供 `corrections-user`。成绩总分摘要后提供 `analytics-comparison`；全部板块后提供 `corrections-report` 和 `discussions`。管理页提供 `positions-admin` 与 `corrections-admin`。挂载点格式为 `<div data-feature="…" class="ios-feature-host"></div>`。

现有 React islands 通过 flushSync 提交，所以公共 render 后可同步调用 afterRender。不要复制根应用侧栏、紫色品牌或其整套 styles.css。各包装 CSS 可引入原模块的独立样式，再在 `.ios-feature-host` 范围内改用本 UI 的现有颜色、字体、间距和表面；新功能保留原生键盘、文件、音频行为。

结果与分享组件继续使用成熟 beUI 组件。真实报告的题量、满分和各板块来自 API，移除实际路径上的固定 18/236 名次。`ui/results.tsx` 可新增 `maxScore?: number` 和 `rank: number|null` 的兼容支持；未参与时显示「未参与排名」，不得回填演示排名。旧样例须有明确标识。

## 验证

各对话复用原目标的授权，以新 goal 完成自己在实际 iOS UI 的接入，交接写到 `docs/integration-ios-任务名.md`。先完成实现和专项验证，再将独立模块交给协调对话。不要反复追逐其他并行任务造成的全目录指纹变化。

最终验收必须从用户的 `/ios-v3/` 页面和 iframe 内执行；仅有根应用的测试通过不满足本轮要求。协调对话验证选岗提示、真实核分、多媒体评论、VS、跨卷趋势、授权审核及重算同步，并实际更新 4781 服务。组件构建和现有 bridge、类型检查、历史模型测试都要运行。
