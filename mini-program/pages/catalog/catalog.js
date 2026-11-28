const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");
const { ASSET } = require("../../config.js");
const { scoreCard: formatScore } = require("../../utils/format.js");

Page({
  data: {
    institution: "",
    publisher: "",
    projectsOpen: false,
    loading: true,
    refreshing: false,
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

  onRefresherRefresh() {
    this.setData({ refreshing: true });
    this.load(true).finally(() => this.setData({ refreshing: false }));
  },

  async load(force) {
    this.setData({ loading: !this.data.projects.length, error: "" });
    try {
      const versions = await api.catalog(force);
      const groups = catalogUtil.groupByInstitution(versions);
      const group = (this.data.institution
        ? groups.find(g => g.name === this.data.institution)
        : groups[0]) || null;
      if (!group) throw new Error("没有找到这个机构的已发布套卷。");
      if (!this.data.institution) {
        this.setData({ institution: group.name, publisher: catalogUtil.publisherName(group.name) });
      }
      const publisher = catalogUtil.publisherName(group.name);
      wx.setNavigationBarTitle?.({ title: `${publisher}行测估分套卷 · 卷卷小榜` });
      // 每张卷卡显示本机真实状态：草稿、已提交或可开始。
      const drafts = storage.draftIndex();
      const projects = group.projects.map(project => {
        const versions = project.versions.map(version => {
          const draft = drafts[version.id] || null;
          const best = storage.bestAttempt(version.id);
          const answered = draft ? draft.answered || 0 : 0;
          const card = catalogUtil.paperCardParts(version);
          return {
            id: version.id,
            number: card.numeric ? version.number || 1 : 0,
            numberText: card.primary,
            unitText: card.unit,
            questionCount: version.questionCount,
            timeLimitMinutes: Number(version.timeLimitMinutes) > 0 ? Math.round(Number(version.timeLimitMinutes)) : 0,
            draftAnswered: answered,
            submitted: Boolean(best),
            state: best ? "complete" : answered ? "draft" : "new",
            progress: answered / version.questionCount * 100,
            actionType: best ? "report" : "practice",
            bestId: best ? best.id : "",
            draftId: draft ? draft.id : "",
            bestScore: best ? formatScore(best.totalCents) : "",
          };
        });
        const counts = new Set(versions.map(v => v.questionCount).filter(Boolean));
        const mins = new Set(versions.map(v => v.timeLimitMinutes).filter(Boolean));
        const doneCount = versions.filter(v => v.submitted).length;
        const metaParts = [`共 ${versions.length} 套`];
        if (counts.size === 1) metaParts.push(`${[...counts][0]}题`);
        if (mins.size === 1) metaParts.push(`${[...mins][0]}分钟`);
        return {
          ...project,
          title: catalogUtil.projectTitle(project, group.projects),
          metaText: metaParts.join(" · "),
          doneCount,
          doneProgress: versions.length ? Math.round(doneCount / versions.length * 100) : 0,
          versions,
        };
      });
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

  onShareAppMessage() {
    const shareUtil = require("../../utils/share.js");
    const publisher = this.data.publisher || "行测模考";
    const institution = this.data.institution ? `?institution=${encodeURIComponent(this.data.institution)}` : "";
    return {
      title: `${publisher}行测模考估分与同卷排名 · 卷卷小榜`,
      path: shareUtil.withReferralPath(`/pages/catalog/catalog${institution}`),
      imageUrl: ASSET.logo,
    };
  },

  onShareTimeline() {
    const shareUtil = require("../../utils/share.js");
    const publisher = this.data.publisher || "行测模考";
    const query = this.data.institution ? `institution=${encodeURIComponent(this.data.institution)}` : "";
    return {
      title: `${publisher}行测估分套卷目录 · 卷卷小榜`,
      query: shareUtil.withReferralQuery(query),
      imageUrl: ASSET.logo,
    };
  },
});
