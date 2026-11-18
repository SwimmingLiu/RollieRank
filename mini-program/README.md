# 卷卷小榜 · 微信小程序

原生小程序（WXML / WXSS / JS），按 `paper-cards-1114-v3` 设计实现。

## 页面

| 页面 | 说明 |
| --- | --- |
| `pages/home` | 首页：机构入口、做题计时入口、最近练习 |
| `pages/catalog` | 机构套卷：按期数分组，显示草稿／已提交状态 |
| `pages/practice` | 录答案：列表和单题录入、存疑标记、草稿恢复、交卷 |
| `pages/report` | 成绩：总分、正误、板块得分率和六维雷达、讨论／榜单／分享入口 |
| `pages/review` | 逐题对照：按错题、待检查和板块筛选，复制错题号 |
| `pages/rank` | 同卷榜：全国或岗位范围、前三名纸卡、其余名次 |
| `pages/records` | 练习记录：身份、岗位、成长分析、搜索与筛选 |
| `pages/analytics` | 成长分析：按卷型查看得分率、得分和正确率走势 |
| `pages/share` | 分享：长图、成绩卡、题型、雷达四种 PNG，保存到相册或邀请同卷好友 |
| `pages/positions` | 选岗：搜索、分页、选择或取消 |
| `pages/discussion` | 试卷讨论：发表、点赞、回复、图片预览 |
| `pages/timer` | 做题计时：整卷或模块计划、暂停、结束进入录答案 |
| `pages/settings` | 设置：昵称、本机身份、备份与恢复、删除记录 |

## 与网页版的口径一致
- 计分、参考答案、订正后的成绩只由服务端给出；小程序保存自己的草稿和正式记录，参考答案由服务端读取。
- 同一份卷每人取最好一次进入榜单；空卷不计百分比。
- 每份成绩单独保存，重练不会覆盖旧成绩。
- 草稿与存疑标记在本机保存，重新进入会恢复。

## 开发
1. 用微信开发者工具打开 `mini-program/` 目录（AppID 已写入 `project.config.json`）。
2. 后端地址在 `config.js` 的 `API_BASE`。本地联调把该地址改为本机服务并关闭「不校验合法域名」。
3. 本机校验：
   ```bash
   npm --prefix mini-program run check
   npm run verify -- all
   ```

用微信开发者工具 CLI 启动自动化和手机预览。以下命令从仓库根目录运行：

```sh
cli auto --project "$PWD/mini-program" --auto-port 9420
cli preview --project "$PWD/mini-program" --qr-format image --qr-output /tmp/rollierank-preview.png
```

## 资源
图片与字体已上传到 `https://rollie-rank-oss.swimmingliu.cn/static/rollierank/`（`rollie-rank` 空间的加速域名），清单见 `assets-manifest.json`；上传脚本为 `scripts/upload-oss.py`。图标和标签栏图标在 `assets/ui`、`assets/tab`、`assets/tab-active`。

## 尚未接入
- 微信登录与云端身份（当前用本机随机身份，换机需要备份恢复）。
- 审核界面（维护者在网页版使用）。
