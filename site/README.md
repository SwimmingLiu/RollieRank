# 卷卷小榜 SEO / GEO 站点

面向搜索引擎与 AI 助手的独立介绍站，部署在 `https://rank.swimmingliu.cn/`。

服务器上的目标目录是宝塔站点根目录下的 `/site/php`（即 `rank.swimmingliu.cn` 这个站点的 `php` 子目录）。这里所有文件都是纯静态文件，不需要 PHP 运行时。

## 目录内容

| 文件 | 用途 |
| --- | --- |
| `index.html` | 首页：低密度图标化产品展示（滚动胶囊、三步交互演示、深色 3D 插画区、130/135 分值矩阵）；完整 SEO/GEO 文案与 FAQ 放在视觉不可见但可抓取的 `.seo-content` 语义层；JSON-LD 含 WebSite / Organization / WebPage / SoftwareApplication / HowTo / FAQPage |
| `zenme-suan-fen.html` | 专题页「行测分数怎么算」：交互式 130/135 题分值可视化对照 + `.seo-content` 完整分值表与 FAQ |
| `gu-fen-zhun-ma.html` | 专题页「行测估分准吗」：五项分差来源图标卡 + `.seo-content` 完整拆解与 FAQ |
| `shua-ti-ji-fen.html` | 专题页「行测刷题怎么记分」：四类练习归档与双计时卡片 + `.seo-content` 完整说明与 FAQ |
| `styles.css` | 暖纸卡片（`paper-cards-1114-v3`）与深色浓缩咖啡展示带样式，以及 `.seo-content` 视觉隐藏规则 |
| `site.js` | 首屏胶囊轮播、三步交互切换、130/135 分值矩阵切换、复制提示、桌面扫码弹层与深色区顶栏反色 |
| `llms.txt` | 给 AI 助手读的站点摘要（关键词、关键事实、分值表、FAQ 速答） |
| `robots.txt` | 放行主流搜索引擎与 AI 爬虫，指向 sitemap |
| `sitemap.xml` | 站点地图（4 个页面） |
| `assets/*` | 站点图标（`logo-64.png`/`logo-256.png`）、小程序码（`miniapp-qr.jpg`）、水彩底纹与 3D 纸艺插画素材 |

### 为什么拆成专题页

单个落地页装不下「怎么算分」「准不准」「怎么记分」三个独立问题，硬塞会变成关键词堆砌。
拆开之后每个页面只回答一个问题，H1 就是那个问题，FAQPage 的问答能直接对应真实搜索下拉词，
AI 助手也更容易把某一页整段当成答案引用。三个专题页互链，首页只留摘要和入口。

## 图片资源放 OSS

站点只用两张图片（`logo-256.png` 42KB、`logo-64.png` 4KB），和小程序共用同一个七牛桶 `rollie-rank`，
走同一个加速域名 `rollie-rank-oss.swimmingliu.cn`，前缀 `static/rollierank-site/` 与小程序资源区分。

线上引用（`index.html` 里 5 处已全部指向 OSS）：

| 位置 | URL |
| --- | --- |
| `og:image` | `https://rollie-rank-oss.swimmingliu.cn/static/rollierank-site/logo-256.png` |
| favicon / 页头 logo | `.../static/rollierank-site/logo-64.png` |
| apple-touch-icon | `.../static/rollierank-site/logo-256.png` |
| JSON-LD `Organization.logo` | `.../static/rollierank-site/logo-256.png` |

`site/assets/` 保留源图，便于改图后重新上传；服务器上的 `site/php/assets/` 为历史副本，可删。

### 上传

```sh
uv run --with qiniu python scripts/upload-site-oss.py --dry-run   # 先看清单
uv run --with qiniu python scripts/upload-site-oss.py             # 实际上传
```

脚本优先读环境变量 `QINIU_AK` / `QINIU_SK`；本机没有时回退到
`/Users/swimmingliu/data/PycharmProject/others/md_image2url/qiniuyun_upload.py` 里已有的密钥。
那把密钥对 `swimmingliu`、`chatgpt-images-2`、`baecare`、`cloud-mail`、`rollie-rank` 五个桶都有权限。

脚本上传 `site/assets/` 下所有图片，并写出 `site/assets-manifest.json` 记录 key、大小和 sha256。
复用 `scripts/upload-oss.py` 的同一个桶、同一个 zone 0 上传入口。

**已上传（2026-11-21）**：

| key | 大小 | 状态 |
| --- | --- | --- |
| `static/rollierank-site/logo-256.png` | 42.9 KB | ✅ 200 |
| `static/rollierank-site/logo-64.png` | 4.5 KB | ✅ 200 |

### 为什么不用站内路径

- 站点服务器带宽有限，图片交给 OSS + CDN 更稳
- 与小程序共用域名，已有 HTTPS 和缓存策略
- 以后加截图、示例图时不必重新部署静态站

## 当前部署状态（2026-11-21 已上线）

| 项 | 状态 |
| --- | --- |
| 服务器 | `lighthouse@swimmingliu.cn:45622`（`118.25.65.206`，VM-4-17-opencloudos） |
| 宝塔站点 | 已创建，siteId 18，站点根 `/www/wwwroot/rank.swimmingliu.cn` |
| 网站根目录 | `/www/wwwroot/rank.swimmingliu.cn/site/php`（本目录内容已上传） |
| Nginx | `/www/server/panel/vhost/nginx/rank.swimmingliu.cn.conf`，初版备份为 `.bak` |
| `/api/` 反代 | 已配置 → `http://127.0.0.1:4173`（systemd `rollierank`，Node 后端） |
| DNS | ✅ `rank` A → `118.25.65.206`（腾讯云 DNSPod，`tccli dnspod CreateRecord`） |
| HTTPS | ✅ Let's Encrypt ECC，`/www/server/panel/vhost/cert/rank.swimmingliu.cn/`，到期 2027-02-19，acme.sh 自动续期 |
| HTTP → HTTPS | ✅ 301 跳转，`.well-known` 保留供续期 |
| 线上验证 | `/`、`/robots.txt`、`/llms.txt`、`/sitemap.xml`、`/assets/*` 全部 200；`/api/catalog` 返回 62 个套卷版本 |

### 运维命令

```sh
# 证书续期（acme.sh 已装 cron，无需手动；强制重签时用）
ssh -p 45622 lighthouse@swimmingliu.cn 'sudo /root/issue_rank_cert.sh'

# 更新站点文件
cd site && zip -qr ../rank-site.zip . -x '.*' -x 'README.md'
scp -P 45622 ../rank-site.zip lighthouse@swimmingliu.cn:/tmp/
ssh -p 45622 lighthouse@swimmingliu.cn \
  'sudo unzip -oq /tmp/rank-site.zip -d /www/wwwroot/rank.swimmingliu.cn/site/php && sudo chown -R www:www /www/wwwroot/rank.swimmingliu.cn/site/php'
```

### DNS 管理

域名 `swimmingliu.cn` 托管在腾讯云 DNSPod，可直接用 tccli 增删记录：

```sh
tccli dnspod CreateRecord --Domain swimmingliu.cn --SubDomain rank \
  --RecordType A --RecordLine "默认" --Value 118.25.65.206
tccli dnspod DescribeRecordList --Domain swimmingliu.cn --Limit 100
```

## 上传到服务器（增量更新用）

服务器管理面板：`http://118.25.65.206:23096`（宝塔）。站点目录为 `/site/php`。

方式一，面板上传：

1. 宝塔 → 文件 → 进入站点根目录 → `site` → `php`
2. 把本目录全部文件上传进去，`assets` 目录一并上传
3. 确认 `index.html` 在 `php/` 根下（访问 `https://rank.swimmingliu.cn/` 直接出页面）

方式二，本机打包后上传：

```sh
cd site
zip -r ../rank-site.zip . -x '.*'
# 然后把 rank-site.zip 上传到站点 php 目录并在线解压
```

## 域名与证书

1. 域名解析：`rank.swimmingliu.cn` 的 A 记录指向 `118.25.65.206`
2. 宝塔 → 网站 → 该站点 → SSL → 申请 Let's Encrypt，开启「强制 HTTPS」
3. 站点根目录设置为包含 `php` 的那一层，保证 `https://rank.swimmingliu.cn/` 命中 `php/index.html`

若站点根直接就是 `php` 目录，把本目录文件放进站点根即可，路径不变。

## 部署后自检

```sh
curl -sI https://rank.swimmingliu.cn/            # 200，Content-Type: text/html
curl -s  https://rank.swimmingliu.cn/robots.txt  # 200
curl -s  https://rank.swimmingliu.cn/llms.txt    # 200
curl -s  https://rank.swimmingliu.cn/sitemap.xml # 200
for p in / /zenme-suan-fen.html /gu-fen-zhun-ma.html /shua-ti-ji-fen.html; do
  curl -s -o /dev/null -w "%{http_code} $p\n" "https://rank.swimmingliu.cn$p"
done
```

标题应为 `行测估分工具 · 卷卷小榜｜录答案自动算分判分、折算行测分数、看同卷排名`。

再用 [Rich Results Test](https://search.google.com/test/rich-results) 验证结构化数据能识别为
SoftwareApplication、HowTo 和 FAQPage；三个专题页应识别为 Article/WebPage + BreadcrumbList + FAQPage。

## 提交收录

1. [Google Search Console](https://search.google.com/search-console) 添加 `rank.swimmingliu.cn`，提交 `sitemap.xml`
2. [百度搜索资源平台](https://ziyuan.baidu.com/) 添加站点，提交 `sitemap.xml`
3. Bing Webmaster Tools 同样提交 sitemap

## 后端挂载方式

`/api/` 直接反代到现有 Node 服务，不迁移语言：

- 服务：systemd `rollierank`，`/opt/rollierank/scripts/serve.mjs`
- 监听：`127.0.0.1:4173`
- 数据：`/var/lib/rollierank/catalog.json`
- Nginx 段：`location /api/` → `proxy_pass http://127.0.0.1:4173`

原 `rollie-rank.swimmingliu.cn` 站点的 `/api/` 代理保持不变，两个域名共用同一个后端进程。
宝塔面板的 Go 项目模块（`class/projectModel/goModel.py`）保留未用——仓库没有 Go 代码，
服务器也没装 Go 运行时；若以后要迁移，再单独排期。

## 小程序入口服务

`server/miniapp-link.mjs` 提供入口链接与小程程码，`server/redis-cache.mjs` 做 **24 小时** 缓存。

| 接口 | 用途 | 个人主体可用 |
| --- | --- | --- |
| `GET /api/miniapp/entry` | **聚合入口**：先试短链，无权限时自动退回小程序码 | ✅ |
| `GET /api/miniapp/qrcode` | 小程序码（JPEG base64），长按识别进入 | ✅ |
| `GET /api/miniapp/shortlink` | 微信短链接 `wxaurl.cn`，仅微信内有效 | ❌ 43104 |
| `GET /api/miniapp/urllink` | URL Link，可唤起小程序 | ❌ 85407 |

### 主体类型决定可用接口（实测结论）

本小程序为**个人主体**，实测结果：

- `stable_token` ✅ 正常（说明 AppID/Secret 无误）
- `generateShortLink` ❌ `43104 this appid does not have permission`
- `generateUrlLink` ❌ `85407 no scheme permission`
- `getwxacode` ✅ 返回 98KB JPEG 小程序码

因此线上走的是**小程序码**方案：展示图片 + 「长按识别」提示，微信内体验接近自动跳转。

若日后升级为企业主体并取得短链权限，`/entry` 会自动改用短链，前端无需改动。

### 配置

在 `/etc/rollierank.env` 里设置：

```
ROLLIERANK_WECHAT_APP_ID=wx7febd9298bcc5b9b
ROLLIERANK_WECHAT_APP_SECRET=<AppSecret>
ROLLIERANK_REDIS_URL=redis://:<password>@127.0.0.1:6379/0
# 可选：指定落地页
ROLLIERANK_MINIPROGRAM_PAGE=pages/home/home
```

改完执行 `sudo systemctl restart rollierank`。

未配置 AppID/Secret 时接口返回 `503 {enabled:false}`，前端引导层会退回「微信搜索卷卷小榜」的提示。

### 缓存

- 键名：`rollierank:miniapp:{shortlink|qrcode|urllink}:<页面路径>`
- TTL：86400 秒
- Redis 不可用时自动降级为进程内 Map，接口不中断

## 手机访问跳转

`site/miniapp-entry.js` 按 UA 分三支：

| 场景 | 行为 |
| --- | --- |
| 微信内置浏览器 | 请求 `/entry`；拿到短链直接跳转，拿到小程序码则弹层提示长按识别 |
| 其他移动浏览器 | 弹层展示小程序码，提示「长按或截屏保存，在微信里扫一扫」 |
| 桌面浏览器 | 不跳转，正常浏览 |

「继续看网页」会在 `sessionStorage` 记一次，同一会话内不再打扰。

## 自有短链（`/s/<code>`）

分享用的短地址。它不替代微信短链，而是用自己的域名 + 个人主体可用的小程序码拼出等价能力。

### 为什么不自建微信短链

`wxaurl.cn/xxx` 的链路是：`302 → weixin://dl/business/?t=<token>`，由微信客户端拦截协议打开小程序。
那个 `token` 由微信服务端签发并绑定 appid，**外部无法生成**。而个人主体拿不到签发权限：

| 接口 | 结果 |
| --- | --- |
| `genwxashortlink` | ❌ 43104 |
| `generate_urllink` | ❌ 85407 |
| `generatescheme` | ❌ 85407 |
| `getwxacodeunlimit` | ✅ 可用 |

`getwxacodeunlimit` 之前报 41030，是因为默认 `check_path:true` 会校验页面已发布到线上版。
**必须传 `check_path:false`**，这是个人主体在开发阶段拿到码的关键。

### 接口

| 接口 | 用途 | 需要口令 |
| --- | --- | --- |
| `POST /api/links` | 创建短链 `{page?, title?, channel?, weappLink?}` | ✅ |
| `GET /api/links` | 列出全部短链 | ✅ |
| `GET /api/links/<code>` | 单条详情，`?visit=1` 记一次点击 | ❌ |
| `GET /api/links/<code>/qrcode` | 小程序码（base64 JPEG，缓存 24h） | ❌ |
| `POST /api/links/<code>/weapp` | 补录 `#小程序://` 口令 | ✅ |
| `GET /s/<code>` | 落地页，按 UA 展示小程序码 | — |

口令取自 `ROLLIERANK_SHORTLINK_TOKEN`，未设置时回退到 `ROLLIERANK_REVIEW_TOKEN`。
未配口令时写接口直接 503 关闭，落地页不受影响。

```sh
curl -X POST https://rank.swimmingliu.cn/api/links \
  -H "Content-Type: application/json" \
  -H "x-rollierank-token: $ROLLIERANK_REVIEW_TOKEN" \
  -d '{"page":"pages/home/home","title":"行测估分工具","channel":"wechat"}'
```

### 存储与配额

短链存在 `catalog.json` 的 `features.shortLinks`。**不能放顶层字段**——`persist()` 只写
`versions / audit / receipts / features` 四项，顶层字段重写后即丢失。上限 500 条，
每条保留最近 50 条点击明细，累计数在 `clicks` 字段。

### 索引

落地页带 `noindex`，`robots.txt` 对 `/s/` 设 `Disallow`：短链是分享入口，内容与首页重复。

## 微信内点一下就进：`#小程序://` 口令

这一节是**个人主体唯一能做到「微信内点击直达」**的方式，值得单独说明。

### 三条官方路都走不通

全部实测或查证过，口径一致：

| 方案 | 个人主体 | 依据 |
| --- | --- | --- |
| URL Link（`wxaurl.cn`） | ❌ 40002 | 官方「仅针对国内**非个人主体**」 |
| 加密 Scheme（`?t=TICKET`） | ❌ 40002 | 同上 |
| 明文 Scheme（`?appid=&path=`） | ❌ | 需在后台「设置→隐私与安全→明文Scheme拉起此小程序」声明，个人主体无此入口 |
| `<wx-open-launch-weapp>` 开放标签 | ❌ | 需**已认证服务号** |
| 扫普通链接二维码打开小程序 | ❌ 85075 | 开放范围「企业、媒体、政府及其他组织」 |
| `web-view` / 业务域名 | ❌ | 个人类型与海外类型暂不支持 |
| 移动应用拉起小程序 | ❌ | 开放平台需营业执照认证 |

注意：**明文 Scheme 看似能自己拼、不用调接口**，但它在后台的声明开关对个人主体不开放。
第三方付费短链服务（小码至营、趣码短链）也都要求用户自己去后台声明——如果存在绕过，
这就是它们的护城河，没有理由不卖。这条反证比文档更硬。

### 能用的：`#小程序://` 文本口令

在小程序里点右上角「…」→「复制链接」，拿到形如：

```
#小程序://卷卷小榜/pages/home/home/AbCdEf123
```

粘到微信聊天里，**好友点一下直接进对应页面，没有中间页**。这是微信内真正的点击即唤起，
且**不经过任何服务端接口**，所以不受主体限制。

关键区别：
- **手动复制**的 `#小程序://` → 只要页面开了分享就能拿到，个人主体可用
- **服务端 API 生成**的 Short Link → 个人主体受限

### 接进短链的流程

口令只能在小程序里手动复制，服务端造不出来，所以是「先建链、后补口令」：

```sh
# 1. 建链
curl -X POST https://rank.swimmingliu.cn/api/links \
  -H "Content-Type: application/json" \
  -H "x-rollierank-token: $ROLLIERANK_REVIEW_TOKEN" \
  -d '{"page":"pages/home/home","title":"行测估分工具"}'

# 2. 在小程序里「…→复制链接」拿到口令，补录进去
curl -X POST https://rank.swimmingliu.cn/api/links/<code>/weapp \
  -H "Content-Type: application/json" \
  -H "x-rollierank-token: $ROLLIERANK_REVIEW_TOKEN" \
  -d '{"weappLink":"#小程序://卷卷小榜/pages/home/home/AbCdEf123"}'
```

补录后，微信内打开 `/s/<code>` 会多出一个「复制口令」按钮；非微信环境不显示，只展示小程序码。

### 前提：首页必须能分享

口令的「复制链接」菜单项只在**页面开启分享**时可用（`onShareAppMessage`）。
`pages/home/home.js` 已补上 `onShareAppMessage` 与 `onShareTimeline`，
否则首页右上角转发是灰的，也拿不到口令。

## 内容维护约定

- 页面与 `llms.txt` 里不写会过期的数字（套数、题量、机构名单），这些放到产品内动态展示。
  唯一例外是分值表——它是考试规则，不是产品数据，可以写；改分值表时要同时改 `zenme-suan-fen.html`
  和 `llms.txt` 两处。
- 新增页面时同步更新 `sitemap.xml`、`llms.txt`、首页「继续看」和三个专题页的导航。
- 「行测小助手 / 行测小助理 / 行测助手 / 行测助理」只作为同类产品对比出现，不用于自称。
- 事实边界：不写成绩提升、通过率、用户数、准确率百分比；不声称能预测真实考试分数。
  涉及「准不准」的问题，讲清差异来源，不给绝对承诺。
- 页面事实以产品实际功能为准。改功能时回头看 `index.html` 的 `featureList` 和 FAQ。

## 关键词部署位置

120 字的小程序简介只能放 26 个词的词面，站点不受这个限制，所以按信息架构分层：

| 关键词 | 主要承载页 |
| --- | --- |
| 行测估分、行测判分、行测对答案、行测录分 | 首页 H1 + FAQ |
| 行测分数、行测分数计算器、行测计算、行测分值 | `zenme-suan-fen.html` |
| 行测刷题、行测备考、行测题库、行测真题、行测模拟、行测练习 | `shua-ti-ji-fen.html` |
| 行测小助手、行测小助理、行测助手、行测助理 | 首页「和行测小助手、行测助理这类工具的区别」 |
| 行测估分准吗、差多少、差很多为什么 | `gu-fen-zhun-ma.html` |
