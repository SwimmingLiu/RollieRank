# 原生答题卡组件方案

mountAnswerSheet 使用现有 mountRoot 和 beUI Button，在公共 BottomSheet 的内容区中挂载，不另建弹层。sections 提供真实题型与范围，answers 和 current 由调用方控制，点击方格仅调用 onJump。

上方只显示已答数和总题数。题型标题保留范围并在列表内吸顶；方格默认五列，350px 及以下为四列。题号位于上角，字号 11–12px，答案以 20px 为主值；未答显示低对比点。已答使用暖纸底，未答白底，当前题为珊瑚描边，单元尺寸至少 44px。

列表有独立高度与滚动范围。挂载及 current 改变时，只调整该列表的 scrollTop，使当前题避开吸顶标题。方向键移动焦点，Home/End 定位首末题，Enter/空格沿用真实 Button 激活；移动焦点不会提前跳题。焦点移动使用 preventScroll，再由自己的列表调整位置。

专项在临时目录编译真实 React 组件和现有 BottomSheet，使用独立 /ios-v3/ iframe 验证 130/135 题、不同题型边界、已答/空白/当前状态、320px 四列与常规五列、长题号、键盘、末题可达及外层滚动不变。公共 bridge、app.js 和 vendor 由协调任务接入。
