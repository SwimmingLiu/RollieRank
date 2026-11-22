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
  const opacity = useMotionValue(1);
  const reducedMotion = useReducedMotion();
  const paper = useRef<HTMLElement>(null);
  const suppressClick = useRef(false);
  const previousQuestion = useRef(question);

  useEffect(() => {
    const previous = previousQuestion.current;
    previousQuestion.current = question;
    if (previous === question || reducedMotion) {
      x.set(0);
      opacity.set(1);
      return;
    }
    const direction = question > previous ? 1 : -1;
    x.set(direction * 44);
    opacity.set(0.35);
    const slide = animate(x, 0, { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] });
    const fade = animate(opacity, 1, { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] });
    return () => { slide.stop(); fade.stop(); };
  }, [question, reducedMotion, x, opacity]);

  function pan(_event: PointerEvent, info: PanInfo) {
    // A horizontal gesture moves this card; native vertical scrolling remains available.
    if (Math.hypot(info.offset.x, info.offset.y) >= 8) suppressClick.current = true;
    const horizontal = Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.2;
    if (!horizontal) {
      x.set(0);
      opacity.set(1);
      return;
    }
    const atEdge = (info.offset.x < 0 && question >= total) || (info.offset.x > 0 && question <= 1);
    const offset = atEdge
      ? Math.max(-18, Math.min(18, info.offset.x * 0.12))
      : Math.max(-56, Math.min(56, info.offset.x * 0.34));
    x.set(offset);
    opacity.set(atEdge ? 1 : Math.max(0.76, 1 - Math.abs(offset) / 220));
  }

  function endPan(_event: PointerEvent, info: PanInfo) {
    if (Math.hypot(info.offset.x, info.offset.y) >= 8) suppressClick.current = true;
    const distance = Math.abs(info.offset.x);
    const horizontal = distance > Math.abs(info.offset.y) * 1.2;
    const threshold = Math.max(44, (paper.current?.clientWidth ?? 300) * .16);
    const deliberate = distance >= threshold || (distance >= 24 && Math.abs(info.velocity.x) >= 500);
    if (horizontal && deliberate) {
      const target = question + (info.offset.x < 0 ? 1 : -1);
      if (target >= 1 && target <= total) {
        onJump(target);
        return;
      }
    }
    animate(x, 0, { duration: reducedMotion ? 0 : .18 });
    animate(opacity, 1, { duration: reducedMotion ? 0 : .18 });
  }

  return <div className="rr-single-answer" data-single-question={question}>
    <motion.section ref={paper} className="rr-single-paper" role="group" aria-label={`第 ${question} 题，${section}`} style={{ x, opacity, touchAction: "pan-y" }}
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
