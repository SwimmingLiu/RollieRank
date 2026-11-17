# 原生答题卡接入

ui/answer-sheet.tsx 导出 mountAnswerSheet(container, props) 和 AnswerSheetProps、AnswerSheetSection 类型。需要由公共 bridge 增加该导出，公共页面在 vendor/beui.css 之后引入 features/answer-sheet.css，使本组件尺寸和圆角覆盖 beUI 默认按钮尺寸；本模块不写 app.js、bridge 或 vendor。

```ts
export { mountAnswerSheet } from "./answer-sheet";
export type { AnswerSheetProps, AnswerSheetSection } from "./answer-sheet";
```

```ts
mountAnswerSheet(container, {
  sections: [{ name: "言语理解", start: 1, end: 3 }],
  answers: ["A", "", "C"],
  current: 3,
  onJump: (question) => { /* 公共入口负责跳题及是否关闭面板。 */ },
});
```

sections 是真实、按题号排序且不重叠的题型范围，并应覆盖当前答卷全部题目。题号从 1 开始，answers 按题号减 1 取值。answers 为只读字符串数组，A–D 表示已选，其余空值映射为空字符串。服务端 null 答案可由调用方使用 `answers.map(answer => answer ?? "")` 转换。current 为当前题号。

请在现有 BottomSheet 的内容宿主准备好后挂载，沿用 mountRoot 注册表进行 cleanup；mountAnswerSheet 本身也返回清理函数。更新 current 或 answers 时可在相同容器再次调用，旧清理函数不会撤销新挂载。组件不创建模态、不关闭面板、不修改答案或调用提交逻辑；点击和 Enter/空格只调用 onJump。

列表默认五列，350px 及以下为四列，触屏单元至少 44px。题型标题在独立列表内吸顶，当前题只在自身列表内定位，不调用会传播到外层的 scrollIntoView；列表尺寸变化或从隐藏转为可见时也会重新定位。方向键移动焦点，Home/End 到首末题；移动焦点不会调用 onJump。

## 已验证

`node --test test/ios-answer-sheet-browser.test.js` 实际执行通过。测试先对本组件及其依赖执行严格 TypeScript 检查，再在临时目录编译真实 React、beUI Button 和现有 BottomSheet；未覆盖公共 vendor。

| 检查 | 实际结果 |
| --- | --- |
| 题量与范围 | 135、130、6、4 题及空集合均通过；130/135 题末题可见并可点击 |
| 响应式列数 | 320/350px 为四列，390/430px 与桌面外层为五列 |
| 触屏与层级 | 实测最小单元 53.5 × 53.5px；题号 11px、答案 20px；13px 圆角方格 |
| 答案与当前态 | 已答暖纸底、未答白底、当前题珊瑚描边；已答计数随受控输入更新 |
| 定位与吸顶 | 当前题在自身列表中可见，题型标题实际吸顶；外层画板、背景和 sheet-content 滚动值不变 |
| 键盘与回调 | 方向键和 Home/End 移动焦点不跳题；Enter、空格和点击按真实题号回调 |
| 只读及关闭 | 冻结答案数组未被组件修改；宿主关闭不调用 onJump，也不改变答案 |
| 反复挂载 | 受控更新和重新打开不同题量正常；旧清理函数不会撤销新挂载 |

截图及验证报告位于 test-results/ios-answer-sheet，固定源码和测试哈希位于 docs/ios-answer-sheet-source-lock.json。

公共 app.js 中的答题卡入口、bridge 导出、CSS 引入、vendor 组合构建和实际用户端口由协调任务接入与复验。本模块只管理列表与跳题回调，未修改这些公共文件。
