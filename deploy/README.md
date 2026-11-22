# RollieRank API 部署（新加坡服务器）

## 选型
- 后端使用现有 Node API（`server/`）。Go 后端分支缺少讨论、订正、岗位和群体分析，迁到 Go 前先保证线上功能完整。
- 答卷、评论和运营积分等现有数据由 Node 服务写入 `/var/lib/rollierank/catalog.json`。卷豆使用项目已有的 PostgreSQL。
- 只监听 `127.0.0.1:4173`，由宝塔面板的网站反向代理对外提供 HTTPS。

## 需要先定的事
1. **API 域名。** 小程序要求 HTTPS + 已备案域名。代码里默认 `https://api.rollie-rank.swimmingliu.cn`，可在 `mini-program/config.js` 改。
2. **运营管理后台（隐蔽入口 + 防爆破）与维护者凭证。**
   - 独立桌面运营后台支持通过 `/etc/rollierank.env` 配置 `ROLLIERANK_ADMIN_PATH=/<随机隐蔽路径>`，设置后默认的 `/admin`、`/admin/` 和 `/api/console/*` 会全部返回 `404`，避免被扫描器发现。
   - 首次打开后台页面时直接设置管理员账号和密码即可（仅允许初始化一次，服务端使用加盐 `scrypt` 哈希安全存入数据库 `catalog.json`）。
   - 登录/初始化接口在 Nginx 边缘层（每 IP 每分钟 5 次）与应用层（IP 连续失败锁定 + 账号锁定 + 渐进延迟）双重防爆破保护。
   - 设置 `ROLLIERANK_REVIEW_TOKEN` 后，旧接口 `/api/admin*` 与答案审核接口也会要求该凭证。
3. **微信小程序内容安全（免费，含图片文字 OCR 检测）。** 在 `/etc/rollierank.env` 中配置以下环境变量后自动启用：
   - `ROLLIERANK_WECHAT_APP_ID` / `ROLLIERANK_WECHAT_APP_SECRET`：小程序凭证（启用文本 `msgSecCheck`）
   - `ROLLIERANK_PUBLIC_BASE_URL`：公网 API 根地址（如 `https://rollie-rank.swimmingliu.cn`，供微信异步拉取图片/语音做 `mediaCheckAsync`）
   - `ROLLIERANK_WECHAT_MSG_TOKEN`：微信公众平台「开发管理 → 开发设置 → 消息推送」里设置的 Token
   - 消息推送 URL 填 `https://<你的API域名>/api/wechat/sec-callback`，消息格式选 JSON 或 XML 均可（明文模式）。
   - 如需临时关闭微信自动审核，可设 `ROLLIERANK_WECHAT_SEC_CHECK=0`。
4. **微信头像七牛 OSS 存储（推荐）。** 在 `/etc/rollierank.env` 中配置以下环境变量后，用户通过小程序选择的微信头像会自动上传至七牛 OSS，数据库中仅存 OSS 地址、不再落盘 base64：
   - `ROLLIERANK_QINIU_AK` / `ROLLIERANK_QINIU_SK`：七牛 AccessKey / SecretKey（兼容 `QINIU_AK` / `QINIU_SK`）
   - `ROLLIERANK_QINIU_BUCKET`：存储空间名（默认 `rollie-rank`）
   - `ROLLIERANK_QINIU_DOMAIN`：加速域名（默认 `https://rollie-rank-oss.swimmingliu.cn`）
   - `ROLLIERANK_QINIU_UP_HOST`：上传节点（默认 `https://up-z0.qiniup.com`）
   - 未配置密钥时自动降级为本机存储，评论区和资料页仍可正常展示头像。
5. **用户反馈微信订阅消息提醒（可选）。** 已配置 `ROLLIERANK_WECHAT_APP_ID` / `ROLLIERANK_WECHAT_APP_SECRET` 时，可在微信公众平台「功能 → 订阅消息」选用一个一次性通知模板：
   - 模板 ID 可写入 `/etc/rollierank.env` 的 `ROLLIERANK_WECHAT_FEEDBACK_TEMPLATE_ID`，或直接在运营后台「用户反馈 → 配置微信提醒」里在线填写并映射模板字段（如 `thing1`、`thing2`、`time3`、`thing4`）。
   - 管理员在小程序「个人中心 → 右上角反馈图标 → 维护者」输入 `ROLLIERANK_REVIEW_TOKEN` 解锁后，点击「订阅 +1」即可绑定微信 OpenID 并累加接收次数；有新反馈时服务端自动推送微信「服务通知」，点击通知直达反馈处理页。

## 服务器步骤
```bash
# 1. 安装 Node.js 20+（宝塔「软件商店 → Node.js 版本管理」也可）
node -v

# 2. 本机推送代码后，在服务器执行（仓库已克隆到 /root/RollieRank 为例）
cd /root/RollieRank
sudo ROLLIERANK_REVIEW_TOKEN='<自行设置>' ./deploy/install-node-api.sh

# 3. 检查
systemctl status rollierank --no-pager
curl -s http://127.0.0.1:4173/api/catalog | head -c 200
```

## 宝塔反向代理
1. 网站 → 添加站点 → 域名填 API 域名（如 `api.rollie-rank.swimmingliu.cn`），PHP 选「纯静态」。
2. 站点设置 → SSL → 申请 Let's Encrypt 证书并开启「强制 HTTPS」。
3. 站点设置 → 反向代理 → 添加：
   - 代理名称：`api`
   - 目标 URL：`http://127.0.0.1:4173`
   - 发送域名：`$host`
4. 在「配置文件」里为代理段加上请求体上限（评论图片需要）：
   ```nginx
   client_max_body_size 10m;
   proxy_read_timeout 90s;
   ```

## 小程序端配置
1. 微信公众平台的「开发管理 → 开发设置 → 服务器域名」为 `request` 和 `downloadFile` 同时保留生产 `https://rollie-rank.swimmingliu.cn` 与测试 `https://rollie-rank-test.swimmingliu.cn`。
2. `mini-program/config.js` 按微信版本选择域名。开发版、真机预览和体验版走测试，正式版走生产。
3. 资源图片来自 `rollie-rank-oss.swimmingliu.cn`（七牛），将该域名保留在合法域名中。

## 微信原稿手机版

安装脚本部署 `/ios-v3/` 页面及样式。使用仓库的 Nginx 站点配置代理 `/ios-v3/` 和公开的 `/src/` 模块。部署后检查 `/ios-v3/app.html` 正常打开，以及 `/src/data/` 下的答题数据返回 404。

在微信公众平台为这个 AppID 验证页面源站的业务域名，并配置该源站为 request 和 downloadFile 合法域名。使用 [小程序原稿版构建](../mini-program/README.md) 生成微信预览，扫码检查真实顶部区域、相册和转发。

## 数据备份
```bash
sudo tar -czf /root/rollierank-$(date +%F).tar.gz /var/lib/rollierank
```

卷豆持久数据和迁移记录由现有 PostgreSQL 备份覆盖。

## 卷豆数据库

生产服务从 `/etc/rollierank.env` 读取现有的 `DATABASE_URL` 和 `DATABASE_SCHEMA`。schema 默认使用 `public`。卷豆表使用 `wallet_` 前缀，并在 `wallet_schema_migrations` 保存迁移校验和。运行账号需要卷豆表读写权限及账本序列使用权限。执行迁移的账号需要对应 schema 的建表权限。

安装代码和依赖后，在服务目录运行迁移。可选的 `MIGRATION_DATABASE_URL` 用于单独的迁移角色，连接同一个目标库。应用进程沿用 `DATABASE_URL`。

```sh
cd /opt/rollierank
sudo node --env-file=/etc/rollierank.env scripts/migrate-tool-credits.mjs
```

测试服务用 `TEST_DATABASE_URL`、`TEST_DATABASE_SCHEMA` 及可选的 `TEST_MIGRATION_DATABASE_URL`。测试 schema 默认 `rollierank_test`，与生产 schema 独立。用 `ROLLIERANK_WALLET_WECHAT_APP_ID` 和 `ROLLIERANK_WALLET_WECHAT_APP_SECRET` 可单独配置卷豆微信登录。测试服务通过回环套接字接收请求，并使用出站 HTTPS 向微信换码。

```sh
cd /opt/rollierank-test/current
sudo node --env-file=/etc/rollierank-test.env scripts/migrate-tool-credits.mjs --test-environment
```

## 微信道具直购

在微信公众平台确认当前 AppID 的虚拟支付资格并发布对应工具的道具。用服务端环境变量配置 `ROLLIERANK_WXPAY_OFFER_ID`、`ROLLIERANK_WXPAY_APP_KEY` 和 `ROLLIERANK_WXPAY_GOODS`。后者是 JSON 数组，每项含 `productId`、`tool`、`title`、`cents` 和可选的 `ios`。个人主体按微信要求使用现网 AppKey 和 `env=0`。配置 `ios: true` 前，先在微信后台开通 Apple IAP 并核对对应道具。 [微信个人主体接入指引](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)

微信明文 JSON 或 XML 消息推送沿用 `/api/wechat/sec-callback` 和 `ROLLIERANK_WECHAT_MSG_TOKEN`。推送触发后的交易核对走微信签名查单。服务端也会补查支付和退款订单。按[卷豆数据库](#卷豆数据库)的步骤先应用钱包迁移。确认环境、商品与工具签收流程后，在运营规则中开启 `purchase.directPurchase`。

本机用 `npm run verify -- feature tool-credits` 验证签名、下单、幂等发货、退款和权益冻结。验证使用模拟微信接口和真实临时 PostgreSQL。微信支付的真实授权和商品适用范围在实际 AppID 后台核对。

## 测试后端

测试实例使用同一台服务器上的独立进程。systemd 把专用回环端口交给测试进程。初次启动从内置试卷和岗位目录初始化。答卷、评论、后台记录与上传数据都写到测试目录。

| 项目 | 生产 | 测试 |
| --- | --- | --- |
| 域名 | `rollie-rank.swimmingliu.cn` | `rollie-rank-test.swimmingliu.cn` |
| 服务 | `rollierank.service` | `rollierank-test.service` |
| 回环端口 | `4173` | `4175` |
| 代码 | `/opt/rollierank` | `/opt/rollierank-test/current` |
| 数据 | `/var/lib/rollierank/catalog.json` | `/var/lib/rollierank-test/catalog.json` |
| 卷豆 | `DATABASE_URL` 与 `DATABASE_SCHEMA` | `TEST_DATABASE_URL` 与 `TEST_DATABASE_SCHEMA` |
| 凭证 | `/etc/rollierank.env` | `/etc/rollierank-test.env` |

浏览器验收使用[独立测试站](https://rollie-rank-test.swimmingliu.cn/ios-v3/app.html)。用测试站账号 `rollierank-test` 登录。本机访问口令保存在 `~/.config/rollierank/test-web-password`。站点使用自己的 DNS 记录、证书和代理配置，由 [nginx-rollie-rank-test.conf](nginx-rollie-rank-test.conf) 转发到测试服务。

在服务器上的源码目录运行 `sudo bash deploy/install-test-api.sh`。重跑会安装新版本并保留测试数据与审核口令。需要测试 Excel 岗位导入时，为测试实例单独准备解析依赖：

```sh
sudo python3 -m venv /opt/rollierank-test/positions-python
sudo /opt/rollierank-test/positions-python/bin/python -m pip install openpyxl==3.1.5 xlrd==2.0.2
```

自动化联调和维护接口使用 SSH 隧道。通过隧道也可以在本机打开 `http://127.0.0.1:4175/ios-v3/app.html`。

```sh
ssh -NT -o ExitOnForwardFailure=yes -L 127.0.0.1:4175:127.0.0.1:4175 swimmingliu.cn
```

在另一个终端运行交卷、榜单、评论和选岗联调。脚本会校验目录响应的测试标识。

```sh
MINIPROGRAM_API_BASE=http://127.0.0.1:4175 node mini-program/tools/e2e.mjs
```

小程序真机使用开发版或体验版，可以直接连接测试 API。网页测试站与维护入口继续使用原有的访问控制。微信手机号、短链和内容审核回调需要独立的微信测试接入配置。CI 继续用一次性实例执行 `npm run verify -- all`。

部署卷豆后检查测试域名。该检查同时验证环境标识、微信登录配置、数据库报价和网页口令。

```sh
node scripts/verify-test-wallet.mjs https://rollie-rank-test.swimmingliu.cn --login-ready
```

## 首次上线检查

首次提交正式发布前，从仓库根目录运行只读检查。

```sh
ssh swimmingliu.cn 'cd /opt/rollierank && sudo node --env-file=/etc/rollierank.env deploy/check-first-release.mjs'
```

检查读取生产的 `catalog.json` 和 PostgreSQL 卷豆表。结果需为 `ready: true`，用户记录计数全部为零。题库、岗位目录、后台账号和配置保留。发现已有记录时先核对来源并保留可恢复的备份。
