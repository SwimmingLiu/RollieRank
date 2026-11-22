import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleHelp, FileText, Gauge, Minus, Search, SlidersHorizontal, X } from "lucide-react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { zhCN } from "react-day-picker/locale";
import { Card, CardContent } from "./components/motion/card";
import { Button } from "./components/motion/button/base";
import { Tabs, TabsList, TabsTrigger } from "./components/motion/tabs";
import { BottomSheet } from "./components/motion/bottom-sheet";
import { Avatar, ProgressRing, TextInput } from "./primitives";
import { publisherIcon, publisherName } from "./publishers";
import { mountRoot } from "./root-registry";

type ChartNode = { id: string; ordinal: number; x: number; y: number | null; date: string; value: string; title: string; institution: string };
type ChartModel = { width: number; height: number; ticks: { y: number; label: string }[]; lines: string[]; nodes: ChartNode[] };
type Option = { id: string; label: string; detail?: string };
type Metric = "rate" | "totalCents" | "accuracy";
type Filters = { examCategory?: string; dimension?: string; metric?: Metric; sourceId?: string; page?: number; selectedId?: string; from?: string; to?: string };

export type AnalyticsReportProps = {
  model: { previousId: string; currentId: string; previousScore: number; currentScore: number; delta: number | null; rates: { key: string; label: string; before: number | null; after: number | null; delta: number | null }[]; types: { key: string; name: string; before: number | null; after: number | null; delta: number | null }[]; count: number; chart: ChartModel | null; statsPath: string };
  onOpen: () => void;
  onPrevious: () => void;
};
export type AnalyticsStatsProps = {
  model: { title: string; dimension: string; metric: Metric; dimensionLabel: string; metricLabel: string; dimensions: Option[]; categories: Option[]; categoryId: string; categoryLabel: string; sources: Option[]; sourceId: string; sourceLabel: string; from: string; to: string; boundsValid: boolean; total: number; rejectedCount: number; latest: string; latestRatio: number | null; average: string; calendarAnchor: string; chart: ChartModel; selectedId: string; rows: { id: string; ordinal: number; date: string; title: string; institution: string; score: string; value: string; accuracy: string; missing: string | null }[]; page: number; pageCount: number; start: number; end: number };
  onChange: (patch: Filters) => void;
  onDates: (from: string, to: string) => boolean;
  onReport: (id: string) => void;
};

const score = (value: number) => String(Number((value / 100).toFixed(2)));
const rate = (value: number | null) => value === null ? "—" : `${Number((value * 100).toFixed(1))}%`;
const delta = (value: number | null, unit = "分", scale = 0.01) => value === null ? "—" : Math.abs(value) < 1e-10 ? "持平" : `${value > 0 ? "进步" : "退步"} ${Number((Math.abs(value) * scale).toFixed(2))} ${unit}`;
const signedPoints = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${Number((value * 100).toFixed(1))}`;
const changeTone = (value: number | null) => value === null ? "is-missing" : value === 0 ? "is-same" : value > 0 ? "is-up" : "is-down";
const ariaRate = (value: number | null) => value === null ? "未记录" : rate(value);

function ChangeIcon({ value, size = 15 }: { value: number | null; size?: number }) {
  return value === null || value === 0 ? <Minus size={size} aria-hidden="true" /> : value > 0 ? <ArrowUpRight size={size} aria-hidden="true" /> : <ArrowDownRight size={size} aria-hidden="true" />;
}

function SubjectChange({ type }: { type: AnalyticsReportProps["model"]["types"][number] }) {
  return <li className={`ios-vs-subject ${changeTone(type.delta)}`} data-analysis-subject={type.name}>
    <header><h3>{type.name}</h3><span className="ios-vs-points" aria-label={delta(type.delta, "个百分点", 100)}><ChangeIcon value={type.delta} size={12} />{type.delta === 0 ? "持平" : signedPoints(type.delta)}</span></header>
    <div className={`ios-vs-rate-glyph ${type.after === null ? "is-missing" : ""}`} role="img" aria-label={`${type.name}，上次${ariaRate(type.before)}，本次${ariaRate(type.after)}`}>
      {type.after !== null ? <span className="ios-vs-rate-fill" style={{ width: `${type.after * 100}%` }} /> : null}
      {type.before !== null ? <i className="ios-vs-previous-tick" style={{ left: `${type.before * 100}%` }} /> : null}
    </div>
    <div className="ios-vs-subject-values"><strong>{rate(type.after)}</strong><small>{rate(type.before)}</small></div>
  </li>;
}

function Trend({ chart, selectedId, onSelect, compact = false }: { chart: ChartModel; selectedId?: string; onSelect?: (id: string) => void; compact?: boolean }) {
  const selected = chart.nodes.find((node) => node.id === selectedId) ?? chart.nodes.at(-1);
  return <div className={`ios-analysis-plot ${compact ? "is-mini" : ""}`} data-selected-id={selected?.id} role={onSelect ? "group" : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? "练习曲线，左右方向键选择记录，Home 和 End 选择首末记录" : undefined} onKeyDown={(event) => {
    if (!onSelect || !chart.nodes.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const at = Math.max(0, chart.nodes.findIndex((node) => node.id === selected?.id));
    const index = event.key === "Home" ? 0 : event.key === "End" ? chart.nodes.length - 1 : Math.max(0, Math.min(chart.nodes.length - 1, at + (event.key === "ArrowLeft" ? -1 : 1)));
    onSelect(chart.nodes[index].id);
  }}>
    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="按实际提交时间排列的成绩曲线">
      {chart.ticks.map((tick) => <g key={tick.y}><path d={`M54 ${tick.y}H${chart.width - 24}`} className="ios-analysis-grid" /><text x={45} y={tick.y + 4} textAnchor="end">{tick.label}</text></g>)}
      {chart.lines.map((line, index) => <polyline key={index} points={line} className="ios-analysis-line" />)}
      {chart.nodes.filter((node) => node.y !== null).map((node) => <circle key={node.id} cx={node.x} cy={node.y ?? 0} r={node.id === selected?.id ? 4.5 : 3} className={node.id === selected?.id ? "is-selected" : ""} onClick={() => onSelect?.(node.id)}><title>{`第 ${node.ordinal} 次 · ${node.date} · ${node.title} · ${node.value}`}</title></circle>)}
      {[chart.nodes[0], chart.nodes.length > 1 && chart.nodes.at(-1)?.x !== chart.nodes[0]?.x ? chart.nodes.at(-1) : undefined].filter((node) => node !== undefined).map((node, index) => <text key={node.id} x={node.x} y={chart.height - 12} textAnchor={index ? "end" : "start"}>{node.date}</text>)}
    </svg>
    <ol className="ios-analysis-sr">{chart.nodes.map((node) => <li key={node.id}>第 {node.ordinal} 次，{node.date}，{node.title}，{node.value}</li>)}</ol>
  </div>;
}

export function AnalyticsReportCard({ model, onOpen, onPrevious }: AnalyticsReportProps) {
  const change = model.delta === null ? "—" : model.delta === 0 ? "持平" : `${model.delta > 0 ? "+" : "−"}${(Math.abs(model.delta) / 100).toFixed(2)}`;
  // 纸卡和图形共同表达前后关系，完整板块各占一枚小卡，不再使用文字明细表。
  return <Card className="ios-analysis-card ios-analysis-vs"><CardContent>
    <div className="ios-analysis-heading"><h2>本次对比</h2><Button variant="ghost" size="icon" onClick={onOpen} aria-label="查看完整成长分析"><ArrowUpRight size={18} /></Button></div>
    <div className="ios-analysis-score-pair">
      <Button variant="ghost" className={`ios-vs-score ios-vs-previous ${model.previousScore >= 10000 ? "is-wide" : ""}`} onClick={onPrevious} aria-label={`上一刷 ${score(model.previousScore)} 分，查看报告`}><small>上次</small><span><strong>{(model.previousScore / 100).toFixed(2)}</strong><em>分</em></span></Button>
      <span className="ios-vs-divider" aria-hidden="true">VS</span>
      <div className={`ios-vs-score ios-vs-current ${model.currentScore >= 10000 ? "is-wide" : ""}`}><small>本次</small><span><strong>{(model.currentScore / 100).toFixed(2)}</strong><em>分</em></span></div>
    </div>
    <div className={`ios-analysis-delta ${changeTone(model.delta)}`} role="status" aria-label={delta(model.delta)}><ChangeIcon value={model.delta} size={20} /><strong>{change}</strong>{model.delta !== 0 ? <small>分</small> : null}</div>
    <div className="ios-analysis-rate-pair">{model.rates.map((item) => <span key={item.key} aria-label={`${item.label}，上次${ariaRate(item.before)}，本次${ariaRate(item.after)}`}><small>{item.key === "accuracy" ? <CircleCheck size={14} /> : <Gauge size={14} />}{item.label}</small><span><small>{rate(item.before)}</small><ArrowRight size={12} aria-hidden="true" /><b>{rate(item.after)}</b></span></span>)}</div>
    {model.types.length ? <section className="ios-vs-subjects" aria-label="全部板块得分率变化"><div className="ios-vs-subject-heading"><h3>板块变化</h3><span><i className="ios-vs-legend-tick" />上次</span><span><i className="ios-vs-legend-fill" />本次</span><small>百分点</small></div><ol className="ios-analysis-subject-grid">{model.types.map((type) => <SubjectChange key={type.key} type={type} />)}</ol></section> : null}
    {model.chart ? <div className="ios-analysis-mini"><Trend chart={model.chart} selectedId={model.currentId} compact /></div> : null}
  </CardContent></Card>;
}

const parseDate = (value: string) => value ? new Date(`${value}T12:00:00`) : undefined;
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (date: Date) => `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

// DayPicker owns date arithmetic and keyboard navigation; beUI owns the themed button surface.
function CalendarDay({ day, modifiers, onAnimationStart, onDrag, onDragStart, onDragEnd, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (modifiers.focused) ref.current?.focus(); }, [modifiers.focused]);
  return <Button ref={ref} variant="ghost" pressScale={1} {...props} />;
}
// Native animation/drag callbacks have different signatures from Motion; the calendar does not use them.
function CalendarNavigation({ onAnimationStart, onDrag, onDragStart, onDragEnd, ...props }: ComponentProps<"button">) { return <Button variant="ghost" size="icon" {...props} />; }

function PracticeCalendar({ from, to, anchor, onFrom, onTo }: { from: string; to: string; anchor: string; onFrom: (date: string) => void; onTo: (date: string) => void }) {
  const [endpoint, setEndpoint] = useState<"from" | "to">("from");
  const [month, setMonth] = useState(parseDate(from || to || anchor));
  const start = parseDate(from), end = parseDate(to);
  return <div className="ios-analysis-calendar">
    <div className="ios-analysis-date-endpoints">{[{ id: "from", label: "开始日期", value: from }, { id: "to", label: "结束日期", value: to }].map((item) => <Button key={item.id} variant="ghost" aria-label={item.label} aria-pressed={endpoint === item.id} onClick={() => { setEndpoint(item.id === "from" ? "from" : "to"); if (item.value) setMonth(parseDate(item.value)); }}><small>{item.label}</small><b>{item.value ? item.value.replaceAll("-", ".") : "选择日期"}</b></Button>)}</div>
    <DayPicker mode="single" month={month} onMonthChange={setMonth} locale={zhCN} weekStartsOn={1} navLayout="around" showOutsideDays fixedWeeks selected={endpoint === "from" ? start : end} onSelect={(date) => { if (!date) return; if (endpoint === "from") { onFrom(localDate(date)); setEndpoint("to"); } else onTo(localDate(date)); }} modifiers={{ range_start: start, range_end: end, range_middle: start && end && from <= to ? { after: start, before: end } : undefined }} labels={{ labelDayButton: dateLabel, labelPrevious: () => "上个月", labelNext: () => "下个月", labelGrid: () => "练习日期日历" }} components={{ DayButton: CalendarDay, PreviousMonthButton: CalendarNavigation, NextMonthButton: CalendarNavigation }} />
  </div>;
}

type Sheet = "filters" | "dimension" | "category" | "source" | "dates" | "pages" | "help" | null;
export function AnalyticsDashboard({ model, onChange, onDates, onReport }: AnalyticsStatsProps) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(model.from);
  const [to, setTo] = useState(model.to);
  const [dateError, setDateError] = useState("");
  const pagePicker = useRef<HTMLButtonElement>(null);
  const open = (next: Sheet) => { setQuery(""); setDateError(""); setFrom(model.from); setTo(model.to); setSheet(next); };
  const choose = (patch: Filters) => { setSheet(null); onChange(patch); };
  const options = sheet === "dimension" ? model.dimensions : sheet === "category" ? model.categories : sheet === "source" ? model.sources : [];
  const chosen = sheet === "dimension" ? model.dimension : sheet === "category" ? model.categoryId : model.sourceId;
  const title = sheet === "dimension" ? "选择题型" : sheet === "category" ? "考试类别" : sheet === "source" ? "来源套卷" : sheet === "dates" ? "练习日期" : sheet === "pages" ? "记录范围" : sheet === "help" ? "关于计分" : "筛选";
  const activeFilters = Number(model.sourceId !== "all") + Number(Boolean(model.from || model.to));
  const selected = model.rows.find((row) => row.id === model.selectedId) ?? model.rows.at(-1);
  return <div className="ios-analysis-dashboard">
    <div className="ios-analysis-toolbar"><Button variant="secondary" onClick={() => open("dimension")} className="ios-analysis-dimension">{model.dimensionLabel}<ChevronDown size={15} /></Button><Button variant="ghost" onClick={() => open("filters")} aria-label="筛选分析记录"><SlidersHorizontal size={17} />筛选{activeFilters ? <span>{activeFilters}</span> : null}</Button></div>
    <Tabs value={model.metric} onValueChange={(value) => { if (value === "rate" || value === "totalCents" || value === "accuracy") onChange({ metric: value }); }} variant="segment" className="ios-analysis-tabs"><TabsList aria-label="分析指标">{[{ id: "rate", label: "得分率" }, { id: "totalCents", label: "得分" }, { id: "accuracy", label: "正确率" }].map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList></Tabs>
    {/* 单次记录不画无意义的单点曲线；同一指标与卷名在卡片和表格中各有唯一归属。 */}
    <Card className={`ios-analysis-card ios-analysis-overview ${model.total === 1 ? "is-first" : ""}`}><CardContent>
      <div className="ios-analysis-summary"><span><small>最近{model.metricLabel}</small><strong>{model.latest}{model.metric === "totalCents" ? <em>分</em> : null}</strong></span><div className="ios-analysis-summary-meta">{model.total > 1 ? <span><small>平均</small><b>{model.average}</b></span> : null}<span aria-label={`${model.total} 次练习`}><Activity size={13} /><b>{model.total}<em>次</em></b></span></div>{model.total === 1 ? <ProgressRing value={(model.latestRatio ?? 0) * 100} label={model.metricLabel} size={62} strokeWidth={4}><Activity size={21} /></ProgressRing> : null}</div>
      {!model.boundsValid ? <p className="ios-analysis-empty" role="status">请调整日期范围</p> : !model.total ? <p className="ios-analysis-empty" role="status">这里还没有练习记录</p> : model.total > 1 ? <><Trend chart={model.chart} selectedId={model.selectedId} onSelect={(id) => onChange({ selectedId: id })} />{selected ? <output className="ios-analysis-selected" aria-live="polite" aria-label={`${selected.title}，第 ${selected.ordinal} 次，${selected.date}，${selected.value}`}><span><CalendarDays size={13} />{selected.date} · {selected.ordinal}刷</span><b>{selected.value}</b></output> : null}</> : null}
    </CardContent></Card>
    {model.rows.length ? <Card className="ios-analysis-card"><CardContent><div className="ios-analysis-heading"><h2>练习记录</h2><small>{model.pageCount > 1 ? `${model.start}–${model.end} / ${model.total}` : `${model.total} 次`}</small></div><table className="ios-analysis-records"><colgroup><col className="analysis-paper-col"/><col className="analysis-score-col"/><col className="analysis-value-col"/><col className="analysis-open-col"/></colgroup><thead><tr><th>套卷</th><th>得分</th><th>{model.metric === "totalCents" ? "正确率" : model.metricLabel}</th><th aria-label="报告"/></tr></thead><tbody>{model.rows.map((row) => <tr key={row.id} className={row.id === model.selectedId ? "is-selected" : ""}><td><Button variant="ghost" onClick={() => onChange({ selectedId: row.id })} aria-label={`选择第 ${row.ordinal} 次，${row.title}`} className="ios-analysis-record-name"><Avatar name={publisherName(row.institution)} src={publisherIcon(row.institution)} size="sm" /><span><b title={row.title}>{row.title}</b><small>{row.date} · {row.ordinal}刷</small></span></Button></td><td>{row.score}</td><td className="ios-analysis-record-value"><span>{model.metric === "totalCents" ? row.accuracy : row.value}</span>{row.missing ? <small className="ios-analysis-missing">{row.missing}</small> : null}</td><td className="ios-analysis-record-open"><Button variant="ghost" size="icon" onClick={() => onReport(row.id)} aria-label={`查看第 ${row.ordinal} 次报告`}><ChevronRight size={15}/></Button></td></tr>)}</tbody></table>{model.pageCount > 1 ? <nav className="ios-analysis-pages" aria-label="练习分页"><Button variant="ghost" size="icon" disabled={model.page === 0} onClick={() => { onChange({ page: model.page - 1 }); if (model.page === 1) pagePicker.current?.focus(); }} aria-label="早一页"><ChevronLeft size={17} /></Button><Button variant="ghost" ref={pagePicker} onClick={() => open("pages")}>{model.page + 1} / {model.pageCount}</Button><Button variant="ghost" size="icon" disabled={model.page === model.pageCount - 1} onClick={() => { onChange({ page: model.page + 1 }); if (model.page === model.pageCount - 2) pagePicker.current?.focus(); }} aria-label="晚一页"><ChevronRight size={17} /></Button></nav> : null}</CardContent></Card> : null}
    {model.rejectedCount ? <details className="ios-analysis-unavailable"><summary>{model.rejectedCount} 份记录暂不可分析</summary><p>这些记录缺少完整的评分依据。</p></details> : null}
    <BottomSheet open={sheet !== null} onOpenChange={(next) => { if (!next) setSheet(null); }} snapPoints={["auto"]} className="beui-island ios-analysis-sheet" labels={{ label: title, close: "关闭筛选" }}>
      <header className="ios-analysis-sheet-top">{sheet !== "filters" && sheet !== "dimension" && sheet !== "pages" ? <Button variant="ghost" size="icon" onClick={() => open("filters")} aria-label="返回筛选"><ChevronLeft size={18} /></Button> : null}<h2>{title}</h2>{sheet === "category" ? <Button variant="ghost" size="icon" onClick={() => open("help")} aria-label="计分说明"><CircleHelp size={18} /></Button> : null}<Button variant="ghost" size="icon" onClick={() => setSheet(null)} aria-label="关闭筛选"><X size={18} /></Button></header>
      {/* 卷型是唯一分组选择；每份记录使用自己的分值，机构只保留为来源筛选。 */}
      {sheet === "filters" ? <div className="ios-analysis-options ios-analysis-filters">{[{ id: "category", label: "考试类别", icon: FileText, value: model.categoryLabel }, { id: "source", label: "来源套卷", icon: FileText, value: model.sourceLabel }, { id: "dates", label: "练习日期", icon: CalendarDays, value: model.from || model.to ? `${model.from || "起始"} 至 ${model.to || "至今"}` : "全部日期" }].map((item) => <Button key={item.id} variant="ghost" onClick={() => { if (item.id === "category" || item.id === "source" || item.id === "dates") open(item.id); }}><i><item.icon size={18} /></i><span><b>{item.label}</b><small>{item.value}</small></span><ChevronRight size={17} /></Button>)}</div> : null}
      {sheet === "dimension" || sheet === "category" || sheet === "source" ? <>{options.length > (sheet === "dimension" ? 12 : 6) ? <TextInput className="ios-analysis-search" aria-label={`搜索${title}`} placeholder="搜索" leftIcon={<Search size={16} />} value={query} onChange={setQuery} /> : null}<div className={`ios-analysis-options ${sheet === "dimension" ? "ios-analysis-dimensions" : ""}`}>{options.filter((option) => `${option.label} ${option.detail ?? ""}`.includes(query.trim())).map((option) => <div key={option.id}><Button variant="ghost" aria-pressed={option.id === chosen} onClick={() => choose(sheet === "dimension" ? { dimension: option.id } : sheet === "category" ? { examCategory: option.id, sourceId: "all" } : { sourceId: option.id })}><span><b>{option.label}</b>{option.detail ? <small>{option.detail}</small> : null}</span><span className="ios-analysis-option-check">{option.id === chosen ? <Check size={17} /> : null}</span></Button></div>)}</div></> : null}
      {sheet === "dates" ? <div className="ios-analysis-date-fields"><PracticeCalendar from={from} to={to} anchor={model.calendarAnchor} onFrom={(date) => { setFrom(date); setDateError(""); }} onTo={(date) => { setTo(date); setDateError(""); }} />{dateError ? <p role="alert">{dateError}</p> : null}<div className="ios-analysis-date-actions"><Button variant="secondary" onClick={() => { setSheet(null); onChange({ from: "", to: "" }); }}>清除</Button><Button onClick={() => { if (onDates(from, to)) setSheet(null); else setDateError("开始日期不能晚于结束日期"); }}>应用</Button></div></div> : null}
      {sheet === "help" ? <div className="ios-analysis-help"><p>本页按练习题量归组：130题为地市卷，135题为副省卷。</p><p>同一卷型的练习一起展示。每份成绩沿用自己的分值和满分，得分率按本卷计算。</p><a href="https://legalinfo.moj.gov.cn/zhfxfzzx/fzzxyw/202610/t20261013_540645.html" target="_blank" rel="noreferrer">官方招考信息<ArrowUpRight size={14} /></a></div> : null}
      {sheet === "pages" ? <div className="ios-analysis-options">{Array.from({ length: model.pageCount }, (_, index) => <Button key={index} variant="ghost" aria-pressed={index === model.page} onClick={() => choose({ page: index })}><span>第 {index * 8 + 1}–{Math.min(model.total, (index + 1) * 8)} 次</span>{index === model.page ? <Check size={18} /> : null}</Button>)}</div> : null}
    </BottomSheet>
  </div>;
}

export function mountAnalyticsReport(container: HTMLElement, props: AnalyticsReportProps) { return mountRoot(container, <AnalyticsReportCard {...props} />); }
export function mountAnalyticsStats(container: HTMLElement, props: AnalyticsStatsProps) { return mountRoot(container, <AnalyticsDashboard {...props} />); }
