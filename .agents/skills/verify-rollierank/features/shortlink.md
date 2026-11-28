# 自有短链（/s/ 与 /api/links）

分享用的短地址与小程序码入口。它不替代微信短链（个人主体拿不到 `genwxashortlink` 权限），
而是用自己的域名 + 个人主体可用的 `getwxacodeunlimit` 拼出等价能力。

- 服务：`server/shortlink.mjs`，在 `server/api.mjs` 里与 `createMiniappLinkService` 一起注册。
- 页面：`site/s/index.html`，由 nginx `location ^~ /s/` 用 `try_files $uri /s/index.html` 兜底。
- 数据：落在 `catalog.json` 的 `features.shortLinks`（顶层字段不会被 `persist()` 写盘）。

## 子功能与入口

| 子功能 | 用户入口 | 驾驶方法 | 前提 |
| --- | --- | --- | --- |
| 创建短链 | `POST /api/links` | 带 `{page?, title?, channel?}` 与 `x-rollierank-token` 请求 | 配置 `ROLLIERANK_WECHAT_APP_ID` / `SECRET` 与 `ROLLIERANK_SHORTLINK_TOKEN`（回退 `ROLLIERANK_REVIEW_TOKEN`） |
| 列出短链 | `GET /api/links` | 带 `x-rollierank-token` 请求（未带或错口令返回 401） | 同上 |
| 查看单条 | `GET /api/links/<code>` | 短码来自创建响应 | 同上 |
| 记录点击 | `GET /api/links/<code>?visit=1` | 落地页自动调用 | 同上 |
| 小程序码 | `GET /api/links/<code>/qrcode` | 落地页自动调用 | 同上 |
| 补录 `#小程序://` 口令 | `POST /api/links/<code>/weapp` | 带 `{weappLink}` 与 `x-rollierank-token` 请求 | 口令只能在小程序「…→复制链接」手动取得 |
| 微信内复制口令 | `/s/<code>` 的「复制口令」按钮 | 微信 UA 打开且该短链已录口令 | `pages/home/home` 已开 `onShareAppMessage` |
| 短链落地页 | `/s/<code>` | 浏览器直接访问 | nginx 已下发 `/s/` 路由 |

## 微信内点击直达能力的边界

个人主体拿不到任何服务端生成「拉起小程序」链接的能力，已查证的排除项：
URL Link（40002）、加密 Scheme（40002）、明文 Scheme（后台声明开关不开放）、
开放标签（需认证服务号）、扫普通链接二维码（85075）、`web-view` 业务域名、移动应用拉起。

唯一可用的是**手动复制**的 `#小程序://` 文本口令——微信内粘贴后点击直达，
不经过服务端接口，因此不受主体限制。不要把这项能力描述成「自动跳转」：
非微信环境下它不生效，落地页仍以小程序码为主。

## 必须覆盖的断言

1. **`check_path` 必须是 `false`**。默认值会校验页面已发布到线上版，未发布时报 `41030 invalid page`；
   个人主体的开发阶段只有关掉它才能拿到码。这是曾经踩过的坑，改动该参数必须失败。
2. **落地页路径只接受小程序内部路径**。`https://`、`//`、`javascript:` 一律 400，
   防止短链被当成开放重定向。
3. **短码不含易混字符**：字母表是 `abcdefghjkmnpqrstuvwxyz23456789`，不含 `o l 0 1`。
4. **短码冲突要重新生成**，不能覆盖既有短链。
5. **小程序码命中 24h 缓存**，第二次请求不再调用微信。
6. **点击统计异步写**，写盘失败不能阻断用户打开小程序。
7. **`/s/` 不进索引**：落地页带 `noindex`，`robots.txt` 对 `/s/` 设 `Disallow`。
8. **口令只做浅校验且必须带前缀**：不以 `#小程序://` 开头的值返回 400，不能用它绕过路径校验。
9. **补录口令同样需要管理口令**：`POST /api/links/<code>/weapp` 未带或错口令返回 401。
10. **无口令的短链不显示复制按钮**：`weappLink` 为空时落地页只展示小程序码。
11. **首页必须可分享**：`pages/home/home.js` 里 `onShareAppMessage` 缺失时，
    微信「…→复制链接」不可用，也就拿不到 `#小程序://` 口令。

## 只读复验

```sh
# 结构检查（不需要凭证）
node --test test/shortlink.test.js

# 线上只读（列出接口需附带口令头，未带口令时应返回 401）
curl -s -o /dev/null -w '%{http_code}\n' -H "x-rollierank-token: $ROLLIERANK_REVIEW_TOKEN" https://rank.swimmingliu.cn/api/links
curl -s -o /dev/null -w '%{http_code}\n' https://rank.swimmingliu.cn/s/<code>
curl -s https://rank.swimmingliu.cn/robots.txt | grep -A1 'Disallow: /s/'
```

线上写操作（创建短链）只在临时实例或已获授权的发布窗口内执行。
