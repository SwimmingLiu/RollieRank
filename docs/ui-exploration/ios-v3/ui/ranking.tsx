import { motion, useReducedMotion } from "motion/react";
import { Card, CardContent } from "./components/motion/card";
import { Tabs, TabsList, TabsTrigger } from "./components/motion/tabs";
import { Avatar, NumberTicker } from "./primitives";
import { TiltCard } from "./components/motion/tilt-card";
import { Button } from "./components/motion/button/base";
import { BriefcaseBusiness, ChevronLeft, CircleHelp, Crown, Globe2, Search, Trophy, UsersRound } from "lucide-react";

// Imported papers use their own type IDs; the live dimension list, rather than a fixed demo union, owns the available tabs.
export type RankDimension = string;
export type RankingPerson = { key?: string; place: number; name: string; score: number | string; avatarSrc?: string; detail?: string; isMe?: boolean; publicId?: string; surpassedPercent?: number };
export type RankingLoadState = { kind: "ready" } | { kind: "loading" } | { kind: "error"; message: string };
export type RankingProps = {
  identityLabel: string;
  publisherLogoSrc: string;
  context: { publisher: string; year: number | string; collection: string; variant?: string; paper: string };
  dimension: RankDimension;
  people: RankingPerson[];
  rows: RankingPerson[];
  // A real receipt may be private or the board may be empty; null keeps those states distinct from any numeric place.
  myRank: number | null;
  participants: number;
  myScore: number | null;
  mySurpassedPercent?: number | null;
  onPerson?: (publicId: string) => void;
  dimensions?: { value: RankDimension; label: string }[];
  scoreUnit?: "分" | "%";
  scope?: {
    value: "selected" | "nationwide" | "position";
    label: string;
    missingSelection: boolean;
    position?: { year: number; exam: "guokao" | "shengkao"; department: string; title: string } | null;
  };
  paging?: { page: number; pages: number };
  loadState?: RankingLoadState;
  onDimensionChange: (dimension: RankDimension) => void;
  onBack: () => void;
};
const DIMENSIONS = [
  { value: "total", label: "总分" }, { value: "politics", label: "政治" }, { value: "common", label: "常识" }, { value: "language", label: "言语" },
  { value: "math", label: "数量" }, { value: "judgment", label: "判断推理" }, { value: "data", label: "资料" },
] satisfies { value: RankDimension; label: string }[];
const compactName = (name: string) => name.replace(/\s/g, "");
// 常见板块用短标签留出字号和间距；判断推理保留全名，自定义题型与读屏名称保持完整。
const shortLabels = new Map<string, string>([["政治理论", "政治"], ["常识判断", "常识"], ["言语理解", "言语"], ["数量关系", "数量"], ["资料分析", "资料"]]);

// Rank slots stay fixed while a metric changes: moving people across one another can obscure scores and invert rows.
// Player cards share the paper/illustration language of the practice cards; depth belongs to the card edges.
export function Ranking(props: RankingProps) {
  const reduce = useReducedMotion();
  const dimensions = props.dimensions ?? DIMENSIONS;
  const loadState = props.loadState ?? { kind: "ready" };
  const ready = loadState.kind === "ready";
  const unit = props.scoreUnit ?? "分";
  // Competition ranks can repeat. Visual podium slots remain distinct and retain every real person, including tied first places.
  const winners = [1, 0, 2].flatMap(index => {
    const person = props.people[index];
    return person ? [{ person, slot: index + 1 }] : [];
  });
  const selfLabel = loadState.kind === "loading" ? "正在读取名次" : loadState.kind === "error" ? "排名暂不可用"
    : props.myRank === null ? "未参与排名" : `我的同卷名次${props.myRank}，共${props.participants}人`;
  const hasRows = ready && props.people.length + props.rows.length > 0;
  const winnerIncludesMe = props.people.some(person => person.isMe);
  const scopePosition = props.scope?.position;
  const scopeTitle = props.scope?.value === "nationwide" ? "全国考生" : props.scope?.missingSelection ? "尚未选岗" : scopePosition?.department ?? "当前岗位";
  const scopeDetail = props.scope?.value === "nationwide" ? "不限报考岗位" : props.scope?.missingSelection ? "当前显示全国成绩" : scopePosition?.title ?? props.scope?.label ?? "";
  return <section className="rr2-ranking rr6-ranking" data-dimension={props.dimension} aria-label="同卷练习榜">
    {/* 交卷默认上榜，右上角只保留简短规则入口。 */}
    <header className="rr6-rank-header">
      <Button variant="ghost" size="icon" className="rr6-rank-back" onClick={props.onBack} aria-label="返回估分报告"><ChevronLeft size={22} /></Button><h1>同卷榜</h1>
      <div className="rr6-rank-tools">
        <Button variant="ghost" size="icon" className="rr6-rank-help" data-position-action="rules" aria-label="榜单规则"><CircleHelp size={18} /></Button>
      </div>
    </header>
    {/* 用户需要一眼读完整卷身份；合并图标与标签的容器，让系列、卷类和套号在窄屏仍处于同一行。 */}
    <Card className="rr6-rank-context" aria-label={props.identityLabel}><CardContent><Avatar name={props.context.publisher} src={props.publisherLogoSrc} size="sm" /><span className="rr6-context-identity"><b>{props.context.publisher}</b><span>{props.context.year}</span><span>{props.context.collection}</span>{props.context.variant ? <span className="rr6-context-variant">{props.context.variant}</span> : null}<span className="rr6-context-paper">{props.context.paper}</span></span></CardContent></Card>
    <Tabs value={props.dimension} onValueChange={value => { if (dimensions.some(item => item.value === value)) props.onDimensionChange(value); }} variant="segment" className="rr2-rank-tabs"><TabsList className="rr2-rank-tab-list">{dimensions.map(dimension => <TabsTrigger key={dimension.value} value={dimension.value} aria-label={dimension.label} className="rr2-rank-tab" indicatorClassName="rr2-rank-tab-indicator">{shortLabels.get(dimension.label) ?? dimension.label}</TabsTrigger>)}</TabsList></Tabs>
    {props.scope ? <div className="ios-positions-scope">
      <div className="rr6-rank-scope-switch" role="group" aria-label="榜单范围">
        <Button variant="ghost" aria-label="我的岗位" data-position-action="scope-selected" aria-pressed={props.scope.value === "selected"}><BriefcaseBusiness size={14} />岗位</Button>
        <Button variant="ghost" aria-label="全国" data-position-action="scope-nationwide" aria-pressed={props.scope.value === "nationwide"}><Globe2 size={14} />全国</Button>
        <Button variant="ghost" aria-label="其他岗位" data-position-action="browse" aria-pressed={props.scope.value === "position"}><Search size={14} />换岗</Button>
      </div>
      {/* 全国默认范围使用同一语义图标，避免尚未选岗时仍暗示一个报考岗位。 */}
      <Card className="rr6-rank-place" size="compact"><CardContent><span className="rr6-rank-place-icon">{props.scope.value === "nationwide" ? <Globe2 size={17} /> : <BriefcaseBusiness size={17} />}</span><div><strong>{scopeTitle}</strong><small>{scopeDetail}</small></div>{ready ? <span className="rr6-rank-people"><UsersRound size={14} />{props.participants}</span> : null}{props.scope.missingSelection ? <Button variant="ghost" size="sm" data-position-action="choose" aria-label="选择岗位">选岗</Button> : null}</CardContent></Card>
    </div> : null}
    {!ready ? <div className="ios-positions-status" role={loadState.kind === "error" ? "alert" : "status"}>{loadState.kind === "error" ? <><p>{loadState.message}</p><Button variant="outline" data-position-action="retry-board">重新读取榜单</Button></> : "正在读取榜单…"}</div> : null}
    {hasRows && winners.length ? <div className="rr6-winners" aria-label="同卷前三名">{winners.map(({ person, slot }) => <motion.div key={person.key ?? `winner-${slot}`} className={`rr6-winner-wrap place-${slot}`} initial={reduce ? false : { opacity: 0, y: 16, rotateX: -8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ type: "spring", stiffness: 250, damping: 26 }}>
      <TiltCard max={4} glare={false} className="rr6-winner-tilt"><Card className={`rr6-winner-card place-${slot}`} aria-label={`第${person.place}名，${person.name}，${Number(person.score).toFixed(2)}${unit}`}><CardContent><span className="rr6-place">{String(person.place).padStart(2, "0")}</span>{person.place === 1 ? <Crown className="rr6-crown" size={23} aria-hidden="true" /> : null}<Avatar name={person.name} src={person.avatarSrc} size="lg" className="rr6-winner-avatar" /><span className="rr6-winner-name" title={person.name}>{compactName(person.name)}</span><strong className="rr6-winner-score"><NumberTicker value={Number(person.score)} decimals={2} duration={0.5} stagger={0.012} /></strong><small>{unit}</small>{person.isMe && person.surpassedPercent !== undefined ? <small className="rr6-rank-surpassed">超越 {Number(person.surpassedPercent.toFixed(1))}%</small> : null}{person.detail ? <small className="ios-positions-score-detail">{person.detail}</small> : null}</CardContent>{person.publicId && props.onPerson ? <Button variant="ghost" className="rr-card-hit" aria-label={`查看${person.name}公开成绩`} onClick={() => { if (person.publicId) props.onPerson?.(person.publicId); }} /> : null}</Card></TiltCard>
    </motion.div>)}</div> : null}
    {ready && !hasRows ? <Card className="rr6-rank-empty"><CardContent><span className="rr6-rank-empty-icon"><Trophy size={21} /></span><strong>暂无真实成绩</strong></CardContent></Card> : null}
    {hasRows && !winnerIncludesMe ? <Card className="rr6-self-card" data-my-rank={props.myRank ?? "none"} aria-label={selfLabel}><CardContent><Avatar name="我" size="md" /><div className="rr6-self-copy"><span>我的排名</span><strong className={`num ${props.myRank === null ? "ios-positions-unranked" : ""}`}>{props.myRank ?? "未参与排名"}<small> / {props.participants}</small></strong>{props.mySurpassedPercent !== undefined && props.mySurpassedPercent !== null ? <small className="rr6-rank-surpassed">超越 {Number(props.mySurpassedPercent.toFixed(1))}%</small> : null}</div>{props.myScore !== null ? <strong className="rr6-self-score num"><NumberTicker value={props.myScore} decimals={2} duration={0.5} stagger={0.012} /><small>{unit}</small></strong> : null}</CardContent></Card> : null}
    {/* 公开成绩的整行点击区必须以行自身定位，独立挂载榜单时也不能遮住选岗等操作。 */}
    {ready ? <ol className="rr6-rank-list" start={props.rows[0]?.place ?? 1} aria-label="同卷成绩">{props.rows.map((person, index) => <motion.li key={person.key ?? `row-${index}`} className={`relative rr6-rank-row ${person.isMe ? "ios-positions-is-me" : ""}`} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}><span className="rr6-row-place num">{String(person.place).padStart(2, "0")}</span><Avatar name={person.name} src={person.avatarSrc} size="md" /><span className="rr6-row-name">{compactName(person.name)}{person.isMe && person.surpassedPercent !== undefined ? <small className="rr6-rank-surpassed">超越 {Number(person.surpassedPercent.toFixed(1))}%</small> : null}{person.detail ? <small className="ios-positions-score-detail">{person.detail}</small> : null}</span><strong className="rr6-row-score num"><NumberTicker value={Number(person.score)} decimals={2} duration={0.48} stagger={0.012} /><small>{unit}</small></strong>{person.publicId && props.onPerson ? <Button variant="ghost" className="rr-card-hit" aria-label={`查看${person.name}公开成绩`} onClick={() => { if (person.publicId) props.onPerson?.(person.publicId); }} /> : null}</motion.li>)}</ol> : null}
    {ready && props.paging && props.paging.pages > 1 ? <div className="ios-positions-rank-paging"><Button variant="outline" data-position-action="board-prev" disabled={props.paging.page <= 1}>上一页</Button><span>第 {props.paging.page} / {props.paging.pages} 页</span><Button variant="outline" data-position-action="board-next" disabled={props.paging.page >= props.paging.pages}>下一页</Button></div> : null}
  </section>;
}
