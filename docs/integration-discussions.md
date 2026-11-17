# 试卷讨论接入

四项功能已在公共入口接入，组合流程、构建验收及运行边界见 [公共集成 PR 草稿](pr-feature-integration.md)。

## 文件与导出

| 文件 | 导出或职责 |
| --- | --- |
| `server/discussions.mjs` | `createDiscussionsService({ readCatalog, mutateCatalog, dataDirectory })`，返回异步 `handle(context)` |
| `src/features/discussions.js` | `createDiscussionsFeature(ctx)`，返回 `afterRender()`、`onRoute()`、`destroy()` |
| `src/features/discussions.js` | 纯函数 `normalizeDiscussionLink` 与 `DISCUSSION_LIMITS` 由服务端共用；模块导入时不访问 DOM |
| `src/features/discussions.js` | 媒体工具 `normalizeDiscussionImage`、`normalizeDiscussionAudio`、`encodeDiscussionWav`、`createDiscussionRecorder` 与 `renderDiscussionComment`，供本模块和验证使用 |
| `src/features/discussions-avatar.js` | `renderDiscussionsAvatar({ name, seed, image? })`、`bindDiscussionsAvatars(root)` |
| `src/features/discussions.css` | 所有选择器与交互属性使用 `discussions` 前缀 |

服务端仅通过 `mutateCatalog` 修改 `features.discussions.comments`；不直接操作文件、版本、提交凭证、审计或其他功能状态。评论包含私有 `guestId/clientId/bodyHash` 供归属与幂等校验；响应剔除这三个字段。

## 公共入口接入

```js
import { createDiscussionsService } from "./discussions.mjs";

const discussions = createDiscussionsService({ readCatalog, mutateCatalog, dataDirectory });
// 放在公共 API 的最终 404 分支之前。query 是 URLSearchParams，input 是普通 JSON 对象。
if (await discussions({ request, response, pathname, method, input, query, send })) return true;
```

`readCatalog()` 返回当前 `{ versions, receipts, audit, features }`。GET 应先等待公共写队列稳定；`mutateCatalog` 在串行同步回调后持久化，失败同时回滚内存。`send(status, body)` 是父入口已绑定当前 response 的函数，业务错误抛出带 `statusCode` 的 Error。

为 `POST /api/discussions` 设置 **8 MiB** JSON 请求限额，按实际接收字节累计；其他接口保持原限额。该路径接受最多 3 MiB PNG 图片和 2 MiB WAV 音频，Base64 后约 6.7 MiB。GET 查询串含本机提交凭证，应沿用同源服务和 `no-store`，不输出敏感查询到公开分析服务。

```js
import { createDiscussionsFeature } from "./features/discussions.js";

const discussions = createDiscussionsFeature(ctx); // 启动时创建一次
// 每次公共 render 写入页面后：
discussions.afterRender();
// current 更新且页面渲染后：
await discussions.onRoute();
// 应用被卸载时，可选调用：
discussions.destroy();
```

前端实际使用 `ctx.state()`、`ctx.route()`、`ctx.attempt()`、`ctx.api(path, data?)`、`ctx.persist()`、`ctx.openModal()`。`ctx.api` 的路径是 `discussions` 或 `discussions?...`，沿用公共函数自动添加的 `/api/` 前缀。`route().page` 应为 `report`，`attempt()` 返回当前真实成绩或带 `isSample` 的示例。

在结果页复盘内容之后加入：

```html
<div data-feature="discussions"></div>
```

在 `styles.css` 的所有样式规则之前加入：

```css
@import "./src/features/discussions.css";
```

现有构建会复制整个浏览器 `src` 目录，头像工具随模块一同发布，无新增依赖或 CDN 资源。工厂只注册一次 `data-discussions-*` 委托事件，不占用公共 `data-action`。`onRoute`、`pagehide` 和 `destroy` 会取消录音；公共入口必须在离开报告时也调用路由钩子。

## API 契约

| 方法与地址 | 输入 | 响应 |
| --- | --- | --- |
| `GET /api/discussions` | 查询 `paperId, guestId, attemptId`，可选 `before` 评论 ID | `200 { paperId, comments, total, nextCursor }`，每页 20 条，最新在前 |
| `POST /api/discussions` | 下方对象 | 新建 `201 { comment, replayed: false }`；相同重试 `200 { comment, replayed: true }` |

```js
{
  paperId: attempt.paperId,
  guestId: state.guestId,
  attemptId: attempt.id,
  clientId: crypto.randomUUID(),
  nickname: state.profile.name,
  text: "这套卷的资料分析，你用了多久？",
  links: ["https://example.com/question"],
  images: [{ dataUri: "data:image/png;base64,...", alt: "第 12 题的时间分配笔记" }],
  audio: { dataUri: "data:audio/wav;base64,...", name: "我的解题思路" }
}
```

`text`、`links`、`images`、`audio` 可分别为空；至少一种内容非空。昵称最多 16 字、文字最多 2,000 字、链接最多 3 个，单个链接最多 2,048 字。链接仅支持无账号密码的 HTTP/HTTPS。图片说明和语音说明最多 120 字。

服务端通过 `receipts[guestId + ":" + attemptId]` 验证真实提交及 `paperId`，不接受客户端成绩或示例凭证。相同试卷的不同版本共用讨论，评论保留发言时的 `versionId/versionLabel`。读取也需要真实凭证，不对未提交者公开参考资料。错误码包括输入无效 `400`、无真实凭证 `403`、重试标识内容冲突 `409`、附件过大 `413`、其他方法 `405`。

媒体只接受客户端规范化后的静态 PNG 与单声道 16 kHz、16 位 PCM WAV 数据 URI。服务端校验实际字节、严格 Base64、PNG CRC/结构/尺寸/有界解压、WAV 字节与时长，并剥离 PNG 附加元数据。图片不超过 2048×2048，每张最多 1 MiB；音频最长 60 秒、最多 2 MiB；附件总量最多 5 MiB。请求中的 `bytes/duration/width/height` 不作为可信依据。

客户端支持 PNG、JPEG、WebP 图片及浏览器可处理的 WAV、MP3、Ogg、WebM、M4A 音频，原文件最多 8 MiB。图片先检查头部像素，再解码缩放；上传音频先读取时长，再完整解码。无法确定时长的上传音频提示转换为 WAV 或 MP3；受模块定时器控制的录音可直接解码，超过上限的编码填充会裁至 60 秒。

## 身份、头像与恢复

游客填写昵称后，发表前保存到现有 `state.profile = { id: state.guestId, name }`，已有昵称直接复用。修改昵称只影响后续发言，历史署名保留。没有额外注册、第三方头像请求或新身份键。

头像默认使用本地首字和稳定配色，提供可访问名称。独立工具可选接收网络图片，图片加载完成前、失败时均显示本地首字，避免破图覆盖回退。成熟组件比较与采用依据见 `docs/solution-discussions.md`。

未发表内容按试卷保存在本模块内存；请求失败、附件处理失败和路由切换保留输入。刷新后重新读取已发表评论；未发表的内存草稿不承诺跨刷新保留。媒体处理与提交期间阻止重复发表；相同内容重试沿用 `clientId`，编辑后生成新标识。列表刷新不重建编辑器和既有音频节点。

## 验证

```bash
node --test test/discussions.test.js
node --test test/discussions-client.test.js
npm run build
ROLLIERANK_DISCUSSIONS_DIST=1 node --test test/discussions-client.test.js
```

浏览器套件使用工作区可用的 `playwright` 与 Chromium；没有 Playwright 时会明确标记跳过，不能视为浏览器验收完成。本机安装了对应 Chromium 并实际运行套件。测试宿主使用生产 `shell/reportView` 和本模块，在独立临时目录与动态端口提供服务，不读取日常 `.local` 数据。`ROLLIERANK_DISCUSSIONS_DIST=1` 让宿主从 `dist` 读取浏览器文件，用于验证构建后的模块和头像工具。

录音验证用浏览器生成的真实音轨运行原生 MediaRecorder、编解码、规范化与发表，并注入权限拒绝与延迟授权。当前 headless macOS 环境的原生麦克风请求持续未返回，实体麦克风、系统权限弹窗和 Safari 的录音编码需在公共集成后复验。

截图和浏览器断言位于 `.beauye/tasks/discussions/evidence/`。公共入口、8 MiB 限额、真实成绩报告提交链、日常目录重启恢复和全站回归仍由协调对话接入后验证；独立测试宿主通过不等于这些集成项已经通过。
