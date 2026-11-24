const credits = require("../../services/tool-credits.js");
const storage = require("../../utils/storage.js");
const { createPageSheetDrag } = require("../../utils/sheet-gesture.js");

const rechargeStatus = {
  closed: { kind: "info", title: "订单已关闭", message: "这笔订单已关闭，可重新选择档位充值。" },
  refund_pending: { kind: "pending", title: "订单退款中", message: "这笔充值正在退款，请留意微信到账通知。" },
  refunded: { kind: "info", title: "订单已退款", message: "这笔充值已原路退款。" },
  review: { kind: "pending", title: "充值待核对", message: "这笔充值正在核对中，请稍后查看到账明细。" },
};
const activeRecharges = new Set();
const CASHIER_RESUME_GRACE_MS = 500;

Page({
  data: {
    uiBase: "/assets/ui",
    loading: true,
    refreshing: false,
    error: "",
    loginError: "",
    capabilities: {
      login: false,
      invite: false,
      purchase: { directPurchase: false, tokenRecharge: false, packages: [] },
      ads: false,
    },
    purchaseReady: false,
    rechargeDeviceMessage: "",
    rechargeTestGuide: "",
    rechargeAction: "",
    rechargeDialog: null,
    rechargeOrder: null,
    packages: credits.formatPackages(),
    selectedPackIndex: 0,
    signedIn: false,
    balance: 0,
    held: 0,
    records: [],
    nextBefore: null,
    loadingMore: false,
    loggingIn: false,
    legacyEligible: false,
    bindLegacy: false,
    canSkipBind: false,
    invite: null,
    inviteLoading: false,
    sheet: "",
    sheetDragY: 0,
    sheetDragging: false,
    sheetClosing: false,
    sheetShadeOpacity: 1,
  },

  onLoad() {
    this.sheetDrag = createPageSheetDrag(this, {
      onDismiss: () => this.closeSheet(),
    });
  },

  onShow() {
    this.syncLegacyCandidate();
    if (this.resumeCashier) {
      this.resumeCashier();
      return;
    }
    if (!this.data.rechargeAction) return this.reloadAndResumeRecharge();
  },

  onUnload() {
    this.unloaded = true;
    clearTimeout(this.cashierResumeTimer);
    this.cashierResumeTimer = null;
    this.resumeCashier?.(true);
  },

  onRefresherRefresh() {
    if (this.data.rechargeAction) return;
    this.setData({ refreshing: true });
    return this.reloadAndResumeRecharge().finally(() => this.setData({ refreshing: false }));
  },

  async reloadAndResumeRecharge() {
    await this.reload();
    if (this.data.rechargeOrder) await this.submitRecharge();
  },

  syncLegacyCandidate() {
    const candidate = credits.legacyBindCandidate();
    this.setData({
      legacyEligible: candidate.eligible,
      bindLegacy: candidate.eligible,
      canSkipBind: false,
    });
  },

  async reload() {
    const isInitial = this.data.loading && !this.data.signedIn;
    if (isInitial) this.setData({ loading: true });
    this.setData({ error: "", loginError: "" });
    try {
      const cap = await credits.capabilities();
      const packages = cap.purchase.packages;
      const previousPack = this.data.signedIn ? this.data.packages[this.data.selectedPackIndex] : null;
      const previousIndex = packages.findIndex(item => item.credits === previousPack?.credits && item.cents === previousPack?.cents);
      const smallest = Math.min(...packages.map(item => item.credits));
      const selectedPackIndex = previousIndex >= 0 ? previousIndex : packages.findIndex(item => item.credits === smallest);
      const purchaseReady = cap.purchase.tokenRecharge;
      const device = purchaseReady ? credits.rechargeDevice(cap.purchase) : {};
      const rechargeDeviceMessage = device.message || "";
      const rechargeTestGuide = device.testGuide || "";

      if (!credits.hasSession()) {
        this.setData({
          loading: false,
          capabilities: cap,
          purchaseReady,
          rechargeDeviceMessage,
          rechargeTestGuide,
          rechargeDialog: null,
          rechargeOrder: null,
          packages,
          selectedPackIndex,
          signedIn: false,
          records: [],
          nextBefore: null,
          invite: null,
          sheet: "",
        });
        return;
      }

      const wallet = await credits.wallet(0);
      let pending = storage.toolCreditRecharge(wallet.accountId);
      if (!pending?.cashierStarted && !activeRecharges.has(wallet.accountId)) {
        const paid = await credits.paidRecharge().catch(() => null);
        if (this.unloaded || credits.accountId() !== wallet.accountId) return;
        pending = storage.toolCreditRecharge(wallet.accountId);
        if (paid && !pending?.cashierStarted && !activeRecharges.has(wallet.accountId)) {
          pending = { credits: paid.credits, cents: paid.cents, yuanText: `¥${paid.credits}`, orderId: paid.id,
            requestId: storage.uuid(), cashierStarted: true, paymentResult: "paid" };
          storage.setToolCreditRecharge(wallet.accountId, pending);
        }
      }
      const orderPackIndex = pending?.cashierStarted ? packages.findIndex(item => item.credits === pending.credits) : -1;
      this.setData({
        loading: false,
        capabilities: cap,
        purchaseReady,
        rechargeDeviceMessage,
        rechargeTestGuide,
        rechargeOrder: pending?.cashierStarted ? pending : null,
        packages,
        selectedPackIndex: orderPackIndex >= 0 ? orderPackIndex : selectedPackIndex,
        signedIn: true,
        balance: wallet.balance,
        held: wallet.held,
        records: wallet.records,
        nextBefore: wallet.nextBefore,
      });
    } catch (error) {
      if (error && error.statusCode === 401) {
        this.setData({
          loading: false,
          signedIn: false,
          balance: 0,
          held: 0,
          rechargeDialog: null,
          rechargeOrder: null,
          records: [],
          nextBefore: null,
          invite: null,
          sheet: "",
          loginError: "登录状态已过期，请重新登录微信账号。",
        });
        return;
      }
      this.setData({
        loading: false,
        error: error?.message || "读取卷豆信息失败，请稍后重试。",
      });
    }
  },

  toggleBindLegacy() {
    this.setData({
      bindLegacy: !this.data.bindLegacy,
      loginError: "",
      canSkipBind: false,
    });
  },

  async onLogin() {
    await this.performLogin(this.data.legacyEligible && this.data.bindLegacy);
  },

  async loginWithoutBind() {
    this.setData({ bindLegacy: false, canSkipBind: false });
    await this.performLogin(false);
  },

  async performLogin(bindLegacy) {
    if (this.data.loggingIn) return;
    this.setData({ loggingIn: true, loginError: "", canSkipBind: false });
    try {
      const result = await credits.login({ bindLegacy });
      wx.showToast({
        title: result.created && result.balance > 0 ? `已领 ${result.balance} 颗卷豆` : "登录成功",
        icon: "success",
      });
      await this.reloadAndResumeRecharge();
    } catch (error) {
      const message = error?.message || "微信登录失败，请稍后重试。";
      const canSkipBind = bindLegacy && (error?.statusCode === 400 || error?.statusCode === 409);
      this.setData({ loginError: message, canSkipBind });
    } finally {
      this.setData({ loggingIn: false });
    }
  },

  selectPackage(event) {
    if (this.data.rechargeAction || this.data.rechargeOrder) return;
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isInteger(index) && index >= 0 && index < this.data.packages.length) {
      this.setData({ selectedPackIndex: index });
    }
  },

  showRechargeDialog({
    kind = "error",
    title = "充值提示",
    message = "",
    detail = "",
    primaryText = "知道了",
    primaryAction = "close",
    secondaryText = "",
    secondaryAction = "",
  }) {
    this.setData({
      rechargeDialog: {
        kind,
        title,
        message,
        detail,
        primaryText,
        primaryAction,
        secondaryText,
        secondaryAction,
      },
    });
  },

  closeRechargeDialog() {
    if (!this.data.rechargeDialog) return;
    this.setData({ rechargeDialog: null });
  },

  noopDialog() {},

  onRechargeDialogPrimary() {
    const action = this.data.rechargeDialog?.primaryAction;
    this.setData({ rechargeDialog: null });
    if (action === "query") return this.submitRecharge();
  },

  onRechargeDialogSecondary() {
    const action = this.data.rechargeDialog?.secondaryAction;
    if (action === "cancel") {
      this.cancelPendingRecharge();
      return;
    }
    this.setData({ rechargeDialog: null });
  },

  cancelPendingRecharge() {
    if (this.data.rechargeAction || !this.data.rechargeOrder) return;
    const owner = credits.accountId();
    if (owner) storage.setToolCreditRecharge(owner, null);
    this.setData({ rechargeOrder: null, rechargeDialog: null });
  },

  async submitRecharge() {
    if (this.data.rechargeAction || !credits.hasSession()) return;
    const owner = credits.accountId();
    if (!owner) return;
    if (activeRecharges.has(owner)) {
      this.showRechargeDialog({
        kind: "pending",
        title: "充值处理中",
        message: "这笔充值正在处理，请稍后查询到账。",
      });
      return;
    }
    let pending = storage.toolCreditRecharge(owner);
    const pack = this.data.packages[this.data.selectedPackIndex];
    const device = pending?.cashierStarted ? null : credits.rechargeDevice(this.data.capabilities.purchase);
    if (this.data.purchaseReady && device?.testGuide) {
      const ios = device.testGuide === "ios";
      this.showRechargeDialog({
        kind: "info",
        title: ios ? "iPhone 充值说明" : "真机测试说明",
        message: ios
          ? "微信在 iPhone 上通过 Apple IAP 收款，只支持现网。小程序开通 Apple IAP 并发布后，可在 iPhone 上充值。"
          : "点击开发者工具顶部的「预览」，用手机微信扫码。iPhone 的充值需要在现网通过 Apple IAP 验证。",
      });
      return;
    }
    if (device && (!this.data.purchaseReady || device.message || !pack)) return;

    activeRecharges.add(owner);
    this.setData({ rechargeAction: pending?.cashierStarted ? "确认到账…" : "正在下单…", rechargeDialog: null });
    try {
      if (!pending?.cashierStarted) {
        // Persist the request and order before opening the cashier so a retry cannot charge twice.
        if (pending?.credits !== pack.credits || pending?.cents !== pack.cents) {
          pending = { credits: pack.credits, cents: pack.cents, yuanText: pack.yuanText, requestId: storage.uuid() };
          storage.setToolCreditRecharge(owner, pending);
        }
        const { order, payData } = await credits.createRecharge(pending, device.platform);
        if (!/^RC[a-f0-9]{30}$/.test(order?.id) || order.credits !== pack.credits || order.cents !== pack.cents) {
          throw new Error("充值订单校验失败，请重试。");
        }
        pending = { ...pending, orderId: order.id };
        storage.setToolCreditRecharge(owner, pending);
        if (this.unloaded || credits.accountId() !== owner) return;
        pending = { ...pending, cashierStarted: true };
        storage.setToolCreditRecharge(owner, pending);
        this.setData({ rechargeOrder: pending, rechargeAction: payData ? "等待微信支付…" : "确认到账…" });
        if (payData) {
          // 安卓微信支付退出时 onShow 常比 fail/success 回调先到达，留短暂缓冲避免吞掉真实 errCode/errMsg。
          const returned = new Promise(resolve => {
            this.resumeCashier = (immediate = false) => {
              clearTimeout(this.cashierResumeTimer);
              if (immediate) {
                resolve({ status: "unknown", errCode: null, errMsg: "" });
                return;
              }
              this.cashierResumeTimer = setTimeout(() => {
                this.cashierResumeTimer = null;
                resolve({ status: "unknown", errCode: null, errMsg: "" });
              }, CASHIER_RESUME_GRACE_MS);
            };
          });
          const outcome = await Promise.race([credits.payRecharge(payData, order), returned]);
          clearTimeout(this.cashierResumeTimer);
          this.cashierResumeTimer = null;
          this.resumeCashier = null;
          const paymentResult = typeof outcome === "string" ? outcome : (outcome?.status || "unknown");
          const paymentErrCode = typeof outcome === "object" && outcome !== null ? outcome.errCode ?? null : null;
          const paymentErrMsg = typeof outcome === "object" && outcome !== null ? outcome.errMsg || "" : "";
          pending = { ...pending, paymentResult, paymentErrCode, paymentErrMsg };
          storage.setToolCreditRecharge(owner, pending);
        }
      }
      if (!this.unloaded && credits.accountId() === owner) await this.checkRecharge(owner, pending);
    } catch (error) {
      if (this.unloaded) return;
      if (error?.errorId === "recharge-quote") {
        storage.setToolCreditRecharge(owner, null);
        await this.reload();
        this.showRechargeDialog({
          kind: "info",
          title: "档位已更新",
          message: "充值档位已更新，请重新选择后发起充值。",
        });
      } else if (error?.errorId === "recharge-signature") {
        storage.setToolCreditRecharge(owner, null);
        this.setData({ rechargeOrder: null });
        this.showRechargeDialog({
          kind: "error",
          title: "订单校验失败",
          message: error.message || "充值订单校验失败，请重试。",
        });
      } else if (!credits.hasSession()) {
        await this.reload();
      } else if (credits.accountId() === owner) {
        if (pending?.orderId && pending?.cashierStarted) {
          this.showRechargeDialog({
            kind: "pending",
            title: "暂未查到结果",
            message: "网络波动导致暂未获取到账结果，请稍后点击查询到账。",
            primaryText: "查询到账",
            primaryAction: "query",
            secondaryText: "稍后再看",
            secondaryAction: "close",
          });
        } else {
          this.showRechargeDialog({
            kind: "error",
            title: "暂时无法下单",
            message: error?.message || "暂时无法发起充值，请稍后重试。",
          });
        }
      }
    } finally {
      clearTimeout(this.cashierResumeTimer);
      this.cashierResumeTimer = null;
      this.resumeCashier = null;
      activeRecharges.delete(owner);
      if (!this.unloaded) this.setData({ rechargeAction: "" });
    }
  },

  async checkRecharge(owner, pending) {
    this.setData({ rechargeAction: "确认到账…" });
    let order = await credits.confirmRecharge(pending.orderId);
    if (pending.paymentResult === "paid" && ["pending", "paid"].includes(order?.state)) {
      await new Promise(resolve => setTimeout(resolve, 900));
      if (this.unloaded || credits.accountId() !== owner) return;
      order = await credits.confirmRecharge(pending.orderId);
    }
    if (this.unloaded || credits.accountId() !== owner) return;
    if (order?.id !== pending.orderId) throw new Error("暂未查到这笔充值。");
    if (order.state === "credited") {
      storage.setToolCreditRecharge(owner, null);
      this.setData({ rechargeOrder: null, rechargeDialog: null });
      await this.reload();
      wx.showToast({ title: `已到账 ${order.credits} 颗`, icon: "success" });
    } else if (rechargeStatus[order.state]) {
      storage.setToolCreditRecharge(owner, null);
      this.setData({ rechargeOrder: null });
      this.showRechargeDialog(rechargeStatus[order.state]);
    } else if (order.state === "pending" && pending.paymentResult === "cancelled") {
      storage.setToolCreditRecharge(owner, null);
      this.setData({ rechargeOrder: null, rechargeDialog: null });
      wx.showToast({ title: "已取消支付", icon: "none" });
    } else if (order.state === "pending" && pending.paymentResult === "failed") {
      storage.setToolCreditRecharge(owner, null);
      this.setData({ rechargeOrder: null });
      const info = credits.describeRechargeFailure(pending.paymentErrCode, pending.paymentErrMsg);
      this.showRechargeDialog({
        kind: "error",
        title: info.title,
        message: info.message,
        detail: info.detail,
      });
    } else if (order.state === "pending") {
      this.showRechargeDialog({
        kind: "pending",
        title: "确认到账中",
        message: order.wechatOrderMissing
          ? "暂未收到微信付款结果。如已付款请点查询到账，未付款可重新选择。"
          : "这笔充值正在核对到账状态，请稍后查询。",
        primaryText: "查询到账",
        primaryAction: "query",
        secondaryText: "重新选择",
        secondaryAction: "cancel",
      });
    } else {
      this.showRechargeDialog({
        kind: "pending",
        title: "确认到账中",
        message: "已收到付款通知，卷豆正在入账中，请稍后查询。",
        primaryText: "查询到账",
        primaryAction: "query",
        secondaryText: "稍后再看",
        secondaryAction: "close",
      });
    }
  },

  openLedger() {
    this._sheetScrollTop = 0;
    this.sheetDrag?.reset();
    this.setData({ sheet: "ledger" });
  },

  async openInvite() {
    this._sheetScrollTop = 0;
    this.sheetDrag?.reset();
    this.setData({ sheet: "invite" });
    if (!this.data.invite && !this.data.inviteLoading) {
      await this.loadInviteCode();
    }
  },

  closeSheet() {
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
    this.setData({ sheet: "" });
  },

  noopSheet() {},

  onSheetScroll(event) {
    this.sheetDrag?.onScroll(event);
  },

  startSheetDrag(event) {
    this.sheetDrag?.start(event);
  },

  moveSheetDrag(event) {
    this.sheetDrag?.move(event);
  },

  endSheetDrag(event) {
    this.sheetDrag?.end(event);
  },

  cancelSheetDrag() {
    this.sheetDrag?.cancel();
  },

  async loadMore() {
    if (this.data.loadingMore || this.data.nextBefore === null) return;
    this.setData({ loadingMore: true, error: "" });
    try {
      const page = await credits.wallet(this.data.nextBefore);
      this.setData({
        balance: page.balance,
        held: page.held,
        records: [...this.data.records, ...page.records],
        nextBefore: page.nextBefore,
      });
    } catch (error) {
      if (error && error.statusCode === 401) {
        this.setData({
          signedIn: false,
          sheet: "",
          records: [],
          nextBefore: null,
          loginError: "登录状态已过期，请重新登录微信账号。",
        });
      } else {
        wx.showToast({ title: error?.message || "加载更多失败，请重试", icon: "none" });
      }
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  async loadInviteCode() {
    if (this.data.inviteLoading) return;
    this.setData({ inviteLoading: true });
    try {
      const invite = await credits.makeInvite();
      this.setData({ invite });
    } catch (error) {
      if (error && error.statusCode === 401) {
        this.setData({ signedIn: false, sheet: "", invite: null, loginError: "登录状态已过期，请重新登录微信账号。" });
      } else {
        wx.showToast({ title: error?.message || "暂无法获取邀请码", icon: "none" });
      }
    } finally {
      this.setData({ inviteLoading: false });
    }
  },

  copyInviteCode() {
    if (!this.data.invite?.code) return;
    wx.setClipboardData({
      data: this.data.invite.code,
      success() {
        wx.showToast({ title: "已复制邀请码", icon: "success" });
      },
    });
  },

  onShareAppMessage() {
    if (this.data.capabilities.invite && this.data.invite?.code) {
      return {
        title: "来卷卷小榜一起估分，首次登录送 3 颗卷豆",
        path: `/pages/home/home?inviteCode=${encodeURIComponent(this.data.invite.code)}`,
      };
    }
    return {
      title: "卷卷小榜 · 选卷、估分与复盘",
      path: "/pages/home/home",
    };
  },
});
