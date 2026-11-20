import { useEffect, useId, useRef, useState } from "react";
import { motion, Reorder, useDragControls, type PanInfo } from "motion/react";
import { Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, FileText, GripVertical, LayoutList, ListOrdered, Minus, Pause, Play, Plus, RotateCcw, Search, Square } from "lucide-react";
import { Button } from "./components/motion/button/base";
import { Card, CardContent } from "./components/motion/card";
import { BottomSheet } from "./components/motion/bottom-sheet";
import { Tabs, TabsList, TabsTrigger } from "./components/motion/tabs";
import { Avatar, ProgressBar, TextInput } from "./primitives";
import { publisherIcon, publisherName } from "./publishers";
import { mountRoot } from "./root-registry";
import { timerCollections, timerPaperSearchText, timerPaperTitle, type TimerPaper } from "./timer-paper-model";

type TimerModule = { id: string; name: string; plannedMs: number; actualMs: number };
export type PracticeTimerModel = {
  status: "ready" | "running" | "paused" | "finished";
  origin: "paper" | "custom";
  mode: "whole" | "modules";
  activeId: string;
  plannedMs: number;
  allocatedMs: number;
  planDeltaMs: number;
  canStart: boolean;
  limit: { minutes: number; kind: string; label: string; url?: string };
  actualMs: number;
  modules: TimerModule[];
};
export type PracticeTimerProps = {
  model: PracticeTimerModel;
  onPlan: (minutes: number, moduleId?: string) => void;
  onSource: (source: "paper" | "custom") => void;
  paperLabel?: string;
  onChoosePaper?: () => void;
  onMode: (mode: "whole" | "modules") => void;
  onReorder: (ids: string[]) => void;
  onBalance: () => void;
  onStart: () => void;
  onPause: () => void;
  onModule: (id: string) => void;
  onFinish: () => void;
  onAssociate?: () => void;
};
const minutes = (milliseconds: number) => Number((milliseconds / 60000).toFixed(1));
const clock = (milliseconds: number) => { const seconds = Math.max(0, Math.floor(milliseconds / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; };

function PlanInput({ label, value, allowZero = false, className = "", onChange }: { label: string; value: number; allowZero?: boolean; className?: string; onChange: (minutes: number) => void }) {
  const [modelValue, setModelValue] = useState(value);
  const [draft, setDraft] = useState(String(minutes(value)));
  const [error, setError] = useState("");
  const valid = (text: string) => text !== "" && Number.isSafeInteger(Number(text)) && Number(text) >= (allowZero ? 0 : 1) && Number(text) <= 720;
  // A delayed effect reset the field during the next edit after +/-; settle changed model values before rendering the input.
  if (value !== modelValue) { setModelValue(value); setDraft(String(minutes(value))); setError(""); }
  return <TextInput required type="number" min={allowZero ? 0 : 1} max={720} step={1} value={draft} onChange={next => { setDraft(next); setError(""); if (valid(next)) onChange(Number(next)); }} error={error || undefined} aria-label={label} className={`rr-session-plan-input ${className}`} onInvalid={event => { event.preventDefault(); setError("请填整数"); }} onBlur={() => { if (!valid(draft)) setError("请填整数"); }} />;
}

function PlannedModule({ module, index, ids, instructions, resetKey, onPlan, onReorder }: { module: TimerModule; index: number; ids: string[]; instructions: string; resetKey: number; onPlan: PracticeTimerProps["onPlan"]; onReorder: PracticeTimerProps["onReorder"] }) {
  const controls = useDragControls();
  const move = (direction: number) => { const target = index + direction; if (target < 0 || target >= ids.length) return; const order = [...ids]; [order[index], order[target]] = [order[target], order[index]]; onReorder(order); };
  return <Reorder.Item value={module.id} dragControls={controls} dragListener={false} className="rr-timer-planned-module" data-timer-module={module.id}>
    <Button variant="ghost" size="icon" className="rr-timer-drag-handle" style={{ touchAction: "none" }} onPointerDown={event => controls.start(event)} onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); move(event.key === "ArrowUp" ? -1 : 1); } }} aria-label={`调整${module.name}顺序`} aria-describedby={instructions} aria-keyshortcuts="ArrowUp ArrowDown" title="拖动排序，或按上下方向键移动"><GripVertical size={16} /></Button>
    <span>{module.name}</span><PlanInput key={resetKey} label={`${module.name}计划分钟`} value={module.plannedMs} allowZero onChange={value => onPlan(value, module.id)} /><small>分</small>
  </Reorder.Item>;
}

function TimerSourceTabs({ source, onSource }: { source: "paper" | "custom"; onSource: (source: "paper" | "custom") => void }) {
  return <Tabs value={source} onValueChange={value => { if ((value === "paper" || value === "custom") && value !== source) onSource(value); }} variant="segment" className="rr-timer-source-tabs"><TabsList aria-label="计时来源"><TabsTrigger value="paper">套卷</TabsTrigger><TabsTrigger value="custom">自定义</TabsTrigger></TabsList></Tabs>;
}

function CustomTimerPlan({ plannedMs, onPlan }: { plannedMs: number; onPlan: PracticeTimerProps["onPlan"] }) {
  const total = minutes(plannedMs);
  // Only direct minutes and step controls remain; the default still comes from the timer model.
  return <div className="rr-timer-custom-plan"><div className="rr-timer-duration"><span>总时长</span><div className="rr-timer-duration-stepper"><Button variant="ghost" size="icon" aria-label="减少一分钟" disabled={total <= 1} onClick={() => onPlan(total - 1)}><Minus size={17} /></Button><div className="rr-timer-duration-value"><PlanInput label="自定义总分钟" className="rr-timer-total-input" value={plannedMs} onChange={value => onPlan(value)} /><small>分钟</small></div><Button variant="ghost" size="icon" aria-label="增加一分钟" disabled={total >= 720} onClick={() => onPlan(total + 1)}><Plus size={17} /></Button></div></div></div>;
}

// 整卷时限固定，分模块才展开分配；拖动和键盘共享同一持久化顺序。
export function PracticeTimer({ model, onPlan, onSource, paperLabel, onChoosePaper, onMode, onReorder, onBalance, onStart, onPause, onModule, onFinish, onAssociate }: PracticeTimerProps) {
  const setup = model.status === "ready", running = model.status === "running", modules = model.mode === "modules";
  const active = model.modules.find(module => module.id === model.activeId);
  const instructions = useId();
  const [resetKey, setResetKey] = useState(0);
  const scrollContent = useRef<HTMLDivElement>(null);
  const ids = model.modules.map(module => module.id);
  const difference = Math.abs(model.planDeltaMs) / 60000;
  // Starting from the last plan field used to carry its scroll position over and hide the clock.
  useEffect(() => { if (model.status === "running") scrollContent.current?.scrollTo({ top: 0 }); }, [model.status]);
  useEffect(() => {
    // Keyboard viewport changes happen after focus; keep that field inside the real scroll area.
    const revealFocusedInput = () => requestAnimationFrame(() => { const focused = document.activeElement; if (focused instanceof HTMLInputElement && scrollContent.current?.contains(focused)) focused.scrollIntoView({ block: "nearest" }); });
    window.addEventListener("resize", revealFocusedInput);
    window.visualViewport?.addEventListener("resize", revealFocusedInput);
    return () => { window.removeEventListener("resize", revealFocusedInput); window.visualViewport?.removeEventListener("resize", revealFocusedInput); };
  }, []);
  return <form className={`rr-session-timer rr-timer-config${setup && modules ? " is-planning-modules" : ""}`} noValidate onSubmit={event => { event.preventDefault(); if (setup && model.canStart && event.currentTarget.checkValidity()) onStart(); }}>
    {/* The action bar has its own layout space, so focused inputs cannot scroll underneath it. */}
    <motion.div className="rr-timer-scroll-content" ref={scrollContent} layoutScroll>
    {model.status === "paused" ? <span className="rr-session-paused">已暂停</span> : null}
    {setup ? <>
      <TimerSourceTabs source={model.origin} onSource={onSource} />
      {model.origin === "paper" && paperLabel ? <div className="rr-timer-selected-paper">{onChoosePaper ? <Button variant="ghost" onClick={onChoosePaper} aria-label="更换计时套卷"><FileText size={16} /><span title={paperLabel}>{paperLabel}</span><ChevronRight size={16} /></Button> : <span title={paperLabel}>{paperLabel}</span>}</div> : null}
      {model.origin === "custom" ? <CustomTimerPlan plannedMs={model.plannedMs} onPlan={onPlan} /> : <div className="rr-timer-limit"><span><b>整卷</b><small>{model.limit.label}</small></span><strong>{minutes(model.plannedMs)}<em>分钟</em></strong></div>}
      <div className="rr-timer-module-controls"><Button variant="ghost" className="rr-timer-module-toggle" aria-pressed={modules} onClick={() => onMode(modules ? "whole" : "modules")} title="模块分配为平台建议，可按做题习惯调整"><ListOrdered size={17} /><span>分模块{modules ? <small>建议</small> : null}</span><ChevronDown size={16} className={modules ? "is-open" : ""} /></Button>{modules ? <Button variant="ghost" size="icon" className="rr-timer-balance" onClick={() => { setResetKey(value => value + 1); onBalance(); }} aria-label="按建议重新分配分钟" title="按建议重新分配，整卷总时长保持不变"><RotateCcw size={15} /></Button> : null}</div>
      {modules ? <div className="rr-timer-allocation"><p id={instructions} className="rr-session-sr-only">拖动手柄调整模块顺序；键盘聚焦手柄后，按向上或向下方向键移动。</p><Reorder.Group as="ol" axis="y" values={ids} onReorder={onReorder} className="rr-timer-reorder-list">{model.modules.map((module, index) => <PlannedModule key={module.id} module={module} index={index} ids={ids} instructions={instructions} resetKey={resetKey} onPlan={onPlan} onReorder={onReorder} />)}</Reorder.Group></div> : null}
    </> : <div className="rr-session-clock" role="timer" aria-label={`做题已用时 ${clock(model.actualMs)}`}><strong>{clock(model.actualMs)}</strong><small>整卷计划 {minutes(model.plannedMs)} 分钟{modules && active ? <span className="rr-session-active-plan">{active.name} · 计划 {minutes(active.plannedMs)} 分钟</span> : null}</small><ProgressBar value={model.actualMs} max={model.plannedMs || 1} label="做题计划进度" animated={false} /></div>}
    {!setup && modules ? <div className="rr-session-modules">{model.modules.map(module => <div key={module.id} className={module.id === model.activeId ? "is-active" : ""}><Button variant="ghost" aria-pressed={module.id === model.activeId} disabled={model.status === "finished"} onClick={() => onModule(module.id)} className="rr-session-module-name">{module.id === model.activeId ? <Check size={14} /> : <span className="rr-session-module-dot" />}<span>{module.name}</span></Button><b>{clock(module.actualMs)}</b><small>/ {minutes(module.plannedMs)}分</small></div>)}</div> : null}
    </motion.div>
    <div className="rr-timer-sticky-footer">{setup && modules ? <div className={`rr-timer-allocation-total ${model.planDeltaMs ? "is-mismatch" : ""}`} role="status"><span>合计 <b>{minutes(model.allocatedMs)}</b> / {minutes(model.plannedMs)} 分</span>{model.planDeltaMs ? <strong>{model.planDeltaMs > 0 ? "多" : "少"} {difference} 分钟</strong> : <Check size={16} />}</div> : null}
    <div className="rr-session-actions">{setup ? <Button type="submit" disabled={!model.canStart}><Play size={16} />开始做题</Button> : model.status === "finished" ? <Button onClick={onAssociate} disabled={!onAssociate}><Check size={16} />关联套卷录答</Button> : <><Button variant="secondary" onClick={running ? onPause : onStart}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "暂停" : "继续"}</Button><Button onClick={onFinish}><Square size={14} />{model.origin === "custom" ? "结束计时" : "结束并录答"}</Button></>}</div>
    </div>
  </form>;
}

export type EntryToolsProps = {
  mode: "list" | "single";
  sections: { name: string; start: number; end: number }[];
  answers: string[];
  current: number;
  marks: number[];
  onMode: (mode: "list" | "single") => void;
  onJump: (question: number) => void;
  onTimer?: () => void;
};

export function EntryTools({ mode, sections, answers, current, marks, onMode, onJump, onTimer }: EntryToolsProps) {
  const [panel, setPanel] = useState<"sections" | "marks" | null>(null);
  const section = sections.find(item => current >= item.start && current <= item.end);
  return <div className="rr-entry-tools">
    {/* Touch users need the uncertainty action's purpose in the visible label, not a hover title. */}
    <div className="rr-entry-toolbar"><Button variant="ghost" className="rr-entry-section-picker" onClick={() => setPanel("sections")} aria-label="选择答题章节">{section?.name ?? "章节"}<ChevronDown size={13} /></Button><span className="rr-entry-toolbar-space" />{onTimer ? <Button variant="ghost" size="icon" onClick={onTimer} aria-label="做题计时"><Clock3 size={17} /></Button> : null}<Button variant="ghost" onClick={() => setPanel("marks")} aria-label={`查看待检查题，${marks.length}题`} title="集中检查存疑的题目" className="rr-entry-marks"><Bookmark size={16} />待检查{marks.length ? <b>{marks.length}</b> : null}</Button><Button variant="ghost" size="icon" onClick={() => onMode(mode === "list" ? "single" : "list")} aria-label={mode === "list" ? "切换单题模式" : "切换列表模式"}>{mode === "list" ? <Square size={17} /> : <LayoutList size={18} />}</Button></div>
    {/* 单题导航归属单题卡，工具栏只负责章节、待检查题和模式切换。 */}
    <BottomSheet open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }} title={panel === "marks" ? "待检查" : "选择章节"} labels={{ label: panel === "marks" ? "待检查" : "选择章节", close: "关闭章节面板" }} snapPoints={["auto"]} className="beui-island rr-session-sheet">
      {panel === "sections" ? <div className="rr-entry-chapter-list">{sections.map(item => <Button key={item.start} variant="ghost" onClick={() => { setPanel(null); onJump(item.start); }}><span>{item.name}</span><small>{item.start}–{item.end}</small><ChevronRight size={15} /></Button>)}</div> : <div className="rr-entry-review-list">{marks.length ? marks.map(number => <Button key={number} variant="secondary" onClick={() => { setPanel(null); onJump(number); }} aria-label={`查看存疑第 ${number} 题`}><Bookmark size={13} /><b>{number}</b><small>{answers[number - 1] || "未答"}</small></Button>) : <p>拿不准的题点“存疑”，稍后回看</p>}</div>}
    </BottomSheet>
  </div>;
}

export type TimingReportProps = { timing: { plannedMs: number; actualMs: number; entryMs?: number; modules: TimerModule[] } };
export function TimingReport({ timing }: TimingReportProps) {
  const [expanded, setExpanded] = useState(false);
  const difference = timing.actualMs - timing.plannedMs;
  const offset = `${difference > 0 ? "超时" : "节余"} ${clock(Math.abs(difference))}`;
  return <Card className="rr-session-report"><CardContent><Button variant="ghost" className="rr-session-report-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label="查看做题用时复盘"><Clock3 size={17} /><span><b>做题用时</b><small>{offset}</small></span><strong>{clock(timing.actualMs)}</strong><ChevronDown size={16} /></Button>{expanded ? <div className="rr-session-report-detail"><div className="rr-session-report-meta"><span>计划 {minutes(timing.plannedMs)} 分</span><span>录答 {clock(timing.entryMs ?? 0)}</span></div><table><thead><tr><th>模块</th><th>计划</th><th>实际</th><th>差值</th></tr></thead><tbody>{timing.modules.map(module => <tr key={module.id}><th scope="row">{module.name}</th><td>{minutes(module.plannedMs)}分</td><td>{clock(module.actualMs)}</td><td className={module.actualMs > module.plannedMs ? "is-over" : ""}>{module.actualMs > module.plannedMs ? "+" : "−"}{clock(Math.abs(module.actualMs - module.plannedMs))}</td></tr>)}</tbody></table></div> : null}</CardContent></Card>;
}

export function mountPracticeTimer(container: HTMLElement, props: PracticeTimerProps) { return mountRoot(container, <PracticeTimer {...props} />); }
export function mountEntryTools(container: HTMLElement, props: EntryToolsProps) { return mountRoot(container, <EntryTools {...props} />); }
export function mountTimingReport(container: HTMLElement, props: TimingReportProps) { return mountRoot(container, <TimingReport {...props} />); }

export type TimerPaperPickerProps = {
  papers: TimerPaper[];
  onPick: (id: string) => void;
  onCustom: () => void;
  allowCustom?: boolean;
  onExit?: () => void;
};
function TimerPaperPicker({ papers, onPick, onCustom, allowCustom = true, onExit }: TimerPaperPickerProps) {
  const [query, setQuery] = useState("");
  const [institution, setInstitution] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const picker = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const ignoreGesture = useRef(false);
  const institutions = [...new Set(papers.map(paper => paper.institution))];
  const scoped = institution ? papers.filter(paper => paper.institution === institution) : papers;
  const collections = timerCollections(scoped);
  const collection = collectionId ? collections.find(item => item.id === collectionId) : undefined;
  const available = collection?.papers ?? scoped;
  const search = query.trim().toLocaleLowerCase("zh-CN");
  const matches = search ? available.filter(paper => timerPaperSearchText(paper).includes(search)) : available;
  const selectInstitution = (id: string) => { const options = timerCollections(papers.filter(paper => paper.institution === id)); setInstitution(id); setCollectionId(options.length === 1 ? options[0].id : null); setQuery(""); };
  const reset = () => { setInstitution(null); setCollectionId(null); setQuery(""); };
  // Back removes one real level even when entry skipped a publisher's sole collection.
  const back = () => { setQuery(""); if (collectionId) setCollectionId(null); else if (institution) setInstitution(null); else onExit?.(); };
  const backdropBack = useRef(back);
  backdropBack.current = back;
  useEffect(() => {
    // The requested swipe starts on this sheet's backdrop, outside the picker DOM subtree.
    const backdrop = picker.current?.closest('[role="dialog"]')?.previousElementSibling;
    if (!(backdrop instanceof HTMLButtonElement) || backdrop.getAttribute('aria-label') !== '关闭面板') return;
    const touchAction = backdrop.style.touchAction;
    let gesture: { pointerId: number; x: number; y: number } | null = null;
    let blockClick = false;
    const start = (event: PointerEvent) => { if (event.isPrimary && event.button === 0) { gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }; blockClick = false; } };
    const move = (event: PointerEvent) => { if (gesture?.pointerId === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 8) blockClick = true; };
    const finish = (event: PointerEvent) => {
      if (gesture?.pointerId !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      gesture = null;
      if (Math.hypot(dx, dy) >= 8) blockClick = true;
      if (blockClick) event.preventDefault();
      if (dx < -Math.max(56, backdrop.clientWidth * .18) && Math.abs(dx) > Math.abs(dy) * 1.5) backdropBack.current();
    };
    const cancel = () => { gesture = null; blockClick = true; };
    // Keep the binding across level changes so the swipe's following click cannot dismiss the sheet.
    const stopCloseClick = (event: MouseEvent) => { if (blockClick) { event.preventDefault(); event.stopImmediatePropagation(); blockClick = false; } };
    backdrop.style.touchAction = 'pan-y';
    backdrop.addEventListener('pointerdown', start);
    backdrop.addEventListener('pointermove', move);
    backdrop.addEventListener('pointerup', finish);
    backdrop.addEventListener('pointercancel', cancel);
    backdrop.addEventListener('click', stopCloseClick, true);
    return () => {
      backdrop.style.touchAction = touchAction;
      backdrop.removeEventListener('pointerdown', start);
      backdrop.removeEventListener('pointermove', move);
      backdrop.removeEventListener('pointerup', finish);
      backdrop.removeEventListener('pointercancel', cancel);
      backdrop.removeEventListener('click', stopCloseClick, true);
    };
  }, []);
  function pan(_event: PointerEvent, info: PanInfo) { if (!ignoreGesture.current && Math.hypot(info.offset.x, info.offset.y) >= 8) suppressClick.current = true; }
  function endPan(_event: PointerEvent, info: PanInfo) {
    if (ignoreGesture.current) return;
    const distance = Math.abs(info.offset.x), threshold = Math.max(56, (picker.current?.clientWidth ?? 300) * .18);
    // A deliberate left gesture goes back; vertical scroll and short row drags never select a paper.
    if (Math.hypot(info.offset.x, info.offset.y) >= 8) suppressClick.current = true;
    if (info.offset.x < -threshold && distance > Math.abs(info.offset.y) * 1.5) back();
  }
  const paperOptions = (options: TimerPaper[]) => options.map(paper => {
    const specified = Number.isInteger(paper.timeLimitMinutes) && (paper.timeLimitMinutes ?? 0) > 0 && (paper.timeLimitMinutes ?? 0) <= 720;
    const limit = specified ? paper.timeLimitMinutes : 120;
    const title = timerPaperTitle(paper, true).replace(/^第\s*(\d+)\s*套$/, "第$1套");
    // The paper, question count and duration share one readable line; group headings carry search context.
    return <Button key={paper.id} variant="ghost" className="rr-timer-paper-option" onClick={() => onPick(paper.id)} aria-label={`${publisherName(paper.institution)}，${timerPaperTitle(paper)}，第 ${paper.number} 套，${allowCustom ? "开始计时" : "关联录答"}`}><span className="rr-timer-paper-copy">{title} · {paper.questionCount}题 · {specified && paper.timeLimitKind !== "suggested" ? `${limit}分钟` : `建议${limit}分钟`}</span><ChevronRight size={17} /></Button>;
  });
  return <motion.div ref={picker} className="rr-timer-paper-picker" style={{ touchAction: "pan-y" }} onPan={pan} onPanEnd={endPan}
    onPointerDownCapture={event => { suppressClick.current = false; ignoreGesture.current = event.target instanceof Element && Boolean(event.target.closest('input, textarea, select, [contenteditable="true"], [role="tablist"], .rr-timer-paper-search, .rr-timer-breadcrumbs')); }}
    onKeyDownCapture={() => { suppressClick.current = false; }}
    onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    {allowCustom ? <TimerSourceTabs source="paper" onSource={source => { if (source === "custom") onCustom(); }} /> : null}
    {institution ? <nav className="rr-timer-breadcrumbs" aria-label="计时套卷路径"><Button variant="ghost" className="rr-timer-back" onClick={back} aria-label="返回上一级" title="返回上一级"><ChevronLeft size={17} /></Button><Button variant="ghost" onClick={reset} aria-label="返回机构选择">机构</Button><ChevronRight size={12} /><Button variant="ghost" onClick={() => { setCollectionId(null); setQuery(""); }} aria-label={`返回${publisherName(institution)}系列选择`}>{publisherName(institution)}</Button>{collection && collection.label !== "套卷" ? <><ChevronRight size={12} /><span title={collection.label}>{collection.label}</span></> : null}</nav> : null}
    <TextInput className="rr-timer-paper-search" leftIcon={<Search size={16} />} aria-label="搜索计时套卷" placeholder="搜索套卷" value={query} onChange={setQuery} />
    <div className="rr-timer-paper-list" data-picker-level={search ? "search" : !institution ? "institution" : !collection ? "collection" : "paper"}>
      {search && !collection ? timerCollections(matches).map(group => <section key={group.id} className="rr-timer-search-group"><h3>{[publisherName(group.institution), group.detail, group.label].filter(Boolean).join(" · ")}</h3>{paperOptions(group.papers)}</section>) : search || collection ? paperOptions(matches) : !institution ? institutions.map(id => <Button key={id} variant="ghost" className="rr-timer-institution-option" onClick={() => selectInstitution(id)} aria-label={`选择${publisherName(id)}计时套卷`}><Avatar name={publisherName(id)} src={publisherIcon(id)} size="sm" /><span><b>{publisherName(id)}</b></span><ChevronRight size={17} /></Button>) : collections.map(item => <Button key={item.id} variant="ghost" className="rr-timer-collection-option" onClick={() => { setCollectionId(item.id); setQuery(""); }} aria-label={`选择${publisherName(item.institution)}${item.label}`}><span><b>{item.label}</b></span><ChevronRight size={17} /></Button>)}
      {search && !matches.length ? <p role="status">没有找到套卷</p> : null}
    </div>
  </motion.div>;
}
export function mountTimerPaperPicker(container: HTMLElement, props: TimerPaperPickerProps) { return mountRoot(container, <TimerPaperPicker {...props} />); }
