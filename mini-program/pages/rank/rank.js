const api = require("../../services/api.js");
const cloudSync = require("../../services/cloud-sync.js");
const profile = require("../../services/profile.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");

const { ASSET } = require("../../config.js");
const catalog = require("../../utils/catalog.js");
const { placeLeaderboardRows } = require("../../utils/rank.js");
const { publisherName, subjectName, subjectId, LOGO } = catalog;

const SHORT_LABELS = { 政治理论: "政治", 常识判断: "常识", 言语理解: "言语", 数量关系: "数量", 判断推理: "判断", 资料分析: "资料" };

const SCOPES = [
  { key: "selected", name: "我的岗位", short: "本岗", icon: "rank-pin", activeIcon: "rank-pin-on" },
  { key: "nationwide", name: "全国", short: "全国", icon: "rank-globe", activeIcon: "rank-globe-on" },
  { key: "position", name: "其他岗位", short: "查岗", icon: "rank-search", activeIcon: "rank-search-on" },
];

function fallbackAvatarFor(seed) {
  const value = String(seed || "卷友");
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  return "/assets/avatars/rank-" + (hash % 8 + 1) + ".svg";
}

function resolveRowAvatar(row) {
  const remote = profile.authorAvatarUrl(row);
  if (remote) return remote;
  if (row.isMe) {
    const own = profile.avatarUrl();
    if (own) return own;
  }
  return fallbackAvatarFor(row.publicId || row.name);
}

function decorateRow(row, totalCount) {
  const fallbackAvatar = fallbackAvatarFor(row.publicId || row.name);
  const surpassedValue = Number(row.surpassedPercent || 0);
  const surpassed = format.percent(surpassedValue / 100);
  const showSurpass = totalCount > 1 && surpassedValue > 0;
  return {
    ...row,
    scoreText: format.scoreCard(row.value),
    surpassed,
    surpassedLabel: showSurpass ? "超越 " + surpassed : "",
    showSurpass,
    avatar: resolveRowAvatar(row),
    fallbackAvatar,
    badgeIcon: row.place === 1 ? "rank-crown" : row.place === 2 ? "rank-medal-2" : "rank-medal-3",
    surpassIcon: row.place === 2 ? "rank-surpass-silver" : row.place === 3 ? "rank-surpass-bronze" : "rank-surpass",
  };
}

Page({
  data: {
    loading: true,
    error: "",
    winners: [],
    otherRows: [],
    publisher: "",
    identity: "",
    logo: "",
    self: null,
    count: 0,
    scope: "nationwide",
    scopes: SCOPES,
    positionMode: "",
    scopeLabel: "",
    canLoadMore: false,
    dimension: "total",
    dimensions: [{ key: "total", label: "总分" }],
    hasWechatProfile: false,
    defaultAvatar: "/assets/avatars/rank-1.svg",
    profileSheetOpen: false,
  },

  onLoad(query) {
    this.attemptId = query.attemptId || "";
    this.versionId = decodeURIComponent(query.versionId || "");
    this.setData({
      hasWechatProfile: storage.hasWechatProfile(),
      defaultAvatar: profile.defaultAvatar(),
    });
    this.load();
  },

  async load() {
    this.setData({ loading: true, error: "" });
    try {
      await cloudSync.ensureSession();
      await cloudSync.syncPosition();
      let attempt = null;
      let version = null;
      if (this.attemptId) {
        const attempts = await api.sync([this.attemptId]);
        attempt = attempts[0];
        if (!attempt) throw new Error("这份成绩不在当前身份下。");
        this.versionId = attempt.versionId;
      }
      if (!this.versionId) throw new Error("缺少套卷参数，请回到选卷页查看。");
      try {
        version = (await api.catalog()).find(item => item.id === this.versionId) || null;
      } catch {
        // 目录读不到时退回答卷自带的字段。
      }
      if (!attempt && !version) throw new Error("没有找到这套卷的公开榜单。");
      const subjects = new Map();
      const sourceTypes = attempt?.report?.breakdown?.length
        ? attempt.report.breakdown.filter(type => type.maxCents > 0)
        : (version?.questionTypes || []).map(type => ({ id: type.id || type.name, name: type.name }));
      for (const type of sourceTypes) {
        const name = subjectName(type.name);
        const key = subjectId(type.id, type.name);
        subjects.set(key, { key, label: SHORT_LABELS[name] || name });
      }
      // 身份行只写项目、期数和卷号；机构单独显示在左侧，不再重复。
      const institution = attempt?.institution || version?.institution || "";
      const publisher = publisherName(institution);
      const fullIdentity = attempt
        ? catalog.attemptIdentity(version, attempt)
        : catalog.practiceIdentity(version);
      const identity = fullIdentity.split(" · ").slice(1).join(" · ") || catalog.versionTitle(version || {});
      this.sharePaperTitle = [publisher, identity].filter(Boolean).join(" ") || "行测同卷";
      wx.setNavigationBarTitle?.({ title: `${this.sharePaperTitle}同卷榜 · 卷卷小榜` });
      this.setData({
        publisher,
        logo: ASSET[LOGO[institution]] || "",
        identity,
        dimensions: [{ key: "total", label: "总分" }, ...subjects.values()],
      });
      this.setData({ scope: storage.position()?.id ? "selected" : "nationwide" });
      await this.fetchRanking();
      this.loaded = true;
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  // 榜单范围与题型维度都由服务端按同一答案版本计算，前端只做展示。
  async fetchRanking(more = false) {
    const request = (this.rankingRequest || 0) + 1;
    this.rankingRequest = request;
    const { scope, dimension } = this.data;
    const query = [
      `versionId=${encodeURIComponent(this.versionId)}`,
      `guestId=${encodeURIComponent(storage.guestId())}`,
      `scope=${scope}`,
      `dimension=${encodeURIComponent(dimension)}`,
      `page=${more ? this.rankPage + 1 : 1}`,
      ...(scope === "position" ? ["positionId=" + encodeURIComponent(this.browsingPosition.id)] : []),
    ].join("&");
    try {
      const result = await api.request(`positions/leaderboard?${query}`);
      if (request !== this.rankingRequest) return;
      this.rankPage = result.page;
      const totalCount = result.count || 0;
      // 同分会共享服务端名次，纸卡和后续列表使用实际排序位置。
      const rows = placeLeaderboardRows(result).map(row => decorateRow(row, totalCount));
      const position = result.position;
      const winners = more ? this.data.winners : rows.slice(0, 3);
      const otherRows = more ? [...this.data.otherRows, ...rows] : rows.slice(3);
      const selfVisible = winners.some(row => row.isMe) || otherRows.some(row => row.isMe);
      const selfRow = result.self && !selfVisible
        ? {
            ...decorateRow({ ...result.self, isMe: true }, totalCount),
            placeText: String(result.self.rank || "").padStart(2, "0"),
          }
        : null;
      this.setData({
        loading: false,
        error: "",
        scope: scope === "selected" && !position ? "nationwide" : scope,
        dimension: result.dimension || dimension,
        winners,
        otherRows,
        self: selfRow,
        count: totalCount,
        scopeLabel: position ? position.label || [position.department, position.title].filter(Boolean).join(" · ") : "全国考生",
        canLoadMore: result.page < result.pages,
      });
    } catch (error) {
      if (request === this.rankingRequest) this.setData({ loading: false, error: error.message });
    }
  },

  setScope(event) {
    const { key } = event.currentTarget.dataset;
    if (key === "position" || (key === "selected" && !storage.position()?.id)) {
      this.setData({ positionMode: key === "position" ? "browse" : "select" });
      return;
    }
    this.setData({ scope: key });
    this.fetchRanking();
  },

  setDimension(event) {
    const { key } = event.currentTarget.dataset;
    if (key === this.data.dimension) return;
    this.setData({ dimension: key });
    this.fetchRanking();
  },

  loadMore() {
    if (this.data.canLoadMore) this.fetchRanking(true);
  },

  changePosition() {
    if (this.data.scope === "nationwide") return;
    this.setData({ positionMode: this.data.scope === "position" ? "browse" : "select" });
  },

  closePosition() {
    this.setData({ positionMode: "" });
  },

  selectPosition(event) {
    const { position } = event.detail;
    const browsing = this.data.positionMode === "browse";
    if (browsing) this.browsingPosition = position;
    this.setData({ positionMode: "", scope: !position ? "nationwide" : browsing ? "position" : "selected" });
    this.fetchRanking();
  },

  help() {
    wx.showModal({
      title: "同卷榜规则",
      content: "交卷后上榜，每人只取本卷最好成绩。\n同分并列，先交卷的排在前面。",
      showCancel: false,
    });
  },

  openResult(event) {
    // 公开详情只显示昵称与分数，别人的答案不会公开。
    const id = event.detail?.publicId || event.currentTarget?.dataset?.id;
    if (!id) return;
    const { scope } = this.data;
    const positionId = scope === "position" ? "&positionId=" + encodeURIComponent(this.browsingPosition.id) : "";
    wx.navigateTo({ url: `/pages/report/report?publicId=${id}&paperId=${encodeURIComponent(this.versionId)}&scope=${scope}${positionId}` });
  },

  openProfileSheet() {
    this.setData({ profileSheetOpen: true });
  },

  closeProfileSheet() {
    this.setData({ profileSheetOpen: false });
  },

  onProfileSaved() {
    this.setData({
      profileSheetOpen: false,
      hasWechatProfile: storage.hasWechatProfile(),
    });
    if (this.versionId) this.fetchRanking();
  },

  onShow() {
    const hasWechatProfile = storage.hasWechatProfile();
    if (hasWechatProfile !== this.data.hasWechatProfile) {
      this.setData({ hasWechatProfile });
    }
    if (this.loaded && this.versionId) this.fetchRanking();
  },

  onShareAppMessage() {
    const shareUtil = require("../../utils/share.js");
    const label = this.sharePaperTitle || "行测同卷";
    const countText = this.data.count > 0 ? `（已有${this.data.count}人交卷）` : "";
    const path = this.versionId
      ? `/pages/rank/rank?versionId=${encodeURIComponent(this.versionId)}`
      : "/pages/home/home";
    return {
      title: `${label}同卷排行榜${countText} · 卷卷小榜`,
      path: shareUtil.withReferralPath(path),
      imageUrl: ASSET.logo,
    };
  },

  onShareTimeline() {
    const shareUtil = require("../../utils/share.js");
    const label = this.sharePaperTitle || "行测同卷";
    return {
      title: `${label}估分同卷榜 · 卷卷小榜`,
      query: shareUtil.withReferralQuery(this.versionId ? `versionId=${encodeURIComponent(this.versionId)}` : ""),
      imageUrl: ASSET.logo,
    };
  },
});
