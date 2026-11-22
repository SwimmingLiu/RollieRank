const credits = require("../../services/tool-credits.js");
const { createPageSheetDrag } = require("../../utils/sheet-gesture.js");

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
    packages: credits.formatPackages(),
    selectedPackIndex: 0,
    signedIn: false,
    uid: 0,
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
    this.reload();
  },

  onRefresherRefresh() {
    this.setData({ refreshing: true });
    this.reload().finally(() => this.setData({ refreshing: false }));
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
      const packages = cap.purchase?.packages?.length ? cap.purchase.packages : credits.formatPackages();
      const recommendedIdx = packages.findIndex((item) => item.recommended);
      const selectedPackIndex = recommendedIdx >= 0 ? recommendedIdx : 0;
      const purchaseReady = Boolean(cap.purchase?.directPurchase || cap.purchase?.tokenRecharge);

      if (!credits.hasSession()) {
        this.setData({
          loading: false,
          capabilities: cap,
          purchaseReady,
          packages,
          selectedPackIndex,
          signedIn: false,
          uid: 0,
          records: [],
          nextBefore: null,
          invite: null,
          sheet: "",
        });
        return;
      }

      const wallet = await credits.wallet(0);
      this.setData({
        loading: false,
        capabilities: cap,
        purchaseReady,
        packages,
        selectedPackIndex,
        signedIn: true,
        uid: wallet.uid || 0,
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
          uid: 0,
          balance: 0,
          held: 0,
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
      await this.reload();
    } catch (error) {
      const message = error?.message || "微信登录失败，请稍后重试。";
      const canSkipBind = bindLegacy && (error?.statusCode === 400 || error?.statusCode === 409);
      this.setData({ loginError: message, canSkipBind });
    } finally {
      this.setData({ loggingIn: false });
    }
  },

  selectPackage(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isInteger(index) && index >= 0 && index < this.data.packages.length) {
      this.setData({ selectedPackIndex: index });
    }
  },

  submitRecharge() {
    if (!this.data.purchaseReady) {
      wx.showToast({ title: "微信支付开通中，暂可先使用赠送卷豆", icon: "none" });
      return;
    }
    wx.showToast({ title: "请稍候，正在发起支付", icon: "none" });
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

  copyUid() {
    if (!this.data.uid) return;
    const text = String(this.data.uid);
    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: `已复制 UID ${text}`, icon: "success" });
      },
    });
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
