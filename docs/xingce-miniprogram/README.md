# 行测小助理 — 小程序扒包与交互设计研究

AppID `wxd74bddd3fe422729` · **v78** · 18 个页面 · 无分包

> 当前 `source/` 为 **v78**（2026-11-14 抓取）。上一版 **v76** 完整保留在 `v76-source/`，
> 两版差异见 [`CHANGELOG-v76-to-v78.md`](CHANGELOG-v76-to-v78.md)。

## 目录

| 路径 | 内容 |
|---|---|
| `source/` | v78 解密解包后的完整源码（29 个文件） |
| `source/app-service.js` | 页面逻辑总包（421KB），含全部 Page() 定义 |
| `source/app-config.json` | 页面路由与窗口配置（18 个页面） |
| `source/pages/*/` | 18 个页面的 HTML 壳 |
| `source/images/support/` | v78 新增的 4 张「支持开发者」插图 |
| `v76-source/` | 上一版 v76 原始解包（39 个文件，含 10 个 `cloudfunctions/`） |
| `tools/unpack-wxapkg.cjs` | V1MMWX 解密 + 解包（AES-CBC 前 1024B，其余 XOR 0x32） |
| `tools/gen-pages.py` | 从解包源码重新生成 `PAGES.md` |
| `tools/capture-v78-screens.sh` | 采集 v78 新增界面截图（锁屏时会拒绝运行） |
| `analysis/modules/` | `ability-radar.js` / `ability-report.js` 两个新模块的独立提取 |
| `screenshots/` | computer use 实机操作截图 18 张（按主流程编号，见 UI-DESIGN.md 索引表） |
| `UI-DESIGN.md` | 交互页面设计学习笔记 |
| `PAGES.md` | 逐页 data / methods / 默认值清单（由 `tools/gen-pages.py` 生成） |
| `CHANGELOG-v76-to-v78.md` | v76 → v78 的完整变更报告 |
| `summary.json` | 页面清单元数据（`packageVersion: 78`） |

## 解密算法（微信 4.1 macOS）

```js
const key = pbkdf2Sync(appid, 'saltiest', 1000, 32, 'sha1');
const iv  = 'the iv: 16 bytes';
// 1. 去掉文件头 'V1MMWX' (6 字节)
// 2. 前 1024 字节：AES-256-CBC 解密（setAutoPadding(false)）
// 3. 其余部分：每字节 XOR 0x32
```

解出的 wxapkg 头为 `0xBE`。索引项格式：`u32 名字长度 + 名字 + u32 偏移 + u32 大小`。

### 索引里的两个坑（工具已处理）

1. **名字长度少 1**：部分记录的名字长度比实际占用少一字节（缺了 `/` 分隔符，解出为 `\x01`）。
   v76 的 `pages/admin/report-\x01list/...` 就是这种；v78 起服务端已修正为 `report-list`。
   解析器按 `+0/+1/+2` 三档回溯名字长度。
2. **偏移与大小集体少 1**：声明偏移指向的是**上一个文件的最后一个字节**，声明大小也少 1。
   因此真实区间是 `[offset + 1, offset + size + 1)`。用声明值直接取会得到「开头多一个上一文件尾字节、
   结尾少一个字节」的文件——v76 与 v78 都是如此。`slicePayloads()` 统一按 +1 校正。
3. **v78 的打包布局变了**：v76 索引与数据区之间有 777 字节空隙，v78 则紧贴（`indexEnd ≈ firstOffset`）。
   另外 v78 的 `timer-records` 一条声明大小异常偏小，此时以**下一条的偏移**为准。

## 用法

```bash
node tools/unpack-wxapkg.cjs <appid> <__APP__.wxapkg> <输出目录>
```

包路径（macOS 微信 4.1.15）：
`~/Library/Containers/com.tencent.xinWeChat/Data/Documents/app_data/radium/users/<user>/applet/packages/<appid>/<version>/__APP__.wxapkg`

### 触发微信拉取最新版

本地缓存只在真正打开小程序时才更新。旧包躺在 `packages/<appid>/<旧版本号>/`，新包会另起版本号目录：

```bash
open "weixin://dl/business/?appid=wxd74bddd3fe422729&path=pages/index/index"
```

等十几秒，再 `ls applet/packages/<appid>/` 看是否出现新版本号目录。
`servicewechat.com` 的 CDN 直连已下线（`/wxa-dev-logic/download_redirect` 只回 302 + 握手 cookie），
拿包只能靠客户端自己下载。
