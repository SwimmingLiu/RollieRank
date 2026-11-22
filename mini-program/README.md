# 卷卷小榜 · 微信小程序

当前项目默认运行原生小程序，界面以 `paper-cards-1114-v3` 为准。配置微信业务域名后，可以另行构建内嵌原稿版。

## 原稿版

原稿版复用全部手机页面、弹层和交互。首页保留原稿 logo 与标题组合并紧接微信胶囊下方，其他页使用原生标题。返回和页面操作放在对应内容区。初始化时显示纸卡骨架。初次打开会接续已有身份、正式练习、录答草稿和存疑标记。

套卷和复盘板块弹层使用单行选项。点遮罩关闭，长列表可上拉展开、滚动和下滑收起。

在「练习记录」点个人资料卡，可以选择头像或进入昵称设置。头像与已保存的昵称保存在服务端，并带回当前设备的练习记录页。

手机号是选填能力，需要在微信公众平台开通手机号快速验证并声明相应隐私用途。服务端需配置 `ROLLIERANK_WECHAT_APP_ID`、`ROLLIERANK_WECHAT_APP_SECRET`、`ROLLIERANK_WECHAT_PHONE_ENABLED=1` 与 `ROLLIERANK_WECHAT_PHONE_KEY`（Base64 编码的 32 字节私密密钥）。完整手机号加密保存，客户端只显示尾号。

开发者工具可以连接隔离的本机服务。真机需要微信已校验的 HTTPS 业务域名。源站先提供 `/ios-v3/app.html` 和 `/api/miniprogram-web/`，再从仓库根目录构建：

```sh
npm --prefix mini-program run build:shared -- https://rollie-rank.swimmingliu.cn test-results/wechat-shared
/Applications/wechatwebdevtools.app/Contents/MacOS/cli preview \
  --project "$PWD/test-results/wechat-shared" \
  --qr-format image \
  --qr-output /tmp/rollierank-preview.png
```

使用生成目录进行预览。直接打开本目录会继续运行原生备用版。

## 原生备用版页面

| 页面 | 说明 |
| --- | --- |
| `pages/home` | 首页：机构入口、做题计时入口、最近练习 |
| `pages/catalog` | 机构套卷：按期数分组，显示草稿／已提交状态 |
| `pages/practice` | 录答案：列表和单题录入、存疑标记、草稿恢复、交卷 |
| `pages/report` | 成绩：总分、正误、板块得分率和六维雷达、讨论／榜单／分享入口 |
| `pages/review` | 逐题对照、错题筛选与复制、答案反馈和反馈记录 |
| `pages/rank` | 同卷榜：全国或岗位范围、前三名纸卡、其余名次 |
| `pages/records` | 练习记录：身份、岗位、成长分析、搜索与筛选 |
| `pages/analytics` | 成长分析：按卷型查看得分率、得分和正确率走势 |
| `pages/share` | 分享：长图、成绩卡、题型、雷达四种 PNG，保存到相册或邀请同卷好友 |
| `pages/positions` | 选岗面板入口，支持国考、省考、分层搜索和岗位详情 |
| `pages/admin` | 反馈记录中的维护者审核入口，支持凭证、审核重算和岗位目录 |
| `pages/discussion` | 试卷讨论：发表、点赞、回复、图片预览 |
| `pages/timer` | 做题计时：整卷或模块计划、暂停、结束进入录答案 |
| `pages/settings` | 昵称设置 |

## 与网页版的口径一致
- 计分、参考答案、订正后的成绩只由服务端给出；小程序保存自己的草稿和正式记录，参考答案由服务端读取。
- 同一份卷每人取最好一次进入榜单；空卷不计百分比。
- 每份成绩单独保存，重练不会覆盖旧成绩。
- 草稿与存疑标记在本机保存，重新进入会恢复。

## 开发

在微信开发者工具里打开下文生成的验收包。改完源码后重新生成验收包，再运行本机校验。

```sh
npm --prefix mini-program run check
npm run verify -- all
```

## 测试环境

开发版、体验版和真机预览访问 `https://rollie-rank-test.swimmingliu.cn` 的测试 API，无需输入网页测试站口令。测试身份、草稿和练习记录保存在独立的存储空间。正式版使用生产域名和正式存储空间。

在微信公众平台的 `request` 和 `downloadFile` 合法域名中添加 `https://rollie-rank-test.swimmingliu.cn`。用微信开发者工具预览真机开发版，或在版本管理将上传的开发版本设为体验版。录答交卷后用测试库核对回执。

### 本机自动化

先按[测试后端部署说明](../deploy/README.md#测试后端)打开 SSH 隧道。也可以在本机用一个新目录启动一次性服务。

```sh
test_data=$(mktemp -d)
ROLLIERANK_DATA_DIR="$test_data" PORT=4175 node scripts/serve.mjs --test-environment
```

用下面的命令生成独立的小程序验收包。验收包使用单独的本地存储，保存测试身份、草稿和练习记录。生成目录可用 `cli open --project` 手动验收，也可用 `cli auto` 跑完整流程。

```sh
npm --prefix mini-program run build:shared -- http://127.0.0.1:4175 test-results/wechat-test
cli auto --project "$PWD/test-results/wechat-test" --auto-port 9420
```

在运行流程的终端设置测试审核口令。共享实例的口令由服务器 `/etc/rollierank-test.env` 保存。一次性实例需在启动前设置同一个 `ROLLIERANK_REVIEW_TOKEN`。

```sh
MINIPROGRAM_API_BASE=http://127.0.0.1:4175 MINIPROGRAM_AUTOMATION_PORT=9420 \
  MINIPROGRAM_REVIEW_TOKEN="$ROLLIERANK_TEST_REVIEW_TOKEN" node mini-program/tools/flow.mjs
```

## 资源
图片与字体已上传到 `https://rollie-rank-oss.swimmingliu.cn/static/rollierank/`（`rollie-rank` 空间的加速域名），清单见 `assets-manifest.json`；上传脚本为 `scripts/upload-oss.py`。图标和标签栏图标在 `assets/ui`、`assets/tab`、`assets/tab-active`。

## 尚未接入
- 微信登录与云端身份（当前用本机随机身份，换机需要备份恢复）。
