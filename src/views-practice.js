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
  versionPath,
} from "./ui.js";
import { unique } from "./views-home.js";
import { selectPreviousAttempt } from "./analytics.js";

export function answerGrid(version, draft) {
  return unique(version.questions.map((q) => q.typeId))
    .map((id) => {
      const qs = version.questions.filter((q) => q.typeId === id);
      return `<section class="sheet-section"><div class="sheet-section-label"><b>${esc(qs[0].type)}</b><span>${qs.filter((q) => draft.answers[q.number - 1]).length} / ${qs.length}</span></div><div class="question-grid">${qs.map((q) => button("question", `<span>${pad(q.number)}</span>${draft.answers[q.number - 1] ? `<small>${draft.answers[q.number - 1]}</small>` : ""}${draft.marks.includes(q.number) ? '<i class="mark-dot"></i>' : ""}`, `q-cell ${draft.answers[q.number - 1] ? "answered" : ""} ${draft.current === q.number ? "current" : ""}`, `data-question="${q.number}" aria-label="第 ${q.number} 题，${draft.answers[q.number - 1] ? "已选 " + draft.answers[q.number - 1] : "未答"}${draft.marks.includes(q.number) ? "，待检查" : ""}" aria-current="${draft.current === q.number}"`)).join("")}</div></section>`;
    })
    .join("");
}

export function practiceView({ version, draft, saveWarning }) {
  // 折算卷按公开分值展示本题得分，原始整数权重只用于统一计分。
  const question = version.questions[draft.current - 1];
  const count = draft.answers.filter(Boolean).length;
  return `<div class="practice-top"><a href="#/home" class="back-link">${icon("left")}返回选卷</a><a href="#/home" class="brand practice-brand"><img src="/ios-v3/assets/brand/rollierank-logo-transparent.png" width="33" height="33" alt=""/><b>卷卷小榜</b></a><span class="save-indicator ${saveWarning ? "warning" : ""}">${icon(saveWarning ? "info" : "check")}${saveWarning ? "保存失败，请勿关闭页面" : "草稿已保存到本机"}</span></div><div class="practice-heading"><div><span class="eyebrow">${esc(version.institution)} · ${esc(version.period)} · ${esc(version.variant)}</span><h1>${esc(version.title)}</h1></div><span class="tag">评分版本 v${esc(version.versionLabel)}</span></div><div class="practice-progress"><div><span>作答进度 <b>${count}</b><small> / ${version.questionCount} 题</small></span><b>${Math.round((count / version.questionCount) * 100)}%</b></div>${progress(count / version.questionCount)}</div>${version.status === "offline" ? '<p class="notice warning">此版本已下线，草稿仍保留；暂时无法提交。</p>' : ""}<div class="practice-layout"><section class="answer-editor card"><div class="editor-top"><span class="tag">${esc(question.type)}</span>${button("mark", `${icon("flag")}${draft.marks.includes(draft.current) ? "已标记" : "待检查"}`, `text-button ${draft.marks.includes(draft.current) ? "marked" : "muted"}`, `aria-pressed="${draft.marks.includes(draft.current)}"`)}</div><div class="question-focus"><span class="eyebrow">当前作答</span><h2>第 <b>${pad(draft.current)}</b> 题<small>/ ${version.questionCount}</small></h2><p>单选题 <i>·</i> 本题 ${score(question.scoreCents ?? question.cents)} 分</p><div class="answer-choices">${["A", "B", "C", "D"].map((option) => button("answer", `<b>${option}</b><span>${draft.answers[draft.current - 1] === option ? "已选择" : "选择此项"}</span>${draft.answers[draft.current - 1] === option ? `<i>${icon("check")}</i>` : ""}`, `answer-choice ${draft.answers[draft.current - 1] === option ? "selected" : ""}`, `data-answer="${option}" aria-label="选择 ${option}" aria-pressed="${draft.answers[draft.current - 1] === option}" data-focuskey="answer-${option}"`)).join("")}</div><div class="auto-next-row"><label for="auto-next">选择后自动跳到下一题</label><input type="checkbox" role="switch" id="auto-next" ${draft.autoNext ? "checked" : ""}/></div><div class="question-controls">${button("prev", `${icon("left")}上一题`, "button outline", `${draft.current === 1 ? "disabled" : ""} data-focuskey="prev"`)}${button("clear-answer", "清除此题", "text-button muted", draft.answers[draft.current - 1] ? "" : "disabled")}${button("next", `下一题${icon("right")}`, "button outline", `${draft.current === version.questionCount ? "disabled" : ""} data-focuskey="next"`)}</div></div><div class="keyboard-note"><span class="key">A</span>–<span class="key">D</span> 选择答案 <i></i> <span class="key">←</span><span class="key">→</span> 切换题目</div></section><aside class="answer-sheet card"><div class="sheet-heading"><h2>${icon("grid")}答题卡</h2>${button("bulk", `${icon("paste")}批量粘贴`, "text-button")}</div><div class="sheet-legend"><span><i class="done"></i>已答</span><span><i></i>未答</span><span><i class="current"></i>当前</span><span><i class="mark"></i>待检查</span></div><div class="sheet-scroll">${answerGrid(version, draft)}</div><div class="sheet-bottom"><form id="jump-form"><label for="jump-question">跳至</label><input id="jump-question" type="number" name="question" min="1" max="${version.questionCount}" placeholder="题号" required/><button class="icon-button" type="submit" aria-label="跳转题目">${icon("arrow")}</button></form>${button("reset-draft", "清空本卷", "text-button muted")}</div></aside></div><div class="practice-dock"><span class="dock-note">${icon("shield")} 只录入选项，无需上传题本</span><div class="mobile-sheet-actions">${button("sheet", `${icon("grid")}答题卡`, "button outline")}${button("bulk", icon("paste"), "icon-button", 'aria-label="批量粘贴答案"')}</div><div class="submit-group"><span>${count === version.questionCount ? "全部录入完成" : `还有 ${version.questionCount - count} 题未答`}</span>${button("confirm-submit", `提交并查看成绩${icon("arrow")}`, "button primary", version.status === "offline" ? "disabled" : "")}</div></div>`;
}

export function reportView({ attempt, state, allTypes = false }) {
  const report = attempt.report;
  // 新机构缺少出品方分值时采用明确的参考估分；结果页展示依据，折算分项避免被当作官方逐题分值。
  const scoringRule = attempt.scoringRule ?? report.scoringRule;
  const scoringNotice = scoringRule
    ? `<p class="notice">${esc(scoringRule.label)}${scoringRule.kind === "reference" ? "。采用平台国考练习参考权重，按本卷总权重折算至 100 分，不代表官方逐题分值。" : "。"}${report.scoreScale ? "分项显示保留两位小数，总分按未舍入权重统一计算。" : ""}</p>`
    : "";
  // 总分和题型统一使用规则兼容的上一刷，避免旧同版本逻辑与 VS 卡选取不同答卷。
  const previous = selectPreviousAttempt(attempt, state.attempts);
  const types = [...report.breakdown].sort(
    (a, b) => a.centsEarned / a.maxCents - b.centsEarned / b.maxCents,
  );
  // 审核订正会更新正式得分，页尾改为承诺保存答卷，避免将可订正成绩描述为永久冻结。
  return `<a class="back-link" href="#/${attempt.isSample ? "home" : "me"}">${icon("left")}${attempt.isSample ? "返回选卷" : "返回我的记录"}</a><div class="page-title"><div><span class="eyebrow">每一份认真，都值得被记录</span><h1>这一次，练得怎么样？</h1><p>${esc(attempt.paperTitle)} <span class="inline-dot">·</span> ${esc(attempt.period)} <span class="inline-dot">·</span> v${esc(attempt.versionLabel)}</p></div>${attempt.isSample ? '<span class="tag">示例报告 · 不计入个人记录</span>' : `<span class="date-label">${icon("clock")}${date(attempt.createdAt, true)}</span>`}</div>${scoringNotice}<div class="report-layout"><section class="score-card card"><div class="score-card-header"><span>本次练习估分</span><span class="small-seal">${icon("check")} 已完成</span></div><div class="score-main"><div class="score-number">${score(report.totalCents)}<span>/ ${score(report.maxCents)} 分</span></div><svg viewBox="0 0 100 100" class="score-ring" aria-label="得分率 ${pct(report.rate)}"><circle cx="50" cy="50" r="40" fill="none" stroke="#f0e8f5" stroke-width="7"/><circle cx="50" cy="50" r="40" fill="none" stroke="#a384b7" stroke-width="7" pathLength="100" stroke-dasharray="${report.rate * 100} 100" stroke-linecap="round" transform="rotate(-90 50 50)"/><text x="50" y="48" text-anchor="middle" class="ring-number">${pct(report.rate)}</text><text x="50" y="65" text-anchor="middle" class="ring-label">得分率</text></svg></div><div class="score-stats"><div class="correct"><span>✓ 答对</span><b>${report.correct}<small> 题</small></b></div><div class="wrong"><span>× 答错</span><b>${report.wrong}<small> 题</small></b></div><div><span>· 未答</span><b>${report.blank}<small> 题</small></b></div></div><div class="accuracy-line"><span>正确率 <b>${pct(report.accuracy)}</b></span><span>答对题数 ÷ 总题数</span></div></section><section class="card weak-card"><div class="section-head"><div><span class="eyebrow">下次，先看看这些题型</span><h2>${allTypes ? "全部题型表现" : "最值得复盘的 3 项"}</h2></div>${button("all-types", allTypes ? "收起" : `全部 ${types.length} 项 ${icon("right")}`, "text-button")}</div><div class="performance-list">${(allTypes
    ? types
    : types.slice(0, 3)
  )
    .map((type, index) => {
      const before = previous?.report.breakdown.find((b) => b.id === type.id);
      return `<div class="performance-row"><span class="performance-index">${pad(index + 1)}</span><div><div class="performance-title"><b>${esc(type.name)}</b><strong>${pct(type.centsEarned / type.maxCents)}</strong></div>${progress(type.centsEarned / type.maxCents, index === 0 ? "rose" : "")}<div class="performance-meta"><span>${score(type.centsEarned)} / ${score(type.maxCents)} 分</span><span>${before ? `上次 ${pct(before.centsEarned / before.maxCents)}` : `答对 ${type.correct} / ${type.count} 题`}</span></div></div></div>`;
    })
    .join(
      "",
    )}</div><p class="weak-note">${icon("info")}按本次得分率排序，作为纸质题本复盘参考。</p></section></div><div class="report-action-grid">${routeLink(`details/${encodeURIComponent(attempt.id)}`, `<span class="action-tile-icon lilac">${icon("grid")}</span><span><b>逐题答案对照</b><small>查看选项，筛出错题与漏答</small></span>${icon("right")}`, "action-tile")}${button("poster", `<span class="action-tile-icon pink">${icon("share")}</span><span><b>留下这一次成绩</b><small>制作专属成绩海报</small></span>${icon("right")}`, "action-tile")}${routeLink(`rank/${encodeURIComponent(attempt.practiceVersionId ?? attempt.versionId)}`, `<span class="action-tile-icon peach">${icon("trophy")}</span><span><b>同卷练习榜</b><small>同卷同版本，看看最佳表现</small></span>${icon("right")}`, "action-tile")}</div><section class="card type-overview">${sectionHead("把每一项都看清楚", button("export-csv", `${icon("download")}导出逐题 CSV`, "text-button"))}<div class="type-overview-grid">${report.breakdown.map((type) => `<div><div class="type-overview-title"><b>${esc(type.name)}</b><span>${type.correct} / ${type.count} 题</span></div><strong>${score(type.centsEarned)}<small> / ${score(type.maxCents)}</small></strong>${progress(type.centsEarned / type.maxCents)}<span class="tiny-muted">得分率 ${pct(type.centsEarned / type.maxCents)}</span></div>`).join("")}</div></section><div class="report-bottom"><p>${icon("shield")}${attempt.isSample ? "示例作答不计入个人练习记录。" : "本次答卷已保存，再次练习会创建新记录。"}</p>${routeLink(`practice/${encodeURIComponent(attempt.practiceVersionId ?? attempt.versionId)}`, `${icon("refresh")}${attempt.isSample ? "开始我的练习" : "再练一次"}`, "button outline")}${attempt.isSample ? "" : routeLink(`stats/${encodeURIComponent(attempt.practiceVersionId ?? attempt.versionId)}`, `查看同卷趋势${icon("arrow")}`, "button soft")}</div>`;
}

export function detailsView({
  attempt,
  detailFilter = "all",
  typeFilter = "all",
}) {
  const report = attempt.report;
  const rows = report.rows.filter(
    (q) =>
      (detailFilter === "all" || q.status === detailFilter) &&
      (typeFilter === "all" || q.typeId === typeFilter),
  );
  return `<a href="#/report/${encodeURIComponent(attempt.id)}" class="back-link">${icon("left")}返回成绩报告</a><div class="page-title"><div><span class="eyebrow">把错题找出来，把思路理清楚</span><h1>逐题对照</h1><p>${esc(attempt.paperTitle)} · v${esc(attempt.versionLabel)} <span class="inline-dot">·</span> 本次 ${score(report.totalCents)} / ${score(report.maxCents)} 分</p></div>${button("export-csv", `${icon("download")}导出 CSV`, "button outline")}</div><section class="card answers-detail"><div class="detail-toolbar"><div class="segmented">${[
    ["all", "全部", report.rows.length],
    ["correct", "答对", report.correct],
    ["wrong", "答错", report.wrong],
    ["blank", "未答", report.blank],
  ]
    .map(([id, label, count]) =>
      button(
        "detail-filter",
        `${label} <b>${count}</b>`,
        detailFilter === id ? "selected" : "",
        `data-value="${id}" aria-pressed="${detailFilter === id}"`,
      ),
    )
    .join(
      "",
    )}</div><label class="select-wrap"><span class="sr-only">筛选题型</span><select id="type-filter"><option value="all">全部题型</option>${report.breakdown.map((t) => `<option value="${esc(t.id)}" ${typeFilter === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>${icon("down")}</label>${button("copy-wrong", `${icon("paste")}复制错题号`, "text-button")}</div><div class="detail-legend"><span><i class="correct">✓</i>参考答案</span><span><i class="wrong">×</i>我的错误选项</span><span>当前 ${rows.length} 题</span></div><div class="detail-table"><div class="detail-table-head"><span>题号 / 题型</span><span>选项对照</span><span>结果</span><span>得分</span></div>${rows.map((q) => `<div class="detail-row"><div class="question-identity"><b>${pad(q.question)}</b><span>${esc(q.type)}</span></div><div class="comparison-options">${["A", "B", "C", "D"].map((option) => `<span class="comparison-option ${option === q.correctAnswer ? "correct" : ""} ${option === q.answer && q.status === "wrong" ? "wrong" : ""}"><b>${option}</b><small>${option === q.correctAnswer ? (q.answer === option ? "✓ 我的答案" : "✓ 参考答案") : option === q.answer ? "× 我的答案" : "—"}</small></span>`).join("")}</div><span class="result-status ${q.status}">${{ correct: "✓ 正确", wrong: "× 错误", blank: "· 未答" }[q.status]}</span><span class="detail-score">${score(q.cents)}<small> / ${score(q.maxCents)}</small></span></div>`).join("")}${rows.length ? "" : empty("这组题目是空的", "切换筛选，看看其他题目。")}</div></section><p class="page-note">${icon("info")}按参考答案核对，无题干与解析。复制错题号后，可回到纸质题本复盘。</p>`;
}
