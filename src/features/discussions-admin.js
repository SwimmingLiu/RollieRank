import { esc, icon, date } from "../ui.js";

const STATUS_LABELS = {
  approved: "已公开",
  pending: "审核中",
  flagged: "待复核",
  rejected: "已屏蔽",
};

const FILTER_TABS = [
  ["queue", "待复核"],
  ["all", "全部"],
  ["approved", "已公开"],
  ["rejected", "已屏蔽"],
];

const actionButton = (action, label, className = "button outline", attrs = "") =>
  `<button type="button" class="${className}" data-disc-admin-action="${action}" ${attrs}>${label}</button>`;

const errorBox = (message) => `<p class="disc-admin-error" role="alert">${esc(message)}</p>`;

export function createDiscussionsAdminFeature(ctx) {
  let summary = null;
  let data = null;
  let reviewToken = "";
  let filter = "queue";
  let searchQuery = "";
  let page = 1;
  let loadError = "";
  let adminError = "";
  let busy = false;
  let generation = 0;

  const rerender = () => ctx.render();
  const modalError = (message) => {
    const node = document.querySelector("[data-disc-admin-modal-error]");
    if (node) node.textContent = message;
    else ctx.toast(message);
  };
  const emitToken = (token) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("rr:admin-token-change", { detail: { token, source: "discussions-admin" } }));
    }
  };

  async function refresh() {
    const currentGeneration = ++generation;
    const currentPage = ctx.route().page;
    loadError = "";
    adminError = "";
    if (currentPage !== "admin") return;
    const jobs = [
      ctx.api("discussions/admin/summary").then((value) => {
        if (currentGeneration === generation) summary = value;
      }),
    ];
    if (reviewToken) {
      jobs.push(
        ctx.api("discussions/admin/list", {
          reviewToken,
          status: filter,
          query: searchQuery,
          page,
          pageSize: 20,
        }).then((value) => {
          if (currentGeneration === generation) {
            data = value;
            summary = value.summary;
          }
        }).catch((error) => {
          if (currentGeneration === generation) {
            data = null;
            adminError = error.message;
          }
        }),
      );
    }
    const results = await Promise.allSettled(jobs);
    if (currentGeneration !== generation) return;
    loadError = results.find((result) => result.status === "rejected")?.reason?.message ?? "";
    rerender();
  }

  function statusBadges(comment) {
    const status = comment.moderation?.status ?? "approved";
    const parts = [
      `<span class="disc-admin-status disc-admin-status-${esc(status)}">${esc(STATUS_LABELS[status] ?? "已公开")}</span>`,
    ];
    if (comment.reportCount > 0) {
      parts.push(`<span class="disc-admin-status disc-admin-status-flagged">举报 ${comment.reportCount}</span>`);
    }
    return parts.join("");
  }

  function commentRow(comment) {
    const status = comment.moderation?.status ?? "approved";
    const reason = comment.moderation?.reason || "";
    const labels = (comment.moderation?.labels ?? []).filter(Boolean);
    const images = comment.images ?? [];
    const links = comment.links ?? [];
    const traces = comment.moderation?.traces ?? [];
    const pendingMedia = traces.filter((t) => t.status === "pending").length;
    return `<article class="disc-admin-item" data-comment-id="${esc(comment.id)}">
      <div class="disc-admin-item-head">
        <div class="disc-admin-item-meta">
          <b>${esc(comment.author?.name || "匿名卷友")}</b>
          <small>${esc(comment.paperTitle || comment.paperId)} · ${date(comment.createdAt, true)}</small>
        </div>
        <div class="disc-admin-badges">${statusBadges(comment)}</div>
      </div>
      ${comment.replyTo ? `<p class="disc-admin-reply-to">回复 ${esc(comment.replyTo.name)}</p>` : ""}
      ${comment.text ? `<p class="disc-admin-text">${esc(comment.text)}</p>` : ""}
      ${links.length ? `<div class="disc-admin-links">${links.map((href) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(href)}</a>`).join("")}</div>` : ""}
      ${images.length ? `<div class="disc-admin-images">${images.map((img, idx) => `<button type="button" class="disc-admin-thumb" data-disc-admin-action="preview-image" data-comment-id="${esc(comment.id)}" data-image-index="${idx}" aria-label="查看配图 ${idx + 1}"><img src="${esc(img.dataUri)}" alt="${esc(img.alt || `配图 ${idx + 1}`)}" loading="lazy"/></button>`).join("")}</div>` : ""}
      ${comment.audio?.dataUri ? `<audio class="disc-admin-audio" controls preload="none" src="${esc(comment.audio.dataUri)}"></audio>` : ""}
      ${(reason || labels.length || pendingMedia > 0) ? `<p class="disc-admin-reason">${esc(reason || (pendingMedia > 0 ? "图片/语音等待微信异步检测结果" : ""))}${labels.length ? ` · 标签：${esc(labels.join("、"))}` : ""}</p>` : ""}
      ${comment.reports?.length ? `<p class="disc-admin-reason">举报说明：${esc(comment.reports.map((r) => r.reason).join("；"))}</p>` : ""}
      <div class="disc-admin-row-actions">
        ${status !== "approved" ? actionButton("approve", "通过", "button outline compact", `data-comment-id="${esc(comment.id)}"`) : ""}
        ${status !== "rejected" ? actionButton("reject", "屏蔽", "button outline compact", `data-comment-id="${esc(comment.id)}"`) : ""}
        ${actionButton("delete", "删除", "text-button disc-admin-danger", `data-comment-id="${esc(comment.id)}"`)}
      </div>
    </article>`;
  }

  function adminHtml() {
    const queueCount = summary?.queueCount ?? 0;
    const wechatBadge = summary
      ? (summary.wechatSecEnabled
          ? (summary.mediaCallbackReady ? "微信图文安全已启用" : "微信文本安全已启用")
          : "本地词库 + 人工审核")
      : "";
    const modeLabel = summary?.mode === "manual" ? "先审后发" : "自动机审";
    const comments = data?.comments ?? [];
    const blockedLog = data?.blockedLog ?? [];
    return `<section class="card disc-admin-card">
      <div class="disc-admin-heading">
        <div>
          <h2>评论管理 ${summary ? `<span class="disc-admin-count">${queueCount} 待复核</span>` : ""}</h2>
          ${summary ? `<p class="disc-admin-sub">${esc(wechatBadge)} · ${esc(modeLabel)} · 共 ${summary.totalCount} 条</p>` : ""}
        </div>
        <div class="disc-admin-actions">
          ${actionButton("refresh", `${icon("refresh")}刷新`, "text-button")}
          ${reviewToken
            ? `${actionButton("settings", "审核策略", "button outline")}${actionButton("lock", "退出", "button outline")}`
            : actionButton("unlock", `${icon("lock")}解锁管理`, "button outline", summary?.reviewEnabled === false ? "disabled" : "")}
        </div>
      </div>
      ${summary?.reviewEnabled === false ? '<p class="disc-admin-muted">审核尚未启用，请联系维护者配置审核凭证。</p>' : ""}
      ${loadError || adminError ? errorBox(loadError || adminError) : ""}
      ${data ? `
        <div class="disc-admin-toolbar">
          <div class="disc-admin-filters" role="tablist" aria-label="评论状态筛选">
            ${FILTER_TABS.map(([id, label]) => `<button type="button" role="tab" aria-selected="${filter === id ? "true" : "false"}" class="disc-admin-tab ${filter === id ? "is-active" : ""}" data-disc-admin-action="filter" data-filter="${id}">${label}</button>`).join("")}
          </div>
          <form class="disc-admin-search" data-disc-admin-form="search">
            <input name="q" type="search" value="${esc(searchQuery)}" placeholder="搜索正文、昵称或套卷" maxlength="100" aria-label="搜索评论"/>
            <button type="submit" class="button outline compact">搜索</button>
          </form>
        </div>
        ${comments.length
          ? `<div class="disc-admin-list">${comments.map(commentRow).join("")}</div>`
          : `<p class="disc-admin-muted">${filter === "queue" ? "当前没有待复核评论。" : "没有匹配的评论。"}</p>`}
        ${data.pages > 1 ? `<div class="disc-admin-pager">
          ${actionButton("prev-page", "上一页", "button outline compact", page <= 1 ? "disabled" : "")}
          <span>第 ${data.page} / ${data.pages} 页</span>
          ${actionButton("next-page", "下一页", "button outline compact", page >= data.pages ? "disabled" : "")}
        </div>` : ""}
        ${blockedLog.length ? `<details class="disc-admin-blocked"><summary>自动拦截记录（${blockedLog.length}）</summary><ul>${blockedLog.map((item) => `<li><b>${esc(item.nickname || "匿名")}</b><small>${esc(item.reason || "")} · ${date(item.createdAt, true)}</small>${item.text ? `<p>${esc(item.text)}</p>` : ""}</li>`).join("")}</ul></details>` : ""}
      ` : reviewToken
        ? '<p class="disc-admin-muted">正在读取评论队列…</p>'
        : `<p class="disc-admin-muted">${summary ? `已公开 ${summary.approvedCount} 条，已屏蔽 ${summary.rejectedCount} 条。` : "正在读取评论状态…"}解锁维护者凭证后可审核评论、查看图片与配置敏感词。</p>`}
    </section>`;
  }

  function afterRender() {
    const node = document.querySelector('[data-feature="discussions-admin"]');
    if (node) node.innerHTML = adminHtml();
    const kpiCount = document.querySelector('[data-kpi="comments-queue"]');
    const kpiMeta = document.querySelector('[data-kpi="comments-meta"]');
    if (kpiCount && summary) kpiCount.textContent = String(summary.queueCount ?? 0);
    if (kpiMeta && summary) {
      const sec = summary.wechatSecEnabled ? (summary.mediaCallbackReady ? "微信图文安全已启用" : "微信文本安全已启用") : "本地词库 + 人工审核";
      kpiMeta.textContent = `${sec} · 共 ${summary.totalCount} 条`;
    }
  }

  function openUnlockModal() {
    ctx.openModal(
      "评论管理凭证",
      `<form id="disc-admin-credential-form" data-disc-admin-form="credential">
        <label class="field-label">维护者凭证<input name="reviewToken" type="password" autofocus required maxlength="4096" autocomplete="off"/></label>
        <p class="disc-admin-muted">与答案审核共用同一维护者凭证，仅保存在当前页面会话。</p>
        <p class="disc-admin-error" data-disc-admin-modal-error role="alert"></p>
      </form>`,
      `${actionButton("close", "取消")}<button type="submit" form="disc-admin-credential-form" class="button primary">进入管理</button>`,
      "disc-admin-dialog",
    );
  }

  function openSettingsModal() {
    const settings = data?.settings ?? { mode: "auto", blockedKeywords: [] };
    ctx.openModal(
      "评论审核策略",
      `<form id="disc-admin-settings-form" data-disc-admin-form="settings">
        <label class="field-label">审核模式
          <select name="mode">
            <option value="auto" ${settings.mode !== "manual" ? "selected" : ""}>自动机审（正常放行，疑似或媒体待审进队列）</option>
            <option value="manual" ${settings.mode === "manual" ? "selected" : ""}>全量先审后发（所有新评论须人工通过后公开）</option>
          </select>
        </label>
        <label class="field-label">自定义敏感词（每行或逗号分隔，命中直接拦截）
          <textarea name="blockedKeywords" rows="4" placeholder="例如：加微卖课, 内部原题, 代考">${esc((settings.blockedKeywords ?? []).join("\n"))}</textarea>
        </label>
        <p class="disc-admin-muted">${summary?.wechatSecEnabled
          ? (summary.mediaCallbackReady ? "微信文本与图片/语音（含图中文字）自动审核均已就绪。" : "微信文本自动审核已启用；配置公网回调域名后可同步开启图片/语音异步检测。")
          : "未检测到微信 AppID/Secret 环境变量，当前使用本地敏感词与人工审核。"}</p>
        <p class="disc-admin-error" data-disc-admin-modal-error role="alert"></p>
      </form>`,
      `${actionButton("close", "取消")}<button type="submit" form="disc-admin-settings-form" class="button primary">保存配置</button>`,
      "disc-admin-dialog",
    );
  }

  function openDeleteConfirm(commentId) {
    const comment = data?.comments.find((item) => item.id === commentId);
    if (!comment) return;
    ctx.openModal(
      "确认删除评论",
      `<p class="disc-admin-muted">删除后不可恢复${!comment.parentId ? "，其下方的子回复也会一并删除" : ""}。</p>
      <p class="disc-admin-preview-quote">${esc(comment.text || "（仅含附件的评论）")}</p>
      <p class="disc-admin-error" data-disc-admin-modal-error role="alert"></p>`,
      `${actionButton("close", "取消")}${actionButton("confirm-delete", "确认删除", "button primary", `data-comment-id="${esc(commentId)}"`)}`,
      "disc-admin-dialog",
    );
  }

  function openImagePreview(commentId, imageIndex) {
    const comment = data?.comments.find((item) => item.id === commentId);
    const image = comment?.images?.[Number(imageIndex)];
    if (!image) return;
    ctx.openModal(
      `配图核查 · ${esc(comment.author?.name || "评论图片")}`,
      `<div class="disc-admin-lightbox"><img src="${esc(image.dataUri)}" alt="${esc(image.alt || "评论配图")}"/></div>`,
      actionButton("close", "关闭"),
      "disc-admin-dialog",
    );
  }

  async function runBusy(operation) {
    if (busy) return;
    busy = true;
    try {
      await operation();
    } catch (error) {
      modalError(error.message || "操作失败，请重试。");
    } finally {
      busy = false;
    }
  }

  async function reviewComment(commentId, action) {
    if (!reviewToken || !commentId) return;
    await runBusy(async () => {
      await ctx.api("discussions/admin/review", { reviewToken, commentId, action });
      if (action === "delete") ctx.closeModal();
      ctx.toast(action === "approve" ? "已通过并公开" : action === "reject" ? "已屏蔽该评论" : "已删除该评论");
      await refresh();
    });
  }

  function onClick(event) {
    const button = event.target.closest?.("[data-disc-admin-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.discAdminAction;
    if (action === "close") { ctx.closeModal(); return; }
    if (action === "refresh") { void refresh(); return; }
    if (action === "unlock") { openUnlockModal(); return; }
    if (action === "settings") { openSettingsModal(); return; }
    if (action === "lock") {
      reviewToken = "";
      data = null;
      adminError = "";
      emitToken("");
      void refresh();
      return;
    }
    if (action === "filter") {
      filter = button.dataset.filter || "queue";
      page = 1;
      void refresh();
      return;
    }
    if (action === "prev-page") {
      if (page > 1) { page -= 1; void refresh(); }
      return;
    }
    if (action === "next-page") {
      if (data && page < data.pages) { page += 1; void refresh(); }
      return;
    }
    if (action === "approve" || action === "reject") {
      void reviewComment(button.dataset.commentId, action);
      return;
    }
    if (action === "delete") {
      openDeleteConfirm(button.dataset.commentId);
      return;
    }
    if (action === "confirm-delete") {
      void reviewComment(button.dataset.commentId, "delete");
      return;
    }
    if (action === "preview-image") {
      openImagePreview(button.dataset.commentId, button.dataset.imageIndex);
    }
  }

  function onSubmit(event) {
    const form = event.target.closest?.("[data-disc-admin-form]");
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.discAdminForm;
    if (kind === "credential") {
      const input = form.querySelector("[name=reviewToken]");
      const credential = input?.value ?? "";
      if (!credential) return;
      input.value = "";
      void runBusy(async () => {
        const result = await ctx.api("discussions/admin/list", {
          reviewToken: credential,
          status: filter,
          query: searchQuery,
          page: 1,
          pageSize: 20,
        });
        reviewToken = credential;
        data = result;
        summary = result.summary;
        adminError = "";
        ctx.closeModal();
        emitToken(credential);
        rerender();
      });
    } else if (kind === "settings") {
      const mode = form.querySelector("[name=mode]")?.value || "auto";
      const blockedKeywords = form.querySelector("[name=blockedKeywords]")?.value ?? "";
      void runBusy(async () => {
        const result = await ctx.api("discussions/admin/settings", {
          reviewToken,
          mode,
          blockedKeywords,
        });
        if (data) data.settings = result.settings;
        summary = result.summary;
        ctx.closeModal();
        ctx.toast("审核策略已保存");
        rerender();
      });
    } else if (kind === "search") {
      searchQuery = form.querySelector("[name=q]")?.value?.trim() ?? "";
      page = 1;
      void refresh();
    }
  }

  function onTokenSync(event) {
    if (event.detail?.source === "discussions-admin") return;
    const nextToken = typeof event.detail?.token === "string" ? event.detail.token : "";
    if (nextToken === reviewToken) return;
    reviewToken = nextToken;
    if (!reviewToken) data = null;
    if (ctx.route().page === "admin") void refresh();
  }

  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  if (typeof window !== "undefined") window.addEventListener("rr:admin-token-change", onTokenSync);

  return {
    afterRender,
    onRoute: refresh,
    dispose() {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      if (typeof window !== "undefined") window.removeEventListener("rr:admin-token-change", onTokenSync);
    },
  };
}
