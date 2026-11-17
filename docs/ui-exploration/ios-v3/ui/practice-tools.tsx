import { BriefcaseBusiness, ChartNoAxesCombined, ChevronRight, LoaderCircle } from "lucide-react";
import { Card, CardContent } from "./components/motion/card";
import { Button } from "./components/motion/button/base";
import { mountRoot } from "./root-registry";

export type PositionToolState =
  | { kind: "loading" }
  | { kind: "unselected" }
  | { kind: "selected"; title: string; department: string }
  | { kind: "error" };
export type PracticeToolsProps = {
  position: PositionToolState;
  attemptCount: number;
  onPosition: () => void;
  onAnalysis: () => void;
};

export function PracticeTools({ position, attemptCount, onPosition, onAnalysis }: PracticeToolsProps) {
  const value = position.kind === "selected" ? position.title : position.kind === "loading" ? "读取中" : position.kind === "error" ? "重新读取" : "未选岗";
  const label = position.kind === "selected" ? `报考岗位，${position.department}，${position.title}，修改岗位` : "选择报考岗位";
  return <div className="rr-practice-tools" data-slot="practice-tools">
    <Card className="rr-practice-tool position" size="compact" interactive>
      <CardContent className="rr-practice-tool-content">
        <span className="rr-practice-tool-label"><BriefcaseBusiness size={17} />报考岗位</span>
        <div className="rr-practice-tool-value"><strong title={position.kind === "selected" ? `${position.department} · ${position.title}` : undefined}>{value}</strong>{position.kind === "loading" ? <LoaderCircle size={15} className="rr-practice-tool-loader" /> : <ChevronRight size={16} />}</div>
      </CardContent>
      <Button variant="ghost" pressScale={1} className="rr-card-hit" disabled={position.kind === "loading"} aria-label={label} onClick={onPosition} />
    </Card>
    <Card className="rr-practice-tool analysis" size="compact" interactive>
      <CardContent className="rr-practice-tool-content">
        <span className="rr-practice-tool-label"><ChartNoAxesCombined size={17} />成长分析</span>
        <div className="rr-practice-tool-value"><strong>{attemptCount ? <><b className="num">{attemptCount}</b><small>次练习</small></> : "查看进步"}</strong><ChevronRight size={16} /></div>
      </CardContent>
      <Button variant="ghost" pressScale={1} className="rr-card-hit" aria-label="查看成长分析" onClick={onAnalysis} />
    </Card>
  </div>;
}

export function mountPracticeTools(container: HTMLElement, props: PracticeToolsProps) {
  return mountRoot(container, <PracticeTools {...props} />);
}
