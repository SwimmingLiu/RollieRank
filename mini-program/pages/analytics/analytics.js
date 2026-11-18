const storage = require("../../utils/storage");
const format = require("../../utils/format");

// 成长只按真实历史汇总：每份成绩用自己的得分／满分，空记录不产生百分比。
Page({
  data: {
    loading: true,
    hasData: false,
    points: [],
    trendText: "",
    trendUp: null,
    averageText: "--",
    subjects: [],
    uiBase: "/assets/ui",
  },

  onLoad() {
    this.build();
  },

  onShow() {
    this.build();
  },

  build() {
    const records = storage.history()
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!records.length) {
      this.setData({ loading: false, hasData: false });
      return;
    }
    const points = records.map(record => ({
      id: record.id,
      dateText: format.dateTime(record.createdAt).slice(5),
      label: record.title,
      score: format.score(record.totalCents),
      rate: record.maxCents ? record.totalCents / record.maxCents : 0,
      pct: format.rate(record.maxCents ? record.totalCents / record.maxCents : 0),
    }));
    // 前后两次都用得分率比较，跨机构、跨题量也能一致。
    const last = points[points.length - 1];
    const previous = points.length > 1 ? points[points.length - 2] : null;
    const delta = previous ? Math.round((last.rate - previous.rate) * 1000) / 10 : null;
    const average = points.reduce((sum, point) => sum + point.rate, 0) / points.length;

    // 题型趋势：同一题型用各卷满分加权，避免不同板块满分不同时被平均失真。
    const buckets = new Map();
    for (const record of records) {
      if (!Array.isArray(record.subjects)) continue;
      for (const subject of record.subjects) {
        if (!buckets.has(subject.name)) buckets.set(subject.name, { name: subject.name, earned: 0, max: 0, count: 0 });
        const bucket = buckets.get(subject.name);
        bucket.earned += subject.centsEarned || 0;
        bucket.max += subject.maxCents || 0;
        bucket.count += 1;
      }
    }
    const subjects = [...buckets.values()].map(bucket => ({
      name: bucket.name,
      pct: bucket.max ? format.rate(bucket.earned / bucket.max) : 0,
      detail: bucket.max ? `${format.score(bucket.earned)} / ${format.score(bucket.max)}` : "--",
    })).sort((a, b) => b.pct - a.pct);

    this.setData({
      loading: false,
      hasData: true,
      points,
      trendText: delta === null ? "还没有可比的上一次" : `较上一次 ${delta >= 0 ? "+" : ""}${delta}%`,
      trendUp: delta === null ? null : delta >= 0,
      averageText: format.percent(average),
      subjects,
    });
  },

  openRecord(event) {
    wx.navigateTo({ url: `/pages/report/report?attemptId=${event.currentTarget.dataset.id}` });
  },
});
