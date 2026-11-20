const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");

const FIELDS = { source: "sourceId", category: "categoryId", department: "departmentId", unit: "unitId" };
const EXAMS = [{ key: "guokao", label: "国考" }, { key: "shengkao", label: "省考" }];

Component({
  options: { styleIsolation: "apply-shared" },
  properties: { mode: { type: String, value: "select" } },
  data: {
    exams: EXAMS, exam: "guokao", level: "source", breadcrumbs: [],
    options: [], page: 1, pages: 1, keyword: "", searchable: false,
    loading: true, error: "", emptyText: "", detail: null, selectedId: "", saving: false,
    uiBase: "/assets/ui",
  },

  lifetimes: {
    attached() {
      this.sequence = 0;
      this.path = {};
      const saved = storage.position();
      if (saved && this.data.mode === "select") this.path = { positionId: saved.id };
      this.setData({ selectedId: saved?.id || "", exam: saved?.exam || "guokao" });
      this.load();
    },
    detached() {
      clearTimeout(this.searchTimer);
      this.sequence += 1;
    },
  },

  methods: {
    async load(more = false) {
      clearTimeout(this.searchTimer);
      const sequence = ++this.sequence;
      const keyword = this.data.keyword.trim();
      this.setData({ loading: true, error: "" });
      try {
        if (!Object.keys(this.path).length) {
          const { sources } = await api.request("positions/catalog?pageSize=1");
          if (sequence !== this.sequence) return;
          const matches = sources.filter(source => source.exam === this.data.exam);
          const options = matches
            .filter(source => !keyword || `${source.year} ${source.region} ${source.label}`.includes(keyword))
            .map(source => ({ id: source.id, label: `${source.year}年 · ${source.region}` }));
          this.setData({
            options, level: "source", breadcrumbs: [], page: 1, pages: 1,
            searchable: matches.length > 10 || Boolean(keyword),
            emptyText: matches.length ? "没有匹配的目录" : this.data.exam === "shengkao" ? "暂无省考岗位目录" : "暂无国考岗位目录",
            loading: false,
          });
          return;
        }
        const next = { ...this.path, pageSize: 40 };
        if (keyword) next.q = keyword;
        if (!next.positionId) next.page = more ? this.data.page + 1 : 1;
        const query = Object.entries(next).map(([key, value]) => key + "=" + encodeURIComponent(value)).join("&");
        const result = await api.request("positions/hierarchy?" + query);
        if (sequence !== this.sequence) return;
        this.path = this.pathFrom(result.breadcrumbs);
        if (!keyword && result.autoAdvance && FIELDS[result.level]) {
          this.path[FIELDS[result.level]] = result.options[0].id;
          await this.load();
          return;
        }
        const source = result.source;
        const breadcrumbs = result.breadcrumbs
          .filter(crumb => crumb.level !== "position")
          .map(crumb => crumb.level === "source" ? { ...crumb, label: `${source.year}年 · ${source.region}` } : crumb);
        const additions = result.options.map(option => ({
          ...option,
          label: option.label || (result.level === "category" ? "直接选择招录部门" : "未分单位"),
        }));
        this.source = source;
        this.setData({
          level: result.level, exam: source?.exam || this.data.exam, breadcrumbs,
          options: more ? [...this.data.options, ...additions] : additions,
          page: result.page, pages: result.pages, loading: false,
          searchable: result.total > 10 || Boolean(keyword) || (this.data.level === result.level && this.data.searchable),
          emptyText: "没有匹配的岗位",
        });
      } catch (error) {
        if (sequence !== this.sequence) return;
        if (error.statusCode === 404 && this.path.positionId) {
          this.path = {};
          await this.load();
          return;
        }
        this.setData({ loading: false, error: error.message });
      }
    },

    pathFrom(crumbs) {
      return Object.fromEntries(crumbs.filter(crumb => FIELDS[crumb.level]).map(crumb => [FIELDS[crumb.level], crumb.id]));
    },

    reset(path, patch = {}) {
      this.path = path;
      this.setData({ options: [], keyword: "", searchable: false, ...patch });
      this.load();
    },

    chooseExam(event) {
      const exam = event.currentTarget.dataset.exam;
      if (!this.data.saving && exam !== this.data.exam) this.reset({}, { exam, detail: null });
    },

    choose(event) {
      if (this.data.loading || this.data.saving) return;
      const option = this.data.options.find(item => item.id === event.currentTarget.dataset.id);
      if (!option) return;
      if (option.position) {
        this.setData({ detail: option.position });
      } else {
        this.reset({ ...this.path, [FIELDS[this.data.level]]: option.id });
      }
    },

    goCrumb(event) {
      const depth = Number(event.currentTarget.dataset.index);
      this.reset(this.pathFrom(this.data.breadcrumbs.slice(0, depth)));
    },

    onKeyword(event) {
      this.setData({ keyword: event.detail.value });
      this.sequence += 1;
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.load(), 250);
    },

    search() { this.load(); },
    clearSearch() { this.setData({ keyword: "" }); this.load(); },
    loadMore() { if (!this.data.loading && this.data.page < this.data.pages) this.load(true); },
    closeDetail() { if (!this.data.saving) this.setData({ detail: null }); },
    ignoreTouch() {},

    dismiss() {
      if (!this.data.saving) this.triggerEvent("dismiss");
    },

    async select() {
      const position = this.data.detail;
      if (!position || this.data.saving) return;
      if (this.data.mode === "browse") {
        this.triggerEvent("selection", { position });
        return;
      }
      await this.saveSelection(position.id);
    },

    clear() {
      wx.showModal({
        title: "清除当前岗位？",
        confirmText: "清除",
        success: result => { if (result.confirm) this.saveSelection(null); },
      });
    },

    async saveSelection(positionId) {
      if (this.data.saving) return;
      this.setData({ saving: true });
      try {
        const { position } = await api.request("positions/selection", { guestId: storage.guestId(), positionId });
        const selection = position ? { id: position.id, label: [position.department, position.title].filter(Boolean).join(" · "), exam: position.exam } : null;
        storage.setPosition(selection);
        this.setData({ saving: false, selectedId: selection?.id || "" });
        this.triggerEvent("selection", { position: selection });
        wx.showToast({ title: selection ? "岗位已保存" : "已清除选岗", icon: "none" });
      } catch (error) {
        this.setData({ saving: false });
        wx.showToast({ title: error.message, icon: "none" });
      }
    },

    copySource() {
      if (this.source?.sourcePage) wx.setClipboardData({ data: this.source.sourcePage });
    },
  },
});
