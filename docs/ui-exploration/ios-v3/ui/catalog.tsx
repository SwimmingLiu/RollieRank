import { ArrowRight, Check, ChevronDown, Pencil } from "lucide-react";
import { Button } from "./components/motion/button/base";
import { Card, CardContent } from "./components/motion/card";
import { ProgressBar } from "./primitives";

type Paper = { number: number; name?: string } & (
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

// Shared paper specifications belong to their period. Each cover shows only its own number and actual state.
export function Catalog(props: CatalogProps) {
  return <div className="rr3-catalog" data-institution={props.institution}>
    <div className="rr3-catalog-selector">
      <Card className="rr3-period-card" interactive={props.canSwitch}>
        <CardContent>
          {props.collectionMeta ? <span className="rr3-catalog-spec">{props.collectionMeta}</span> : null}
          <div className="rr3-period-face rr5-collection-face"><h2>{props.collectionTitle}</h2>{props.canSwitch ? <ChevronDown size={20} /> : null}</div>
        </CardContent>
        {/* A single collection opens directly; it does not need a one-option selection dialog. */}
        {props.canSwitch ? <Button id="period-picker" variant="ghost" className="rr-card-hit" pressScale={1} aria-label={`选择套卷，当前${props.collectionTitle}${props.collectionMeta ? `，${props.collectionMeta}` : ""}`} onClick={props.onPeriods} /> : null}
      </Card>
    </div>
    <div className="rr3-paper-grid" aria-label={props.collectionTitle}>
      {props.papers.map(paper => <Card className={`rr3-paper-cover ${paper.status}`} interactive key={paper.number}>
        <CardContent>
          <div className="rr3-paper-top"><strong>{String(paper.number).padStart(2, "0")}<small>套</small></strong>{paper.status === "complete" ? <Check size={17} className="rr3-paper-state" /> : paper.status === "draft" ? <span className="rr3-paper-edit-badge" aria-label="录入中"><Pencil size={15} /></span> : null}</div>
          {paper.name ? <span className="rr5-paper-name">{paper.name}</span> : null}
          <div className="rr3-paper-foot">{paper.status === "complete" ? <span className="rr3-paper-score">{paper.score.toFixed(2)}<small>分</small></span> : paper.status === "draft" ? <span className="rr3-paper-progress-label">{paper.answered}<small> / {paper.totalQuestions}</small></span> : <span className="rr6-paper-new">开始</span> }<ArrowRight size={17} /></div>
          {paper.status === "draft" ? <ProgressBar value={paper.answered} max={paper.totalQuestions} label={`第${paper.number}套录入进度`} valueText={`已录${paper.answered}题，共${paper.totalQuestions}题`} animated={false} /> : null}
        </CardContent>
        <Button variant="ghost" className="rr-card-hit" pressScale={1} aria-label={`第${paper.number}套，${paper.status === "complete" ? `查看成绩${paper.score.toFixed(2)}分` : paper.status === "draft" ? `继续录入，已录${paper.answered}题` : "开始录入"}`} onClick={() => props.onOpen(paper.number)} />
      </Card>)}
    </div>
  </div>;
}
