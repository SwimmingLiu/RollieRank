import {
  DISCUSSION_LIMITS, normalizeDiscussionImage,
  normalizeDiscussionLink, safeDiscussionMedia,
} from "../../../../src/features/discussions.js";
import { esc, date } from "../../../../src/ui.js";

const uid = () => crypto.randomUUID();
const DRAFT_STORAGE_PREFIX = "rollierank:discussion-drafts:v1:";
const DRAFT_STORAGE_CHAR_LIMIT = 1800000, DRAFT_STORAGE_COUNT_LIMIT = 50;
const DRAFT_STORAGE_MAX_AGE = 90 * 24 * 60 * 60 * 1000;
const postExcerpt = (post) => {
  if (!post) return null;
  const text = post.text.replace(/\s+/gu, " ").trim() || (post.images.length ? "图片评论" : "这条评论");
  return text.length > 56 ? text.slice(0, 56) + "…" : text;
};

// Mobile comments recognize URLs in their text, preserving surrounding punctuation and balanced URL parentheses.
export function discussionTextParts(text) {
  const parts = [], pattern = /https?:\/\/[^\s<>"'，。！？、；：）】〉》“”‘’]+/giu;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    let candidate = match[0].replace(/[.,!?;:]+$/u, "");
    for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
      while (candidate.endsWith(close) && candidate.split(close).length > candidate.split(open).length) candidate = candidate.slice(0, -1);
    }
    candidate = candidate.replace(/[.,!?;:]+$/u, "");
    let href;
    try { href = normalizeDiscussionLink(candidate); } catch { continue; }
    if (match.index > cursor) parts.push({ kind: "text", text: text.slice(cursor, match.index) });
    parts.push({ kind: "link", text: candidate, href });
    cursor = match.index + candidate.length;
  }
  if (cursor < text.length || !parts.length) parts.push({ kind: "text", text: text.slice(cursor) });
  return parts;
}
export function extractDiscussionLinks(text) { return [...new Set(discussionTextParts(text).filter((part) => part.kind === "link").map((part) => part.href))]; }

// 旧包装把整张表单放进报告；新控制器复用媒体工具，列表和 BottomSheet 各自保留状态。
export function createIOSDiscussionsFeature(ctx) {
  const DEFAULT_NAME = "卷友";
  const pages = new Map(), drafts = new Map(), lastTargets = new Map(), mounts = new Map(), restoredGuests = new Set();
  let editor = null, editorObserver = null, destroyed = false;
  let storageReadNotice = "";
  const ui = () => window.RollieUI;
  const validNickname = (value) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= DISCUSSION_LIMITS.nickname && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value);
  // 评论直接使用已有身份；无资料时统一显示默认昵称，不再打断发言流程要求填写昵称。
  const profileName = () => validNickname(ctx.state().profile?.name) ? ctx.state().profile.name.trim() : DEFAULT_NAME;
  const currentScope = () => {
    const attempt = ctx.attempt();
    if (!attempt) return null;
    const guestId = ctx.state().guestId;
    return { guestId, paperId: attempt.paperId, attemptId: attempt.id,
      key: `${guestId}:${attempt.paperId}`, real: !attempt.isSample && attempt.paperId !== "sample-preview",
      title: attempt.paperTitle || ctx.version()?.title || "当前试卷" };
  };
  const pageFor = (scope) => {
    if (!pages.has(scope.key)) pages.set(scope.key, { posts: [], threads: new Map(), pendingLikes: new Set(), total: null, loaded: false, requested: false, loading: false, error: "", nextCursor: null, pending: null, refreshAfterLoad: false, sequence: 0, revisions: new Map() });
    return pages.get(scope.key);
  };
  // Each reply target owns its draft so replying to a second person cannot overwrite unsent text.
  const draftKey = (scope, target) => `${scope.key}:${target?.id || "root"}`;
  // The old in-memory map lost authored text on refresh; restore only bounded, sanitized records for this identity.
  function restoreDrafts(scope) {
    if (!scope.real || restoredGuests.has(scope.guestId)) return;
    restoredGuests.add(scope.guestId);
    const identifier = value => typeof value === "string" && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value);
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_PREFIX + scope.guestId);
      if (!raw) return;
      if (raw.length > DRAFT_STORAGE_CHAR_LIMIT) throw new Error("oversized draft storage");
      const saved = JSON.parse(raw);
      if (saved?.version !== 1 || !Array.isArray(saved.drafts)) throw new Error("invalid draft storage");
      for (const entry of saved.drafts.slice(0, DRAFT_STORAGE_COUNT_LIMIT)) {
        if (!identifier(entry?.paperId) || typeof entry.text !== "string" || entry.text.length > DISCUSSION_LIMITS.text || !Number.isFinite(entry.updatedAt) || Date.now() - entry.updatedAt > DRAFT_STORAGE_MAX_AGE) continue;
        const target = entry.target === null ? null : identifier(entry.target?.id) && identifier(entry.target?.rootId) && validNickname(entry.target?.name) && typeof entry.target.excerpt === "string" && entry.target.excerpt.length <= 80 ? entry.target : undefined;
        if (target === undefined) continue;
        const scopeKey = `${scope.guestId}:${entry.paperId}`;
        const images = (Array.isArray(entry.images) ? entry.images : []).slice(0, DISCUSSION_LIMITS.images).flatMap(image => {
          const dataUri = typeof image?.dataUri === "string" && image.dataUri.length <= Math.ceil(DISCUSSION_LIMITS.imageBytes * 4 / 3) + 100 ? safeDiscussionMedia(image.dataUri, "image") : null;
          return dataUri && identifier(image.id) ? [{ id: image.id, dataUri, alt: typeof image.alt === "string" ? image.alt.slice(0, 120) : "讨论配图" }] : [];
        });
        const draft = { guestId: scope.guestId, paperId: entry.paperId, scopeKey, target, text: entry.text, images, updatedAt: entry.updatedAt,
          busy: false, processing: false, error: "", notice: entry.missingImages ? "图片草稿未能保存，请重新添加照片。" : "",
          clientId: identifier(entry.clientId) ? entry.clientId : uid(), lastSubmission: typeof entry.lastSubmission === "string" && entry.lastSubmission.length <= 16000 ? entry.lastSubmission : "" };
        drafts.set(`${scopeKey}:${target?.id || "root"}`, draft);
        if (entry.selected) lastTargets.set(scopeKey, target);
      }
    } catch { storageReadNotice = "旧草稿暂时无法恢复，请重新编辑；当前内容仍可发表。"; }
  }
  // Keep text and retry tokens even when photos exceed browser quota; unsaved media stays in memory with a visible recovery notice.
  function persistDrafts(scope) {
    const owned = [...drafts.values()].filter(draft => draft.guestId === scope.guestId && hasContent(draft)).sort((a, b) => b.updatedAt - a.updatedAt);
    const entries = owned.slice(0, DRAFT_STORAGE_COUNT_LIMIT).map(draft => ({ paperId: draft.paperId, target: draft.target, text: draft.text, images: [],
      updatedAt: draft.updatedAt, clientId: draft.clientId, lastSubmission: draft.lastSubmission, missingImages: draft.images.length,
      selected: lastTargets.has(draft.scopeKey) && (lastTargets.get(draft.scopeKey)?.id || "root") === (draft.target?.id || "root") }));
    let remaining = DRAFT_STORAGE_CHAR_LIMIT - JSON.stringify({ version: 1, drafts: entries }).length;
    entries.forEach((entry, index) => {
      for (const image of owned[index].images) {
        const saved = { id: image.id, dataUri: image.dataUri, alt: image.alt }, length = JSON.stringify(saved).length + 1;
        if (length <= remaining) { entry.images.push(saved); entry.missingImages--; remaining -= length; }
      }
    });
    try {
      const key = DRAFT_STORAGE_PREFIX + scope.guestId;
      if (entries.length) {
        try { localStorage.setItem(key, JSON.stringify({ version: 1, drafts: entries })); }
        catch {
          entries.forEach((entry, index) => { entry.images = []; entry.missingImages = owned[index].images.length; });
          localStorage.setItem(key, JSON.stringify({ version: 1, drafts: entries }));
        }
      } else localStorage.removeItem(key);
      storageReadNotice = "";
      owned.forEach((draft, index) => { draft.notice = index >= entries.length ? "草稿空间已满，本次内容仅在当前页面保留。" : entries[index].missingImages ? "图片草稿未能保存，刷新后需重新添加照片。" : ""; });
    } catch { owned.forEach(draft => { draft.notice = "草稿暂时无法保存，刷新前请先发表或复制文字。"; }); }
  }
  const draftFor = (scope, target = null) => {
    restoreDrafts(scope);
    const key = draftKey(scope, target);
    if (!drafts.has(key)) drafts.set(key, { guestId: scope.guestId, paperId: scope.paperId, scopeKey: scope.key, target, text: "", images: [], updatedAt: Date.now(),
      busy: false, processing: false, error: "", notice: storageReadNotice, clientId: uid(), lastSubmission: "" });
    if (target) drafts.get(key).target = target;
    return drafts.get(key);
  };
  const hasContent = (draft) => Boolean(draft && (draft.text.trim() || draft.images.length));
  const hasDraft = (scope) => { restoreDrafts(scope); return [...drafts.values()].some(draft => draft.scopeKey === scope.key && hasContent(draft)); };
  const threadFor = (scope, rootId) => {
    const threads = pageFor(scope).threads;
    if (!threads.has(rootId)) threads.set(rootId, { rootId, posts: [], expanded: false, total: 0, nextCursor: null, pending: null, loaded: false, state: { kind: "idle" }, refreshAfterLoad: false });
    return threads.get(rootId);
  };
  const readState = (scope) => {
    const page = pageFor(scope);
    if (page.error) return { kind: "error", message: page.error };
    return page.loaded && page.total !== null ? { kind: "ready", total: page.total } : { kind: "loading" };
  };

  function attach(host, mount, props) {
    if (!host || typeof mount !== "function") return;
    mounts.set(host, mount(host, props));
  }
  function releaseDetached() {
    for (const [host, dispose] of mounts) if (!host.isConnected) { mounts.delete(host); dispose(); }
  }
  function parsePost(raw, scope) {
    if (!raw || typeof raw.id !== "string" || raw.paperId !== scope.paperId || typeof raw.author?.name !== "string") throw new Error("讨论数据无法识别，请重新加载。");
    const images = (Array.isArray(raw.images) ? raw.images : []).slice(0, DISCUSSION_LIMITS.images).flatMap((image, index) => {
      const src = safeDiscussionMedia(image?.dataUri, "image");
      return src ? [{ id: `${raw.id}:${index}`, src, alt: typeof image.alt === "string" ? image.alt : "讨论配图" }] : [];
    });
    const text = typeof raw.text === "string" ? raw.text : "", textParts = discussionTextParts(text);
    const inline = new Set(textParts.filter((part) => part.kind === "link").map((part) => part.href));
    const links = [...new Set((Array.isArray(raw.links) ? raw.links : []).slice(0, DISCUSSION_LIMITS.links).flatMap(value => {
      try { return [normalizeDiscussionLink(value)]; } catch { return []; }
    }))].filter((link) => !inline.has(link));
    const validTime = Number.isFinite(raw.createdAt) && Number.isFinite(new Date(raw.createdAt).getTime());
    const parentId = typeof raw.parentId === "string" ? raw.parentId : null;
    return { id: raw.id, name: raw.author.name, text, textParts, createdAt: validTime ? raw.createdAt : 0,
      time: validTime ? date(raw.createdAt, true) : "", datetime: validTime ? new Date(raw.createdAt).toISOString() : "",
      version: typeof raw.versionLabel === "string" ? raw.versionLabel : "", images, links,
      parentId, rootId: typeof raw.rootId === "string" ? raw.rootId : raw.id,
      replyTo: parentId && typeof raw.replyTo?.id === "string" && typeof raw.replyTo.name === "string" ? { id: raw.replyTo.id, name: raw.replyTo.name, excerpt: null } : null,
      likeCount: Number.isSafeInteger(raw.likeCount) && raw.likeCount >= 0 ? raw.likeCount : 0,
      likedByMe: raw.likedByMe === true, replyCount: Number.isSafeInteger(raw.replyCount) && raw.replyCount >= 0 ? raw.replyCount : 0, action: { kind: "idle" } };
  }

  const findPost = (page, id) => page.posts.find(post => post.id === id) || [...page.threads.values()].flatMap(thread => thread.posts).find(post => post.id === id);
  function rememberPost(page, post) {
    const existing = findPost(page, post.id);
    if (existing) Object.assign(existing, post);
    else if (!post.parentId) page.posts.unshift(post);
    page.revisions.set(post.id, ++page.sequence);
  }
  const mergePosts = (page, previous, fetched, sequence, more) => {
    const changed = previous.filter(post => (page.revisions.get(post.id) || 0) > sequence);
    const next = new Map((more ? previous : changed).map(post => [post.id, post]));
    for (const post of fetched) if (!next.has(post.id) || (page.revisions.get(post.id) || 0) <= sequence) next.set(post.id, post);
    return [...next.values()];
  };

  function grade() {
    const version = ctx.version();
    ctx.navigate(version?.id ? `practice/${encodeURIComponent(version.id)}` : "me");
  }
  function showImage(image) {
    const src = safeDiscussionMedia(image.src, "image");
    if (src) ctx.openModal("讨论配图", `<img class="rr-discussion-full-image" src="${esc(src)}" alt="${esc(image.alt)}"/>`);
  }
  function paintSurfaces() {
    if (destroyed) return;
    releaseDetached();
    const scope = currentScope(), route = ctx.route().page;
    if (route === "report" && scope) {
      const host = document.querySelector("[data-ios-discussion-entry]") || document.querySelector('[data-feature="discussions"]');
      host?.classList.add("ios-feature-host", "ios-discussion-entry-host");
      attach(host, ui()?.mountDiscussionReportEntry, { read: scope.real ? readState(scope) : { kind: "ready", total: 0 }, sample: !scope.real,
        compact: host.dataset.discussionVariant === "compact", onOpen: () => ctx.navigate("discussion") });
    }
    if (route === "discussion") {
      const host = document.querySelector("[data-ios-discussion-page]");
      host?.classList.add("ios-feature-host", "ios-discussion-page-host");
      const page = scope?.real ? pageFor(scope) : null;
      // These handlers share the rendered paper scope, including when an earlier request finishes after navigation.
      attach(host, ui()?.mountDiscussionPage, { title: scope?.title || "本卷交流", access: !scope ? "missing" : scope.real ? "real" : "sample",
        read: page ? readState(scope) : { kind: "ready", total: 0 }, posts: page?.posts || [], hasMore: Boolean(page?.nextCursor), loadingMore: Boolean(page?.loading),
        threads: page ? [...page.threads.values()].map(thread => ({ ...thread, hasMore: Boolean(thread.nextCursor),
          posts: thread.posts.map(post => ({ ...post, replyTo: post.replyTo ? { ...post.replyTo, excerpt: postExcerpt(findPost(page, post.parentId)) } : null })) })) : [],
        hasDraft: scope ? hasDraft(scope) : false, name: profileName(), onWrite: () => openEditor(),
        onPhotoFiles: files => { openEditor(); if (editor) void addFiles(editor.scope, editor.target, files); },
        onMore: () => { if (scope) void load(scope, true); }, onRetry: () => { if (scope) void load(scope); }, onGrade: scope ? grade : () => ctx.navigate("me"), onImage: showImage,
        onLike: post => { if (scope) void setLike(scope, post.id); }, onReply: post => openEditor({ id: post.id, name: post.name, rootId: post.rootId, excerpt: postExcerpt(post) }),
        onThread: rootId => { if (scope) { const thread = threadFor(scope, rootId); thread.expanded = !thread.expanded; paintSurfaces(); if (thread.expanded && !thread.loaded) void loadReplies(scope, rootId); } },
        onMoreReplies: rootId => { if (scope) void loadReplies(scope, rootId, true); }, onRetryReplies: rootId => { if (scope) void loadReplies(scope, rootId, Boolean(threadFor(scope, rootId).nextCursor)); } });
    }
  }

  async function load(scope, more = false) {
    if (destroyed || !scope?.real) return;
    const page = pageFor(scope);
    if (page.pending) return page.pending;
    if (more && !page.nextCursor) return;
    const sequence = page.sequence;
    page.requested = true; page.loading = true; page.error = ""; paintSurfaces();
    const params = new URLSearchParams({ guestId: scope.guestId, paperId: scope.paperId, attemptId: scope.attemptId });
    if (more) params.set("before", page.nextCursor);
    page.pending = (async () => {
      try {
        const result = await ctx.api(`discussions?${params}`);
        if (result.paperId !== scope.paperId || !Array.isArray(result.comments) || !Number.isSafeInteger(result.total) || result.total < 0 || !(result.nextCursor === null || typeof result.nextCursor === "string")) throw new Error("讨论数据无法识别，请重新加载。");
        const fetched = result.comments.map(raw => { const post = parsePost(raw, scope); if (page.pendingLikes.has(post.id)) post.action = { kind: "busy" }; return post; });
        if (fetched.some(post => post.parentId)) throw new Error("讨论数据无法识别，请重新加载。");
        page.posts = mergePosts(page, page.posts, fetched, sequence, more);
        // 首次读取途中发表时，旧快照不能作为新总数；补读服务端数量后再展示。
        page.total = page.refreshAfterLoad && !page.loaded ? null : Math.max(result.total, page.total ?? 0, page.posts.length);
        page.nextCursor = result.nextCursor; page.loaded = page.total !== null;
        // Returning from a report refreshes roots; cached threads must also discover other readers' new replies and likes.
        if (!more) for (const post of page.posts) {
          const thread = page.threads.get(post.id);
          if (!thread) continue;
          thread.total = post.replyCount; thread.loaded = false;
          if (thread.expanded) {
            if (thread.pending) thread.refreshAfterLoad = true;
            else void loadReplies(scope, post.id);
          }
        }
      } catch (error) { page.error = error.message || "暂时无法读取讨论，请重试。"; }
      finally {
        page.loading = false; page.pending = null;
        if (page.refreshAfterLoad) { page.refreshAfterLoad = false; void load(scope); }
        paintSurfaces();
      }
    })();
    return page.pending;
  }

  async function loadReplies(scope, rootId, more = false) {
    if (destroyed || !scope.real) return;
    const page = pageFor(scope), thread = threadFor(scope, rootId);
    if (thread.pending) return thread.pending;
    if (more && !thread.nextCursor) return;
    const sequence = page.sequence;
    const params = new URLSearchParams({ guestId: scope.guestId, paperId: scope.paperId, attemptId: scope.attemptId, rootId });
    if (more) params.set("before", thread.nextCursor);
    thread.state = { kind: "busy" }; paintSurfaces();
    thread.pending = (async () => {
      try {
        const result = await ctx.api(`discussions/replies?${params}`);
        if (result.paperId !== scope.paperId || result.rootId !== rootId || !Array.isArray(result.comments) || !Number.isSafeInteger(result.total) || result.total < 0 || !(result.nextCursor === null || typeof result.nextCursor === "string")) throw new Error("暂时无法读取回复，请重试。");
        const fetched = result.comments.map(raw => { const post = parsePost(raw, scope); if (page.pendingLikes.has(post.id)) post.action = { kind: "busy" }; return post; });
        if (fetched.some(post => !post.parentId || post.rootId !== rootId)) throw new Error("暂时无法读取回复，请重试。");
        // Replies are append-only: retain locally posted tails while an older page is loading.
        thread.posts = mergePosts(page, thread.posts, fetched, sequence, true).sort((a, b) => a.createdAt - b.createdAt);
        thread.total = Math.max(result.total, thread.total); thread.nextCursor = result.nextCursor; thread.loaded = true; thread.state = { kind: "idle" };
      } catch (error) { thread.state = { kind: "error", message: error.message || "暂时无法读取回复，请重试。" }; }
      finally { thread.pending = null; if (thread.refreshAfterLoad) { thread.refreshAfterLoad = false; void loadReplies(scope, rootId); } paintSurfaces(); }
    })();
    return thread.pending;
  }

  async function setLike(scope, id) {
    const page = pageFor(scope), post = findPost(page, id);
    if (destroyed || !scope.real || !post || page.pendingLikes.has(id)) return;
    const liked = !post.likedByMe;
    page.pendingLikes.add(id); post.action = { kind: "busy" }; page.revisions.set(id, ++page.sequence); paintSurfaces();
    try {
      const result = await ctx.api("discussions/like", { guestId: scope.guestId, paperId: scope.paperId, attemptId: scope.attemptId, commentId: id, liked });
      const updated = parsePost(result.comment, scope);
      if (updated.id !== id) throw new Error("点赞未成功，请重试。");
      rememberPost(page, updated);
    } catch (error) { const current = findPost(page, id); if (current) current.action = { kind: "error", message: error.message || "点赞未成功，请重试。" }; page.revisions.set(id, ++page.sequence); }
    finally { page.pendingLikes.delete(id); }
    paintSurfaces();
  }

  // This compact composer hides the generic heading; hidden close controls must also leave the focus loop.
  function releaseEditorChrome(previous) {
    const chrome = previous?.chrome;
    if (!chrome?.button?.isConnected) return;
    if (chrome.tabindex === null) chrome.button.removeAttribute("tabindex");
    else chrome.button.setAttribute("tabindex", chrome.tabindex);
  }

  function editorUnmounted(token) {
    if (editor?.token !== token) return;
    const previous = editor; editor = null; editorObserver?.disconnect(); editorObserver = null;
    releaseEditorChrome(previous);
    if (previous.host) mounts.delete(previous.host);
    paintSurfaces();
  }
  function finishEditor({ close = false } = {}) {
    if (!editor) return;
    const previous = editor;
    persistDrafts(previous.scope);
    editor = null; editorObserver?.disconnect(); editorObserver = null;
    releaseEditorChrome(previous);
    if (previous.host) {
      const dispose = mounts.get(previous.host); mounts.delete(previous.host); dispose?.();
    }
    if (close) ctx.closeModal();
    paintSurfaces();
  }

  function paintEditor() {
    if (destroyed || !editor) return;
    const current = editor, draft = draftFor(current.scope, current.target);
    const host = document.querySelector(`[data-ios-discussion-editor="${current.token}"]`);
    if (!host) {
      // BottomSheet 的 portal 晚于 openModal 返回；只等本次编辑器宿主，避免丢失首次挂载。
      if (!editorObserver) {
        editorObserver = new MutationObserver(paintEditor);
        editorObserver.observe(document.body, { childList: true, subtree: true });
      }
      return;
    }
    editorObserver?.disconnect(); editorObserver = null;
    current.host = host;
    const close = host.closest('[role="dialog"]')?.querySelector('#sheet-close');
    if (close && !current.chrome) {
      current.chrome = { button: close, tabindex: close.getAttribute("tabindex") };
      close.setAttribute("tabindex", "-1");
    }
    attach(host, ui()?.mountDiscussionEditor, {
      text: draft.text, images: draft.images.map(image => ({ id: image.id, src: safeDiscussionMedia(image.dataUri, "image"), alt: image.alt })),
      replyTo: current.target ? { name: current.target.name, excerpt: current.target.excerpt || "这条评论" } : null,
      busy: draft.busy, processing: draft.processing, error: draft.error, notice: draft.notice,
      onChange(value) { if (!draft.busy) { draft.text = value; draft.updatedAt = Date.now(); persistDrafts(current.scope); paintEditor(); } },
      onRemoveImage(index) { if (!draft.busy) { draft.images.splice(index, 1); draft.updatedAt = Date.now(); persistDrafts(current.scope); paintEditor(); } },
      onFiles: (files) => { void addFiles(current.scope, current.target, files); },
      onCancelReply() {
        if (draft.busy) return;
        current.target = null; lastTargets.set(current.scope.key, null); persistDrafts(current.scope); paintEditor();
      },
      onSubmit: () => { void submit(current.scope, current.target); }, onUnmount: () => editorUnmounted(current.token),
    });
  }

  function openEditor(target) {
    const scope = currentScope();
    if (!scope?.real || ctx.route().page !== "discussion") return;
    restoreDrafts(scope);
    if (target === undefined) {
      const last = lastTargets.get(scope.key);
      target = hasContent(drafts.get(draftKey(scope, last))) ? last : [...drafts.values()].find(draft => draft.scopeKey === scope.key && hasContent(draft))?.target || null;
    }
    if (editor) finishEditor({ close: true });
    draftFor(scope, target); lastTargets.set(scope.key, target); editor = { scope, target, token: uid(), host: null };
    ctx.openModal("发表评论", `<div data-ios-discussion-editor="${editor.token}"></div>`, "", "rr-discussion-sheet");
    paintEditor(); queueMicrotask(paintEditor);
  }

  async function addFiles(scope, target, files) {
    const draft = draftFor(scope, target);
    if (!files.length || draft.busy || draft.processing) return;
    draft.processing = true; draft.error = ""; paintEditor();
    try {
      if (draft.images.length + files.length > DISCUSSION_LIMITS.images) throw new Error("每条评论最多添加 3 张图片，已选图片仍保留。");
      const selected = [];
      for (const file of files) selected.push({ ...await normalizeDiscussionImage(file), id: uid() });
      draft.images.push(...selected);
    } catch (error) { draft.error = error.message; }
    finally { draft.processing = false; draft.updatedAt = Date.now(); persistDrafts(scope); paintEditor(); paintSurfaces(); }
  }

  async function submit(scope, target) {
    const draft = draftFor(scope, target);
    if (!scope.real || draft.busy || draft.processing) return;
    try {
      const nickname = profileName();
      if (!validNickname(nickname)) throw new Error("请填写 1–16 字的讨论昵称。");
      const links = extractDiscussionLinks(draft.text);
      if (links.length > DISCUSSION_LIMITS.links) throw new Error("每条评论最多添加 3 个链接。");
      if (!draft.text.trim() && !links.length && !draft.images.length) throw new Error("写点内容或添加照片后再发表。");
      const payload = { paperId: scope.paperId, guestId: scope.guestId, attemptId: scope.attemptId, nickname, text: draft.text, links,
        images: draft.images.map(({ dataUri, alt }) => ({ dataUri, alt })), parentId: target?.id || null };
      // Image IDs refer to immutable normalized bytes, keeping the reload-safe retry fingerprint small.
      const serialized = JSON.stringify({ ...payload, images: draft.images.map(({ id, alt }) => ({ id, alt })) });
      if (draft.lastSubmission && draft.lastSubmission !== serialized) draft.clientId = uid();
      draft.lastSubmission = serialized; draft.busy = true; draft.error = "";
      draft.updatedAt = Date.now(); persistDrafts(scope);
      ctx.state().profile = { id: scope.guestId, name: nickname }; ctx.persist(); paintEditor();
      const result = await ctx.api("discussions", { ...payload, clientId: draft.clientId });
      const post = parsePost(result.comment, scope), page = pageFor(scope);
      const exists = Boolean(findPost(page, post.id));
      if (post.parentId) {
        if (!target || post.parentId !== target.id || post.rootId !== target.rootId) throw new Error("回复未成功，请重试。");
        const root = parsePost(result.rootComment, scope);
        if (root.parentId || root.id !== post.rootId) throw new Error("回复未成功，请重试。");
        rememberPost(page, root);
        const thread = threadFor(scope, root.id);
        if (!exists) thread.posts.push(post); else Object.assign(findPost(page, post.id), post);
        page.revisions.set(post.id, ++page.sequence); thread.total = root.replyCount; thread.expanded = true;
        if (thread.pending) thread.refreshAfterLoad = true;
        else if (!thread.loaded) void loadReplies(scope, root.id);
      } else {
        if (target) throw new Error("回复未成功，请重试。");
        rememberPost(page, post);
      }
      if (page.total !== null) page.total = Math.max(page.total + (exists ? 0 : 1), Number.isSafeInteger(result.total) ? result.total : 0);
      if (page.pending) page.refreshAfterLoad = true;
      draft.text = ""; draft.images = [];
      draft.lastSubmission = ""; draft.clientId = uid();
      persistDrafts(scope);
      if (editor && draftKey(editor.scope, editor.target) === draftKey(scope, target)) finishEditor({ close: true });
      ctx.toast(target ? "回复已发表。" : "评论已发表。"); paintSurfaces();
      if (!page.loaded) void load(scope);
    } catch (error) { draft.error = error.message || "发表失败，编辑内容仍保留。"; }
    finally { draft.busy = false; paintEditor(); paintSurfaces(); }
  }

  const unsubscribe = ctx.onModalClose?.(() => finishEditor());
  const onPageHide = () => { for (const guestId of restoredGuests) persistDrafts({ guestId }); finishEditor({ close: true }); };
  // 路由和面板关闭保留草稿；支持的浏览器在整页离开前提供未发表内容的原生确认。
  const onBeforeUnload = (event) => {
    for (const guestId of restoredGuests) persistDrafts({ guestId });
    if (![...drafts.values()].some(hasContent)) return;
    event.preventDefault(); event.returnValue = true;
  };
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onBeforeUnload);
  return {
    reportEntryView(variant = "card") { return `<div class="ios-feature-host ios-discussion-entry-host" data-ios-discussion-entry data-discussion-variant="${variant === "compact" ? "compact" : "card"}"></div>`; },
    discussionView() { return '<div class="ios-feature-host ios-discussion-page-host" data-ios-discussion-page></div>'; },
    afterRender() {
      paintSurfaces();
      const scope = currentScope();
      if (scope?.real && ["report", "discussion"].includes(ctx.route().page) && !pageFor(scope).requested) void load(scope);
    },
    async onRoute() {
      const scope = currentScope(), route = ctx.route().page;
      if (editor && (route !== "discussion" || editor.scope.key !== scope?.key || editor.scope.attemptId !== scope?.attemptId)) finishEditor({ close: true });
      paintSurfaces();
      if (scope?.real && ["report", "discussion"].includes(route)) await load(scope);
    },
    destroy() {
      finishEditor({ close: true }); destroyed = true; unsubscribe?.();
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      for (const dispose of mounts.values()) dispose(); mounts.clear(); pages.clear(); drafts.clear(); lastTargets.clear();
    },
  };
}
