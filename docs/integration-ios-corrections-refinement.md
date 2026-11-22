# 纠错入口收敛接入

## 导出

createIOSCorrectionsFeature(ctx) 保留原 afterRender、onRoute、afterSubmit、adminView、dispose，并提供下列方法。

| 方法 | 行为 |
| --- | --- |
| openFeedback(questionNumber?) | 打开现有 BottomSheet 反馈表单；可传入当前答卷的整数题号。成功返回 true；保存中、样例、无答卷或非法题号返回 false。无参数从空题号开始。 |
| reportStatusView() | 返回轻量订正状态 HTML；没有真实答案订正、仅有待审反馈或当前为样例时返回空字符串。 |

逐题对照页标题栏的“答案纠错”按钮调用 `corrections.openFeedback()`；逐题操作可调用 `corrections.openFeedback(questionNumber)`。ctx.attempt() 必须在 details 返回当前真实答卷。每次进入从新反馈开始，不继承已经取消表单中的题目；表单内仍可增加多题，失败重试保留当前输入与幂等编号。

原 createCorrectionsFeature 仅新增两个公开方法：openFeedback(questionNumber?) 和 reportNotifications()。后者返回当前答卷的通知副本，供包装渲染，不引入另一个成绩缓存。原根应用反馈按钮继续工作。

## 报告与个人记录

报告不再提供常驻 corrections-report 卡。包装 afterRender 会清空仍存在的旧宿主，并由 :empty 隐藏，避免兼容期留下空区域。

公共报告可放置 `<div data-feature="corrections-status" class="ios-feature-host"></div>`。包装在 afterRender 自动填入 reportStatusView()；也可在生成报告时直接插入该方法返回的 HTML。不要同时放置两份状态。

状态只在当前答卷收到真实答案变化后出现，显示“答案已订正”及非零分数变化，点击打开最新一次处理详情。普通报告不常驻版本或修订号；题号、理由和版本仍可在详情中核对。多次订正的完整通知保留在个人记录。

corrections-user 的空通知卡收敛为一行“维护者审核”入口；有真实反馈、通知或读取错误时仍保留原区域。管理页及凭证、审核和重算链路不变。

## 关闭和样例

取消、Escape 和公共 BottomSheet 遮罩只关闭输入，不发送反馈或提交答卷，也不改变正式答案、成绩、历史或参与状态。重新进入时可重新选择题号。原有失败重试只发生在仍打开的表单内。

标题栏按钮可根据 ctx.attempt()?.isSample 禁用；公开方法自身也会拒绝样例，不能仅靠隐藏按钮。所有授权与重算仍由原服务端验证。

## 验证边界

专项使用 test/ios-corrections-browser.test.js，在独立同源 /ios-v3/ iframe 内挂载真实 beUI BottomSheet 和真实 API。7 组场景全部通过，无浏览器运行错误；原纠错 11 项回归也全部通过。

| 验证项 | 实际结果 |
| --- | --- |
| 普通报告及待审反馈 | 不存在常驻反馈卡，reportStatusView() 返回空字符串 |
| 逐题对照入口 | 指定第 2 题时预填 2；不传题号留空；超范围题号被拒绝 |
| 取消、Escape、遮罩关闭 | 反馈数量仍为 0，服务端答卷快照与操作前完全一致 |
| 再次进入及多题 | 不继承取消的题目；可增加、删除多题，失败保留输入并安全重试；保存中直接调用公开入口也不会替换当前表单 |
| 审核后的报告 | 只出现“答案已订正”和实际分数变化，点击打开真实处理理由；无常驻技术版本信息 |
| 通知与审核 | 空通知只保留维护入口；真实通知、授权、分批通过与拒绝继续可用 |
| 样例报告 | 入口及公开方法都阻止正式反馈，报告状态返回空 |
| 手机与桌面外层 | 320/390/430px 及 1280px iframe 检查通过，无横向溢出 |

运行：`node --test test/ios-corrections-browser.test.js`。ROLLIERANK_BROWSER_PYTHON 可指定包含 Playwright 与 Chromium 的 Python 环境；本次测试实际执行，未跳过。截图与结果保存至 test-results/ios-corrections-refinement，源码及测试的固定哈希保存在 docs/ios-corrections-refinement-source-lock.json。

公共 app.js 的标题栏按钮和报告状态挂载、bridge/vendor 组合构建、真实用户端口及全场景复验仍由协调任务维护。模块验证使用独立端口及临时目录，不把专项宿主的成功等同于公共入口已完成接入。
