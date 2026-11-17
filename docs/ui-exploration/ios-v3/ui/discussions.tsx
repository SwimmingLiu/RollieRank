import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Heart, ImagePlus, Link as LinkIcon, LoaderCircle, Maximize2, MessageCircle, Minimize2, X } from "lucide-react";
import { Button } from "./components/motion/button/base";
import { Card, CardContent } from "./components/motion/card";
import { DiscussionAvatar } from "./discussions-avatar";
import { mountRoot } from "./root-registry";

export type DiscussionImage = { id: string; src: string; alt: string };
type ActionState = { kind: "idle" } | { kind: "busy" } | { kind: "error"; message: string };
export type DiscussionPost = {
  id: string; name: string; text: string; time: string; datetime: string;
  version: string; textParts: ({ kind: "text"; text: string } | { kind: "link"; text: string; href: string })[]; images: DiscussionImage[]; links: string[];
  parentId: string | null; rootId: string; replyTo: { id: string; name: string; excerpt: string | null } | null;
  likeCount: number; likedByMe: boolean; replyCount: number; action: ActionState;
};
export type DiscussionThread = { rootId: string; posts: DiscussionPost[]; expanded: boolean; total: number; hasMore: boolean; state: ActionState; loaded: boolean };
type ReadState = { kind: "loading" } | { kind: "ready"; total: number } | { kind: "error"; message: string };
export type DiscussionEntryProps = { read: ReadState; sample: boolean; compact?: boolean; onOpen: () => void };
export type DiscussionPageProps = {
  title: string; read: ReadState; posts: DiscussionPost[]; access: "real" | "sample" | "missing";
  loadingMore: boolean; hasMore: boolean; hasDraft: boolean; name: string;
  threads: DiscussionThread[];
  onWrite: () => void; onPhotoFiles: (files: File[]) => void; onMore: () => void; onRetry: () => void; onGrade: () => void;
  onLike: (post: DiscussionPost) => void; onReply: (post: DiscussionPost) => void;
  onThread: (rootId: string) => void; onMoreReplies: (rootId: string) => void; onRetryReplies: (rootId: string) => void;
  onImage: (image: DiscussionImage) => void;
};
export type DiscussionEditorProps = {
  text: string; images: DiscussionImage[]; replyTo: { name: string; excerpt: string } | null;
  busy: boolean; processing: boolean; error: string; notice: string;
  onChange: (value: string) => void;
  onRemoveImage: (index: number) => void; onCancelReply: () => void;
  onFiles: (files: File[]) => void;
  onSubmit: () => void;
  onUnmount: () => void;
};

function readLabel(read: ReadState) {
  if (read.kind === "loading") return "正在读取";
  if (read.kind === "error") return "暂时无法读取";
  return read.total ? `${read.total} 条讨论` : "暂无讨论";
}

export function DiscussionReportEntry({ read, sample, compact = false, onOpen }: DiscussionEntryProps) {
  // 成绩页固定操作栏只保留评论图标与数量，入口无需再占一张内容卡。
  if (compact) return <Button variant="ghost" className="rr-report-comment rr-discussion-entry" onClick={onOpen} aria-label={`评论本卷，${sample ? "完成练习后查看" : readLabel(read)}`} title="评论本卷"><MessageCircle size={21} />{sample ? null : <b aria-hidden="true">{read.kind === "ready" ? read.total : "…"}</b>}<span className="sr-only">{`本卷交流，${sample ? "完成练习后查看" : readLabel(read)}`}</span></Button>;
  return <Button variant="secondary" className="rr-discussion-entry" onClick={onOpen} aria-label={`本卷交流，${sample ? "完成练习后查看" : readLabel(read)}`}>
    <span className="rr-discussion-entry-icon"><MessageCircle size={20} /></span>
    <span className="rr-discussion-entry-copy"><strong>本卷交流</strong><small>{sample ? "完成练习后查看" : readLabel(read)}</small></span>
    <ChevronRight size={17} aria-hidden="true" />
  </Button>;
}

const compactCount = (count: number) => count >= 10000 ? `${Number((count / 10000).toFixed(1))}万` : String(count);
function CommentPost({ post, nested, onImage, onLike, onReply }: { post: DiscussionPost; nested: boolean; onImage: DiscussionPageProps["onImage"]; onLike: DiscussionPageProps["onLike"]; onReply: DiscussionPageProps["onReply"] }) {
  return <article className={`rr-discussion-post ${nested ? "rr-discussion-reply" : ""}`} data-comment-id={post.id}>
    <DiscussionAvatar name={post.name} />
    <div className="rr-discussion-post-body"><header><strong title={post.name}>{post.name}</strong>{nested && post.replyTo ? <><small>回复</small><span className="rr-discussion-reply-target" title={post.replyTo.name}>{post.replyTo.name}</span></> : null}</header>
      {/* Default names can be identical; quote the specific parent when replying inside a thread. */}
      {nested && post.parentId !== post.rootId && post.replyTo?.excerpt ? <p className="rr-discussion-parent-excerpt">{post.replyTo.excerpt}</p> : null}
      {post.text ? <p className="rr-discussion-text">{post.textParts.map((part, index) => part.kind === "link" ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{part.text}</a> : part.text)}</p> : null}
      {post.images.length ? <div className="rr-discussion-images">{post.images.map(image => <Button variant="ghost" key={image.id} className="rr-discussion-image" onClick={() => onImage(image)} aria-label={`查看图片：${image.alt}`}><img src={image.src} alt={image.alt} loading="lazy" /></Button>)}</div> : null}
      {post.links.length ? <div className="rr-discussion-links">{post.links.map(link => <a key={link} href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><LinkIcon size={14} /><span>{link}</span><span className="sr-only">，在新标签页打开</span></a>)}</div> : null}
      <footer className="rr-discussion-post-actions"><time dateTime={post.datetime}>{post.time}</time><Button variant="ghost" onClick={() => onReply(post)} aria-label={`回复${post.name}的评论`}>回复</Button><Button variant="ghost" className={`rr-discussion-like ${post.likedByMe ? "is-liked" : ""}`} aria-pressed={post.likedByMe} aria-label={`${post.likedByMe ? "取消点赞" : "点赞"}${post.name}的评论，${post.likeCount}赞`} disabled={post.action.kind === "busy"} onClick={() => onLike(post)}><Heart size={17} fill={post.likedByMe ? "currentColor" : "none"} />{post.likeCount ? <span>{compactCount(post.likeCount)}</span> : null}</Button></footer>
      {post.action.kind === "error" ? <p className="rr-discussion-action-error" role="alert">{post.action.message}</p> : null}
    </div>
  </article>;
}

export function DiscussionPage(props: DiscussionPageProps) {
  const photoInput = useRef<HTMLInputElement>(null);
  return <div className="rr-discussion-page" data-slot="discussion-page" aria-label={`${props.title}，全部评论`}>
    <header className="rr-discussion-heading"><div><MessageCircle size={18} /><h2>全部评论</h2></div>{props.access === "real" ? <span aria-live="polite"><span aria-hidden="true">{props.read.kind === "ready" ? props.read.total : "…"}</span><span className="sr-only">{readLabel(props.read)}</span></span> : null}</header>
    {props.access !== "real" ? <Card className="rr-discussion-sample"><CardContent><p>{props.access === "sample" ? "完成本卷练习，即可参与评论。" : "请从成绩报告进入本卷交流。"}</p><Button variant="secondary" onClick={props.onGrade}>{props.access === "sample" ? "去练习" : "返回记录"}<ChevronRight size={15} /></Button></CardContent></Card> : <>
      <div className="rr-discussion-list" aria-label="本卷评论">
        {props.posts.map(post => { const thread = props.threads.find(item => item.rootId === post.id); return <section key={post.id} className="rr-discussion-thread" data-thread-id={post.id}><CommentPost post={post} nested={false} onImage={props.onImage} onLike={props.onLike} onReply={props.onReply} />
          {thread?.expanded ? <div className="rr-discussion-replies">{thread.posts.map(reply => <CommentPost key={reply.id} post={reply} nested onImage={props.onImage} onLike={props.onLike} onReply={props.onReply} />)}{thread.state.kind === "busy" ? <p className="rr-discussion-replies-state" role="status">正在读取…</p> : thread.state.kind === "error" ? <Button variant="ghost" onClick={() => props.onRetryReplies(post.id)}>重试回复</Button> : thread.hasMore ? <Button variant="ghost" onClick={() => props.onMoreReplies(post.id)}>展开更多回复<ChevronDown size={13} /></Button> : null}</div> : null}
          {post.replyCount ? <Button variant="ghost" className="rr-discussion-thread-toggle" aria-expanded={thread?.expanded === true} aria-label={`${thread?.expanded ? "收起" : "展开"}${post.replyCount}条回复`} onClick={() => props.onThread(post.id)}>{thread?.expanded ? <>收起回复<ChevronUp size={13} /></> : <>展开 {compactCount(post.replyCount)} 条回复<ChevronDown size={13} /></>}</Button> : null}
        </section>; })}
        {props.read.kind === "loading" && !props.posts.length ? <p className="rr-discussion-list-state" role="status">正在读取讨论…</p> : null}
        {props.read.kind === "ready" && !props.posts.length ? <div className="rr-discussion-empty"><MessageCircle size={27} aria-hidden="true" /><p>还没有评论，来聊第一句</p></div> : null}
        {props.read.kind === "error" ? <div className="rr-discussion-list-state"><p role="alert">{props.read.message}</p><Button variant="ghost" onClick={props.onRetry}>重新加载</Button></div> : null}
        {props.hasMore ? <Button variant="ghost" className="rr-discussion-more" onClick={props.onMore} disabled={props.loadingMore}>{props.loadingMore ? "正在读取…" : "更早的讨论"}</Button> : null}
      </div>
      {/* Separate sibling buttons keep photo selection visible and inside the original user gesture. */}
      <div className="rr-discussion-compose-dock"><div className="rr-discussion-compose-bar"><DiscussionAvatar name={props.name} /><Button variant="ghost" className="rr-discussion-compose" onClick={props.onWrite}><span>{props.hasDraft ? "继续编辑草稿" : "说点什么…"}</span>{props.hasDraft ? <small>草稿</small> : null}</Button><Button variant="ghost" size="icon" className="rr-discussion-compose-photo" aria-label="添加图片" title="添加图片" onClick={() => photoInput.current?.click()}><ImagePlus size={21} /></Button><input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden tabIndex={-1} aria-label="选择讨论图片" onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; if (files.length) props.onPhotoFiles(files); }} /></div></div>
    </>}
  </div>;
}

export function DiscussionEditor(props: DiscussionEditorProps) {
  const form = useRef<HTMLFormElement>(null), imageInput = useRef<HTMLInputElement>(null), textInput = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false), [multiline, setMultiline] = useState(false);
  // The same sheet follows the visual viewport, keeping its input and actions above a mobile keyboard.
  useLayoutEffect(() => {
    const sheet = form.current?.closest<HTMLElement>('[role="dialog"]');
    if (!sheet) return;
    const viewport = window.visualViewport;
    const names = ["--rr-composer-viewport-height", "--rr-composer-keyboard-offset"];
    const previous = names.map((name) => sheet.style.getPropertyValue(name));
    const update = () => {
      const height = viewport?.height ?? window.innerHeight, top = viewport?.offsetTop ?? 0;
      sheet.style.setProperty(names[0], `${height}px`);
      sheet.style.setProperty(names[1], `${Math.max(0, window.innerHeight - height - top)}px`);
    };
    update(); viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update); window.addEventListener("resize", update);
    return () => { viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update); window.removeEventListener("resize", update); names.forEach((name, index) => previous[index] ? sheet.style.setProperty(name, previous[index]) : sheet.style.removeProperty(name)); };
  }, []);
  // Start with one compact line, reserving room for photos and reply context when a keyboard reduces the viewport.
  useLayoutEffect(() => {
    const field = textInput.current;
    if (!field) return;
    const resize = () => {
      // Temporary measurement used to reset the scroll offset and hide the line being typed at the end.
      const previousScroll = field.scrollTop, caretAtEnd = document.activeElement === field && field.selectionStart === field.value.length && field.selectionEnd === field.value.length;
      if (expanded) { field.style.height = "100%"; field.style.maxHeight = "none"; field.style.paddingRight = "4px"; field.style.overflowY = "auto"; field.scrollTop = caretAtEnd ? field.scrollHeight : previousScroll; return; }
      const style = getComputedStyle(field), line = Number.parseFloat(style.lineHeight) || 22;
      const border = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
      const vertical = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) + border;
      const minimum = Math.max(44, line + vertical);
      const available = window.visualViewport?.height ?? window.innerHeight;
      const reserved = 64 + (props.replyTo ? 54 : 0) + (props.images.length ? 98 : 0) + (props.processing ? 26 : 0) + (props.error ? 42 : 0) + (props.notice ? 42 : 0) + (props.text.length >= 1800 ? 22 : 0);
      const maximum = Math.max(minimum, Math.min(line * 6 + vertical, available - reserved));
      field.style.maxHeight = `${maximum}px`;
      field.style.height = "0px";
      // Measure without the expansion control first, so its appearance does not make short text keep wrapping.
      field.style.paddingRight = "4px";
      const canExpand = field.scrollHeight + border > minimum + line;
      field.style.paddingRight = canExpand ? "48px" : "4px";
      const required = field.scrollHeight + border;
      field.style.height = `${Math.max(minimum, Math.min(maximum, required))}px`;
      field.style.overflowY = required > maximum ? "auto" : "hidden";
      field.scrollTop = caretAtEnd ? field.scrollHeight : previousScroll;
      setMultiline(canExpand);
    };
    resize(); window.addEventListener("resize", resize); window.visualViewport?.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); };
  }, [props.text, props.images.length, props.processing, props.replyTo, props.error, props.notice, expanded]);
  useEffect(() => { textInput.current?.focus({ preventScroll: true }); }, [expanded]);
  useEffect(() => () => { queueMicrotask(props.onUnmount); }, []);
  const locked = props.busy || props.processing;
  const hasContent = Boolean(props.text.trim() || props.images.length);
  const send = <Button type="submit" variant="primary" className="rr-discussion-submit" disabled={locked || !hasContent}>{props.busy ? <LoaderCircle size={17} className="animate-spin" aria-label="发送中" /> : "发送"}</Button>;
  return <form ref={form} className="rr-discussion-editor" data-expanded={expanded} data-slot="discussion-editor" onSubmit={event => { event.preventDefault(); props.onSubmit(); }} aria-label="发表本卷评论" aria-busy={props.busy || props.processing}>
    <fieldset disabled={props.busy}>
      {props.replyTo ? <div className="rr-discussion-reply-context"><div><span>回复 <b>{props.replyTo.name}</b></span><p>{props.replyTo.excerpt}</p></div><Button variant="ghost" size="icon" onClick={props.onCancelReply} aria-label="取消回复"><X size={15} /></Button></div> : null}
      {/* Selected media sits above the writing bar; it no longer leaves a mostly empty attachment toolbar below the text. */}
      {props.processing || props.images.length ? <div className="rr-discussion-editor-media">
        {props.processing ? <p className="rr-discussion-processing" role="status">正在处理照片…</p> : null}
        {props.images.length ? <div className="rr-discussion-selected-images">{props.images.map((image, index) => <figure key={image.id}><img src={image.src} alt={image.alt} /><Button variant="ghost" className="rr-discussion-remove-image" size="icon" onClick={() => props.onRemoveImage(index)} aria-label={`移除图片 ${index + 1}`}><X size={15} /></Button></figure>)}</div> : null}
      </div> : null}
      {/* Photo, text and Send share one chat bar; expansion stays in its corner as the same field grows. */}
      <div className="rr-discussion-input-row">
        <Button variant="ghost" size="icon" className="rr-discussion-photo" aria-label="图片" title="添加照片" disabled={locked || props.images.length >= 3} onClick={() => imageInput.current?.click()}><ImagePlus size={21} /></Button>
        <div className="rr-discussion-input-wrap"><label className="sr-only" htmlFor="discussion-text">评论内容</label><textarea ref={textInput} id="discussion-text" rows={1} maxLength={2000} autoFocus placeholder="说点什么…" value={props.text} onChange={event => props.onChange(event.target.value)} /></div>
        {multiline || expanded ? <Button variant="ghost" size="icon" className="rr-discussion-expand" aria-label={expanded ? "收起编辑" : "展开编辑"} title={expanded ? "收起编辑" : "展开编辑"} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</Button> : null}
        {send}
      </div>
      {props.text.length >= 1800 ? <small className="rr-discussion-counter" aria-live="polite">{props.text.length} / 2000</small> : null}
      <input ref={imageInput} type="file" data-discussion-file="images" accept="image/png,image/jpeg,image/webp" multiple hidden tabIndex={-1} aria-label="选择讨论图片" onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; props.onFiles(files); }} />
    </fieldset>
    {props.notice ? <p className="rr-discussion-draft-notice" role="status">{props.notice}</p> : null}
    {props.error ? <p className="rr-discussion-editor-error" role="alert">{props.error}</p> : null}
  </form>;
}

export function mountDiscussionReportEntry(container: HTMLElement, props: DiscussionEntryProps) { return mountRoot(container, <DiscussionReportEntry {...props} />); }
export function mountDiscussionPage(container: HTMLElement, props: DiscussionPageProps) { return mountRoot(container, <DiscussionPage {...props} />); }
export function mountDiscussionEditor(container: HTMLElement, props: DiscussionEditorProps) { return mountRoot(container, <DiscussionEditor {...props} />); }
