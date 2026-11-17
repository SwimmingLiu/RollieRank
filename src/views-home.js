import {
  icon,
  esc,
  pad,
  score,
  pct,
  date,
  button,
  routeLink,
  progress,
  empty,
  sectionHead,
  studyArt,
  versionPath,
} from "./ui.js";

const latestVersions = (catalog) =>
  catalog.filter(
    (v) =>
      !catalog.some(
        (other) =>
          other.paperId === v.paperId &&
          Number(other.versionLabel) > Number(v.versionLabel),
      ),
  );
export const unique = (values) => [...new Set(values)];

export function paperCard(version, state) {
  const draft = state.drafts[version.id];
  const count = draft?.answers.filter(Boolean).length ?? 0;
  const history = state.attempts.filter((a) => a.versionId === version.id);
  const best = history.length
    ? Math.max(...history.map((a) => a.report.totalCents))
    : null;
  return `<article class="paper-card ${count ? "has-draft" : ""}"><div class="paper-card-top"><div class="paper-icon">${icon("book")}<span>${pad(version.number)}</span></div><span class="paper-state ${count ? "working" : history.length ? "complete" : ""}">${count ? "进行中" : history.length ? `${icon("check")}已练习` : "未开始"}</span></div><h3>${routeLink(`paper/${versionPath(version)}`, esc(version.title))}</h3><p class="paper-description">${esc(version.project.replace(" · ", " / "))} · ${esc(version.period)}</p><div class="paper-spec"><span>${version.questionCount} 题</span><i></i><span>${score(version.maxCents)} 分</span><i></i><span>v${esc(version.versionLabel)}</span></div>${count ? `<div class="card-draft"><div><span>已完成 ${count} 题</span><b>${Math.round((count / version.questionCount) * 100)}%</b></div>${progress(count / version.questionCount)}</div>` : `<div class="card-baseline">${best !== null ? `<span>个人最佳</span><strong>${score(best)}<small> 分</small></strong>` : `<span>${icon("grid")} ${esc(version.variant)}</span>`}</div>`}<div class="paper-card-actions">${routeLink(`paper/${versionPath(version)}`, `套卷详情 ${icon("right")}`, "text-button muted")}${routeLink(`practice/${versionPath(version)}`, `${count ? "继续作答" : history.length ? "再次练习" : "开始练习"}${icon("arrow")}`, `button ${count ? "primary" : "soft"} compact`)}</div></article>`;
}

export function homeView({ catalog, state, search = "" }) {
  const versions = latestVersions(catalog).filter(
    (v) => v.status === "published",
  );
  const filters = state.filters;
  const candidates = versions.filter(
    (v) =>
      v.institution === filters.institution &&
      v.project === filters.project &&
      v.period === filters.period &&
      v.variant === filters.variant,
  );
  const visible = candidates.filter(
    (v) =>
      (!search ||
        `${v.title} ${v.number}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filters.status === "all" ||
        (filters.status === "draft" &&
          state.drafts[v.id]?.answers.some(Boolean)) ||
        (filters.status === "done" &&
          state.attempts.some((a) => a.versionId === v.id))),
  );
  const drafts = Object.values(state.drafts)
    .filter((d) => d.answers.some(Boolean))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const recentDraft = drafts[0];
  const recentVersion = catalog.find((v) => v.id === recentDraft?.versionId);
  const startVersion = recentVersion ?? candidates[0] ?? versions[0];
  const average = state.attempts.length
    ? state.attempts.reduce((n, a) => n + a.report.rate, 0) /
      state.attempts.length
    : null;
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  const sameDay = (a, b) =>
    new Date(a).toDateString() === new Date(b).toDateString();
  const studied = unique(
    state.attempts
      .filter((a) => a.createdAt >= monday.setHours(0, 0, 0, 0))
      .map((a) => new Date(a.createdAt).toDateString()),
  ).length;
  const institutions = unique([
    "四海",
    "花生十三",
    ...versions.map((v) => v.institution),
  ]);
  const projects = unique(
    versions
      .filter((v) => v.institution === filters.institution)
      .map((v) => v.project),
  );
  const periods = unique(
    versions
      .filter(
        (v) =>
          v.institution === filters.institution &&
          v.project === filters.project,
      )
      .map((v) => v.period),
  );
  const variants = unique(
    versions
      .filter(
        (v) =>
          v.institution === filters.institution &&
          v.project === filters.project &&
          v.period === filters.period,
      )
      .map((v) => v.variant),
  );
  return `<div class="page-title home-title"><div><span class="eyebrow">每一次练习，都有迹可循</span><h1>今天，也进步一点<span class="title-spark">✧</span></h1><p>选一套卷，给努力一个清晰的刻度。</p></div><div class="date-label">${icon("calendar")} ${new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(today)}</div></div><div class="home-layout"><div class="home-primary"><section class="study-hero"><div class="hero-copy"><span class="hero-kicker"><i></i>${recentVersion ? "接着上次，继续向前" : "你的下一次进步，从这里开始"}</span><h2>${recentVersion ? esc(recentVersion.title) : "每一分，都算清楚。"}</h2><p>${recentVersion ? `${esc(recentVersion.period)} · ${recentDraft.answers.filter(Boolean).length} / ${recentVersion.questionCount} 题已答，草稿等你继续。` : "录入答案，了解短板。\n让每一次认真，都被好好记录。"}</p><div class="hero-actions">${startVersion ? routeLink(`practice/${versionPath(startVersion)}`, `${recentVersion ? "继续上次练习" : "开始今天的练习"}${icon("arrow")}`, "button primary") : ""}${button("sample", "先看看成绩报告", "text-button", startVersion ? `data-version="${esc(startVersion.id)}"` : "disabled")}</div>${recentVersion ? progress(recentDraft.answers.filter(Boolean).length / recentVersion.questionCount, "hero-progress") : `<span class="hero-footnote">${icon("shield")} 即时保存，随时继续</span>`}</div>${studyArt()}</section><div class="overview-strip"><div><span class="metric-icon lilac">${icon("book")}</span><span><small>累计练习</small><b>${state.attempts.length}<em> 次</em></b></span></div><div><span class="metric-icon pink">${icon("check")}</span><span><small>已练套卷</small><b>${unique(state.attempts.map((a) => a.paperId)).length}<em> 套</em></b></span></div><div><span class="metric-icon peach">${icon("chart")}</span><span><small>平均得分率</small><b>${average === null ? "—" : pct(average)}<em>${average === null ? " 等你写下" : ""}</em></b></span></div></div><section class="paper-library">${sectionHead("找到你的下一套卷", `<span class="count-badge">${candidates.length} 套可练</span>`)}<div class="institution-tabs" role="group" aria-label="机构筛选">${institutions.map((name) => button("institution", `${name === "四海" ? '<span class="institution-symbol">四</span>' : icon("book")}${esc(name)}${name === "四海" ? '<span class="institution-detail">套题练习</span>' : ""}`, `institution-tab ${filters.institution === name ? "selected" : ""}`, `data-value="${esc(name)}" aria-pressed="${filters.institution === name}"`)).join("")}</div><div class="library-filters"><div class="select-filters"><label class="select-wrap"><span class="sr-only">考试项目</span><select id="filter-project">${(projects.length ? projects : [filters.project]).map((p) => `<option ${filters.project === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>${icon("down")}</label><label class="select-wrap"><span class="sr-only">期数</span><select id="filter-period">${(periods.length ? periods : ["暂无期数"]).map((p) => `<option ${filters.period === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>${icon("down")}</label></div><div class="variant-chips">${variants.map((v) => button("variant", esc(v), `chip ${filters.variant === v ? "selected" : ""}`, `data-value="${esc(v)}" aria-pressed="${filters.variant === v}"`)).join("")}</div></div><div class="paper-list-toolbar"><div class="line-tabs" role="group" aria-label="练习状态">${[
    ["all", "全部套卷"],
    ["draft", "进行中"],
    ["done", "已练习"],
  ]
    .map(([value, name]) =>
      button(
        "status-filter",
        name,
        filters.status === value ? "selected" : "",
        `data-value="${value}" aria-pressed="${filters.status === value}"`,
      ),
    )
    .join(
      "",
    )}</div><label class="search-field">${icon("search")}<input id="paper-search" type="search" placeholder="搜索套卷" value="${esc(search)}" aria-label="搜索套卷"/></label></div><div id="paper-results" class="paper-grid">${visible.length ? visible.map((v) => paperCard(v, state)).join("") : `<div class="grid-empty">${empty(search ? "没有找到这套卷" : "这里还没有套卷", search ? "试试其他卷名，或清除搜索条件。" : "换一个机构或期数，继续你的练习。", button("reset-filters", "查看四海套卷", "button soft"))}</div>`}</div></section></div><aside class="home-aside"><section class="week-card">${sectionHead("本周的小坚持", `<span class="tiny-muted">${today.getMonth() + 1} 月</span>`)}<div class="week-days">${days
    .map((d, i) => {
      const done = state.attempts.some((a) => sameDay(a.createdAt, d));
      return `<div class="${sameDay(d, today) ? "today" : ""} ${done ? "studied" : ""}"><span>${"一二三四五六日"[i]}</span><b>${done ? icon("check") : d.getDate()}</b><i></i></div>`;
    })
    .join(
      "",
    )}</div><p>本周已练习 <b>${studied}</b> 天<span>${studied ? "每一份坚持都算数" : "今天开始，刚刚好"}</span></p></section><section class="recent-card">${sectionHead("最近练习", routeLink("me", `全部 ${icon("right")}`, "text-button muted"))}${
    state.attempts.length
      ? state.attempts
          .slice(0, 3)
          .map((a) =>
            routeLink(
              `report/${encodeURIComponent(a.id)}`,
              `<span class="recent-number">${icon("book")}</span><span class="recent-meta"><b>${esc(a.paperTitle)}</b><small>${date(a.createdAt)} · v${esc(a.versionLabel)}</small></span><strong>${score(a.report.totalCents)}<small> 分</small></strong>`,
              "recent-row",
            ),
          )
          .join("")
      : `<div class="recent-empty"><div class="little-sheet"><i></i><i></i><i></i><span>${icon("check")}</span></div><p>第一份成绩，等你来写下</p><span>完成练习后，随时回来看看。</span></div>`
  }</section><section class="guide-card"><span class="guide-icon">${icon("spark")}</span><h3>练得明白，才好往前。</h3><p>不止核对一个分数，<br/>也找到下一次可以进步的地方。</p><div class="guide-step"><b>01</b><span>选套卷，录入你的答案</span></div><div class="guide-step"><b>02</b><span>看成绩，找到题型短板</span></div><div class="guide-step"><b>03</b><span>再练习，留下进步记录</span></div>${button("help", `了解评分方式 ${icon("arrow")}`, "text-button")}</section><div class="aside-footnote">${icon("lock")}你的答案与成绩，仅在本机保存。</div></aside></div>`;
}

export function paperView({ version, state }) {
  const draft = state.drafts[version.id];
  const history = state.attempts.filter((a) => a.versionId === version.id);
  const types = unique(version.questions.map((q) => q.typeId));
  return `<a class="back-link" href="#/home">${icon("left")}返回套卷</a><div class="page-title"><div><span class="eyebrow">${esc(version.institution)} · ${esc(version.project)} · ${esc(version.period)}</span><h1>${esc(version.title)}</h1><p>${esc(version.variant)} <span class="inline-dot">·</span> 评分版本 v${esc(version.versionLabel)}</p></div><span class="tag ${version.status === "offline" ? "warning" : ""}">${version.status === "offline" ? "已下线" : "可开始练习"}</span></div><div class="detail-layout"><section class="card paper-detail-card"><div class="detail-cover">${icon("book")}<span>练习本 <b>${pad(version.number)}</b></span></div><div class="paper-big-stats"><div><b>${version.questionCount}</b><span>道单选题</span></div><div><b>${score(version.maxCents)}</b><span>分满分</span></div><div><b>${types.length}</b><span>类题型</span></div></div>${sectionHead("这套卷的题型构成")}<div class="rules-list">${types
    .map((id) => {
      const qs = version.questions.filter((q) => q.typeId === id);
      // 折算卷展示实际分值，原始权重仍保留在服务端计分配置中。
      return `<div><span>${qs[0].type}</span><span>${qs.length} 题</span><b>${score(qs.reduce((n, q) => n + (q.scoreCents ?? q.cents), 0))}<small> 分</small></b></div>`;
    })
    .join(
      "",
    )}</div></section><aside><section class="card action-card"><span class="metric-icon lilac">${icon("leaf")}</span><h2>${draft?.answers.some(Boolean) ? "接着上次的认真" : "准备好了，就开始吧"}</h2><p>${draft?.answers.some(Boolean) ? `已完成 ${draft.answers.filter(Boolean).length} / ${version.questionCount} 题，草稿已保存在本机。` : "拿出你的纸质题本，将已作答的选项录入答题卡。"}</p>${version.status === "published" ? routeLink(`practice/${versionPath(version)}`, `${draft?.answers.some(Boolean) ? "继续作答" : "开始练习"}${icon("arrow")}`, "button primary full") : '<p class="notice warning">套卷已下线，现有历史仍可查看。</p>'}${history.length ? routeLink(`stats/${versionPath(version)}`, `已练习 ${history.length} 次，查看同卷记录 ${icon("right")}`, "text-button full") : ""}<div class="rule-note"><b>${icon("info")}计分说明</b><p>答对得对应分值，答错、未答计 0 分。按练习评分参考估分，实际考试评分以考试组织方为准。</p><p>提交后保存成绩快照，再次作答会创建新记录。</p></div></section><section class="card light-card"><h3>${icon("trophy")}同卷练习榜</h3><p>看看同一套卷、同一版本下的个人最佳表现。</p>${routeLink(`rank/${versionPath(version)}`, `查看演示榜单 ${icon("arrow")}`, "text-button")}</section></aside></div>`;
}
