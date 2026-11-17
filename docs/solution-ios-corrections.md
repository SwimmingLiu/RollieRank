# iOS 纠错包装方案

createIOSCorrectionsFeature 组合现有 createCorrectionsFeature，服务请求、凭证、审核、试算与重算使用同一条链路。原模块只增加 modalSelector 配置，默认仍为 dialog[open]；iOS 使用 .rr-sheet 查找待禁用按钮，包含标题栏的关闭操作。弹层的打开、关闭、焦点和返回行为继续交给公共 BottomSheet 适配器。

结果、个人通知和管理队列沿用 corrections-report、corrections-user、corrections-admin 挂载点。个人通知区增加“维护者审核”入口，调用 navigate('admin')。adminView 只输出纠错与岗位管理两个宿主，公共入口提供页面导航。

包装样式采用现有字体、白色纸卡、深灰正文和浅珊瑚强调。表单保留原生标签、选择器与文本框，底部操作可以换行，320px 下不横向溢出。设计样例的反馈按钮禁用，并提示完成真实练习后再反馈。

专项测试在独立同源服务的 /ios-v3/ iframe 中加载现有 beUI 编译组件与包装模块，使用真实 API 和临时目录。验证多题提交、失败保留输入、保存期间禁用、试算、错误凭证、授权、批量确认、通过与拒绝、反馈者及其他考生通知、维护者入口和会话凭证清除。公共端口、组合页面与最终构建由协调任务验收。
