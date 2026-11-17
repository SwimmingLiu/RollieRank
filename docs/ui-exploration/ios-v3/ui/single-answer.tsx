import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from "motion/react";
import { Bookmark, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./components/motion/button/base";
import { mountRoot } from "./root-registry";

type Answer = "A" | "B" | "C" | "D";
const OPTIONS: readonly Answer[] = ["A", "B", "C", "D"];
export type SingleAnswerProps = {
  question: number;
  total: number;
  section: string;
  answer: string;
  marked: boolean;
  onAnswer: (option: Answer) => void;
  onJump: (question: number) => void;
  onMark: () => void;
};

export function SingleAnswer({ question, total, section, answer, marked, onAnswer, onJump, onMark }: SingleAnswerProps) {
  const x = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const paper = useRef<HTMLElement>(null);
  const suppressClick = useRef(false);

  useEffect(() => { x.set(0); }, [question, x]);

  function pan(_event: PointerEvent, info: PanInfo) {
    // A horizontal gesture moves this card; native vertical scrolling remains available.
    if (Math.hypot(info.offset.x, info.offset.y) >= 8) suppressClick.current = true;
    const horizontal = Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.2;
    x.set(horizontal ? Math.max(-24, Math.min(24, info.offset.x * .12)) : 0);
  }

  function endPan(_event: PointerEvent, info: PanInfo) {
    if (Math.hypot(info.offset.x, info.offset.y) >= 8) suppressClick.current = true;
    const distance = Math.abs(info.offset.x);
    const horizontal = distance > Math.abs(info.offset.y) * 1.2;
    const threshold = Math.max(44, (paper.current?.clientWidth ?? 300) * .16);
    const deliberate = distance >= threshold || (distance >= 24 && Math.abs(info.velocity.x) >= 500);
    if (horizontal && deliberate) {
      const target = question + (info.offset.x < 0 ? 1 : -1);
      if (target >= 1 && target <= total) onJump(target);
    }
    animate(x, 0, { duration: reducedMotion ? 0 : .18 });
  }

  return <div className="rr-single-answer" data-single-question={question}>
    <motion.section ref={paper} className="rr-single-paper" role="group" aria-label={`第 ${question} 题，${section}`} style={{ x, touchAction: "pan-y" }}
      onPan={pan} onPanEnd={endPan}
      onPointerDownCapture={() => { suppressClick.current = false; }}
      onKeyDownCapture={() => { suppressClick.current = false; }}
      onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      {/* Match the list action so a bookmark always means an uncertain answer to check later. */}
      <header className="rr-single-heading"><h2><small>第</small><strong>{question}</strong><small>题</small></h2><Button variant="ghost" className="rr-single-mark" aria-pressed={marked} aria-label={`${marked ? "取消存疑" : "存疑"}第 ${question} 题`} title="存疑的题可从待检查集中回看" onClick={onMark}><Bookmark size={17} fill={marked ? "currentColor" : "none"} />{marked ? "已存疑" : "存疑"}</Button></header>
      <div className="rr-single-options" role="group" aria-label="选择答案">{OPTIONS.map(option => <Button key={option} variant="secondary" pressScale={.98} className={`rr-single-option ${answer === option ? "is-selected" : ""}`} aria-label={`第 ${question} 题，选 ${option}`} aria-pressed={answer === option} data-single-option={option} onClick={() => onAnswer(option)}><b>{option}</b>{answer === option ? <Check size={19} aria-hidden="true" /> : <span className="rr-single-option-dot" aria-hidden="true" />}</Button>)}</div>
      <nav className="rr-single-navigation" aria-label="单题导航"><Button variant="ghost" disabled={question <= 1} onClick={() => onJump(question - 1)} aria-label="上一题"><ChevronLeft size={17} />上一题</Button><Button variant="ghost" disabled={question >= total} onClick={() => onJump(question + 1)} aria-label="下一题">下一题<ChevronRight size={17} /></Button></nav>
    </motion.section>
  </div>;
}

export function mountSingleAnswer(container: HTMLElement, props: SingleAnswerProps) { return mountRoot(container, <SingleAnswer {...props} />); }
