# 卷豆账号和账本

## Sub-features

微信换码、首次赠送、可核实的旧游客身份绑定、余额与流水、工具独立定价、并发占用、结算和释放、人工调整、渠道受控的邀请归因与奖励、微信道具直购和代币充值。

## How to get to it (user POV)

小程序通过「个人中心 / 练习记录（`pages/records/records`）-> 我的卷豆（`pages/credits/credits`）」直接进入，服务层位于 `mini-program/services/tool-credits.js`，调用 `/api/tool-credits/capabilities`、`/api/tool-credits/login`、`/api/tool-credits/wallet`、`/api/tool-credits/quote`、`/api/tool-credits/logout`、`/api/tool-credits/invite/code` 与 `/api/tool-credits/invite/visit`。正式交卷（`mini-program/services/api.js`）在存在本机卷豆 token 时自动附带 `Authorization: Bearer <token>`。

运营后台通过侧边栏「卷豆」（`/admin/#credits`，实现位于 `admin/src/components/ToolCreditsView.tsx`）进入，使用 `/admin/api/tool-credits` 下的查询、规则和调整接口以及现有管理员会话。参数和状态写在[产品与前端对接方案](../../../../docs/solution-tool-credits.md#前端对接)。

付费工具从服务端取得 `billing` 并调用占用、结算与释放方法。普通交卷沿用原入口，受邀账号可附带登录 token 记录首次有效提交。

在原生「个人中心 → 卷豆」选择套餐并点「立即充值」。小程序通过 `/api/tool-credits/recharges` 下单，使用微信收银台付款，再查询服务器订单。余额卡的「到账明细」展示入账和使用流水。后台用卷豆规则开启充值，可查订单和触发复查。

## Driving it with verification CLI

运行 `npm run verify -- feature tool-credits`。需要 PostgreSQL 的 `initdb`、`pg_ctl` 和 `postgres`。Node 自行启动隔离回环 PostgreSQL 及 HTTP 服务，使用随机测试 schema。微信登录和群渠道的远端响应使用可控替身。两条独立进程竞争同一个真实账本中的最后一颗卷豆。

- 登录两次，核对同一账号编号、余额为 3 和一条赠送流水。使用旧资料凭证验证首次绑定。
- 在已有会话和迁移记录的 schema 并发执行两次迁移。核对原记录和新卷豆表。检查测试服务拒绝生产 schema。
- 对照最后一颗卷豆的并发结果、相同业务单重试、失败释放、超时后迟到结果、价格修改前后的结算。
- 用管理员会话改规则、补发和扣回。对照用户余额、后台原因和操作人，确认运营积分独立。
- 用已校验群凭证模拟多次邀请、首次正式交卷、已结算工具的有效使用和月上限。核对伪造场景、过期重放及跨账号复用无法领奖。
- 模拟微信虚拟支付的签名响应，验证道具价格、账号绑定、无凭证推送拒绝、确认后仅产生一次可用权益。核对失败释放、已用订单退款拒绝、原路退款受理冻结、成功撤回及失败解冻。
- 通过 HTTP 下单并验签，核对卷豆 1 元 1 颗及沙箱、现网密钥分离。让确认请求与微信推送并发到达，核对重复交易、错误价格、账号和跨环境通知均无法多入账。模拟代币扣减回包丢失和会话过期，换码复查后在 `/wallet` 读取唯一的 `purchase` 流水。确认充值卷豆可参与原有工具占用、结算和退款对账。
- 驱动原生 `submitRecharge`，使用模拟 `wx.requestVirtualPayment` 和隔离 HTTP、PostgreSQL。核对双点、取消、下单回包丢失、返回页面后的原订单恢复、过期会话换码和测试包拒绝现网支付参数。确认到账后通过现有明细入口读取新增流水。
- 通过真实 Playwright 驱动 `/admin/#credits` 校验账号列表、流水明细、规则与可扫张数实时试算预览、人工补发/扣回与账号筛选，并保留 `test-results/verification/visual/tool-credits/` 原始分辨率截图。
- 驱动小程序 `services/tool-credits.js` 与 `services/api.js` 对接真实钱包服务，并检验 `pages/credits/credits` 与 `pages/records/records` 卷豆入口在 320/390/430 宽度的视觉布局与无溢出。

输出包含 `tool-credits.log`、`results.json` 和 `source-lock.json`。CI 保留专项和全量结果。

共享测试站部署后运行 `node scripts/verify-test-wallet.mjs https://rollie-rank-test.swimmingliu.cn --login-ready --recharge-ready`。它只读核对沙箱开关、固定兑换比例、充值和钱包入口的鉴权、测试 PG 中的用量及网页口令。

## Gotchas

真实微信登录需要对应环境的 AppID 和服务端密钥。开发者工具中确认「到账明细」可开关，模拟 iPhone 时点击「iPhone 充值说明」查看 Apple IAP 条件。布局代理在 320、390、430 检查套餐、状态和底栏。微信支付沙箱使用支持该模式的微信真机。iPhone 支付和到账在开通 Apple IAP 的现网正式版验证。群活动审批、群入口校验器和激励视频需对应平台能力。答题卡定位由识别专项验证。
