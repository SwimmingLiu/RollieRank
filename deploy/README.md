# RollieRank API 部署（新加坡服务器）

## 选型
- 后端使用现有 Node API（`server/`）。Go 后端分支缺少讨论、订正、岗位和群体分析，迁到 Go 前先保证线上功能完整。
- 数据落在服务器 `/var/lib/rollierank/catalog.json`，由 systemd 单进程串行写入。
- 只监听 `127.0.0.1:4173`，由宝塔面板的网站反向代理对外提供 HTTPS。

## 需要先定的事
1. **API 域名。** 小程序要求 HTTPS + 已备案域名。代码里默认 `https://api.rollie-rank.swimmingliu.cn`，可在 `mini-program/config.js` 改。
2. **维护者凭证。** 设置 `ROLLIERANK_REVIEW_TOKEN` 后，`/api/admin*` 需要 `Authorization: Bearer <token>`；不设置则保持本机无凭证行为。

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
1. 微信公众平台 → 开发管理 → 开发设置 → 服务器域名 → request 合法域名，加入 API 域名。
2. `config.js` 的 `API_BASE` 与上面的域名一致。
3. 资源图片来自 `rollie-rank-oss.swimmingliu.cn`（七牛），需要把该域名也加入 request/download 合法域名，或在小程序里改用本地 `assets/`。

## 微信原稿手机版

安装脚本部署 `/ios-v3/` 页面及样式。使用仓库的 Nginx 站点配置代理 `/ios-v3/` 和公开的 `/src/` 模块。部署后检查 `/ios-v3/app.html` 正常打开，以及 `/src/data/` 下的答题数据返回 404。

在微信公众平台为这个 AppID 验证页面源站的业务域名，并配置该源站为 request 和 downloadFile 合法域名。使用 [小程序原稿版构建](../mini-program/README.md) 生成微信预览，扫码检查真实顶部区域、相册和转发。

## 数据备份
```bash
sudo tar -czf /root/rollierank-$(date +%F).tar.gz /var/lib/rollierank
```
