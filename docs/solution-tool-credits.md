# 答题卡扫描与卷豆方案

本次交付卷豆后端。小程序可按下文接入登录、余额和明细，运营后台可接入定价和人工调整。答题卡扫描是首个计划接入的付费工具，扫描、核对和交卷流程见产品方案，当前可调用的接口见[前端对接](#前端对接)。

卷友拍一张答题卡，系统把识别出的选项填进现有答题卡，用户改一改存疑题就能交卷。注册送 3 颗**卷豆**，每张标准答题卡用 1 颗，新用户可以免费扫 3 张。扫描与后续开放的付费工具共用卷豆余额，充值按 1 元 1 颗进入同一个余额。手动录答、核对答案、交卷和看成绩继续免费。

「卷豆」和「卷友」都沿用卷卷小榜的叫法。「送 3 颗」「用 1 颗」念得顺，也适合给后续工具用。「卷票」有纸卡感，更像扫描专用券。「卷粮」有备考补给感，要解释一份能用几次。评审稿暂用「卷豆」，扫描入口直接写「还可扫描 3 张」。

## 用户怎么扫

1. **选好套卷。** 用户在录答页选择「扫描答题卡」，拍照或从相册选一张。照片预览提示「让答题区完整入镜」，支持裁掉姓名、准考证号。确认前显示套卷、照片、「本次用 1 颗卷豆」和剩余可扫张数。卷豆不足时可以手动录入，或从已开放的入口领取、购买卷豆。
2. **开始识别。** 服务端先占用本次所需的卷豆，再处理照片。用户可以离开页面，回来时看到任务状态。识别成功并保存可恢复的结果后，再扣掉本次占用的卷豆。
3. **打开答题卡核对。** 填入可靠的选项，涂改、多涂、看不清的题标「待核对」，确认留白的题保持空白。如果已有手填草稿，默认只补空题，用户也可确认整份替换。保留计时记录、当前题和已有复查标记。回到这份草稿可继续改，用户确认交卷后才走现有计分、报告和上榜流程。

| 情况 | 怎么处理 |
| --- | --- |
| 上传失败、照片不完整、版式不匹配、整张空白、识别结果无法核对或服务超时 | 释放占用，说明原因，允许重拍或手动录入 |
| 整张卡定位可靠，有少量题存疑 | 保存答案和待核对题号，按确认时显示的数量扣卷豆。修改、查看、提交这份结果免费 |
| 连点、断网后重试或退出再进 | 回到原任务。结果保存后，同一账号、同一套卷、同一张照片在结果保留期内可再次打开，只算一张 |

扫描结果建议保留 7 天，仅本人可以取回。已经导入的作答草稿按现有规则保存。原图仅在识别处理中暂存，任务结束即清理，异常残留最多保留 24 小时。海报只使用允许公开的成绩和统计字段。

## 卷豆的默认规则

| 项目 | 建议默认值 | 发放或消耗时机 |
| --- | --- | --- |
| 新人体验 | 送 3 颗 | 首次完成微信账号注册时自动发放，每个账号一次 |
| 老卷友体验 | 送同一份 3 颗 | 已有的卷友首次绑定正式账号时领取，同一账号只发一份首登赠送 |
| 扫描答题卡 | 每张用 1 颗卷豆 | 可核对的识别结果保存成功时扣。每人同时 1 单，每天最多发起 20 次新识别，失败的任务也计入请求上限 |
| 邀请奖励 | 每位有效新人给邀请人 2 颗，每月最多奖励 10 位 | 默认关闭。获准后，新人按规则完成首次有效使用即发 |
| 购买卷豆 | 1 元 1 颗，首发 1、5、10、30、60 颗五档 | 微信确认付款及代币兑换后入账。各环境分别开放 |
| 激励视频 | 完整看完给 1 颗，每天最多领 2 颗 | 流量主开通后启用，通过完成校验才发放 |

卷豆默认长期可用，仅限本人在卷卷小榜内使用。各付费功能分别设置每次用几颗，入口只显示该功能当前的用量。比如买了 10 颗，扫 3 张后剩下 7 颗，还能用于后续开放的付费工具。现有运营积分后台已配置交卷、纠错、精选评论奖励，卷豆单独记账，后台界面可以沿用已有的余额、流水、人工发放和审计入口。 [现有积分规则](../server/admin-console.mjs#L151)

运营后台可配置新人和老用户的赠送数量、各工具用量、开放的答题卡版式、调用上限、邀请奖励与有效期、广告奖励、渠道开关及已发布的卷豆档位。修改规则时预览新人还能免费扫几张，首轮试用建议维持每张 1 颗。任务和订单创建时记下用户看到的用量或商品价格，邀请在注册时记下本次活动规则。人工补发或扣回要填原因，流水保留操作人和对应任务、订单或活动。

## 成绩分享和邀请

保留四种成绩图和正常转发。在可以使用邀请功能的渠道，用户可在分享预览里选择带邀请入口的版本。现有成绩图用通用小程序码，能打开产品。需要统计是谁邀请的，可以调用微信的小程序码能力，在码里放随机短码，由服务端查出对应的分享者。微信内原生分享卡片也可以带邀请码。受邀者打开后进入同卷详情或产品介绍页，并自行决定是否注册。 [现有海报](../mini-program/pages/share/share.js#L404) · [微信小程序码文档](https://developers.weixin.qq.com/miniprogram/dev/server/API/qrcode-link/qr-code/api_getunlimitedqrcode.html)

- **怎么认领。** 以首次有效进入时的邀请码为准，7 天内首次注册才记入该邀请。每个新账号只归属一人。自己邀请自己、已有账号回访或重复注册事件都不会产生奖励。
- **什么时候发。** 新人在注册后 7 天内首次成功扫描并导入答案，或首次正式交卷，就立即给邀请人 2 颗卷豆。比如小李通过小王的码注册，先拿到自己的 3 颗。小李扫一张并导入，自己还剩 2 颗，小王收到 2 颗。注册即发可以作为待确认规则，只有对应渠道明确允许时才开启。遇到疑似批量注册的账号可人工核对，同设备或网络只作为排查信号。
- **哪些渠道用。** 微信明确限制奖励诱导朋友圈分享，也限制群或好友分享中的浅层互动。微信群的带奖励版本按实际活动规则提审，明确展示发放条件和上限。小红书电商规则限制站外交易导流，抖音公约限制恶意导流及部分外部二维码。小红书、抖音先提供纯成绩图，有平台支持的入口后再开放该渠道的邀请码。 [微信小程序分享规范](https://developers.weixin.qq.com/miniprogram/product/#_2-5-1-滥用分享行为) · [小红书交易导流规则](https://school.xiaohongshu.com/rule/detail/1944) · [抖音社区自律公约](https://www.douyin.com/rule/policy)

## 购买卷豆和看广告

**个人主体可以申请道具直购。** 卷卷小榜当前为个人主体。微信开放文档要求个人开发者持中国大陆居民身份证、小程序服务类目含「工具」，且已完成认证和备案。符合条件可在「支付与交易 → 虚拟支付」申请，个人主体各终端合计月支付限额为 10 万元。 [微信个人主体接入指南](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person.html) · [项目主体记录](../site/README.md#L170)

**卷豆充值按 1 元 1 颗。** 卷卷小榜的 AppID 已获微信确认可使用现网代币充值，微信代币名称为「卷豆」，使用 `short_series_coin` 拉起收银台。充值与赠送共用卷豆余额，可用于已开放的付费工具。 [微信虚拟支付开发流程](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html) · [微信虚拟支付接口](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html)

| 卷豆颗数 | 价格 |
| ---: | ---: |
| 1 颗 | ¥1 |
| 5 颗 | ¥5 |
| 10 颗 | ¥10 |
| 30 颗 | ¥30 |
| 60 颗 | ¥60 |

购买前显示人民币金额、卷豆颗数、适用功能和退款规则。支付后显示确认进度，到账后从卷豆余额和明细读取结果。用户离开页面后可以用原订单查回到账状态。 [微信虚拟支付费率](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/devplan.html)

用户看一个余额，明细可查每次领取、购买、使用和退款。使用时先扣赠送的卷豆，再按购买顺序扣购入卷豆。退款按原单走微信渠道，退款处理中冻结原单剩余卷豆，平台确认全额退款后扣回本单未使用的卷豆。部分退款和已用卷豆差额交运营按平台账单核对。

**看广告领卷豆**放在「领卷豆」里，由用户主动选择。开通流量主后再接微信激励视频，按官方完成信号判断是否看完，服务端给每次观看发一次领取凭证，通过去重和限额校验才发放。中途关闭或广告加载失败，用户可以返回原页面。 [微信激励视频接口](https://developers.weixin.qq.com/miniprogram/dev/api/ad/wx.createRewardedVideoAd.html)

## 怎么接现有系统

1. **先补账号和记账。** 现有小程序资料凭证主要保存在本机，积分查询也沿用游客 ID。小程序发起微信登录，服务端向微信核验身份，再以该账号记卷豆。同一个微信账号换手机或重装后能找回余额。现有答卷和草稿继续可用，能核实归属的旧记录由本人确认关联。卷豆使用项目已有的 PostgreSQL，记录每笔卷豆的来源、消费的功能和订单的到账、使用、退款。 [现有资料入口](../mini-program/services/profile.js#L9) · [现有积分查询](../server/admin-console.mjs#L420)
2. **接上现有识别和答题卡。** 识别目前在本地 Node 进程内完成，主要消耗 CPU，现有样本以 140 题版式为主。地市 130 题、副省 135 题要用人工核过的实拍答案验证，逐个版式通过后再开放。扣减额度前校验实际读取到的题位和版式。接口按题量补齐的答案需要结合原图定位来判断，留白较多的答卷也可以正常通过。识别结果写入现有核对流程。 [识别现状](integration-omr.md) · [现有答题页](../mini-program/pages/practice/practice.js#L316)
3. **在开始计算前校验用量。** 所有生产识别入口都经过服务端身份、余额和限额校验，把识别交给单独的后台进程，避免拖慢普通录答。建任务时一起记录占用的卷豆，确认交付时一起保存可恢复结果和扣减记录。任务失败或超时就释放本次占用，迟到结果也按同一任务状态处理。多个设备同时发起工具任务，最后一颗卷豆只能被占用一次。给单用户、全站并发和外部 API 预算分别设上限，服务繁忙时提示稍后重试或继续手动录入。

成本用「全部识别请求花掉的 CPU、外部 API 和存储成本 ÷ 可交付的扫描数」来算，把失败重试也算进去。当前算法没有外部识别 API 费用，后续加外部服务时再记录实际用量。后台先观察首次扫描完成率、识别失败率、每张交付成本和试用量。按现有默认值，一个有效邀请会发出新人 3 颗和邀请人 2 颗，共 5 张标准扫描的额度，可直接据此估算活动预算。

## 上线顺序和验收

1. **先让卷友扫起来。** 完成微信账号、试用赠送、余额和明细、拍照识别、答题卡核对和运营补发。选少量真实卷友试用，收集便于核对的实拍样本，算清失败率和单张成本。
2. **验证充值，再开购买入口。** 测试环境核对下单、余额到账、跨工具消费和退款。接入实际小程序后再开放正式版。邀请奖励按渠道提审后打开。普通分享和扫码进入可以先验证，体验额度用完后至少有一种自助补充方式，再扩大开放。
3. **最后开广告。** 拿到流量主资格后测填充和收益，按实测收入调一次发多少、每天发几次。

验收要用真实照片和真实入口。新账号首次拿 3 颗卷豆，换手机仍只有同一份。扫三张合格照片后余额归零，识别失败退回占用，同一任务重复请求只扣一次，手动录答仍能走通。识别草稿退出可恢复，确认交卷才生成成绩。邀请上线前验证新旧账号、重复事件、四种分享图、扫码归属及隐私字段。购买上线前验证订单去重和补查、赠送与购买进入同一余额、按功能扣各自的颗数，以及退款按原订单回收可退的卷豆。实现后跑 `npm run verify -- all` 和识别专项，检查手机端原始截图。

体验阶段采用新账号和首次绑定的老卷友各送 3 颗、扫描试用每张 1 颗、邀请按首次有效使用发奖。充值按微信发布的 1 元 1 颗执行。

## 后端实现

### 账号和账本

客户端调用 `wx.login`，把临时 `code` 交给 Node 服务。服务端通过微信 `jscode2session` 换取账号身份，以 AppID 和 OpenID 的摘要定位同一个卷豆账号。微信密钥、OpenID 和微信会话密钥由服务端处理。客户端保存服务签发的卷豆 `token`，有效期 30 天。退出登录会注销该 token，其他设备可继续使用。

创建账号和记首次赠豆在同一笔 PostgreSQL 事务里。两个设备同时首次登录时，共用账号编号和一笔赠送。老卷友选择关联时，服务端核对当前游客身份以及既有资料凭证或正式回执。已验证过手机号归属时，微信账号还须匹配。已经领过首次赠豆的账号随后关联旧资料，余额按原账本延续。现有草稿和练习历史继续使用原有入口和身份。

卷豆表使用 `wallet_` 前缀，位于现有 PostgreSQL 的 `DATABASE_SCHEMA`。同一账号的占用、结算和人工调账通过行锁串行写入，数据库唯一约束保护业务单号和流水。测试服务使用 `TEST_DATABASE_URL` 和独立 schema。运营积分仍使用原账本。 [HTTP 实现](../server/tool-credits.mjs) · [PostgreSQL 账本](../server/tool-credits-store.mjs) · [迁移 SQL](../server/migrations/wallet/001_initial.sql) · [部署步骤](../deploy/README.md#卷豆数据库)

### 付费工具

每个工具有独立标识和整数用量。运营可配置 `costs`，例如 `{"answer-sheet":1,"photo-review":2}`。价格调整影响新业务单，已经占用的业务单按确认时的价格结算。卷豆余额和可用额度由账号共用，优先扣赠送余额，再按入账顺序扣购买余额。

| 状态 | 卷豆变化 | 调用方如何处理 |
| --- | --- | --- |
| `reserved` | 占用从可用余额中划出，流水暂未扣减 | 执行工具操作 |
| `settled` | 原子保存交付编号、扣减流水并释放占用 | 按编号读回结果并交付 |
| `released` | 占用退回可用余额 | 显示失败。用户重新发起时生成新业务单 |
| `expired` | 到期占用退回可用余额 | 过期结果按失败处理。重新发起使用新业务单 |

工具后端通过 `createApi` 的功能工厂取得 `billing`，调用 `await billing.requireAccount(request)` 获取可信账号编号。以 `{ accountId, tool, operationId }` 标识一次工具操作。工具保存自己的结果后再结算，账务接口需要 `await`。

```js
const cost = await billing.quote(tool);
const operation = await billing.reserve(key, { quotedCost, holdMs: 30_000 });
const settled = await billing.settle(key, deliveryRef);
```

- 报价时向用户展示 `cost`。确认后把该次看到的价格作为 `quotedCost` 传给 `reserve`。价格变化返回 `409 quote`，刷新报价后重新确认。
- `reserve` 返回 `{ id, state, cost, expiresAt, deliveryRef, created }`。同一个业务单重试时，`created` 为 `false`。用 `billing.operation(key)` 查看原业务单，按其状态恢复结果或返回进度。默认占用五分钟，`holdMs` 支持 1 秒到 30 分钟。
- 结果持久化后，把工具自己保存的 `deliveryRef` 交给 `settle`。只有 `state === "settled"` 时才向用户交付。结果写入和钱包结算之间遇到中断时，用原业务单和同一个凭证恢复。重复结算返回同一结果，一份交付凭证在同一账号同一工具下只结算一次。
- 工具失败时调用 `billing.release(key)`。已结算的操作保留原状态，取消或过期的操作收到迟到结果也保持原状态。已经结算的结果可保存后续核对状态。确认发生邀请活动认可的有效使用后，调用 `billing.recordToolUse(key)` 记一次奖励事件。

默认价 `answer-sheet: 1` 供扫描接入时使用。照片、题位、版式、任务重试和结果留存由扫描工具管理。统一账本只保存用量、操作标识、占用状态与交付编号。扫描入口开放前单独检查身份、版式、资源上限和实拍准确率。

### 邀请和外部渠道

邀请归因需要活动审批和服务端渠道校验能力。`ROLLIERANK_WECHAT_GROUP_INVITE_APPROVED=1` 代表活动获准，运行时还需安装 `verifyInviteVisit` 校验器。客户端上报的微信场景号用于筛掉非群场景，服务端以校验器返回的微信身份和凭证编号为准。朋友圈、小红书和抖音继续使用普通成绩图。

服务端为首个通过校验的进入记录发一次 `claim`。注册时同时核对微信身份、本机身份和有效期，成功后消耗该凭证。同一账号不会重复归因。确认有效使用时按注册时保存的奖励、期限和月上限发豆。后台关闭活动开关后，新归因停止，已登记的有效邀请按登记规则兑现。

带卷豆 token 的正式交卷仍走 `POST /api/submit`。当答卷有至少一项选择，且 `guestId` 与登录时的 `visitorId` 对应时，服务端随正式回执保存邀请事件。奖励事务可以重放，重复收件只入一次账。手动录答、交卷与看成绩继续免费。

道具直购、卷豆充值和激励视频各有独立开关。卷豆充值使用本 AppID 已获准的代币模式。激励视频需开通流量主。 [微信个人主体接入指引](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)

### 微信代币充值

1. 微信登录后，服务端校验买家的钱包归属和报价，用 PostgreSQL 保存订单号、档位、人民币金额和支付环境。`buyQuantity` 为卷豆颗数，`signData` 和双签名由服务端生成。首次下单用当次 `wx.login` 的会话密钥签署 checkout 和固定的代币扣减请求。数据库仅暂存这笔扣减的签名。 [微信虚拟支付签名](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html)
2. 收银台返回、微信推送和后台补查进入同一核对流程。服务端用 `query_order` 核对现金单、微信内部单号、实付金额、终端和环境。客户端提交的订单状态和金额只用于交互与报价确认。 [微信查询现金单](https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order.html)
3. 现金确认后，服务端以固定单号调用 `currency_pay` 兑换相同数量。微信确认扣减后再次核对现金单，再在账号锁内一次写入订单状态、`purchase` 流水和可用卷豆批次。网络丢回包沿用同一扣减单号，微信返回重复成功也可以恢复到账。这笔兑换使用已购代币，现金只收一次。 [微信扣减代币](https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_currency_pay.html)
4. 微信确认退款处理中时，冻结原批次并释放使用该批次的待结算工具操作。签名查单确认原现金单已全额退款后，扣回这个批次的剩余卷豆。若已消费则标记 `review`，供运营处理差额。部分退款先保留冻结，交运营核对。退款由微信渠道发起。 [微信虚拟支付退款流程](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html)

充值单以 `RC` 开头，微信代币扣减单以 `RD` 开头。卷豆正常消费沿用现有的 `billing.reserve`、`billing.settle` 和 `billing.release`。运营积分继续独立记账。开发版、预览和体验版使用测试 API、测试 PostgreSQL 与微信沙箱 `env=1`。正式版使用生产 API 与现网 `env=0`。Apple IAP 需开通并单独启用，使用现网。 [微信代币充值后端部署](../deploy/README.md#微信代币充值) · [微信终端路由](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html)

### 道具直购订单和退款

一笔道具直购订单授予指定工具的一次使用权。配置中的商品 ID 和价格须与微信后台已发布的道具一致。服务器核对当前钱包与付款用的微信身份，保存订单和价格快照，再返回 `wx.requestVirtualPayment` 所需的原始 `signData` 和双签名。商品价格以人民币分保存。 [微信调起虚拟支付](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html)

前端支付结果用于触发查单。后台通过微信签名查单核对订单号、实付金额和渠道，付款确认后在 PostgreSQL 开放该订单的使用权。微信消息推送也会触发同一查单，后台会补查未确认订单。付款的微信单号只能绑定一笔本地订单。申报终端与微信实际支付渠道不一致时，订单进入对账。 [微信查询订单](https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order)

工具服务调用 `await billing.reserve(key, { paymentOrderId })` 占用已付款的使用权。订单只适用于自身账号和指定的工具。占用成功返回 `cost: 0`，保存结果后走原有的 `billing.settle` 确认用完。失败或到期时可再次使用这笔道具。道具购买与卷豆余额分别记账。

普通微信订单的未使用道具支持全额原路退款。退款任务发起时冻结使用权。微信确认退款单状态为 8 后标记退款完成。退款失败且原支付单仍完整可退时恢复使用权。苹果渠道按 Apple 的退款流程处理，外部退款或金额变化进入对账。 [微信退款任务](https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_refund_order) · [个人主体退款说明](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)

## 前端对接

### 小程序卷豆页

使用所在构建的现有 API 域名。开发版和体验版先校验 `X-RollieRank-Environment: test`。把卷豆 token 存在相应环境的本机存储中。以下各路径以 `/api/tool-credits` 开头。带身份的请求使用 `Authorization: Bearer <token>`。

| 方法和路径 | 传参 | 返回和用法 |
| --- | --- | --- |
| `GET /capabilities` | 无 | `{ login, invite, purchase: { directPurchase, tokenRecharge, tokenRechargeIos?, packages }, ads }`。按能力开关显示入口 |
| `POST /login` | `{ code, visitorId?, bindLegacy?, profileToken?, attemptId?, inviteClaim? }` | `{ token, accountId, created, balance, held }`。小程序从 `wx.login` 取 code，`visitorId` 沿用现有 `guestId` |
| `GET /wallet` | 可传 `before`，需 token | `{ accountId, balance, held, records, nextBefore }`。`balance` 是可用卷豆，`held` 是占用中的卷豆 |
| `GET /quote?tool=answer-sheet` | 工具标识，需 token | `{ tool, cost }`。该值是当前单次用量，工具入口是否开放由工具自己决定 |
| `POST /logout` | `{}`，带当前 token | `{ ok:true }`。清除本机对应 token |
| `POST /invite/code` | `{}`，需 token 和已开通渠道 | `{ code, reward, useDays, monthlyLimit }` |
| `POST /invite/visit` | `{ code, visitorId, scene, proof }` | 校验通过返回 `{ accepted:true, claim }`，把 claim 留到首次登录。校验失败返回 `{ accepted:false }` |

- 新设备用同一个微信账号重新调用 `wx.login` 即可找回余额。登录前若用户同意关联本机资料，传 `bindLegacy:true`，并带已有的 `profileToken` 或一个可核实的正式回执 `attemptId`。缺少可验证资料时可以取消关联后登录。
- 明细每页最多 30 条。以 `nextBefore` 作为下一页的 `before`，为 `null` 时到末页。每条包括 `id`、`source`、`amount`、`balanceAfter`、`reason`、`tool`、`createdAt`。按原顺序显示。正负 `amount` 表示入账和扣减。`balanceAfter` 是该笔入账后余额，当前可用额度使用顶层 `balance`。`createdAt` 是 Unix 毫秒。
- 明细中的来源为 `welcome`、`manual`、`tool`、`invite`、`purchase` 和 `refund`。充值和退款分别显示「微信充值」「微信充值退款」。人工调整显示「人工补发」或「人工扣回」。运营填写的原因和账号审计只对管理员显示。
- 收到 `401` 时清除过期 token 并提示重新登录。需要邀请发奖的正式交卷请求附上同一个卷豆 token，原有游客交卷请求仍可照常发送。
- 用 `accountId` 作为用户向运营提供的卷豆账号编号。用户不需要提供微信登录凭证或手机号。

### 卷豆充值对接

卷豆页使用 `purchase.packages` 的 `{ credits, cents }` 显示颗数和应付金额，默认选最小档。`purchase.tokenRecharge === true` 且设备支持时开放支付。iPhone 的开发版和体验版显示「iPhone 充值说明」。iPhone 付款使用现网 Apple IAP，正式版还要求 `purchase.tokenRechargeIos === true`。 [微信终端路由](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html) · [微信收银台](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html)

| 方法和路径 | 请求和返回 |
| --- | --- |
| `POST /recharges` | 传 `{ credits, quotedCents, requestId, platform, code }`，返回 `{ order, payData }`。`platform` 为 `ios` 或微信支付侧的 `android`，`code` 来自新的 `wx.login` |
| `GET /recharges` | 返回当前账号最近 50 笔 `{ orders }` |
| `GET /recharges/<id>` | 读取本地 `{ order }` |
| `POST /recharges/<id>/confirm` | 传 `{}` 触发微信查单并尝试入账，返回 `{ order }`。`needsWechatCode` 为 `true` 时，用新的 `wx.login` code 传 `{ code }` 重试 |

1. 用户确认档位后生成 UUID 格式的 `requestId`，用该档位的 `cents` 填 `quotedCents`。下单请求遇到网络重试时复用 `requestId`，并重新获取 `code`。保存返回的订单 `id`，把非空的 `payData` 原样传给 `wx.requestVirtualPayment`。其中 `mode` 为 `short_series_coin`，`signData`、`paySig` 和 `signature` 均由服务端生成。
2. 收银台结束后确认原单。超时后允许查询到账，回到页面时自动补查。微信明确取消且查单仍未付款时回到选档；付款结果未知时保留原单供用户查询。用户再次主动发起新充值时生成新 `requestId`。
3. `order` 含 `id`、`credits`、`cents`、`platform`、`state`、`needsWechatCode`、`createdAt` 和 `updatedAt`。到账以 `credited` 为准，然后刷新 `/wallet`。`pending` 或 `paid` 显示「到账确认中」。`closed`、`refund_pending`、`refunded`、`review` 分别显示「订单已关闭」「退款处理中」「已退款」「待运营核对」。`409 recharge-quote` 表示需要刷新档位与报价。

### 道具直购对接

`GET /api/tool-credits/capabilities` 返回 `purchase.directPurchase: true` 时，使用 `purchase.products` 渲染已配置道具。每项包含 `productId`、`tool`、`title`、`cents` 和 `ios`。调起前检查 `wx.requestVirtualPayment` 可用，并按微信指引校验 iOS 微信版本。 [微信个人主体前端接入](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)

所有购买请求附带卷豆 Bearer 凭证。

| 接口 | 调用方式 |
| --- | --- |
| `POST /api/tool-credits/purchases` | 传 `{ productId, requestId, quotedCents, platform, code }`。用新的 `wx.login` code，`platform` 为 `android` 或 `ios`。返回 `{ order, payData }` |
| `GET /api/tool-credits/purchases` | 返回当前账号最近 50 笔订单 |
| `GET /api/tool-credits/purchases/<订单号>` | 读取已保存状态 |
| `POST /api/tool-credits/purchases/<订单号>/confirm` | 传 `{}`，触发服务端向微信查单，返回 `{ order }` |

原样把 `payData` 交给 `wx.requestVirtualPayment`，保留 `signData` 字符串。下单接口的网络重试沿用 `requestId`，换取新的微信 code。支付弹窗返回后按订单号确认，避免再调用同一笔支付。用户明确开始另一笔购买时生成新的 `requestId`。

订单含 `id`、`productId`、`tool`、`title`、`cents`、`channel`、`state`、`entitlement` 和时间字段。只有 `entitlement: "available"` 时才能使用。其余使用权状态为 `"reserved"`、`"used"` 或 `null`。订单为 `pending` 时显示「付款确认中」，`refunding` 时显示「退款处理中」，`review` 时显示「待运营核对」。

### 运营后台

沿用现有运营后台会话。默认接口前缀为 `/admin/api/tool-credits`。部署设置 `ROLLIERANK_ADMIN_PATH` 时，用配置后的后台路径拼接 `/api/tool-credits`。

| 方法和路径 | 请求和返回 |
| --- | --- |
| `GET /admin/api/tool-credits` | 可传 `accountId` 筛选。返回 `{ rules, groupApproved, directPurchaseReady, tokenRechargeReady, accounts, records }` |
| `POST /rules` | 传修改的分组字段，返回 `{ rules }`。分组为 `welcome`、`costs`、`invite`、`purchase`、`ads`。套餐数组按整组替换 |
| `POST /adjust` | `{ accountId, amount, reason, requestId }`。正数补发，负数扣回。原因必填。返回 `{ accountId, balance, held }` |
| `GET /purchases` | 可按账号编号或 UID 筛选最近 50 笔道具订单，附带钱包账号编号与微信单号 |
| `POST /purchases/<订单号>/confirm` | 传 `{}`，手动触发查单 |
| `POST /purchases/<订单号>/refund` | 传 `{ requestId, reason }`，指定微信退款原因代码 `"0"` 至 `"5"`，返回订单和退款单号 |
| `GET /recharges` | 可按账号编号或 UID 筛选最近 50 笔充值单，附带钱包账号、微信单号、支付环境和核对原因 `issue` |
| `POST /recharges/<订单号>/confirm` | 传 `{}`，手动触发充值或退款查单 |

```json
{
  "welcome": { "newAccount": 3, "existingMember": 3 },
  "costs": { "answer-sheet": 1 },
  "invite": { "enabled": false, "groups": false, "reward": 2, "monthlyLimit": 10, "registerDays": 7, "useDays": 7 },
  "purchase": {
    "directPurchase": false,
    "tokenRecharge": false,
    "packages": [
      { "credits": 1, "cents": 100 },
      { "credits": 5, "cents": 500 },
      { "credits": 10, "cents": 1000 },
      { "credits": 30, "cents": 3000 },
      { "credits": 60, "cents": 6000 }
    ]
  },
  "ads": { "enabled": false, "reward": 1, "dailyLimit": 2 }
}
```

`cents` 为人民币分，卷豆和用量用整数。查询最多返回 50 个最近账号和 50 条最近流水。规则修改和人工调整记录操作人。管理员可以在确认前预览赠豆能用几次，例如新人可扫张数取 `Math.floor(welcome.newAccount / costs["answer-sheet"])`。

一次人工调整生成一个 `requestId`，网络重试沿用相同 ID 和参数。每次调整最多 10000 颗，原因最多 200 字。已保存的请求重复提交只记一笔，复用请求 ID 改金额、账号或原因会返回 `409`。状态和流水以刷新后的服务端数据为准。

`tokenRechargeReady` 表示服务端具备当前环境的支付配置和卷豆数据库迁移。用 `purchase.tokenRecharge` 开关管理新充值，提交其他规则时只传改动字段。`directPurchaseReady` 和 `purchase.directPurchase` 用于道具直购。 [测试与部署](../deploy/README.md#微信代币充值)

### 错误与本机联调

| HTTP 状态 | 处理 |
| --- | --- |
| `400` | 校验输入。已选择关联旧资料时，核对资料凭证或正式回执 |
| `401`、`403` | 刷新登录或检查权限。邀请未开放时隐藏入口 |
| `402` / `balance` | 可用卷豆不足。扫描场景仍可手动录答 |
| `404` | 刷新账号、操作或工具定价 |
| `409` | 按返回的 `error` 更新界面。`quote` 表示价格变化 |
| `502`、`503` | 允许稍后重试。保持草稿和操作编号 |

接口错误返回 `{ error, errorId? }`。小程序、后台和工具分别按各自入口联调。

```sh
npm run verify -- feature tool-credits
node test/support/tool-credits-server.mjs 45719
```

第二条命令在 `http://127.0.0.1:45719` 启动一次性测试 API 和回环 PostgreSQL，需要安装 `initdb`、`pg_ctl` 和 `postgres`。它在本地把 `wallet-test-<身份>` 兑换为测试账号。更换 `visitorId` 并保留同一测试身份，可核对换设备后的余额。实际微信换码需要给对应服务配置 `ROLLIERANK_WECHAT_APP_ID` 和 `ROLLIERANK_WECHAT_APP_SECRET`。本地交易和流水通过真实 PostgreSQL 验证。

```sh
curl -s http://127.0.0.1:45719/api/tool-credits/login \
  -H 'Content-Type: application/json' \
  -d '{"code":"wallet-test-demo","visitorId":"local-device-1"}'
```
