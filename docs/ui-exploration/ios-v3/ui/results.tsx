import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, ChevronRight, CircleDashed, Clock3, LayoutGrid, List, Trophy, X } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "./components/motion/button/base";
import { Card, CardContent } from "./components/motion/card";
import { TiltCard } from "./components/motion/tilt-card";
import { Avatar, Badge, NumberTicker, ProgressBar } from "./primitives";
import { mountRoot } from "./root-registry";
import { publisherName } from "./publishers";
import { AbilityRadar } from "./ability-radar";

import { primarySectionScores, type SectionScore } from "../score-groups.js";
export type { SectionScore } from "../score-groups.js";
export type ScoreVerification = { kind: "verified" } | { kind: "legacy" };
// 真实答卷的满分和参与状态来自服务端；固定百分制与演示名次不适用于新套卷。
export type ScoreOverviewProps = {
  total: number;
  maxScore?: number;
  verification?: ScoreVerification;
  correct: number;
  wrong: number;
  blank?: number;
  rank: number | null;
  participants: number;
  sections: SectionScore[];
  initialAll?: boolean;
  onAllChange?: (all: boolean) => void;
  onRank: () => void;
  onReview: (section: string) => void;
};

const rateLabel = (section: SectionScore) => String(Math.round(section.earnedCents / section.maxCents * 1000) / 10);
const points = (cents: number) => (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
const twoDigits = (value: number) => String(value).padStart(2, "0");
const hasStanding = ({ rank, participants }: Pick<ScoreOverviewProps, "rank" | "participants">) => rank !== null && rank > 0 && participants > 0;

// 交卷与答案订正均自动计分，旧示例只标明来源，不再引导考生手动核分。
function VerificationStatus({ verification }: { verification?: ScoreVerification }) {
  if (!verification || verification.kind === "verified") return null;
  return <span className="rr-score-verification" role="status" style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, opacity: .75 }}>示例估分</span>;
}

// Both report and artwork compare normalized lengths while preserving each subject's real earned/max values.
export function SectionScores({ sections, matrix = false, animated = true, onReview }: { sections: SectionScore[]; matrix?: boolean; animated?: boolean; onReview?: (section: string) => void }) {
  const reduce = useReducedMotion();
  return <div className={matrix ? "rr2-score-matrix" : "rr2-score-bars"} data-slot="section-scores">{sections.map((section, index) => {
    const values = <><div className="rr2-section-score-label"><span>{section.name}</span><strong className="num">{rateLabel(section)}<small>%</small></strong>{onReview ? <ChevronRight size={15} aria-hidden="true" /> : null}</div><span className="rr6-section-raw">{points(section.earnedCents)} / {points(section.maxCents)} 分</span><ProgressBar value={section.earnedCents} max={section.maxCents} label={section.name} valueText={`${points(section.earnedCents)}分，满分${points(section.maxCents)}分`} className={section.earnedCents / section.maxCents < 0.6 ? "rr2-section-progress lower" : "rr2-section-progress"} animated={animated} /></>;
    return <motion.div className="rr2-section-score" key={section.name} initial={animated && !reduce ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: animated && !reduce ? index * 0.025 : 0 }}>
      {matrix ? <Card className="rr4-score-cell"><CardContent>{values}</CardContent></Card> : values}
      {onReview ? <Button variant="ghost" className="rr-card-hit rr-section-hit" pressScale={1} onClick={() => onReview(section.name)} aria-label={`复盘${section.name}，得分${points(section.earnedCents)}，满分${points(section.maxCents)}`} /> : null}
    </motion.div>;
  })}</div>;
}

// The result is a composed score sheet: one score, one rank action and two useful review targets.
// The user removed the extra paper-identity strip; navigation retains the actual attempt context.
export function ScoreOverview(props: ScoreOverviewProps) {
  const [all, setAll] = useState(props.initialAll ?? false);
  const reduce = useReducedMotion();
  const sections = useMemo(() => primarySectionScores(props.sections), [props.sections]);
  const maximum = props.maxScore ?? 100;
  const ranked = hasStanding(props);
  return (
    <div className="rr2-report rr3-report" data-slot="score-report" data-ready="true">
      <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
        <Card className="rr3-score-card">
          <CardContent className="rr3-score-content">
            {/* 订正属于本次成绩，用卡内短状态进入详情，避免在报告前再插一整块提示。 */}
            <span className="rr3-score-label">总分<VerificationStatus verification={props.verification} /><span data-feature="corrections-status" className="ios-feature-host rr-score-correction" /></span>
            <div className={`rr2-score-total rr3-total ${props.total >= 100 ? "wide-value" : ""}`} aria-label={`本次估分${props.total.toFixed(2)}分，满分${points(maximum * 100)}分`}><strong><NumberTicker value={props.total} decimals={2} duration={0.65} stagger={0.018} /></strong><span> / {points(maximum * 100)} 分</span></div>
            <img className="rr3-score-art" src="assets/illustrations/score-ribbon.svg" alt="" aria-hidden="true" />
            {/* 留空交卷后明确显示未答，避免正确与错误数量看似没有覆盖整卷。 */}
            <div className={`rr2-score-outcomes rr3-outcomes ${(props.blank ?? 0) > 0 ? "has-blank" : ""}`}><span className="correct"><span className="rr6-outcome-icon"><Check size={17} /></span><b className="num">{props.correct}</b><small>正确</small></span><span className="wrong"><span className="rr6-outcome-icon"><X size={17} /></span><b className="num">{props.wrong}</b><small>错误</small></span>{(props.blank ?? 0) > 0 ? <span className="rr-outcome-blank"><span className="rr6-outcome-icon"><CircleDashed size={16} /></span><b className="num">{props.blank}</b><small>未答</small></span> : null}</div>
            <Button variant="ghost" className="rr3-rank-link" aria-label={ranked ? `同卷练习榜，第${props.rank}名，共${props.participants}人` : "未参与排名，查看同卷练习榜"} onClick={props.onRank}><Trophy size={15} /><span>{ranked ? "同卷排名" : "未参与排名"}</span>{ranked ? <><b className="num">{props.rank}</b><small> / {props.participants}</small></> : null}<ChevronRight size={15} /></Button>
          </CardContent>
        </Card>
      </motion.div>
      {/* 首刷不预留分析卡空隙；有可比快照后由分析包装显示原生 VS。 */}
      <div data-feature="analytics-comparison" className="ios-feature-host" hidden />
      <AbilityRadar sections={sections} />
      <section className="rr3-sections" aria-label="板块表现">
        {/* 非标准题量的报告保留实际板块；两种布局均展示全部已记录数据。 */}
        <div className="rr3-section-heading"><h2>板块表现</h2><Button variant="ghost" size="sm" className="rr2-section-toggle" aria-pressed={all} onClick={() => { setAll(!all); props.onAllChange?.(!all); }}>{all ? <LayoutGrid size={15} /> : <List size={15} />}{all ? "卡片展示" : "列表展示"}</Button></div>
        {all ? <Card className="rr3-all-sections"><CardContent><SectionScores sections={sections} onReview={props.onReview} /></CardContent></Card> : <div className="rr3-featured-sections">{sections.map((section, index) => <Card key={section.name} className={`rr3-subject-card tone-${index % 2}`} interactive><CardContent><span className="rr3-subject-name">{section.name}<ChevronRight size={14} /></span><strong className="rr3-subject-points">{rateLabel(section)}<small>%</small></strong><span className="rr6-subject-raw">{points(section.earnedCents)} / {points(section.maxCents)} 分</span><ProgressBar value={section.earnedCents} max={section.maxCents} label={section.name} valueText={`${points(section.earnedCents)}分，满分${points(section.maxCents)}分`} animated={!reduce} /></CardContent><Button variant="ghost" className="rr-card-hit" pressScale={1} aria-label={`复盘${section.name}，得分${points(section.earnedCents)}，满分${points(section.maxCents)}`} onClick={() => props.onReview(section.name)} /></Card>)}</div>}
      </section>
    </div>
  );
}

export type ShareResultProps = {
  logoSrc: string;
  publisherLogoSrc: string;
  institution: string;
  year: number;
  period: number;
  paper: number;
  collectionLabel?: string;
  paperTitle?: string;
  total: number;
  maxScore?: number;
  verification?: ScoreVerification;
  rank: number | null;
  participants: number;
  sections: SectionScore[];
  correct?: number;
  wrong?: number;
  blank?: number;
  comparison?: { previousScore: number; currentScore: number };
  timing?: { plannedMs: number; actualMs: number; modules?: { name: string; plannedMs: number; actualMs: number }[] };
};

export type ShareMode = "report" | "score" | "sections" | "radar";

export const SHARE_MODES = [
  { id: "report", label: "长图" }, { id: "score", label: "成绩卡" },
  { id: "sections", label: "题型" }, { id: "radar", label: "雷达" },
] satisfies { id: ShareMode; label: string }[];

export function isShareMode(value: string): value is ShareMode {
  return SHARE_MODES.some(mode => mode.id === value);
}

// 年份属于试卷身份；系列自身带年份时只显示一次，品牌改作末尾的轻水印。
const shareCollection = (props: ShareResultProps) => (props.collectionLabel ?? `第 ${twoDigits(props.period)} 期`).replace(new RegExp(`^${props.year}(?:年|\\s|·)*`), "");
function ShareWatermark({ logoSrc }: Pick<ShareResultProps, "logoSrc">) {
  return <footer className="rr-share-watermark" aria-label="卷卷小榜"><img src={logoSrc} alt="" /><span>卷卷小榜</span></footer>;
}

// The exported image is this same component in static mode, not a separate canvas approximation.
// A single framed card replaces the nested colour tiles; its illustration never encodes a score or ranking.
export function ShareArtwork(props: ShareResultProps & { exportMode?: boolean }) {
  const animated = !props.exportMode;
  // 分项可能只传部分板块；海报满分使用答卷快照，100 仅兼容旧调用。
  const maximum = props.maxScore ?? 100;
  const ranked = hasStanding(props);
  const sections = primarySectionScores(props.sections);
  return <Card className="rr4-share-artwork rr5-share-artwork" data-share-artwork="true" data-export={props.exportMode || undefined} data-institution={props.institution}>
    <div className="rr5-poster-frame">
      <CardContent className="rr5-poster-hero">
        <div className="rr5-poster-paper"><Avatar name={publisherName(props.institution)} src={props.publisherLogoSrc} size="sm" /><span>{publisherName(props.institution)}</span><span>{props.year} · {shareCollection(props)}</span><span>{props.paperTitle ?? <>行测 <b>{twoDigits(props.paper)}</b> 套</>}</span></div>
        {/* 成绩图直接显示真实分数与满分，重复标题同时从兼容海报移除。 */}
        <div className={`rr5-poster-total ${props.total >= 100 ? "wide-value" : ""}`}><VerificationStatus verification={props.verification} /><strong><NumberTicker value={props.total} decimals={2} animated={animated} duration={0.65} stagger={0.015} /></strong><small>满分 {points(maximum * 100)} 分</small></div>
        <img className="rr5-poster-illustration" src="assets/illustrations/score-keepsake-v1-640.png" alt="" aria-hidden="true" />
        <div className="rr5-poster-rank" aria-label={ranked ? `同卷第${props.rank}名，共${props.participants}人` : "未参与排名"}><Trophy size={16} /><span>{ranked ? "同卷名次" : "未参与排名"}</span>{ranked ? <strong className="num">{props.rank}<small> / {props.participants}</small></strong> : null}</div>
      </CardContent>
      <CardContent className="rr5-poster-sections"><div className="rr5-section-heading"><h2>板块得分率</h2></div><div className="rr6-share-rates" role="img" aria-label={`${sections.length} 个板块得分率：${sections.map(section => `${section.name}${rateLabel(section)}%`).join("，")}`}>{sections.map(section => <div className="rr6-rate-row" key={section.name}><div><span>{section.name}</span><strong className="num">{rateLabel(section)}<small>%</small></strong></div><ProgressBar value={section.earnedCents} max={section.maxCents} label={section.name} valueText={`${rateLabel(section)}%`} animated={animated} /></div>)}</div></CardContent>
    </div>
    <ShareWatermark logoSrc={props.logoSrc} />
  </Card>;
}

export function ShareResult(props: ShareResultProps) {
  const reduce = useReducedMotion();
  return <motion.div className="rr2-share-page" data-ready="true" initial={reduce ? false : { opacity: 0, y: 16, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 230, damping: 25 }}><TiltCard max={5} glare={false} className="rr2-share-tilt"><ShareArtwork {...props} /></TiltCard></motion.div>;
}

const elapsed = (value: number) => `${Number((value / 60000).toFixed(1))} 分`;
const scoreChange = (value: number) => `${value > 0 ? "+" : ""}${Number(value.toFixed(2))}`;

function ShareSectionRows({ sections }: { sections: SectionScore[] }) {
  return <div className="rr-share-subjects" aria-label="全部板块得分">{sections.map(section => <div key={section.name} className="rr-share-subject">
    <div><b>{section.name}</b><strong>{rateLabel(section)}<small>%</small></strong></div>
    <ProgressBar value={section.earnedCents} max={section.maxCents} label={section.name} valueText={`${points(section.earnedCents)} 分，满分 ${points(section.maxCents)} 分`} animated={false} />
    <small>{points(section.earnedCents)} / {points(section.maxCents)} 分</small>
  </div>)}</div>;
}

function ShareOutcomes(props: ShareResultProps) {
  // Old share callers omit question counts; preserve that uncertainty instead of inferring counts from scores.
  if (props.correct === undefined || props.wrong === undefined || props.blank === undefined) return null;
  return <div className="rr-share-outcomes" aria-label="答题结果"><span><Check size={15} /><b>{props.correct}</b><small>正确</small></span><span><X size={15} /><b>{props.wrong}</b><small>错误</small></span><span><CircleDashed size={15} /><b>{props.blank}</b><small>未答</small></span></div>;
}

// These four artifacts share one data contract and one render tree for preview and PNG, so export never drifts from the selected view.
export function ShareModeArtwork(props: ShareResultProps & { mode: ShareMode; exportMode?: boolean }) {
  const sections = useMemo(() => primarySectionScores(props.sections), [props.sections]);
  const ranked = hasStanding(props), maximum = props.maxScore ?? 100;
  const full = props.mode === "report", scoreOnly = props.mode === "score";
  return <Card className={`rr-share-artifact rr-share-artifact-${props.mode}`} data-share-artwork="true" data-share-mode={props.mode} data-export={props.exportMode || undefined}>
    {/* 四种成图均把年份并入卷身份，品牌不再占据独立的顶部信息行。 */}
    <div className="rr-share-paper"><span className="rr-share-logo-slot"><Avatar name={publisherName(props.institution)} src={props.publisherLogoSrc} size="sm" /></span><div className="rr-share-identity-line"><b>{publisherName(props.institution)} · {props.year} · {shareCollection(props)}</b><span> · {props.paperTitle ?? `行测 ${twoDigits(props.paper)} 套`}</span></div></div>
    {/* 长图、成绩卡、题型和雷达都复用这组数值，去掉重复标签后保留分数与满分。 */}
    <div className={`rr-share-score ${full || scoreOnly ? "is-hero" : "is-compact"}`} aria-label={`成绩 ${props.total.toFixed(2)} 分，满分 ${maximum} 分`}>
      {/* 历史示例仍保留来源标记；真实成绩不会为此生成额外文字或留白。 */}
      <div><VerificationStatus verification={props.verification} /><strong>{props.total.toFixed(2)}</strong><small> / {points(maximum * 100)} 分</small></div>
      {full || scoreOnly ? <img src="assets/illustrations/score-ribbon.svg" alt="" aria-hidden="true" /> : null}
    </div>
    {full || scoreOnly ? <ShareOutcomes {...props} /> : null}
    {full || scoreOnly ? <div className="rr-share-standing" aria-label={ranked ? `同卷第 ${props.rank} 名，共 ${props.participants} 人` : "未参与排名"}><Trophy size={15} /><span>{ranked ? "同卷排名" : "未参与排名"}</span>{ranked ? <b>{props.rank}<small> / {props.participants}</small></b> : null}</div> : null}
    {full || props.mode === "radar" ? <AbilityRadar sections={sections} /> : null}
    {full || props.mode === "sections" ? <section className="rr-share-section-card"><h2>板块表现</h2><ShareSectionRows sections={sections} /></section> : null}
    {full && props.comparison ? <section className="rr-share-comparison" aria-label="与上次比较"><div><small>上次</small><strong>{props.comparison.previousScore.toFixed(2)}</strong></div><span>VS</span><div><small>本次</small><strong>{props.comparison.currentScore.toFixed(2)}</strong></div><b>{scoreChange(props.comparison.currentScore - props.comparison.previousScore)}<small> 分</small></b></section> : null}
    {full && props.timing ? <section className="rr-share-timing"><h2><Clock3 size={17} />做题用时</h2><div><span><small>计划</small><b>{elapsed(props.timing.plannedMs)}</b></span><span><small>实际</small><b>{elapsed(props.timing.actualMs)}</b></span><span><small>差值</small><b>{scoreChange((props.timing.actualMs - props.timing.plannedMs) / 60000)} 分</b></span></div>{props.timing.modules?.length ? <table><thead><tr><th>板块</th><th>计划</th><th>实际</th></tr></thead><tbody>{props.timing.modules.map(module => <tr key={module.name}><th scope="row">{module.name}</th><td>{elapsed(module.plannedMs)}</td><td>{elapsed(module.actualMs)}</td></tr>)}</tbody></table> : null}</section> : null}
    <ShareWatermark logoSrc={props.logoSrc} />
  </Card>;
}

async function exportShare(props: ShareResultProps, mode?: ShareMode): Promise<string> {
  const host = document.createElement("div");
  host.className = "rr2-poster-host beui-island";
  host.setAttribute("aria-hidden", "true");
  // Explicit modes measure their content; the old poster keeps its documented 450×720 export.
  Object.assign(host.style, { position: "fixed", left: "-10000px", top: "0", width: "450px", ...(mode ? {} : { height: "720px" }), pointerEvents: "none" });
  document.body.append(host);
  const dispose = mountRoot(host, mode ? <ShareModeArtwork {...props} mode={mode} exportMode /> : <ShareArtwork {...props} exportMode />);
  try {
    await document.fonts.ready;
    await Promise.all([...host.querySelectorAll("img")].map(image => image.decode()));
    // Card owns data-slot="card"; use a dedicated business marker instead of overriding its slot contract.
    const artwork = host.querySelector<HTMLElement>('[data-share-artwork="true"]');
    if (!artwork) throw new Error("成绩卡未能生成");
    // The shared radar uses a real canvas; wait for its fonts and animation before cloning it to PNG.
    const deadline = performance.now() + 5000;
    while ([...artwork.querySelectorAll("canvas")].some(canvas => canvas.dataset.ready !== "true")) {
      if (performance.now() > deadline) throw new Error("能力图尚未准备好，请重试");
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    const lastSection = artwork.querySelector<HTMLElement>(".rr6-share-rates > :last-child");
    if (lastSection && lastSection.getBoundingClientRect().bottom > artwork.getBoundingClientRect().bottom - 12) {
      throw new Error(`成绩卡内容超出海报范围 ${Math.ceil(lastSection.getBoundingClientRect().bottom - artwork.getBoundingClientRect().bottom + 12)}px`);
    }
    const height = mode ? Math.ceil(artwork.getBoundingClientRect().height) : 720;
    if (height < 1 || artwork.scrollWidth > 451) throw new Error("分享布局未能生成，请重试");
    return await toPng(artwork, { width: 450, height, pixelRatio: 2, backgroundColor: "#fffaf1" });
  } finally {
    dispose();
    host.remove();
  }
}

export async function createSharePoster(props: ShareResultProps): Promise<string> { return exportShare(props); }
export async function createModeSharePoster(props: ShareResultProps, mode: ShareMode): Promise<string> { return exportShare(props, mode); }
