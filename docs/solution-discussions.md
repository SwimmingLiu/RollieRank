# 试卷讨论实现方案

结果页沿用现有紫粉配色、卡片、字体和按钮样式。讨论放在成绩与复盘内容之后，先显示编辑器，再显示按时间排序的评论。编辑器只有昵称、内容、附件与发布操作；格式和大小限制放进可展开帮助。手机保持单列，图片可打开查看，音频使用原生播放控件。

游客首次发言时填写昵称，发布前保存为现有 `state.profile = { id: state.guestId, name }`。已有身份直接复用，昵称不作为账号认证。未发表内容按试卷保存在模块内存中；请求、附件处理失败和路由切换均保留，成功后清空。已发表评论存入 `features.discussions`，只通过父服务的串行 `mutateCatalog` 写入。

服务端检查本机提交凭证，评论请求必须携带属于同一 `guestId`、同一 `paperId` 的真实 `attemptId`。读取和发表使用同一凭证约束。示例报告既不读取真实讨论，也不提供发表表单。不同版本的同一试卷共用讨论，评论保留发言时的版本号。

每条评论最多 2,000 字、3 张图片、1 段 60 秒以内音频和 3 个 HTTP/HTTPS 链接。客户端将图片解码并绘制为 PNG，将可解码的 WAV、MP3、Ogg、WebM、M4A 音频转换为单声道 16 kHz、16 位 PCM WAV。服务端独立检查严格 Base64、实际字节、PNG CRC/结构/像素/有界解压和 WAV 头/字节/时长，仅保存规范化媒体。单图最多 1 MiB，音频最多 2 MiB，单条附件合计最多 5 MiB，父接口需要 8 MiB JSON 限额。

发表使用客户端生成的 `clientId`，服务端按本机身份与该标识幂等处理，响应丢失后重试不会重复发表。失败保留文字、链接和已选媒体；发送期间锁定编辑器，避免响应覆盖新编辑。读取使用游标分页，列表更新不重建编辑器，保留焦点、文本选区和正在播放的音频。

录音在支持 `getUserMedia`、`MediaRecorder` 和 Web Audio 的安全上下文提供；优先选择浏览器支持的音频容器，停止后转成 WAV。取消、路由离开、权限请求完成后已离开、设备错误和销毁时停止所有轨道并清除定时器。权限失败后可再次尝试或上传音频。最长 60 秒自动停止。

## 控件与头像选型

| 候选 | 适配结论 | 采用情况 |
| --- | --- | --- |
| 项目 `src/ui.js` 的昵称首字头像 | 无框架依赖，与当前身份、主题一致；原实现缺少独立图片回退封装 | 提取为本地可复用 `discussions-avatar.js`，默认首字与稳定配色 |
| [Web Awesome Avatar](https://webawesome.com/docs/components/avatar) | 原生 Web Component 可独立接入，提供图片、首字与可访问名称；需额外安装或托管组件运行时 | 本次只需静态头像，保留零依赖构建，未引入 |
| [Shoelace Avatar](https://shoelace.style/components/avatar) | 支持原生自定义元素与首字；官方页面标注不再积极开发并指向 Web Awesome | 未引入 |
| [Base UI Avatar](https://base-ui.com/react/components/avatar) | 图片与 fallback 行为成熟，但入口依赖 React，与当前无框架模块不匹配 | 未引入 |
| 原生 `form`、`input type=file`、[`audio controls`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio) 与 [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) | 浏览器提供表单语义、文件选择、键盘、播放与录音行为；无需组件运行时 | 实际复用；业务层补校验与状态反馈 |

头像工具默认不请求网络。调用者如提供 HTTP/HTTPS 头像，加载成功后覆盖始终存在的本地首字；错误或超时不影响本地回退。全部内容经 `ui.js` 的 `esc` 转义，链接仅支持无凭证的 HTTP/HTTPS，外链使用 `noopener noreferrer`，不解析 HTML、Markdown 或嵌入远端网页。

## 模块验证与交接

实现范围仅包含 discussions 模块、专属测试及本任务文档。服务、样式、结果页挂载点由协调对话接入。独立测试在临时目录与临时端口运行，验证服务重建后读取、幂等重试、凭证隔离、非法媒体与链接、失败保留编辑内容、头像回退和录音清理。浏览器验证使用独立测试宿主；生产页面公共集成后的完整回归由协调对话执行。
