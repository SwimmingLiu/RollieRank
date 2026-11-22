import {
  icon,
  esc,
  score,
  pct,
  date,
  button,
  routeLink,
  progress,
  empty,
  sectionHead,
} from "./ui.js";
import { unique } from "./views-home.js";

// 真实榜单由岗位服务渲染；服务未接通时提供恢复入口，不回退到旧演示榜或手选成绩。
export function rankView() {
  return `<div class="page-title"><h1>同卷练习榜</h1></div>${empty("榜单暂不可用", "请刷新后重试。", routeLink("me", "练习记录", "button outline"))}`;
}

export function historyRows(attempts, state) {
  return attempts
    .map((attempt) => {
      const best = Math.max(
        ...state.attempts
          .filter((a) => a.versionId === attempt.versionId)
          .map((a) => a.report.totalCents),
      );
      return `<div class="history-row"><span class="history-icon">${icon("book")}</span><div class="history-name">${routeLink(`report/${encodeURIComponent(attempt.id)}`, esc(attempt.paperTitle))}<small>${esc(attempt.institution)} · ${esc(attempt.period)} · v${esc(attempt.versionLabel)} <span> ${date(attempt.createdAt, true)}</span></small></div><div class="history-result"><b>${score(attempt.report.totalCents)}<small> / ${score(attempt.report.maxCents)}</small></b><span>${pct(attempt.report.rate)} 得分率</span></div><span class="history-best">${attempt.report.totalCents === best ? '<span class="tag">个人最佳</span>' : ""}</span>${routeLink(`report/${encodeURIComponent(attempt.id)}`, icon("right"), "icon-button", 'aria-label="查看本次报告"')}${button("delete-attempt", icon("trash"), "icon-button delete-record", `data-id="${esc(attempt.id)}" aria-label="删除这次练习"`)}</div>`;
    })
    .join("");
}

// 正式记录直接归当前本机身份，历史页面只呈现记录和备份，不再重复要求认领。
export function meView({ state, catalog, historyPaper = "all" }) {
  const attempts = state.attempts;
  const filtered = attempts.filter(
    (a) => historyPaper === "all" || a.paperId === historyPaper,
  );
  const average = attempts.length
    ? attempts.reduce((n, a) => n + a.report.rate, 0) / attempts.length
    : null;
  const best = attempts.length
    ? Math.max(...attempts.map((a) => a.report.rate))
    : null;
  return `<div class="page-title"><div><span class="eyebrow">认真走过的每一步，都在这里</span><h1>我的练习记录</h1><p>回头看看，努力一直有迹可循。</p></div>${button("export-data", `${icon("download")}备份本机数据`, "button outline")}</div><section class="profile-card card"><span class="avatar large">${state.profile ? esc(state.profile.name[0]) : icon("user")}</span><div class="profile-details"><h2>${state.profile ? esc(state.profile.name) : "你好，认真练习的你"}${state.profile ? '<span class="tag">体验身份</span>' : ""}</h2><p>${state.profile ? "本机身份已设置，记录仍保存在当前浏览器。" : "无需登录也可以练习，答案和成绩自动保存在本机。"}</p></div>${button(state.profile ? "settings" : "login", state.profile ? `隐私与设置 ${icon("settings")}` : `设置体验身份 ${icon("arrow")}`, "button soft")}</section><div class="personal-metrics"><div class="card"><span class="metric-icon lilac">${icon("book")}</span><span>累计练习</span><strong>${attempts.length}<small> 次</small></strong><p>${unique(attempts.map((a) => a.paperId)).length} 套卷留下了你的努力</p></div><div class="card"><span class="metric-icon pink">${icon("trophy")}</span><span>最高得分率</span><strong>${best === null ? "—" : pct(best)}</strong><p>各次练习中的最高得分比例</p></div><div class="card"><span class="metric-icon peach">${icon("chart")}</span><span>平均得分率</span><strong>${average === null ? "—" : pct(average)}</strong><p>按每次得分率计算，不作跨卷排名</p></div></div><section class="card history-card">${sectionHead(
    "每一次练习，都算数",
    `<label class="select-wrap"><span class="sr-only">筛选历史套卷</span><select id="history-paper"><option value="all">全部套卷</option>${unique(
      attempts.map((a) => a.paperId),
    )
      .map(
        (id) =>
          `<option value="${esc(id)}" ${id === historyPaper ? "selected" : ""}>${esc(attempts.find((a) => a.paperId === id).paperTitle)}</option>`,
      )
      .join("")}</select>${icon("down")}</label>`,
  )}<div class="history-table-head"><span>套卷与练习时间</span><span>本次成绩</span><span>同版表现</span></div>${filtered.length ? historyRows(filtered, state) : empty("第一份成绩，还在路上", "选一套卷，给今天的努力留一个记录。", routeLink("home", `去选一套卷 ${icon("arrow")}`, "button primary"))}</section><section class="card same-paper-card">${sectionHead("同一套卷，再看近一点", '<span class="tiny-muted">同卷同版本统计</span>')}<div class="same-paper-grid">${
    unique(attempts.map((a) => a.versionId))
      .map((id) => {
        const a = attempts.find((a) => a.versionId === id);
        const count = attempts.filter((item) => item.versionId === id).length;
        return routeLink(
          `stats/${encodeURIComponent(id)}`,
          `<span class="history-icon">${icon("chart")}</span><span><b>${esc(a.paperTitle)}</b><small>v${esc(a.versionLabel)} · ${count} 次练习</small></span>${icon("right")}`,
          "same-paper-item",
        );
      })
      .join("") ||
    '<p class="empty-inline">完成练习后，在这里对比同一套卷的表现。</p>'
  }</div></section><div class="data-actions">${button("restore-data", `${icon("upload")}从备份恢复`, "text-button muted")}${button("privacy", `${icon("shield")}隐私与数据说明`, "text-button muted")}${button("feedback", `${icon("mail")}反馈与纠错`, "text-button muted")}${button("delete-all", `${icon("trash")}删除本机记录`, "text-button muted danger")}</div>`;
}

function trendChart(attempts, offset = 0) {
  const width = 700,
    height = 210,
    left = 42,
    top = 18,
    right = 35,
    bottom = 42;
  const x = (index) =>
    left +
    (attempts.length === 1 ? 0.5 : index / (attempts.length - 1)) *
      (width - left - right);
  const y = (rate) => top + (1 - rate) * (height - top - bottom);
  const points = attempts.map((a, i) => `${x(i)},${y(a.report.rate)}`);
  return `<svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="同卷同版本得分率趋势"><defs><linearGradient id="trend-fill" x2="0" y2="1"><stop stop-color="#c5a8d7" stop-opacity=".3"/><stop offset="1" stop-color="#c5a8d7" stop-opacity="0"/></linearGradient></defs>${[0, 0.25, 0.5, 0.75, 1].map((rate) => `<path d="M${left} ${y(rate)}H${width - right}" stroke="#eee7f3" stroke-dasharray="4 5"/><text x="${left - 9}" y="${y(rate) + 4}" text-anchor="end">${rate * 100}%</text>`).join("")}${attempts.length > 1 ? `<path d="M${x(0)} ${y(0)}L${points.join("L")}L${x(attempts.length - 1)} ${y(0)}Z" fill="url(#trend-fill)"/><polyline points="${points.join(" ")}" fill="none" stroke="#9370aa" stroke-width="3" stroke-linejoin="round"/>` : ""}${attempts.map((a, i) => `<circle cx="${x(i)}" cy="${y(a.report.rate)}" r="5" fill="#9a77af" stroke="#fff" stroke-width="2"/><text x="${x(i)}" y="${y(a.report.rate) - 13}" text-anchor="middle" class="chart-value">${pct(a.report.rate)}</text><text x="${x(i)}" y="${height - 15}" text-anchor="middle">第 ${offset + i + 1} 次</text>`).join("")}</svg>`;
}

export function statsView({ state, version, versionId }) {
  const attempts = state.attempts
    .filter((a) => a.versionId === versionId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const newest = attempts.at(-1);
  const best = attempts.length
    ? Math.max(...attempts.map((a) => a.report.totalCents))
    : 0;
  const average = attempts.length
    ? attempts.reduce((n, a) => n + a.report.totalCents, 0) / attempts.length
    : 0;
  return `<a href="#/me" class="back-link">${icon("left")}返回我的记录</a><div class="page-title"><div><span class="eyebrow">和过去的自己，再认真比一比</span><h1>${esc(version?.title ?? newest?.paperTitle ?? "同卷练习趋势")}</h1><p>评分版本 v${esc(version?.versionLabel ?? newest?.versionLabel ?? "1.0")} · 同卷同版本独立比较</p></div>${version?.status === "published" ? routeLink(`practice/${encodeURIComponent(versionId)}`, `${icon("refresh")}再练一次`, "button primary") : ""}</div>${attempts.length ? `<div class="stats-metrics"><div class="card"><span>练习次数</span><b>${attempts.length}<small> 次</small></b></div><div class="card"><span>个人最高</span><b>${score(best)}<small> 分</small></b></div><div class="card"><span>最近一次</span><b>${score(newest.report.totalCents)}<small> 分</small></b></div><div class="card"><span>平均得分</span><b>${score(Math.round(average))}<small> 分</small></b></div></div><section class="card trend-card">${sectionHead("看得见的练习轨迹", `<span class="tag">${attempts.length < 2 ? "首次基线" : "得分率变化"}</span>`)}${trendChart(attempts.slice(-12), Math.max(0, attempts.length - 12))}<p>${attempts.length < 2 ? "目前只有一次练习，下一次完成后再观察变化。" : `仅展示最近 ${Math.min(12, attempts.length)} 次同版本练习，不与其他套卷混合比较。`}</p></section><section class="card type-overview">${sectionHead("最近一次的题型表现", routeLink(`report/${encodeURIComponent(newest.id)}`, `查看报告 ${icon("right")}`, "text-button"))}<div class="type-overview-grid">${newest.report.breakdown.map((type) => `<div><div class="type-overview-title"><b>${esc(type.name)}</b><span>${type.correct}/${type.count} 题</span></div><strong>${pct(type.centsEarned / type.maxCents)}</strong>${progress(type.centsEarned / type.maxCents)}</div>`).join("")}</div></section><section class="card history-card">${sectionHead("这套卷的每一次练习")}${historyRows([...attempts].reverse(), state)}</section>` : `<section class="card">${empty("这里还没有练习记录", "完成这套卷后，会按当前版本单独统计。", version?.status === "published" ? routeLink(`practice/${encodeURIComponent(versionId)}`, "开始这套练习", "button primary") : "")}</section>`}`;
}
