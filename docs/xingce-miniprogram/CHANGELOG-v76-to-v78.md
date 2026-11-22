# v76 → v78 变更报告

抓取日期：2026-11-14 · AppID `wxd74bddd3fe422729` · 包版本 **76 → 78**

| | v76 | v78 |
|---|---:|---:|
| `__APP__.wxapkg` | 1,236,681 B | 1,265,916 B |
| 包内条目 | 39 | 29 |
| 页面数 | 17 | 18 |
| `app-service.js` | 441,992 B | 431,314 B |
| `page-frame.html` | 384,938 B | 410,285 B |
| `workers.js` | 388,841 B | 388,841 B（逐字节相同） |

**一句话**：这次更新只做两件事——**加了一个赞赏/打赏页**（`pages/support/support`），
**成绩页加了能力雷达图和分享图预览**。其余 16 个页面的代码逐字节未变。

---

## 1. 新增页面：`pages/support/support`「支持开发者」

窗口标题 `支持开发者`，在 `app-config.json` 的 `pages` 数组里排第 2（紧跟首页）。

### 入口

首页 `pages/index/index` 顶部按钮：

```js
data: {
  supportDeveloperEnabled: x,        // x = featureFlags.SUPPORT_PAYMENT_ENABLED（本包为 true）
  supportDeveloperButtonText: "打赏开发者",
}
onSupportDeveloperTap: function () {
  this.data.supportDeveloperEnabled && wx.navigateTo({ url: "/pages/support/support" })
}
```

- v76 里这块是个 `open-type="contact"` 的客服按钮，文案「💰 支持开发者」/「跳转后回复“上岸”」，
  但被 `supportDeveloperEnabled: 0` 永久隐藏——**死 UI**。v78 换成真按钮 + 真页面。
- 开发版（`envVersion === 'develop'`）会把文案改成「打赏开发者（测试）」，方便调支付。
- 按钮用 `catchtap`（不是 `bindtap`），阻止冒泡到根节点的 `onGlobalClick`（那个函数会收起展开的试卷列表）。

### 页面数据与方法

```js
data: {
  loading: true, available: false, testBuild: false,
  notice: "赞赏暂未开放。",
  products: [], selectedId: "", selectedPrice: "",
  checkingOrder: false, retryAvailable: false, busy: false,
  isIOS: false, isSimulator: false,
  paymentFailureCode: "", paymentFailureDetail: "", paymentFailureHint: "",
  receipt: "",
}
```

方法：`onLoad` / `onShow` / `chooseProduct` / `pay` / `checkOrder` / `refreshOrder` /
`clearPendingOrder` / `copyTestOpenId` / `copyPaymentDiagnostic`。

### 支付链路

```js
// 所有服务端交互都走这一个云函数，四个 action
wx.cloud.callFunction({ name: "supportPayment", data: { action: "catalog" } })        // 商品列表
wx.cloud.callFunction({ name: "supportPayment", data: { action: "create", code, productId } })  // 下单
wx.cloud.callFunction({ name: "supportPayment", data: { action: "status", orderId } })          // 查单
wx.cloud.callFunction({ name: "supportPayment", data: { action: "testIdentity" } })             // 测试 openid
```

1. `onLoad`：读 `wx.getStorageSync("supportPendingOrder")` 续单；`catalog` 拉商品；
   若 `envVersion` 是 `develop`/`trial` 或 `testBuild`，走测试分支。
   **只有恰好 1 个商品时**才自动选中，否则要求用户手选。
2. `pay()`：`wx.login()` 拿 code → `action: "create"` 拿 `orderId` + `payment` 参数
   → **先**落盘 `{id, awaitingConfirmation: true}` → `wx.requestVirtualPayment({...payment})`。
   - 这是**虚拟支付**，不是 `wx.requestPayment`。
   - 按钮文案按平台分叉：iOS 显示 `Apple 内购 ¥<价>`，安卓显示 `微信支付 ¥<价>`，
     模拟器显示 `请用手机扫码测试支付`，未选中显示 `请选择赞赏金额`。
   - 版本闸门：微信 < 8.0.68 直接 toast「请更新微信后再试」。
   - 模拟器（`platform === 'devtools'`）直接拦截，不发起支付。
   - 守卫：`available && !isSimulator && !busy && selectedId && (!pendingOrderId || retryAvailable)`。
3. 支付回调后 `refreshOrder()` 轮询 `action: "status"`，按状态给回执：

| 状态 | 回执文案 | 可重试 |
|---|---|---|
| `supported` | `已收到「<商品名>」，谢谢你的支持。` | 清空订单 |
| `closed` | `订单已关闭。` | — |
| `refunded` | `该订单已退款。` | — |
| `not_created`（非等待确认） | `微信未生成支付单，可以重新支付。` | ✓ |
| `unpaid`（非等待确认） | `上一笔尚未支付，可以重新支付。` | ✓ |
| 其他 | `微信暂未确认支付，请稍后查询。` | — |
| 异常 `not_found` | `暂时无法查询订单，请稍后再试。` | 清空订单 |

4. 支付失败分支：
   - `errCode === -2` → 用户取消，清单 + 「已取消支付。」
   - 其他 → 保留订单（`awaitingConfirmation: false`），回执「未完成支付，正在查询微信订单。」，随即查单。
   - 失败诊断（仅测试构建）：把 `errMsg` 里 ≥28 位的形似密钥串替换成 `[已隐藏]` 再截 480 字；
     `copyPaymentDiagnostic()` 把「设备 / 微信版本 / 基础库 / 错误码 / 详情」拼成多行复制到剪贴板。
5. iOS 特判：errMsg 命中 `/大陆|店面|storefront|country or region/i` 时提示
   「请在 iPhone 的「媒体与购买项目」中切换到可用的 App Store 账号，再返回重试。」
6. `onShow`：若已加载完且有 `pendingOrderId`，自动 `checkOrder()` —— 覆盖「支付后杀进程 / 切后台」的补单场景。

### 页面文案

```
导航栏         支持开发者
加载          正在读取赞赏选项…
不可用        赞赏暂未开放。 / 暂时无法读取赞赏选项，请稍后再试。
Hero          行测小助理 · 谢谢你的支持 · ♥
档位区        赞赏金额 · ¥
支付按钮      请用手机扫码测试支付 / Apple 内购 ¥<价> / 微信支付 ¥<价> / 请选择赞赏金额
底部          查询支付结果
测试辅助      复制测试 OpenID · 复制支付诊断
```

测试构建下 `copyPaymentDiagnostic` 复制的内容形如：

```
设备 ios iOS 17.5
微信 8.0.49 · 基础库 3.5.0
支付错误码 -1
<errMsg>
```

### 商品与插图

商品 id → 图片映射（4 张新图，均为手绘奶油色 + 深棕描边风格）：

| 商品 id | 图片 | 尺寸 | 画面 |
|---|---|---|---|
| `support_egg` | `images/support/support_egg.png` | 121×148 | 一颗鸡蛋 |
| `support_sprite` | `images/support/support_sprite.png` | 64×148 | 雪碧瓶 |
| `support_666` | `images/support/support_666.png` | 148×102 | 「666」气泡字 |
| `support_pass` | `images/support/support_pass.png` | 148×79 | 「一起上岸」气泡字 |

图片只经一条链渲染：

```js
products.map(e => ({...e, image: d[e.id] || ""}))   // d = 上面那张映射表
// 模板：wx:if="{{item.image}}" → <image class="support-image" mode="aspectFit" src="{{item.image}}" />
```

样式固定 112×112、`flex: 0 0 112`。所以**云函数返回的 product id 必须是这 4 个之一**，
否则该档位不显示图片。Hero 区不用图片，用一个 `rotate(12deg)` 的卡片里放 `♥` 字符
（`.support-hero-art` 110×110，`#ffedcd → #edba79` 渐变）。

价格不写死在包里，全部由 `supportPayment` 云函数下发（`products: [{id, name, price}]`）。

### 新增云函数：`supportPayment`

包内**没有**它的任何源码（v76 那 10 个 `cloudfunctions/` 目录在 v78 里全删了），
说明它只部署在云开发侧，通过 `wx.cloud.callFunction` 按名调用。

任何 `!result.ok` 都抛 `Error(result.code || "unavailable")`，页面据此走不可用分支。
---

## 2. 成绩页改版：`pages/result/result`

代码 33,366 B → 39,640 B（**本版最大改动**）。**没有删除任何方法**，新增 14 个：

```
onResultPanelTap      onRadarBandTap       refreshAbilityRadar   removeRadarImage
onShareStyleTap       showFullSharePreview saveSharePreview      retrySharePreview
closeSharePreview     releaseSharePreview  absorbPreviewTouch    onResize
complete              fail
```

### 2.1 双面板：能力图 / 英雄榜

```js
data: { resultPanel: "ability", ... }   // v78 默认打开「能力图」
onResultPanelTap: function (e) {
  var panel = e.currentTarget.dataset.panel;
  if (panel === this.data.resultPanel) return;
  this.setData({ resultPanel: panel }, function () {
    panel === "ability" ? self.refreshAbilityRadar() : self.loadLeaderboard(...)
  })
}
```

首页模板里对应新增 `insight-tabs` 切换条与 `ability-card` 卡片。

### 2.2 能力雷达图（新模块 `utils/ability-radar.js`，4.8 KB）

六个维度固定：

```js
var e = ["政治理论", "常识判断", "言语理解", "数量关系", "判断推理", "资料分析"]
```

模块名归一到这六维（`/政治/→0`、`/常识/→1`、`/言语/→2`、`/数量|数学运算|数字推理/→3`、
`/判断|推理/→4`、`/资料/→5`）。

导出三个函数：

- `collectModules(modules)` — 把 `sectionResults` 归到六维；任何一题的 `cAns` 不是 `^[ABCD]$` 就整体返回 `[]`（判定不可用）。
- `compare(modules, snapshot, bands, band)` — 算**当前分段**和**上一分段**的正确率 `rates`，
  并判断"高分段是否全面压制本段"给出 `higher`。
- `draw(canvas, w, h, dpr, modules, opts)` / `drawChart(...)` — Canvas 2D 绘制。

六轴角度：`-π/2 + i*2π/N`（首轴朝上），轴数 = 有题且有分的维度数（3–6）。

几何常量：

```js
var i = Math.min(.294*n, .37*a);   // 内环 Rin
var f = Math.min(.434*n, .465*a);  // 外环 Rout
var h = c ? .8*i : i;              // 人群环（有更高分段基准时压到 0.8*Rin）
```

半径映射（`b` = 用户各维正确率，`s` = 本分段人群正确率，`n2` = 下一分段）：

```js
if (!s)      return i * t / 100;                        // 无人群：线性到 Rin
if (t <  s)  return h * t / s;                          // 低于人群：压缩到人群环内
if (t === s) return h;                                  // 等于人群环
if (t <= n2) return h + (i-h) * (t-s) / (n2-s);         // 人群环 → 内环：线性
return i + (f-i) * p(t-n2) / p(100-n2);                 // 超过下一分段：饱和曲线冲向 Rout

var p = function (t) { return -Math.expm1(-Math.pow(t/10, 1.55)) };  // = 1 - exp(-(t/10)^1.55)
```

这样尾部极值不会把图形撑爆，而「和同龄人比」的信息在图形上占据主要面积。

参考环颜色：

| 元素 | 颜色 | 说明 |
|---|---|---|
| 自身多边形 | `#a6522e` 描边 + 径向渐变填充 | 高表现时线宽 2.2 → 2.9，加 `shadowBlur 6` |
| 本分段平均 | `#285783`（蓝） | 半径 `h`（0.8Rin 或 Rin） |
| 下一分段平均 | `#28744f`（绿） | 固定画在 Rin |
| 网格环 / 辐条 | `#d5dfe7` / `#dbe2e8` | 网格环在 `h*(1/3)`、`h*(2/3)` |

「高表现」判定：`≥ ceil(2N/3)` 个维度的半径超过 `1.22*Rin`（6 维即需 4 个）。

`collectModules` 的归类规则与作废条件：

```js
/政治/ → 0    /常识/ → 1    /言语/ → 2
/数量|数学运算|数字推理/ → 3
/判断|推理/ → 4        // 图形推理/定义判断/类比推理/逻辑判断 全部并入
/资料/ → 5
其他（如"附加题""不计分"）→ -1，丢弃

if (!/^[ABCD]$/.test(q.cAns)) return [];   // 任一题答案不是单个 A/B/C/D → 整个雷达作废
```

`compare(modules, snapshot, bands, band)` 返回 `{current, next, higher}`，
其中 `higher` **仅当下一分段在全部维度上都严格更高**时才非 null。

分段统计来自云端 `exam_rank_stats` 文档的**累计桶差分**，不是抽样估计：

```js
// filteredQuestionStats[band] 是「分数 > band」的累计统计
// 两个累计桶相减 = 落在 (band, next] 区间的人
var I = P[q][C] - (k ? k[q][C] : 0);   // 本区间内选对 C 的人数
// 门槛
totalCount >= 10 && 分段人数 >= 10 && scoreRankMap 最高分名次必须是 1
```

分段切点：

```js
U = function (examId) {
  return String(examId || "").startsWith("26-huasheng-shiye-A")
    ? [0, 90, 105, 120]     // 事业单位 A 类：score = 1.5 * correctCount，满分 150
    : [0, 60, 70, 80];      // 其他卷：score = correct / total * 100
}
radarBands = U(examId).slice(1)   // 去掉 0（全员），只留可点的分段
```

配套数据字段：

```js
radarReady, radarBands, radarBand, radarLabels, radarImage,
radarSample, radarReference, radarHasReference,
radarUnavailable: "能力图暂时无法显示，切换分段可重试"
```

`onRadarBandTap` 切换分段（`全员 / >60 / >70 / >80`，按 `scoreRankMap` 实际存在的档位生成，
华生事业 A 类是 `[0,90,105,120]`，其余是 `[0,60,70,80]`）。维度数据不足 3 个时不画图。

### 2.3 分享图预览（新模块 `utils/ability-report.js`，3.1 KB）

四种样式：

```js
var L = [{id:"long",label:"长截图"},{id:"compact",label:"精简图"},
         {id:"details",label:"细节图"},{id:"ability",label:"能力图"}]
data: { sharePreviewOpen, shareStyles: L, shareStyle: "long",
        sharePreviewPath, sharePreviewState, shareSaving }
```

`ability-report.js` 导出 `measure(rows)` 与 `draw(ctx, data, radar, …, canvas, …)`：
标题 `行测小助理 · 能力报告`，分数块 + 正确/错误/未做三栏 + 雷达图 + 分模块条。
`measure` 按行数算画布高度：`Math.max(600, 466 + (48*rows + 10*(rows-1)) + 28)`，宽度定 450。

生成/保存流程：

```
onShareStyleTap → 命中缓存则直接显示，否则 generateShareImage(style)
  → createSelectorQuery 量 #shareCanvas → Canvas 2D 绘制 → wx.canvasToTempFilePath
  → 失败时 sharePreviewState='error'，页面显示「生成失败，点此重试」→ retrySharePreview()
saveSharePreview → saveToAlbum(path) → 成功 toast「已保存到相册」
  → 失败 toast「相册保存失败，请检查权限及手机空间」
```

埋点：`image.start` / `image.bitmap` / `image.saved` / `image.cancelled` / `image.failed`。
切换样式时 `_imageJob.cancel()` 取消上一张，避免并发写画布。

### 2.4 首页模板配套改动

- 新增 `share-preview` 遮罩层：`share-style-tabs`、`share-preview-image`、`saveSharePreview`、
  `ability-render-canvas`，支持点击放大（`showFullSharePreview`）、拖动吸收（`absorbPreviewTouch`）。
- 「参考排名: 」拆成 `参考排名` + `rank-caption` + `rank-numbers` 两段。
- 分数卡改为 grid 三列；分数放大条件由 `rank>=100000 || totalSubmissions>=100000` 改为 `score>=100`。
- 新增 `onResize`：横竖屏切换时重算画布尺寸。

### 2.5 渲染方式：离屏 canvas → 临时 PNG

雷达图不是直接画在页面上的，而是：

```
#abilityChart (只用来量尺寸)
#abilityCanvas (type="2d", 1×1, left/top:-9999px, 离屏)
  → R.draw(node, w, h, min(pixelRatio, 2), modules, comparison)
  → wx.canvasToTempFilePath({fileType:"png"})
  → setData({ radarImage: 临时路径, radarLabels: 标签坐标 })
  → <image class="ability-image"> + 绝对定位 label 叠加
```

`onUnload` / 切换分段 / 关闭预览时用 `wx.getFileSystemManager().unlink` 回收临时文件。

竞态处理用请求序号 + 导出锁：`_radarDrawRequest` 递增做 latest-wins，
`_radarExporting` 阻止 `canvasToTempFilePath` 期间重入，
回调里校验 `_unloaded / 请求号 / 当前面板 / radarReady / 当前分段` 是否仍成立，过期结果直接删文件。

### 2.6 分享流程从「直接保存」改成「先预览再保存」

| | v76 | v78 |
|---|---|---|
| 选样式 | `wx.showActionSheet(["长截图","精简图","细节图"])` | 页内 Tab 条 + 遮罩层 |
| 生成 | `wx.showLoading({title:"生成中..."})` | `sharePreviewState: "loading"` / `"ready"` / `"error"` |
| 保存 | 生成后**立即** `saveToAlbum` | 用户点「保存到相册」才调 `saveSharePreview` |
| 缓存 | 无 | `_shareFiles: Map<style, tempFilePath>`，切回已生成的样式直接复用 |
| 失败 | toast「图片生成失败，请重试」 | 预览区显示「生成失败，点此重试」→ `retrySharePreview` |

`onHide` / `onMemoryPressure` 取消任务后不再 `wx.hideLoading()`，而是把预览态置为 `error`，
用户切回来能直接点重试。`onUnload` 新增：删雷达临时图、释放预览缓存、清空 `_radarModules/_radarSnapshot`。

### 2.7 排行榜改成懒加载

v78 默认面板是「能力图」，所以进页时不再立即拉排行榜：

```js
// onLoad 里
a._rankIdentityReady = true;
"heroes" === a.data.resultPanel && a.loadLeaderboard(d.examId, a.data.score);
// 切 Tab 时
t._rankIdentityReady && !t._leaderboardLoaded && t.loadLeaderboard(t.data.examId)
```

失败后再切一次 Tab 会重试。`loadLeaderboard` 还补了 `!t ||` 的空 examId 守卫（v76 会带 `undefined` 发请求）。

### 2.8 连带的接口变更：`utils/image-export.js`

```js
// v76
exportCanvas: function (e, t) { return t.wait(function (t, n) { return wx.canvasToTempFilePath({ ..., success: t, fail: n }) }) }
// v78  第三参是「产物无人接收时要删掉」的回调
exportCanvas: function (e, t, n) { return t.wait(function (t, r) {
  return wx.canvasToTempFilePath({ ..., success: function (e) { !t(e) && e.tempFilePath && n && n(e.tempFilePath) }, fail: r })
}) }
```

配合 `createJob().wait` 的 resolve 器改为返回布尔值，页面据此在导出过期时删除孤儿文件。

---

## 3. 首页入口改造：`pages/index/index`

代码 20,091 B → 20,404 B。**唯一的功能改动就是第 1 节那个打赏按钮**。

| 项 | v76 | v78 |
|---|---|---|
| 结构 | `button(open-type="contact") > view.support-content > support-title("💰 支持开发者") + support-desc("跳转后回复"上岸"")` | `button(catchtap=onSupportDeveloperTap) > text.support-btn-icon("💰") + text({{supportDeveloperButtonText}})` |
| 数据 | `supportDeveloperEnabled: 0`（恒假） | `supportDeveloperEnabled: SUPPORT_PAYMENT_ENABLED`（恒真） |
| 样式 | `.support-btn` 字重 400、`padding: 8 25` | `.support-btn` 定高 62、`font-size:27`、`font-weight:700`、`color:#2c3e50`；`.title-row` 加 `min-height:84` |

删掉的 CSS 类：`support-content`、`support-title`、`support-desc`。
其余 53 个 Page 顶层键逐字节相同；`drawScoreWheel` / `refreshMotivationAudioUrl` 等函数的差异只是压缩器重命名（`p`↔`C`、`w`↔`p`），无行为变化。

---

## 4. Feature flags

`utils/feature-flags.js`：

```js
// v76
{ QUESTION_BANK_ENABLED: true, COMPACT_HISTORY_WRITES_ENABLED: false, redirectIfQuestionBankClosed(){ return false } }
// v78
{ QUESTION_BANK_ENABLED: true, COMPACT_HISTORY_WRITES_ENABLED: true,
  SUPPORT_PAYMENT_ENABLED: true,
  getMiniProgramEnvVersion(){ return wx.getAccountInfoSync()?.miniProgram?.envVersion || "" },
  redirectIfQuestionBankClosed(){ return false } }
```

- `COMPACT_HISTORY_WRITES_ENABLED` **由 false 翻成 true** —— 历史记录写入切成精简模式。
- 新增 `SUPPORT_PAYMENT_ENABLED`、`getMiniProgramEnvVersion`。

---

## 5. 包结构变化

### 新增条目（6）

```
+ images/support/support_666.png          5,200 B
+ images/support/support_egg.png          3,503 B
+ images/support/support_pass.png         5,220 B
+ images/support/support_sprite.png       4,540 B
+ pages/support/support.html                458 B
+ pages/admin/report-list/report-list.html  500 B
```

### 移除条目（16）

```
- .vercel/project.json
- cloudfunctions/autoExportStatic/{cloudbaserc,config,package}.json
- cloudfunctions/deleteExamRecord/{cloudbaserc,package}.json
- cloudfunctions/idiomSearch/{cloudbaserc,package}.json
- cloudfunctions/login/package.json
- cloudfunctions/updateRankStats/{cloudbaserc,config,package}.json
- cloudfunctions/uploadFile/package.json
- project.private.config.json
- vercel.json
- pages/admin/report-/list/report-list.html   ← 路径拼错，v78 修正为 report-list
```

**这些是打包内容清理，不是功能删除。** 关键证据：**v76 里这 10 个云函数模块的 `require` 次数是 0**。

```
$ grep -o 'require("cloudfunctions/[^"]*")' v76/app-service.js | wc -l
0
```

而且它们 `require("wx-server-sdk")`、用 `Buffer` / `DYNAMIC_CURRENT_ENV` / `getWXContext`，
小程序运行时没有这些，**任何一条 require 都会在启动时报模块缺失**。v76 能正常上线，
反证这些 `define()` 只是被编译器顺带打进来的死代码（v76 打包时把 `cloudfunctions/` 目录
当成了小程序源码目录一起编译，源码 37,301 字节）。

服务端标记的出现次数对比：

| 标记 | v76 | v78 |
|---|---:|---:|
| `wx-server-sdk` | 5 | **0** |
| `DYNAMIC_CURRENT_ENV` | 5 | **0** |
| `getWXContext` | 4 | **0** |
| `fileContent`（`cloud.uploadFile` 服务端参数） | 3 | **0** |
| `exam_rank_stats` | 8 | **0** |

云函数照常按名调用，环境 ID 完全一致：

```js
// app.js onLaunch，两版逐字符相同
wx.cloud ? wx.cloud.init({ env: "cloud1-8g137o5da8d5e269", traceUser: true }) : ...
```

| 调用点 | v76 | v78 |
|---|---|---|
| `wx.cloud.callFunction` | 7 | 8（多一个 `supportPayment`） |
| `wx.cloud.database()` | 9 | 9 |
| `wx.cloud.uploadFile` / `downloadFile` / `deleteFile` / `getTempFileURL` | 2/2/1/1 | 2/2/1/1 |

逐个调用点（v78，与 v76 逐字符相同，只多 `supportPayment`）：

```
utils/cloud.js                    → login
utils/cloud.js                    → deleteExamRecord   （自带 "function not found" 降级到客户端删除）
utils/generate_static.js          → uploadFile
utils/generate_static.js          → autoExportStatic
pages/support/support.js          → supportPayment     ← 新增
pages/idiom/idiom.js              → idiomSearch
pages/idiom-reader/idiom-reader.js → idiomSearch ×2
```

`updateRankStats` 客户端从未调用过——v76 里唯一出现处是 `autoExportStatic/index.js`
自己的服务端对服务端调用，那个文件也一起从包里消失了；它实际由 `cloudbaserc.json` 里的
8 个 timer 触发器驱动，属云端行为。

同一份逻辑客户端侧本来就有副本：`utils/{exam-model,exam-catalog,answer-compat,hero-detail}.js`
与 `cloudfunctions/autoExportStatic/*.js` 逻辑一致（`exam-model` 甚至逐字节相同），
且这些 `utils/` 模块两版之间**逐字节未变**。

被删的 15 个文件本身也证明与运行无关：`cloudbaserc.json` 是 cloudbase CLI 的部署描述
（`envId` / `runtime` / `handler` / timer 触发器），`vercel.json` 是静态站 rewrite 规则，
`project.private.config.json` 是开发者工具的本地设置。

同理，`pages/admin/report-\x01list/...` 是 v76 索引里 `/` 被错写成 `\x01` 导致的脏文件名，
v78 服务端已经修好，路由本身一直是 `pages/admin/report-list/report-list`。

### `page-frame.html` +24 KB 是什么

不是基础库升级。`__wcc_version__` 两版逐字符相同（`v0.5vv_20211229_syb_scopedata`），
运行时前导 37,587 字节逐字节一致。增长全部来自 WXML/WXSS 编译产物：

| 来源 | 字节 |
|---|---:|
| 新增 `pages/support/support` 的模板 + 渲染函数 + wxss | ≈ +10,800 |
| `pages/result/result` 能力图 + 分享预览的模板/样式 | ≈ +6,700 |
| `pages/index/index` 打赏按钮改造 | ≈ −200 |
| 插入新页导致页面表、模板编号、局部变量整体重编号 | 余量 ≈ +7,800 |

`workers.js`（本地扫描识别线程）**逐字节未变**。

---

## 6. 未变的页面（16 个）

以下页面的 JS 代码块、模板、样式在 v76/v78 之间**逐字节相同**
（仅压缩后空白不同，归一化后完全一致）：

```
components/hero-ranking/hero-ranking    pages/exam/exam                pages/fb-tool/fb-tool
pages/idiom/idiom                       pages/idiom-reader/idiom-reader pages/letter/letter
pages/math-tools/menu/menu              pages/math-tools/percentage/percentage
pages/percentage-result/percentage-result  pages/set-history/set-history
pages/timer/timer                       pages/timer-setup/timer-setup
pages/timer-records/timer-records       pages/timer-report/timer-report
pages/user-list/user-list               pages/admin/report-list/report-list
```

---

## 7. 复现步骤

```bash
# 1. 让微信把新版本拉下来（本地缓存只在真正打开小程序时更新）
open "weixin://dl/business/?appid=wxd74bddd3fe422729&path=pages/index/index"

# 2. 确认新版本目录出现（v78）
ls ~/Library/Containers/com.tencent.xinWeChat/Data/Documents/app_data/radium/users/*/applet/packages/wxd74bddd3fe422729/

# 3. 解包两版
node tools/unpack-wxapkg.cjs wxd74bddd3fe422729 <path>/78/__APP__.wxapkg /tmp/v78
node tools/unpack-wxapkg.cjs wxd74bddd3fe422729 <path>/76/__APP__.wxapkg /tmp/v76

# 4. 逐文件比对
diff -rq /tmp/v76 /tmp/v78
```
