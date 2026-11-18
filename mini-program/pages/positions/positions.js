const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");

Page({
  data: {
    loading: true,
    error: "",
    items: [],
    total: 0,
    page: 1,
    pages: 1,
    keyword: "",
    facets: null,
    exam: "",
    region: "",
    current: null,
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    this.from = query.from || "";
    this.load(1);
  },

  async load(page) {
    this.setData({ loading: true, error: "" });
    try {
      const params = [`page=${page}`, "pageSize=20"];
      if (this.data.keyword.trim()) params.push(`q=${encodeURIComponent(this.data.keyword.trim())}`);
      if (this.data.exam) params.push(`exam=${encodeURIComponent(this.data.exam)}`);
      if (this.data.region) params.push(`region=${encodeURIComponent(this.data.region)}`);
      const result = await api.request(`positions/catalog?${params.join("&")}`);
      const saved = storage.position();
      this.setData({
        current: saved ? { id: saved.id, label: saved.label || saved.title } : null,
        loading: false,
        items: (result.items || []).map(item => ({
          id: item.id,
          code: item.code,
          department: item.department,
          title: item.title,
          location: item.location,
          exam: item.exam,
          category: item.examCategory || item.category || "",
          selected: saved ? saved.id === item.id : false,
        examLabel: item.exam === "guokao" ? "国考" : item.exam === "shengkao" ? "省考" : (item.exam || ""),
        })),
        total: result.total || 0,
        page: result.page || page,
        pages: result.pages || 1,
        facets: result.facets || null,
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  retry() {
    this.load(this.data.page || 1);
  },

  onKeyword(event) {
    this.setData({ keyword: event.detail.value });
  },

  search() {
    this.load(1);
  },

  chooseExam(event) {
    const { exam } = event.currentTarget.dataset;
    this.setData({ exam: exam === this.data.exam ? "" : exam });
    this.load(1);
  },

  chooseRegion(event) {
    const { region } = event.currentTarget.dataset;
    this.setData({ region: region === this.data.region ? "" : region });
    this.load(1);
  },

  prevPage() {
    if (this.data.page > 1) this.load(this.data.page - 1);
  },

  nextPage() {
    if (this.data.page < this.data.pages) this.load(this.data.page + 1);
  },

  async select(event) {
    const { id, title } = event.currentTarget.dataset;
    wx.showLoading({ title: "正在保存", mask: true });
    try {
      const profile = await api.request("positions/selection", { guestId: storage.guestId(), positionId: id });
      const position = profile && profile.position ? profile.position : { id, title };
      // 只在本机保存岗位选择，排行榜按该岗位分组，不上传其他个人信息。
      storage.setPosition({ id, label: title, title, selectedAt: Date.now() });
      wx.hideLoading();
      wx.showToast({ title: "已选岗", icon: "success" });
      if (this.from) wx.navigateBack();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async clear() {
    try {
      await api.request("positions/selection", { guestId: storage.guestId(), positionId: null });
    } catch {
      // 服务端离线时仍按本机选择处理。
    }
    storage.setPosition(null);
    this.load(this.data.page);
    wx.showToast({ title: "已取消选岗", icon: "none" });
  },
});
