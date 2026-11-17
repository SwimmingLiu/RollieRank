# iOS 纠错模块接入

## 导出与页面

从 docs/ui-exploration/ios-v3/features/corrections.js 导入 createIOSCorrectionsFeature(ctx)，只初始化一次。它复用原 createCorrectionsFeature 的全部请求与审核逻辑，返回 afterRender、onRoute、afterSubmit、dispose，并新增 adminView()。

adminView() 返回 corrections-admin 与 positions-admin 两个 ios-feature-host 挂载点。协调入口将它用于 admin 页面，并在公共 render 后调用 afterRender。个人记录的 corrections-user 区域会自动增加“维护者审核”按钮，调用 ctx.navigate('admin')；无需为包装注册公共 data-action。

结果与个人记录仍使用既定 corrections-report、corrections-user 挂载点。样例 isSample:true 会禁用反馈入口，原模块也会在动作处理时拒绝打开正式反馈表单。

引入 features/corrections.css；它只加载原纠错模块独立 CSS，并在自己的宿主和弹层内覆盖为白、深灰、浅珊瑚及当前字体，不加载根应用 styles.css。

## BottomSheet 与兼容配置

ctx.openModal(title, body, actions, className) 继续由公共 beUI BottomSheet 实现。包装会为 body 和 actions 增加 ios-corrections-sheet、ios-corrections-sheet-actions 样式范围，并传入 ios-corrections-modal 类名。原先的 correction-dialog 布局不会用于 iOS。

原模块只新增 ctx.modalSelector，用于保存期间查询弹层内按钮。未配置时仍为 dialog[open]，根应用行为保持。iOS 包装默认使用 .rr-sheet，包含关闭按钮及内容操作；如公共上下文显式提供 modalSelector，将使用该配置。建议提供 .rr-sheet，避免只禁用 #sheet-content 而遗漏标题栏关闭按钮。

焦点、Escape、关闭后返回和弹层切换均由公共适配器及 beUI 处理。模块只在原有试算结果替换按钮后将焦点放入新结果。表单依赖原生 input/select/textarea、form 属性和 document submit 委托；mountButtons 必须保留 form、type、name、value、data-correction-* 等原始属性。

凭证仍只在模块内存中保留；审核后调用 syncAttempts 与 refreshCatalog。服务端接口、状态和授权规则沿用 integration-corrections.md，没有新增后台接口。

## 验证范围

专项验证使用临时同源端口、真实 createApi 和现有 beUI mountSheet，在 /ios-v3/ 的 iframe 内操作。页面确认没有原生 dialog，操作确实发生在 .rr-sheet 内。测试文件为 test/ios-corrections-browser.test.js，报告与截图位于 test-results/ios-corrections。

| 已验证 | 结果 |
| --- | --- |
| 多题填写、增删题目、失败保留输入、保存期间禁用操作 | 通过；标题栏关闭按钮也被禁用 |
| BottomSheet 内反馈详情及试算 | 通过；0.85 分正式成绩保持，建议成立时试算为 2.15 分 |
| 个人通知区进入管理页，重复 afterRender 不生成重复入口 | 通过；两个管理 slot 均存在 |
| 错误凭证拒绝、正确凭证授权、刷新清除凭证 | 通过；浏览器 DOM 和本地存储不包含凭证 |
| 审核确认、返回保留理由、分批通过和拒绝 | 通过；第一题订正，第二题拒绝，待审数量归零 |
| 反馈者与另一考生的订正通知 | 通过；分别显示 0.85 → 1.35 分和 3.35 → 2.85 分 |
| Tab、Escape、320/390/430px 手机及桌面 iframe | 通过；无横向溢出，无浏览器运行错误 |
| 样例报告反馈入口和动作保护 | 通过；isSample:true 不打开反馈弹层 |
| 根应用兼容回归 | 原纠错 11 项测试全部通过，包含原生 dialog 流程 |
| iOS 现有模型与 bridge 检查 | 7 项通过 |

运行专项：`node --test test/ios-corrections-browser.test.js`。可用 ROLLIERANK_BROWSER_PYTHON 指定安装了 Playwright 和 Chromium 的 Python；依赖缺失时会明确跳过，本次实际执行通过。

实际 4781 端口切换、公共 app.js/service-client.js 的组合接线、真实记录恢复及整体组件构建和类型检查由协调任务处理。本任务未修改这些公共文件，也未将独立宿主的成功等同于用户端口已完成更新。
