import { PAPERS } from './data/papers.js';
import { OPTIONS, QUESTION_COUNT, SECTIONS, ruleFor, sectionFor, scorePaper, formatScore, exportCsv } from './scoring.js';
import { parseAnswers } from './answers.js';
import { emptyDraft, loadDrafts, saveDrafts } from './storage.js';

const $ = selector => document.querySelector(selector);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const pad = number => String(number).padStart(2, '0');
let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Storage unavailable'); } }; }
const restored = loadDrafts(storage, PAPERS.map(paper => paper.id));
let drafts = restored.drafts;
let selectedId = restored.selectedId;
let view = 'entry';
let filter = 'all';
let typeFilter = 'all';
let saveWarning = restored.warning;
let toastTimer;
let pendingEntries = [];

const paper = () => PAPERS.find(item => item.id === selectedId);
const draft = () => drafts[selectedId];
const answeredCount = () => draft().answers.filter(Boolean).length;

function updateSaveState() {
  const state = $('#save-state');
  state.classList.toggle('warning', saveWarning);
  state.innerHTML = `<span class="status-dot"></span>${saveWarning ? '本机保存不可用，请导出成绩' : draft().updatedAt ? '草稿已保存在本机' : '草稿保存在本机'}`;
}

function persist() {
  try { saveDrafts(storage, selectedId, drafts); saveWarning = false; }
  catch { saveWarning = true; }
  updateSaveState();
}

function changed() {
  draft().updatedAt = Date.now();
  draft().reportReady = false;
  persist();
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3200);
}

function renderEntry() {
  const state = draft();
  const current = state.current;
  const section = sectionFor(current);
  const rule = ruleFor(current, state.rules);
  const count = answeredCount();
  const sectionCount = state.answers.slice(section.start - 1, section.end).filter(Boolean).length;
  return `<div class="entry-layout">
    <section class="card answer-panel" aria-labelledby="sheet-title">
      <div class="panel-heading"><h2 id="sheet-title">答题卡</h2><div class="panel-actions"><button class="text-button" type="button" data-action="bulk">${icon('paste')}批量粘贴</button><button class="text-button" type="button" data-action="reset">${icon('reset')}清空</button></div></div>
      <div class="section-tabs" aria-label="选择题目模块">${SECTIONS.map(item => `<button type="button" data-action="section" data-section="${item.id}" class="${item.id === section.id ? 'active' : ''}" aria-pressed="${item.id === section.id}" data-focuskey="section-${item.id}">${item.name}<small>${item.start}–${item.end}</small></button>`).join('')}</div>
      <div class="section-heading"><h3>${section.name}</h3><span>已填 ${sectionCount} / ${section.end - section.start + 1} 题</span></div>
      <div class="question-grid" aria-label="${section.name}答题卡">${Array.from({ length: section.end - section.start + 1 }, (_, index) => {
        const q = section.start + index;
        const answer = state.answers[q - 1];
        return `<button type="button" class="question-cell ${answer ? 'answered' : ''}" data-action="question" data-question="${q}" data-focuskey="q-${q}" aria-current="${q === current}" aria-label="第 ${q} 题，${answer ? '已选 ' + answer : '未作答'}"><small>${pad(q)}</small><strong>${answer ?? '·'}</strong></button>`;
      }).join('')}</div>
      <div class="sheet-footer"><div class="legend"><span><i class="current"></i>当前题</span><span><i class="filled"></i>已填写</span><span><i></i>未填写</span></div><form class="jump-control" id="jump-form"><label for="jump-question">跳至</label><input id="jump-question" name="question" type="number" min="1" max="130" inputmode="numeric" aria-label="跳转题号" required /><span>题</span><button type="submit" aria-label="跳转到指定题号">${icon('right')}</button></form></div>
    </section>
    <aside class="entry-sidebar">
      <section class="card editor-card" aria-labelledby="current-question-heading">
        <div class="editor-label">当前作答<button type="button" class="text-button" data-action="clear-answer" ${state.answers[current - 1] === null ? 'disabled' : ''}>清除此题</button></div>
        <div class="current-question"><h2 id="current-question-heading">第 ${pad(current)} 题</h2><span>/ 130</span></div><p class="current-type">${rule.name}<span class="subtle"> · </span>每题 ${formatScore(rule.cents)} 分</p>
        <div class="choice-buttons" aria-label="第 ${current} 题的选项">${OPTIONS.map(option => `<button type="button" class="choice-button" data-action="answer" data-answer="${option}" data-focuskey="answer-${option}" aria-label="选择 ${option}" aria-pressed="${state.answers[current - 1] === option}">${option}</button>`).join('')}</div>
        <div class="question-navigation"><button type="button" data-action="prev" data-focuskey="prev" ${current === 1 ? 'disabled' : ''}>${icon('left')}上一题</button><button type="button" data-action="next" data-focuskey="next" ${current === 130 ? 'disabled' : ''}>下一题${icon('right')}</button></div>
        <label class="auto-next"><input id="auto-next" type="checkbox" ${state.autoNext ? 'checked' : ''} />选择后自动跳至下一题</label>
        <div class="keyboard-hint">${icon('keyboard')}键盘 A–D 选答案，← → 切换题目</div>
      </section>
      <section class="card progress-card" aria-label="作答进度">
        <div class="progress-heading"><span>作答进度</span><strong>${count} <small>/ 130</small></strong></div><div class="progress-track"><span style="width:${count / 130 * 100}%"></span></div>
        <div class="subject-progress">${SECTIONS.map(item => {
          const completed = state.answers.slice(item.start - 1, item.end).filter(Boolean).length;
          const total = item.end - item.start + 1;
          return `<div class="subject-row"><span>${item.name}</span><div class="mini-track"><i style="width:${completed / total * 100}%"></i></div><b>${completed}/${total}</b></div>`;
        }).join('')}</div>
        <button type="button" class="primary-button full-width" data-action="generate">生成得分报告${icon('arrow')}</button><p class="submit-note">${count === 130 ? '答案已填完，可以查看本次得分' : `还有 ${130 - count} 题未填，可按 0 分计入`}</p>
      </section>
    </aside>
  </div><p class="entry-tip">${icon('info')}答案按套卷分别保存。可点击任意题号修改，或批量粘贴带题号的选项。</p>`;
}

function resultRows(report) {
  return report.rows.filter(row => (filter === 'all' || row.status === filter) && (typeFilter === 'all' || row.typeId === typeFilter));
}

function renderTable(report) {
  const rows = resultRows(report);
  const statuses = { correct: '正确', wrong: '错误', blank: '未作答' };
  return `<div class="table-scroll"><table class="results-table"><thead><tr><th scope="col">题号</th><th scope="col">题型</th><th scope="col">我的答案</th><th scope="col">参考答案</th><th scope="col">结果</th><th scope="col">得分 / 分值</th></tr></thead><tbody>${rows.map(row => `<tr><td>${pad(row.question)}</td><td>${row.type}</td><td class="option">${row.answer ?? '—'}</td><td class="option">${row.correctAnswer}</td><td><span class="result-badge ${row.status}">${row.status === 'blank' ? '' : icon(row.status === 'correct' ? 'check' : 'close')}${statuses[row.status]}</span></td><td class="result-score">${formatScore(row.cents)} <span class="subtle">/ ${formatScore(row.maxCents)}</span></td></tr>`).join('')}</tbody></table>${rows.length ? '' : '<div class="empty-results">当前筛选下没有题目</div>'}</div><div class="table-footer">当前显示 ${rows.length} 题 · 共 130 题，导出包含全部题目</div>`;
}

function renderReport() {
  const report = scorePaper(paper().answerKey, draft().answers, draft().rules);
  // Keep card captions short enough for narrow phones; unit scores are available in the rules and results table.
  return `<section class="card report-summary" aria-label="本次练习得分"><div><div class="score-title">${icon('chart')}本次估分</div><div class="score-value">${formatScore(report.totalCents)}<span>/ 100 分</span></div></div><div class="report-counts"><div>答对<b>${report.correct}<small class="sr-only">题</small></b></div><div>答错<b>${report.wrong}<small class="sr-only">题</small></b></div><div>未作答<b>${report.blank}<small class="sr-only">题</small></b></div></div></section>
    <div class="report-controls"><h2>各题型得分</h2><div><button type="button" class="secondary-button" data-action="edit">${icon('grid')}继续修改</button><button type="button" class="primary-button" data-action="export">${icon('download')}导出逐题成绩</button></div></div>
    <div class="breakdown-grid">${report.breakdown.map(item => `<section class="card breakdown-card"><h3>${item.name}</h3><div><strong>${formatScore(item.centsEarned)}</strong><span>/ ${formatScore(item.maxCents)} 分</span></div><small>答对 ${item.correct} / ${item.count} 题</small><div class="progress-track"><span style="width:${item.centsEarned / item.maxCents * 100}%"></span></div></section>`).join('')}</div>
    <p class="report-notice">${icon('info')}按提供的评分参考估分，未作答计 0 分。逐题结果和导出文件均包含全部 130 题。</p>
    <section class="card details-card" aria-labelledby="details-title"><div class="details-top"><h2 id="details-title">逐题得分</h2><div class="detail-filters" aria-label="按结果筛选">${[['all', '全部', 130], ['correct', '答对', report.correct], ['wrong', '答错', report.wrong], ['blank', '未答', report.blank]].map(([id, label, count]) => `<button type="button" data-action="filter" data-filter="${id}" class="${filter === id ? 'active' : ''}" aria-pressed="${filter === id}">${label} ${count}</button>`).join('')}</div><select id="type-filter" class="detail-select" aria-label="按题型筛选"><option value="all">全部题型</option>${draft().rules.map(rule => `<option value="${rule.id}" ${typeFilter === rule.id ? 'selected' : ''}>${rule.name}</option>`).join('')}</select></div><div id="results-content">${renderTable(report)}</div></section>`;
}

function render() {
  const focusKey = document.activeElement?.dataset.focuskey;
  $('#entry-tab').setAttribute('aria-selected', String(view === 'entry'));
  $('#report-tab').setAttribute('aria-selected', String(view === 'report'));
  $('#workspace').setAttribute('aria-labelledby', view === 'entry' ? 'entry-tab' : 'report-tab');
  $('#paper-select').value = selectedId;
  $('#paper-number').textContent = pad(paper().number);
  $('[data-action="paper-prev"]').disabled = paper().number === 1;
  $('[data-action="paper-next"]').disabled = paper().number === PAPERS.length;
  $('#workspace').innerHTML = view === 'entry' ? renderEntry() : renderReport();
  updateSaveState();
  if (focusKey) $(`[data-focuskey="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
}

function jump(question) {
  if (!Number.isInteger(question) || question < 1 || question > QUESTION_COUNT) { toast('请输入 1–130 之间的题号'); return; }
  draft().current = question;
  persist();
  render();
  // On phones the question grid follows the editor; bring the options back into view after a jump.
  if (window.matchMedia('(max-width: 760px)').matches) $('.editor-card').scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

function answer(option) {
  const state = draft();
  state.answers[state.current - 1] = option;
  if (state.autoNext && state.current < QUESTION_COUNT) state.current++;
  changed();
  render();
}

function switchPaper(id) {
  if (!PAPERS.some(item => item.id === id)) return;
  selectedId = id;
  view = 'entry';
  filter = 'all';
  typeFilter = 'all';
  persist();
  render();
}

function confirm(title, description, label, callback, destructive = false) {
  $('#confirm-title').textContent = title;
  $('#confirm-description').textContent = description;
  const button = $('#confirm-action');
  button.textContent = label;
  button.style.background = destructive ? 'var(--red)' : '';
  button.style.borderColor = destructive ? 'var(--red)' : '';
  button.onclick = () => { $('#confirm-dialog').close(); button.onclick = null; callback(); };
  $('#confirm-dialog').showModal();
}

function generate() {
  const show = () => {
    draft().reportReady = true;
    persist();
    view = 'report';
    filter = 'all';
    typeFilter = 'all';
    render();
    $('#report-tab').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const blank = QUESTION_COUNT - answeredCount();
  if (blank && !draft().reportReady) confirm(`还有 ${blank} 题未作答`, '未作答的题目将按 0 分计入。你可以先查看报告，再继续补充答案。', '按 0 分计入并生成', show);
  else show();
}

function openBulk() {
  $('#bulk-input').value = '';
  $('#bulk-start').value = draft().current;
  updateBulkPreview();
  $('#bulk-dialog').showModal();
  $('#bulk-input').focus();
}

function updateBulkPreview() {
  const text = $('#bulk-input').value;
  const preview = $('#bulk-preview');
  const start = Number($('#bulk-start').value);
  $('#bulk-start').disabled = /\d/.test(text.normalize('NFKC'));
  preview.classList.remove('error');
  pendingEntries = [];
  $('#bulk-confirm').disabled = true;
  if (!text.trim()) { preview.textContent = '粘贴后会先预览，再确认录入。'; return; }
  try {
    pendingEntries = parseAnswers(text, $('#bulk-start').disabled ? 1 : start);
    const overwritten = pendingEntries.filter(entry => draft().answers[entry.question - 1] !== null).length;
    const blanks = pendingEntries.filter(entry => entry.answer === null).length;
    preview.innerHTML = `识别 ${pendingEntries.length} 题，第 ${pendingEntries[0].question}–${pendingEntries.at(-1).question} 题${blanks ? `，含 ${blanks} 道空题` : ''}。${overwritten ? `将替换 ${overwritten} 个已有答案。` : ''}<div class="preview-chips">${pendingEntries.slice(0, 15).map(entry => `<span>${entry.question}. ${entry.answer ?? '空'}</span>`).join('')}${pendingEntries.length > 15 ? '<span>…</span>' : ''}</div>`;
    $('#bulk-confirm').disabled = false;
  } catch (error) { preview.textContent = error.message; preview.classList.add('error'); }
}

function openRules() {
  const state = draft();
  // Show the supplied booklet as the mapping source now that its subtype boundaries are verified.
  $('#rules-content').innerHTML = `<table class="rules-table"><thead><tr><th scope="col">题型</th><th scope="col">题号</th><th scope="col">每题</th><th scope="col">满分</th></tr></thead><tbody>${state.rules.map(rule => `<tr><td>${rule.name}</td><td>${rule.start}–${rule.end}</td><td>${formatScore(rule.cents)}</td><td>${formatScore(rule.cents * rule.count)}</td></tr>`).join('')}</tbody><tfoot><tr><td>合计</td><td>130 题</td><td></td><td>100 分</td></tr></tfoot></table><p class="source-note">参考答案：${escape(paper().sourceFile)}<br />题型题号：${escape(paper().bookletFile)}<br />各题型范围已与本套题本核对。</p>`;
  $('#rules-dialog').showModal();
}

function exportResults() {
  const report = scorePaper(paper().answerKey, draft().answers, draft().rules);
  const content = exportCsv(paper(), report);
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `卷卷小榜-四海第${pad(paper().number)}套-逐题成绩.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('已导出全部 130 题的成绩');
}

const actions = {
  view: button => button.dataset.view === 'report' ? generate() : (view = 'entry', render()),
  rules: openRules,
  bulk: openBulk,
  question: button => jump(Number(button.dataset.question)),
  section: button => jump(SECTIONS.find(item => item.id === button.dataset.section).start),
  answer: button => answer(button.dataset.answer),
  prev: () => jump(Math.max(1, draft().current - 1)),
  next: () => jump(Math.min(130, draft().current + 1)),
  'clear-answer': () => { draft().answers[draft().current - 1] = null; changed(); render(); },
  'paper-prev': () => switchPaper(PAPERS[paper().number - 2]?.id),
  'paper-next': () => switchPaper(PAPERS[paper().number]?.id),
  generate,
  edit: () => { view = 'entry'; render(); $('#entry-tab').focus({ preventScroll: true }); },
  export: exportResults,
  filter: button => { filter = button.dataset.filter; render(); $(`[data-filter="${filter}"]`)?.focus({ preventScroll: true }); },
  'close-dialog': button => button.closest('dialog').close(),
  'bulk-confirm': () => {
    updateBulkPreview();
    if (!pendingEntries.length || $('#bulk-confirm').disabled) return;
    const count = pendingEntries.length;
    pendingEntries.forEach(entry => { draft().answers[entry.question - 1] = entry.answer; });
    draft().current = Math.min(130, pendingEntries.at(-1).question + 1);
    changed();
    $('#bulk-dialog').close();
    render();
    toast(`已录入 ${count} 题`);
  },
  reset: () => {
    if (!answeredCount()) { toast('这份答题卡已经是空的'); return; }
    confirm('清空本套答案？', `将清空${paper().title}的个人答案。其他套卷的记录会保留。`, '清空本套答案', () => {
      const rules = draft().rules;
      drafts[selectedId] = { ...emptyDraft(), rules };
      changed();
      render();
      toast('已清空本套答案');
    }, true);
  },
};

document.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (button && !button.disabled) actions[button.dataset.action]?.(button);
});

document.addEventListener('change', event => {
  if (event.target.id === 'paper-select') switchPaper(event.target.value);
  if (event.target.id === 'auto-next') { draft().autoNext = event.target.checked; persist(); }
  if (event.target.id === 'type-filter') {
    typeFilter = event.target.value;
    $('#results-content').innerHTML = renderTable(scorePaper(paper().answerKey, draft().answers, draft().rules));
  }
});

document.addEventListener('submit', event => {
  if (event.target.id === 'jump-form') { event.preventDefault(); jump(Number(new FormData(event.target).get('question'))); }
});

document.addEventListener('keydown', event => {
  // Held keys must not fill several questions while automatic advancement is enabled.
  if (view !== 'entry' || $('dialog[open]') || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  const key = event.key.toUpperCase();
  if (OPTIONS.includes(key)) { event.preventDefault(); answer(key); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); jump(Math.max(1, draft().current - 1)); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); jump(Math.min(130, draft().current + 1)); }
  else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); actions['clear-answer'](); }
});

$('#bulk-input').addEventListener('input', updateBulkPreview);
$('#bulk-start').addEventListener('input', updateBulkPreview);
$('#paper-select').innerHTML = PAPERS.map(item => `<option value="${item.id}">四海 · 2026 下半年一期 · 第 ${pad(item.number)} 套</option>`).join('');
render();
if (restored.warning) toast('草稿读取失败，当前可继续录入；建议导出成绩留存');
