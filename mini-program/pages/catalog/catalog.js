const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");
const { scoreCard: formatScore } = require("../../utils/format.js");

Page({
  data: {
    institution: "",
    publisher: "",
    projectsOpen: false,
    loading: true,
    error: "",
    projects: [],
    projectOptions: [],
    activeProject: 0,
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    const institution = decodeURIComponent(query.institution || "");
    this.setData({ institution, publisher: catalogUtil.publisherName(institution) });
    this.load();
  },

  onShow() {
    if (this.data.projects.length) this.load();
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
      const drafts = storage.draftIndex();
      const projects = group.projects.map(project => ({
        ...project,
        title: [project.project.split(" · ")[0], catalogUtil.periodLabel(project.period),
          project.variant === "副省级" ? project.variant : ""].filter(Boolean).join(" · "),
        versions: project.versions.map(version => {
          const draft = drafts[version.id] || null;
          const best = storage.bestAttempt(version.id);
          const answered = draft ? draft.answered || 0 : 0;
          return {
            id: version.id,
            number: catalogUtil.numberedPaper(version) ? version.number : 0,
            numberText: catalogUtil.numberedPaper(version) ? String(version.number).padStart(2, "0") : catalogUtil.versionTitle(version),
            questionCount: version.questionCount,
            draftAnswered: answered,
            submitted: Boolean(best),
            state: best ? "complete" : answered ? "draft" : "new",
            progress: answered / version.questionCount * 100,
            actionType: best ? "report" : "practice",
            bestId: best ? best.id : "",
            draftId: draft ? draft.id : "",
            bestScore: best ? formatScore(best.totalCents) : "",
          };
        }),
      }));
      const savedKey = getApp().globalData.catalogSelection?.[this.data.institution];
      const defaultProject = projects.findIndex(project => catalogUtil.periodLabel(project.period) === "第1期");
      const savedProject = projects.findIndex(project => project.key === savedKey);
      const activeProject = savedProject >= 0 ? savedProject : Math.max(0, defaultProject);
      this.setData({ projects, projectOptions: projects.map(({ key, title }) => ({ key, label: title })), loading: false, activeProject });
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  retry() {
    this.load(true);
  },

  openProjects() {
    this.setData({ projectsOpen: true });
  },

  closeProjects() {
    this.setData({ projectsOpen: false });
  },

  switchProject(event) {
    const index = this.data.projects.findIndex(project => project.key === event.detail.key);
    const selected = this.data.projects[index];
    if (!selected) return;
    const data = getApp().globalData;
    data.catalogSelection = { ...data.catalogSelection, [this.data.institution]: selected.key };
    this.setData({ activeProject: index, projectsOpen: false });
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
