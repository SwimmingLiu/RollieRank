# 本卷交流与互动接入

报告底部的评论图标进入独立的「全部评论」页面。根评论与回复都计入总数；底部输入入口使用已有昵称，点开后显示文字、照片和发送，正文中的 HTTP 链接自动识别。编辑器随文字增高，可展开全屏。

## 控制器与组件

`features/discussions.js` 导出 `createIOSDiscussionsFeature(ctx)`，提供 `reportEntryView()`、`discussionView()`、`afterRender()`、`onRoute()` 和 `destroy()`。页面保持当前真实答卷及公开版本；示例引导用户先练习。

`ui/discussions.tsx` 通过 bridge 导出 `mountDiscussionReportEntry`、`mountDiscussionPage` 和 `mountDiscussionEditor`。列表接收根评论与 `threads`，交互回调包括 `onLike(post)`、`onReply(post)`、`onThread(rootId)`、`onMoreReplies(rootId)` 和 `onRetryReplies(rootId)`。编辑器接收 `replyTo` 和 `onCancelReply`。

评论使用原有头像、细线图标、暖纸背景与浅珊瑚强调色。回复统一缩进一层，以目标昵称说明关系；回复他人的回复仍归属同一根评论。点赞以显式目标状态写入，重复请求和并发点击不会重复计数。

## 服务契约

| 操作 | 接口与行为 |
| --- | --- |
| 列表 | `GET /api/discussions`，`total` 包含回复，`rootTotal` 用于根评论分页 |
| 发表 | `POST /api/discussions`，可选 `parentId` 指定回复对象；回复结果附带 `rootComment` |
| 回复分页 | `GET /api/discussions/replies`，凭当前卷真实练习凭证读取 `rootId` 下的回复 |
| 点赞 | `POST /api/discussions/like`，提交 `commentId` 与 `liked` 目标状态 |

公开字段包括 `rootId`、`parentId`、`replyTo`、`replyCount`、`likeCount` 和当前身份的 `likedByMe`，不返回点赞者身份列表。所有读写验证试卷及练习凭证。后端继续读取已有媒体，手机端本轮只提供文字、照片与自动链接。

## 草稿与刷新

根评论、不同回复对象各有独立草稿。关闭、切路由、处理图片或发送失败均保留原目标的输入；成功后才清空。相同内容重试沿用 `clientId`，编辑后使用新标识。草稿按身份、试卷与回复对象保存在有大小限制的浏览器存储中，真实整页刷新后恢复文字和照片；存储拒绝时保留当前内容并提供恢复提示。已发表内容由服务端持久化。

根列表重新读取后会刷新已展开的回复串，返回讨论页可见其他人的新回复。分页、失败重试、折叠及再次展开保持根评论关系与真实数量。

## 验证

运行 `npm run verify -- feature discussion`。真实 A／B／C 身份专项覆盖点赞取消、回复及回复他人、分页、草稿、响应丢失重试、跨卷拒绝和重载；另检查手机没有媒体设备调用。当前完整运行见 `test-results/verification/results.json`，互动原图与响应见 `test-results/verification/journeys/discussion-interactions/`。
