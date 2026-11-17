import { esc, icon } from "../../../../src/ui.js";

const action = (name, label, attributes = "", className = "button") => `<button type="button" class="${className}" data-correction-action="${name}" ${attributes}>${label}</button>`;

// A question is the feedback object; users choose it from their answer sheet instead of typing an unrelated number.
export function paperFeedbackPresentation({ attempt, draft, marks = [] }) {
  const rows = attempt.report.rows;
  const selected = new Set(draft.items.map(item => Number(item.question)).filter(Boolean));
  const marked = new Set(marks);
  if (draft.items.some(item => !item.question)) {
    const buttons = questions => questions.map(row => action("pick-feedback-question", `<b>${row.question}</b>${marked.has(row.question) ? `<span>${icon("flag")}存疑</span>` : ""}`, `data-question="${row.question}" aria-label="反馈第 ${row.question} 题${marked.has(row.question) ? "，存疑" : ""}" ${selected.has(row.question) ? "disabled" : ""}`, "rr-feedback-pick")).join("");
    const uncertain = rows.filter(row => marked.has(row.question));
    const all = `<div class="rr-feedback-question-grid" aria-label="全部题目">${buttons(rows)}</div>`;
    return {
      title: "选择反馈题目",
      body: `<div class="rr-feedback-picker">${uncertain.length ? `<h3>待检查</h3><div class="rr-feedback-question-grid" aria-label="存疑题">${buttons(uncertain)}</div><details><summary>全部题目</summary>${all}</details>` : all}<p class="correction-error" data-correction-modal-error role="alert"></p></div>`,
      actions: action("cancel-feedback-question", selected.size ? "返回反馈" : "取消"),
    };
  }
  const cards = draft.items.map((item, index) => {
    const row = rows.find(row => row.question === Number(item.question));
    const title = `<header><span>${esc(row.type)}</span>${marked.has(row.question) ? `<span class="rr-feedback-mark">${icon("flag")}存疑</span>` : ""}${draft.items.length > 1 ? action("remove-row", icon("trash"), `data-row-index="${index}" aria-label="移除第 ${row.question} 题反馈"`, "rr-feedback-remove") : ""}</header>`;
    const choices = ["A", "B", "C", "D"].map(answer => `<label class="rr-feedback-choice"><input type="radio" name="suggestedAnswer-${index}" data-suggested-answer value="${answer}" ${item.suggestedAnswer === answer ? "checked" : ""} required aria-label="第 ${row.question} 题建议 ${answer}"/><span>${answer}</span></label>`).join("");
    return `<fieldset class="rr-feedback-question" data-correction-row>${title}<div class="rr-feedback-question-title">第 <b>${row.question}</b> 题<input type="hidden" name="question" value="${row.question}"/></div><div class="rr-feedback-original" data-correction-reference><span>我选 <b>${esc(row.answer || "留空")}</b></span><span>参考 <b>${esc(row.correctAnswer)}</b></span></div><div class="rr-feedback-choices" role="group" aria-label="第 ${row.question} 题建议答案">${choices}</div><label class="field-label rr-feedback-evidence">反馈依据<textarea name="evidence" rows="2" required maxlength="4000" placeholder="出处、页码或核对过程">${esc(item.evidence)}</textarea></label></fieldset>`;
  }).join("");
  return {
    title: "反馈参考答案",
    body: `<form id="correction-feedback-form" class="rr-question-feedback-form" data-correction-form="feedback"><div class="rr-feedback-question-list">${cards}</div>${action("add-row", "再反馈一题", "", "rr-feedback-add")}<p class="correction-error" data-correction-modal-error role="alert"></p></form>`,
    actions: `${action("close", "取消")}<button class="button primary" type="submit" form="correction-feedback-form">提交反馈</button>`,
  };
}
