# iOS 选岗与真实排行接入

## 导出与调用

从 `docs/ui-exploration/ios-v3/features/positions.js` 导入 `createIOSPositionsFeature(ctx)`，在服务状态与真实目录就绪后实例化一次。上下文完全沿用 `docs/ios-v3-feature-integration.md`，包括真实版本 getter、`setDimension(id)`、普通对象服务状态与同源 API。

返回 `afterRender,onRoute,beforeSubmit,afterSubmit,rankView,mountRank,standing,openPicker,openParticipation,withdraw,destroy`。`afterRender()` 已调用 `mountRank()`，由该方法执行 `window.RollieUI.mountRank(host, props)`；公共 render 后调用一次 afterRender 即可。排名宿主是 `[data-ios-positions-rank]`，ID 为 `ios-positions-rank-ui`，不会匹配旧演示路径的 `#rank-ui`。

个人身份下方和管理页保留契约中的 `positions-profile`、`positions-admin` 挂载点，并加 `.ios-feature-host`。导入 `features/positions.css`，它只引入原岗位局部样式并覆盖该区域及岗位弹层的颜色、字体、按钮和间距，不引入根应用侧栏或紫色全局样式。

包装直接复用 `createPositionsFeature`。原模块新增 `snapshot()`，返回与内部状态分离的副本，包含 profile、catalog、scope、browsingPosition、page 和 board；旧入口的默认钩子保持兼容。

## 公共入口需要调整

排行页面调用包装的 `rankView()`，替换旧 `rank()` 的演示宿主。移除实际路径中的 `RANK_FIXTURES`、`rankModel()` 与旧 `updateRank()` 调用，不向旧组件继续传固定的 18/236。实例 onRoute 必须在真实版本切换及报告、分享、排行路由进入时调用，并在真实成绩订正同步后再次调用。

报告和分享 props 使用 `const {rank,count}=positions.standing()`，把 rank 原样传入（可为 null），participants 使用 count。未参与、无真实版本、旧样例或请求失败返回 `{rank:null,count:0}`；真实榜有其他参与者时保留实际 count。它独立读取当前版本的总分榜，默认个人岗位，未选岗由服务回退全国，不跟随临时浏览其他岗位的范围。

提交前 await beforeSubmit，返回 false 时结束本轮提交。选岗或明确跳过会再次调用 ctx.submitAttempt，保留原勾选；提交函数应允许原确认弹层已被替换。服务答卷保存后调用 afterSubmit，以 Promise.allSettled 汇总后续同步失败并继续进入真实报告。

`openModal` 的 body 与 actions 已分别包裹 `.ios-feature-host.ios-positions-sheet`。公共 BottomSheet 需要同时渲染 body/actions，保留原生表单、按钮 data 属性和焦点约束。岗位委托使用 `data-position-action`，不得另接一份相同行为。已有 beUI mountButtons 如增强正文按钮，应保留这些属性。

## RankingProps 的兼容扩展

原有 Card、TiltCard、Avatar、NumberTicker、Tabs 及领奖台样式保留。`myRank`、`myScore` 支持 null，`context.year` 支持未知时的空字符串；新增参数均为可选，旧入口仍可使用原 props。

| 字段 | 包装传入的真实值 |
| --- | --- |
| dimensions | 当前公开版本的去重 typeId/type，另加 total；不按固定七类猜测。 |
| people / rows | 首屏前三人及剩余真实行；后续页不重复前三人。place 保留服务端并列名次，key 另行稳定区分。 |
| myRank / participants / myScore | self.rank / count / self.value；未参与传 null，零分保留。 |
| scoreUnit | 总分为分；题型按 rate 显示百分比，并保留原得分/满分说明。 |
| scope | selected、nationwide 或 position 及当前范围名称、未选岗提示。 |
| participation / paging | 真实参与状态、page/pages；入口复用原岗位模块的委托行为。 |
| loadState | ready、loading 或带 message 的 error；加载失败不显示旧样例人物。 |

领奖台的视觉槽位与真实 place 分离，1、1、3 等并列顺序不会丢人或产生重复 React key。长昵称可以完整通过 title 读取，头像使用真实传入资源或 beUI 本地回退。

## 验证与边界

专项测试位于 `test/ios-positions*`。独立测试使用实际 createApi、服务端核分的答卷、官方岗位目录和临时持久化目录；组件验证把最新 ranking.tsx 与现有 root/sheet 组件构建到测试临时产物，保持共享 vendor 不变。

7 项 iOS 专项与 7 项原模块兼容测试全部执行并通过。既有 bridge 测试 2 项、历史模型测试 4 项通过，UI 的 `tsc --noEmit` 通过。浏览器从独立服务的 `/ios-v3/` 原预览页进入 iframe，验证真实前三人纸卡及并列、动态题型、零分、选岗提醒与跳过、搜索翻页、参与、撤回、范围隔离、失败重试和报告 standing。390×844、320×568、430×932 均无横向溢出，320px BottomSheet 搜索及分页可操作。

独立证据位于 `.beauye/tasks/ios-positions/evidence/`，包括 module-browser.json、截图、targeted-tests.log、typecheck.log、bridge.log 和 practice.log。`docs/ios-positions-source-lock.json` 固定本任务源码哈希；冻结副本在 `.beauye/tasks/ios-positions/frozen/`。此处的临时组件构建验证最新源码，正式 vendor 仍由协调对话统一生成。

公共 4781 端口切换、iframe 入口、记录 slots、报告/分享 standing 字段接入、共享 bridge 与 vendor 的最终构建及四功能组合验收由协调对话执行。本模块不改 app.js、service-client.js、bridge 或服务入口。
