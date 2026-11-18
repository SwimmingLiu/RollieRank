const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");
const { ASSET } = require("../../config.js");

Page({
  data: {
    institution: "",
    displayName: "",
    loading: true,
    error: "",
    logo: "",
    projects: [],
    activeProject: 0,
    asset: ASSET,
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    const institution = decodeURIComponent(query.institution || "");
    this.setData({ institution, displayName: catalogUtil.displayName(institution) });
    this.load();
  },

  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh());
  },

  async load(force) {
    this.setData({ loading: !this.data.projects.length, error: "" });
    try {
      const versions = await api.catalog(force);
      const group = catalogUtil.groupByInstitution(versions).find(g => g.name === this.data.institution);
      if (!group) throw new Error("没有找到这个机构的已发布套卷。");
      // 每张卷卡显示本机真实状态：草稿、已提交或可开始。
      const history = storage.history();
      const drafts = storage.draftIndex();
      const projects = group.projects.map((project, index) => ({
        ...project,
        label: [project.project, project.period, project.variant].filter(Boolean).join(" · "),
        isActive: index === 0,
        versions: project.versions.map(version => {
          const draft = drafts[version.id] || null;
          const best = storage.bestAttempt(version.id);
          const answered = draft ? draft.answered || 0 : 0;
          return {
            id: version.id,
            number: version.number,
            numberLabel: version.number ? `${String(version.number).padStart(2, "0")}套` : "",
            logo: catalogUtil.LOGO[version.institution] || null,
            title: catalogUtil.versionTitle(version),
            questionCount: version.questionCount,
            draftAnswered: answered,
            submitted: Boolean(best),
            action: best ? "看成绩" : answered ? "继续录入" : "开始",
            actionType: best ? "report" : "practice",
            bestId: best ? best.id : "",
            draftId: draft ? draft.id : "",
            bestScore: best ? (best.totalCents / 100).toFixed(2) : "",
          };
        }),
      }));
      this.setData({ projects, loading: false, logo: group.logo || "" });
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  retry() {
    this.load(true);
  },

  switchProject(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (index !== this.data.activeProject) this.setData({ activeProject: index });
  },

  openPaper(event) {
    const { id, action } = event.currentTarget.dataset;
    const paper = this.data.projects.flatMap(p => p.versions).find(v => v.id === id);
    if (action === "report" && paper && paper.bestId) {
      wx.navigateTo({ url: `/pages/report/report?attemptId=${paper.bestId}` });
      return;
    }
    // 继续录入沿用原答卷标识，交卷后仍是同一次练习。
    const draft = paper && paper.draftId ? `&attemptId=${paper.draftId}` : "";
    wx.navigateTo({ url: `/pages/practice/practice?versionId=${id}${draft}` });
  },
});
