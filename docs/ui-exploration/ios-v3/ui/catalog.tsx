import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { Button } from "./components/motion/button/base";
import { Card, CardContent } from "./components/motion/card";
import { ProgressBar } from "./primitives";

type Paper = { number: number; name?: string; questionCount?: number; timeLimitMinutes?: number } & (
  | { status: "new" }
  | { status: "draft"; answered: number; totalQuestions: number }
  | { status: "complete"; score: number }
);
export type CatalogProps = {
  institution: string;
  year: number;
  period: number;
  variant: string;
  collectionTitle: string;
  collectionMeta: string;
  canSwitch: boolean;
  papers: Paper[];
  onPeriods: () => void;
  onOpen: (paper: number) => void;
};

function sharedCollectionMeta(props: CatalogProps) {
  const counts = new Set(props.papers.map(p => p.questionCount).filter(Boolean));
  const mins = new Set(props.papers.map(p => p.timeLimitMinutes).filter(Boolean));
  const parts = [`共 ${props.papers.length} 套`];
  if (counts.size === 1) parts.push(`${[...counts][0]}题`);
  if (mins.size === 1) parts.push(`${[...mins][0]}分钟`);
  return parts.join(" · ");
}

// Shared paper specifications and completion live in the period header; each card stays a clean single-row paper tile.
export function Catalog(props: CatalogProps) {
  const summaryMeta = sharedCollectionMeta(props);
  const doneCount = props.papers.filter(paper => paper.status === "complete").length;
  const donePct = props.papers.length ? Math.round(doneCount / props.papers.length * 100) : 0;
  return <div className="rr3-catalog" data-institution={props.institution}>
    <div className="rr3-catalog-selector">
      <Card className="rr3-period-card" interactive={props.canSwitch}>
        <CardContent>
          <div className="rr3-period-face rr5-collection-face">
            <div className="rr6-collection-copy">
              <h2>{props.collectionTitle}</h2>
              <span className="rr6-collection-meta">{summaryMeta}</span>
            </div>
            {doneCount > 0 ? <span className="rr6-collection-stat">{doneCount}/{props.papers.length}</span> : null}
            {props.canSwitch ? <span className="rr6-collection-chevron" aria-hidden="true"><ChevronDown size={16} /></span> : null}
          </div>
          {doneCount > 0 ? <div className="rr6-collection-bar" aria-hidden="true"><span style={{ width: `${donePct}%` }} /></div> : null}
        </CardContent>
        {/* A single collection opens directly; it does not need a one-option selection dialog. */}
        {props.canSwitch ? <Button id="period-picker" variant="ghost" className="rr-card-hit" pressScale={1} aria-label={`选择套卷，当前${props.collectionTitle}${props.collectionMeta ? `，${props.collectionMeta}` : ""}`} onClick={props.onPeriods} /> : null}
      </Card>
    </div>
    <div className="rr3-paper-grid" aria-label={props.collectionTitle}>
      {props.papers.map(paper => <Card className={`rr3-paper-cover ${paper.status}`} interactive key={paper.number}>
        <CardContent>
          <div className="rr3-paper-top">
            <strong className={paper.status !== "new" ? "rr6-paper-stamp" : undefined}>
              {String(paper.number).padStart(2, "0")}
              {paper.status === "new" ? <small>套</small> : null}
              {paper.status === "complete" ? <span className="rr6-paper-badge" aria-hidden="true"><Check size={10} className="rr3-paper-state" /></span> : null}
            </strong>
          </div>
          {paper.name ? <span className="rr5-paper-name">{paper.name}</span> : null}
          <div className="rr3-paper-foot">
            {paper.status === "complete"
              ? <span className="rr3-paper-score">{paper.score.toFixed(2)}<small>分</small></span>
              : paper.status === "draft"
                ? <div className="rr6-paper-draft-col">
                    <span className="rr3-paper-progress-label">{paper.answered}<small>/{paper.totalQuestions}</small></span>
                    <ProgressBar value={paper.answered} max={paper.totalQuestions} label={`第${paper.number}套录入进度`} valueText={`已录${paper.answered}题，共${paper.totalQuestions}题`} animated={false} />
                  </div>
                : <span className="rr6-paper-action" aria-hidden="true"><ArrowRight size={14} /></span>}
          </div>
        </CardContent>
        <Button variant="ghost" className="rr-card-hit" pressScale={1} aria-label={`第${paper.number}套，${paper.status === "complete" ? `查看成绩${paper.score.toFixed(2)}分` : paper.status === "draft" ? `继续录入，已录${paper.answered}题` : "开始录入"}`} onClick={() => props.onOpen(paper.number)} />
      </Card>)}
    </div>
  </div>;
}
