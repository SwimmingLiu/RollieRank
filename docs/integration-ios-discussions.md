# iOS 试卷讨论接入

当前独立交流页与按需编辑器以 [本卷交流独立页面接入](integration-ios-discussions-refinement.md) 为准。

## 导出与公共接入

`docs/ui-exploration/ios-v3/features/discussions.js` 导出：

```js
createIOSDiscussionsFeature(ctx)
// 返回 { afterRender, onRoute, destroy }
```

包装直接组合原 `createDiscussionsFeature`，保留其真实 API、提交凭证、媒体校验、失败输入保留、分页和录音清理。根模块没有固定 `#modal` 依赖，本轮没有修改根模块或服务端。图片预览调用已有 `ctx.openModal`，由公共入口映射到 beUI BottomSheet。

协调入口需创建一次工厂，在每次公共 render 后调用 `afterRender`，所有路由完成后调用 `onRoute`，卸载时调用 `destroy`。使用约定中的同源 `api`、真实 `attempt/version/state` 和原有持久化。

```js
import { createIOSDiscussionsFeature } from "./features/discussions.js";
const discussions = createIOSDiscussionsFeature(ctx);
```

成绩板块之后提供：

```html
<div data-feature="discussions" class="ios-feature-host"></div>
```

在公共 iOS HTML 中引入 `features/discussions.css`。该文件只导入根模块的讨论专用 CSS，并在本挂载点覆盖白色、深灰、浅珊瑚、字体与纸卡，不导入根应用全局样式或侧栏。

## 头像 bridge 导出

新增独立文件 `ui/discussions-avatar.tsx`，复用当前 `ui/primitives.tsx` 的真实 beUI Avatar，导出 `mountDiscussionAvatar(container, { name, src? })` 和类型 `DiscussionAvatarProps`。图片加载时保留本地首字，失败后使用原 Avatar 回退；只接受 HTTP/HTTPS 或同源相对 URL，默认头像不请求网络。

协调对话在 `ui/bridge.tsx` 增加：

```ts
export { mountDiscussionAvatar } from "./discussions-avatar";
```

然后按现有流程统一构建 `vendor/beui.js/css`。包装在首次挂载和原模块的异步更新后调用该出口，并复用现有 `mountButtons`。DOM 被替换、路由离开或销毁时，包装清理脱离页面的 React island。bridge 出口尚未加载时，仍显示原模块的本地头像；公共接入验收应确认 `[data-slot="discussion-avatar"]` 确实渲染，而不仅是首字可见。

## 示例与导航

`attempt().isSample:true` 时，根模块禁止所有真实讨论读写。包装仅显示示例说明与正式核分按钮：有 `ctx.version().id` 时调用 `navigate("practice/" + encodeURIComponent(id))`；缺少版本时调用 `navigate("me")` 回记录选择试卷。不上传旧样例的分数，也不把旧记录伪装为真实凭证。

## 专项验证

```bash
node --test test/ios-discussions.test.js
```

套件在临时目录启动真实 `createApi`，先提交答案取得真实核分凭证，再从 `/ios-v3/` 的现有预览页及 iframe 内执行本包装。仅用测试入口替换 iframe 的业务启动脚本；现有 HTML 外壳、纸卡、字体和 BottomSheet 均保留。测试临时编译真实 bridge 与独立头像组件，不写公共 vendor 文件，不访问日常数据或占用 4781 端口。

覆盖组合评论真实写入、失败时文字及附件保留、刷新与服务重启读取、beUI 头像、图片 BottomSheet、320/390px、示例零请求与核分导航、录音权限失败恢复和音轨释放。录音使用浏览器生成的真实音轨执行原生 MediaRecorder；实体麦克风与系统权限弹窗仍待实际设备验证。

协调对话已报告完成公共入口与真实 Avatar bridge 接入、vendor 构建及 4781 同源 Node 服务切换。实际 `/ios-v3/` 入口的 10 项流程通过，包含多媒体评论、真实 Avatar、核分、选岗、VS、跨机构趋势、排行、BottomSheet 审核重算和 135 题刷新恢复。

公共入口结果来源于协调对话的组合验收；本模块直接验证的专项、回归、截图与限定文件指纹保存在 `.beauye/tasks/ios-discussions/evidence/`，已核对与交付源码一致。
