import { BarChart3, Check, ChevronLeft, ChevronRight, UsersRound } from "lucide-react";
import { Button } from "./components/motion/button/base";
import { Card, CardContent } from "./components/motion/card";
import { Tabs, TabsList, TabsTrigger } from "./components/motion/tabs";
import { Avatar, ProgressBar } from "./primitives";
import { mountRoot } from "./root-registry";

type Scope = "selected" | "nationwide" | "position";
type Band = "all" | "lt60" | "60-70" | "70-80" | "80plus";
type Question = { number: number; type: string; typeId: string; correctAnswer: string; ownAnswer: string | null; options: { answer: string; count: number; rate: number | null }[]; blank: { count: number; rate: number | null } };
export type InsightData = { versionId: string; scope: "nationwide" | "position"; band: Band; selectionMissing: boolean; participantCount: number; sampleCount: number; minSampleSize: number; lowSample: boolean; questions: Question[]; subjects: { id: string; name: string; count: number; maxCents: number; ownRate: number | null; averageRate: number | null; deltaRate: number | null }[]; bands: { id: Band; label: string; count: number }[] };
export type PublicResultData = { participantCount: number; scope: "nationwide" | "position"; result: { publicId: string; name: string; rank: number; surpassedPercent: number; totalCents: number; maxCents: number; rate: number; subjects: { id: string; name: string; count: number; centsEarned: number; maxCents: number; rate: number }[] } };
type PanelState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "questions"; data: InsightData; question: number } | { kind: "comparison"; data: InsightData } | { kind: "public"; data: PublicResultData };
export type InsightPanelProps = { state: PanelState; scope: Scope; onScope: (scope: "selected" | "nationwide") => void; onBand: (band: Band) => void; onQuestion: (question: number) => void; onRetry: () => void; onFeedback?: (question: number) => void };
export type InsightQuestionStatProps = { question: number; wrong: boolean; state: { kind: "loading" } | { kind: "error" } | { kind: "ready"; correctRate: number | null; sameWrongRate: number | null } };
const percent = (value: number | null) => value === null ? "—" : `${Number((value * 100).toFixed(1))}%`;
const points = (value: number) => String(Number((value / 100).toFixed(2)));
const bandLabels: Record<Band, string> = { all: "全部", lt60: "60以下", "60-70": "60–70", "70-80": "70–80", "80plus": "80以上" };
const isBand = (value: string): value is Band => Object.hasOwn(bandLabels, value);

function PublicResult({ data }: { data: PublicResultData }) {
  const person = data.result;
  return <div className="rr-insight-public">
    <Card className="rr-insight-score"><CardContent><div className="rr-insight-person"><Avatar name={person.name} size="md" /><b title={person.name}>{person.name}</b><span>第 {person.rank} 名</span></div><strong>{points(person.totalCents)}<small> / {points(person.maxCents)} 分</small></strong><div className="rr-insight-public-meta"><span>超越 {Number(person.surpassedPercent.toFixed(1))}%</span><span><UsersRound size={13} />{data.participantCount}</span></div></CardContent></Card>
    <div className="rr-insight-subjects">{person.subjects.map((subject) => <div key={subject.id}><header><b>{subject.name}</b><span>{points(subject.centsEarned)} / {points(subject.maxCents)}</span><strong>{percent(subject.rate)}</strong></header><ProgressBar value={subject.rate * 100} label={`${subject.name}得分率`} animated={false} /></div>)}</div>
  </div>;
}

export function InsightPanel(props: InsightPanelProps) {
  const { state } = props;
  if (state.kind === "loading") return <div className="rr-insight-status" role="status">正在读取…</div>;
  if (state.kind === "error") return <div className="rr-insight-status" role="alert"><p>{state.message}</p><Button variant="secondary" onClick={props.onRetry}>重试</Button></div>;
  if (state.kind === "public") return <div className="beui-island rr-insights"><PublicResult data={state.data} /></div>;
  const { data } = state;
  const question = state.kind === "questions" ? data.questions.find((item) => item.number === state.question) ?? data.questions[0] : undefined;
  return <div className="beui-island rr-insights">
    <div className="rr-insight-toolbar"><div role="group" aria-label="对比范围"><Button variant="ghost" aria-pressed={props.scope === "selected"} onClick={() => props.onScope("selected")}>同岗</Button><Button variant="ghost" aria-pressed={props.scope === "nationwide"} onClick={() => props.onScope("nationwide")}>全国</Button></div><span aria-label={`${data.sampleCount} 位样本`}><UsersRound size={14} />{data.sampleCount} 人</span></div>
    {data.selectionMissing ? <p className="rr-insight-hint">尚未选岗，显示全国</p> : null}
    <Tabs value={data.band} onValueChange={(band) => { if (isBand(band)) props.onBand(band); }} variant="segment" className="rr-insight-bands"><TabsList aria-label="分数段">{data.bands.map((band) => <TabsTrigger key={band.id} value={band.id} aria-label={`${bandLabels[band.id]}，${band.count}人`}>{bandLabels[band.id]}</TabsTrigger>)}</TabsList></Tabs>
    {/* 空样本只是一条当前范围状态，保留本人卡片时不再占据一整段空白。 */}
    {data.sampleCount === 0 ? <div className={`rr-insight-empty ${state.kind === "comparison" ? "is-compact" : ""}`} role="status"><UsersRound size={state.kind === "comparison" ? 15 : 24} /><span>暂无样本</span></div> : null}
    {state.kind === "questions" && question ? <>
      <div className="rr-insight-question-heading"><Button variant="ghost" size="icon" aria-label="上一题分布" disabled={question.number <= 1} onClick={() => props.onQuestion(question.number - 1)}><ChevronLeft size={18} /></Button><b>第 {question.number} 题<small>{question.type}</small></b><Button variant="ghost" size="icon" aria-label="下一题分布" disabled={question.number >= data.questions.length} onClick={() => props.onQuestion(question.number + 1)}><ChevronRight size={18} /></Button></div>
      <div className="rr-insight-answers" aria-label="本人和参考答案"><span>我选 <b>{question.ownAnswer || "留空"}</b></span><span><Check size={14} />参考 <b>{question.correctAnswer}</b></span></div>
      {/* 反馈只针对当前题的参考答案；未接入处理能力的宿主不显示空动作。 */}
      {props.onFeedback ? <Button variant="ghost" size="sm" className="rr-insight-reference-feedback" onClick={() => props.onFeedback?.(question.number)}>反馈参考答案</Button> : null}
      <div className="rr-insight-options">{question.options.map((option) => <div key={option.answer} className={option.answer === question.correctAnswer ? "is-correct" : ""}><b>{option.answer}{option.answer === question.ownAnswer ? <i aria-label="我的选择" /> : null}</b><ProgressBar value={(option.rate ?? 0) * 100} label={`选项 ${option.answer}`} valueText={`${option.count}人，${percent(option.rate)}`} animated={false} /><span><strong>{percent(option.rate)}</strong><small>{option.count} 人</small></span></div>)}<div className="rr-insight-blank"><span>留空</span><span>{question.blank.count} 人 · {percent(question.blank.rate)}</span></div></div>
    </> : null}
    {/* 双列明确标出本人和对应群体，差值保留在可访问说明中，避免孤立角标造成误读。 */}
    {state.kind === "comparison" ? <div className="rr-insight-comparison">{data.subjects.map((subject) => <Card key={subject.id} className="rr-insight-subject-card"><CardContent><header><b>{subject.name}</b></header><div className="rr-insight-value-pair"><span><small>我的</small><strong>{percent(subject.ownRate)}</strong></span><span><small>{data.band !== "all" ? "同段均值" : data.scope === "position" ? "同岗均值" : "全国均值"}</small><strong>{percent(subject.averageRate)}</strong></span></div><div className="rr-insight-comparison-track"><ProgressBar value={(subject.ownRate ?? 0) * 100} label={`${subject.name}本人得分率`} valueText={percent(subject.ownRate)} animated={false} />{subject.averageRate !== null ? <span className="rr-insight-mean-marker" style={{ left: `${subject.averageRate * 100}%` }} role="progressbar" aria-label={`${subject.name}群体平均得分率`} aria-valuenow={subject.averageRate * 100} aria-valuemin={0} aria-valuemax={100} aria-valuetext={percent(subject.averageRate)} /> : null}</div></CardContent></Card>)}</div> : null}
  </div>;
}

export function mountInsightPanel(container: HTMLElement, props: InsightPanelProps) { return mountRoot(container, <InsightPanel {...props} />); }
export function mountInsightEntry(container: HTMLElement, props: { onOpen: () => void }) { return mountRoot(container, <Button variant="ghost" size="icon" onClick={props.onOpen} aria-label="分数段能力对比" title="分数段对比"><BarChart3 size={18} /></Button>); }
export function mountInsightQuestionEntry(container: HTMLElement, props: { question: number; label: string; onOpen: () => void }) { return mountRoot(container, <Button variant="ghost" className="rr-detail-distribution" onClick={props.onOpen} aria-label={`第 ${props.question} 题选项分布`}>{props.label}</Button>); }

// Inline review cells show nationwide measurements; loading, errors and empty cohorts never imply zero.
export function InsightQuestionStat({ question, wrong, state }: InsightQuestionStatProps) {
  const correct = state.kind === "ready" ? percent(state.correctRate) : "—";
  const sameWrong = state.kind === "ready" ? percent(state.sameWrongRate) : "—";
  return <span className="rr-detail-cohort" data-state={state.kind} aria-label={`第 ${question} 题，全国答对率 ${correct}${wrong ? `，同错 ${sameWrong}` : ""}`} title={state.kind === "error" ? "统计暂不可用" : "全国答题统计"}><strong>{correct}</strong>{wrong ? <small>同错 {sameWrong}</small> : null}</span>;
}
export function mountInsightQuestionStat(container: HTMLElement, props: InsightQuestionStatProps) { return mountRoot(container, <InsightQuestionStat {...props} />); }
