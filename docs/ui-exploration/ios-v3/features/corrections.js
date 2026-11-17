import { createCorrectionsFeature } from "../../../../src/features/corrections.js";
import { esc, icon, score } from "../../../../src/ui.js";
import { paperFeedbackPresentation } from "./correction-feedback.js";

export function createIOSCorrectionsFeature(ctx) {
  const marksFor = attempt => (ctx.uiState?.().reviewMarks?.[attempt.id] ?? []).filter(number => attempt.report.rows.some(row => row.question === number));
  const feature = createCorrectionsFeature({
    ...ctx,
    // BottomSheet 是实际业务弹层，不能依赖只存在于根应用的 dialog[open]。
    modalSelector: ctx.modalSelector ?? ".rr-sheet",
    feedbackPresentation: ({ attempt, draft }) => paperFeedbackPresentation({ attempt, draft, marks: marksFor(attempt) }),
    defaultFeedbackQuestion: attempt => {
      const marks = marksFor(attempt);
      return marks.length === 1 ? marks[0] : undefined;
    },
    openModal(title, body, actions = "") {
      ctx.openModal(title,
        `<div class="ios-corrections-sheet">${body}</div>`,
        actions ? `<div class="ios-corrections-sheet-actions">${actions}</div>` : "",
        "ios-corrections-modal");
    },
  });

  const adminView = () => '<div class="ios-corrections-admin-view"><div data-feature="corrections-admin" class="ios-feature-host"></div><div data-feature="positions-admin" class="ios-feature-host"></div></div>';
  const maintenanceEntry = () => `<div class="ios-corrections-maintenance"><button type="button" class="text-button" data-ios-correction-action="admin">${icon("shield")}维护者审核${icon("right")}</button></div>`;
  function reportStatusView() {
    const notice = feature.reportNotifications()
      .filter((item) => item.changes?.some((change) => change.beforeAnswer !== change.afterAnswer))
      .sort((a, b) => b.toRevision - a.toRevision)[0];
    if (!notice) return "";
    const difference = notice.deltaCents ? `<strong>${notice.deltaCents > 0 ? "+" : ""}${score(notice.deltaCents)} 分</strong>` : "";
    return `<button type="button" class="ios-corrections-report-status" data-correction-action="notice" data-notice-id="${esc(notice.id)}" aria-label="查看答案订正处理详情">${icon("check")}<span>答案已订正</span>${difference}${icon("right")}</button>`;
  }
  function afterRender() {
    feature.afterRender();
    // 报告以实际订正状态代替常驻反馈卡；兼容尚未移除的旧宿主，不留下空卡片。
    document.querySelector('[data-feature="corrections-report"]')?.replaceChildren();
    const status = document.querySelector('[data-feature="corrections-status"]');
    if (status) status.innerHTML = reportStatusView();
    for (const slot of document.querySelectorAll('[data-feature^="corrections-"]')) slot.classList.add("ios-corrections-host");
    const card = document.querySelector('[data-feature="corrections-user"] .correction-card');
    if (card) {
      // 空通知不占一张纸卡；有真实内容或错误时保留通知与恢复入口。
      if (!card.querySelector(".correction-list-row, .correction-error")) card.replaceWith(document.createRange().createContextualFragment(maintenanceEntry()));
      else card.insertAdjacentHTML("beforeend", maintenanceEntry());
    }
  }
  function click(event) {
    const button = event.target.closest?.('[data-ios-correction-action="admin"]');
    if (!button || button.disabled) return;
    event.preventDefault();
    ctx.navigate("admin");
  }
  document.addEventListener("click", click);
  // A visual viewport resize can occur after focus; reveal the current field inside the dedicated feedback scroller.
  const revealFeedbackField = () => requestAnimationFrame(() => {
    const field = document.activeElement;
    if (field?.matches?.('.rr-question-feedback-form textarea,.rr-question-feedback-form input:not([type=hidden])')) field.scrollIntoView({ block: "nearest" });
  });
  window.addEventListener("resize", revealFeedbackField);
  window.visualViewport?.addEventListener("resize", revealFeedbackField);
  return { ...feature, afterRender, adminView, reportStatusView,
    dispose() { document.removeEventListener("click", click); window.removeEventListener("resize", revealFeedbackField); window.visualViewport?.removeEventListener("resize", revealFeedbackField); feature.dispose(); },
  };
}
