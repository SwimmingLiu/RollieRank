import { animate, motion, type PanInfo, useMotionValue, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Button } from "./components/motion/button/base";
import { TiltCard } from "./components/motion/tilt-card";
import { Card, CardHeader, CardContent, CardFooter } from "./components/motion/card";
import { ArrowRight, ChevronRight, Check, Clock3, Play, Trophy } from "lucide-react";
import { Avatar, NumberTicker, ProgressBar } from "./primitives";
import { publishers as DEFAULT_PUBLISHERS, publisherName, type Publisher } from "./publishers";
export type { Publisher } from "./publishers";

type PaperIdentity = {
  id?: string;
  year?: number;
  editionLabel?: string;
  variantLabel?: string;
  paperTitle?: string;
  institution: string;
  period: number | string;
  paper: number | string;
  answered: number;
  totalQuestions?: number;
};

export type RecentPaper = PaperIdentity & (
  | { complete: false; score?: never; rank?: never; participants?: never }
  | { complete: true; score: number | string; rank?: number; participants?: number }
);

export type HomeProps = {
  recents: RecentPaper[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  onOpen: (index: number) => void;
  onPublisher: (institution: string) => void;
  logoSrc?: string;
  paperArtSrc?: string;
  publisherLogos?: Record<string, string>;
  publishers?: Publisher[];
  timer?: { status: "ready" | "running" | "paused" | "finished"; plannedMs: number; actualMs: number; measuredAt: number };
  onTimer?: () => void;
};

// 首页承接独立计时任务；只呈现时长和一个动作，选卷与模块计划进入后再设置。
function HomeTimerCard({ model, onOpen }: { model: NonNullable<HomeProps["timer"]>; onOpen: () => void }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (model.status !== "running") return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, [model.status]);
  const actual = model.actualMs + (model.status === "running" ? Math.max(0, now - model.measuredAt) : 0);
  const seconds = Math.floor(actual / 1000);
  const time = model.status === "ready" ? String(Math.round(model.plannedMs / 60000)) : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <Card className="rr-home-timer" interactive><CardContent><span className="rr-home-timer-icon"><Clock3 size={23} /></span><div><h2>做题计时</h2><small>{model.status === "running" ? "计时中" : model.status === "paused" ? "已暂停" : model.status === "finished" ? "已结束" : "套卷 · 自定义"}</small></div><span className="rr-home-timer-value">{model.status === "ready" ? null : <strong>{time}</strong>}</span><span className="rr-home-timer-action" aria-hidden="true">{model.status === "running" ? <ChevronRight size={17} /> : <Play size={16} />}</span></CardContent><Button className="rr-card-hit" variant="ghost" pressScale={1} onClick={onOpen} aria-label={model.status === "ready" ? "开始做题计时" : model.status === "finished" ? "查看计时记录" : "继续做题计时"} /></Card>;
}

const twoDigits = (value: string | number) => String(value).padStart(2, "0");
const normalizeIndex = (index: number, length: number) => length > 0 ? ((index % length) + length) % length : 0;
const scoreLabel = (score: number | string) => typeof score === "number" ? score.toFixed(2) : score;

function publisherLogo(institution: string, props: HomeProps) {
  return props.publisherLogos?.[institution]
    ?? (props.publishers ?? DEFAULT_PUBLISHERS).find((publisher) => institution.startsWith(publisher.institution))?.logoSrc;
}

// A paper cover gives the card a subject; progress no longer competes with the paper title as a second hero.
function RecentFace({ recent, logoSrc, onOpen }: {
  recent: RecentPaper;
  logoSrc: string | undefined;
  onOpen: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const total = recent.totalQuestions ?? 130;
  return (
    <Card className="rr2-recent-card rr3-practice-cover" data-institution={recent.institution} interactive>
      <CardHeader className="rr2-recent-meta">
        <span className="rr2-publisher"><Avatar name={publisherName(recent.institution)} src={logoSrc} size="sm" />{publisherName(recent.institution)}</span>
        <span className="rr3-cover-year">{recent.year ?? 2026}</span>
      </CardHeader>
      <CardContent className="rr3-cover-content">
        {recent.complete ? <>
          <div className={`rr3-cover-score ${Number(recent.score) >= 100 ? "wide-value" : ""}`}><strong><NumberTicker value={Number(recent.score)} decimals={2} animated={false} /></strong><span>分</span></div>
          <span className="rr3-cover-identity">{recent.editionLabel ?? `第${recent.period}期`}{recent.variantLabel ? ` · ${recent.variantLabel}` : ""} · {recent.paperTitle ?? `行测 ${twoDigits(recent.paper)} 套`}</span>
        </> : <>
          <span className="rr3-cover-period">{recent.editionLabel ?? <>第 <b>{recent.period}</b> 期</>}{recent.variantLabel ? ` · ${recent.variantLabel}` : ""}</span>
          <h3 className="rr3-cover-title">{recent.paperTitle ?? <>行测 <b>{twoDigits(recent.paper)}</b> 套</>}</h3>
        </>}
        <img className="rr3-cover-art" src="assets/illustrations/answer-paper.svg" alt="" aria-hidden="true" />
      </CardContent>
      <CardFooter className="rr2-recent-foot">
        {recent.complete ? <span className="rr3-cover-status"><Check size={14} />已估分{recent.rank !== undefined ? <span><Trophy size={12} />{recent.rank}</span> : null}</span> : <div className="rr3-cover-progress"><span><b className="num">{recent.answered}</b><small> / {total} 题</small></span><ProgressBar value={recent.answered} max={total} label="录入进度" valueText={`已录${recent.answered}题，共${total}题`} animated={false} /></div>}
        <span className="rr2-card-open rr2-card-open-face" aria-hidden="true"><ArrowRight size={20} /></span>
      </CardFooter>
      {/* A transformed Button contains its own pseudo-element. A real full-card target preserves the hit area during motion. */}
      <Button variant="ghost" className="rr-card-hit" pressScale={1} onClick={onOpen} aria-label={`${publisherName(recent.institution)}${recent.editionLabel ? `${recent.editionLabel}，${recent.paperTitle ?? `第${recent.paper}套`}` : `第${recent.period}期第${recent.paper}套`}${recent.variantLabel ?? ""}，${recent.complete ? "查看成绩" : "继续录入"}`} />
    </Card>
  );
}

export function Home(props: HomeProps) {
  const { recents, initialIndex = 0, onIndexChange, onOpen, onPublisher } = props;
  const [index, setIndex] = useState(() => normalizeIndex(initialIndex, recents.length));
  const indexRef = useRef(index);
  const deck = useRef<HTMLDivElement>(null);
  // 只拦截当前拖动手势的合成点击；新的点按或键盘打开不应等待翻卡动画。
  const dragged = useRef(false);
  const lastWheel = useRef(0);
  const focusFrame = useRef<number | null>(null);
  const reduce = useReducedMotion();
  const dragTilt = useMotionValue(0);

  useEffect(() => {
    const next = normalizeIndex(initialIndex, recents.length);
    indexRef.current = next;
    setIndex(next);
  }, [initialIndex, recents.length]);

  const flip = useCallback((direction: number, focus = false) => {
    if (recents.length < 2) return;
    const next = normalizeIndex(indexRef.current + direction, recents.length);
    indexRef.current = next;
    setIndex(next);
    onIndexChange?.(next);
    if (focus) {
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
      focusFrame.current = requestAnimationFrame(() => { focusFrame.current = null; deck.current?.querySelector<HTMLButtonElement>('[data-distance="0"] button')?.focus({ preventScroll: true }); });
    }
  }, [onIndexChange, recents.length]);

  useEffect(() => () => { if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current); dragTilt.stop(); }, [dragTilt]);

  useEffect(() => {
    const element = deck.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (recents.length < 2 || Math.abs(event.deltaY) < 4 || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      event.preventDefault();
      if (performance.now() - lastWheel.current < 500) return;
      lastWheel.current = performance.now();
      flip(event.deltaY > 0 ? 1 : -1);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [flip, recents.length]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    flip(event.key === "ArrowDown" ? 1 : -1, true);
  };

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Depth follows the dragged paper itself; it settles without delaying the next card's state.
    animate(dragTilt, 0, { type: "spring", stiffness: 420, damping: 34 });
    if (Math.abs(info.offset.y) > 32 || (Math.abs(info.velocity.y) > 280 && Math.abs(info.offset.y) > 10)) {
      flip(info.offset.y < 0 ? 1 : -1);
    }
  };

  return (
    <div className="rr-home">
      <div className="rr-brand">
        {props.logoSrc ? <img className="rr-brand-mark" src={props.logoSrc} alt="" /> : null}
        <h1 className="rr-brand-title">卷卷小榜</h1>
      </div>
      {props.timer && props.timer.status !== "ready" && props.onTimer ? <HomeTimerCard model={props.timer} onOpen={props.onTimer} /> : null}
      {/* First-use starts with publishers; empty decorative cards would imply nonexistent history. */}
      {recents.length > 0 && <section className="rr-recents" aria-label="最近练习">
        <div className="rr-section-heading"><h2>最近练习</h2></div>
        <div className="rr-deck rr-deck--drum" ref={deck} tabIndex={0} role="region" aria-label={`最近练习，第${index + 1}张，共${recents.length}张；上下滑动切换`} onKeyDown={onKeyDown}>
          {recents.map((recent, cardIndex) => {
            const distance = normalizeIndex(cardIndex - index, recents.length);
            const active = distance === 0;
            return (
              // Neighbouring covers curve above and below the front card, so the motion belongs to the card itself.
              <motion.div className="rr-recent" data-distance={distance} data-complete={recent.complete} key={recent.id ?? `${recent.institution}-${recent.period}-${recent.paper}`} aria-hidden={!active} inert={!active} initial={false} animate={{ y: active ? 0 : distance === 1 ? 42 : -30, scale: active ? 1 : 0.95, rotateX: active ? 0 : distance === 1 ? -24 : 24 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }} style={{ zIndex: active ? 3 : distance === 1 ? 2 : 1 }}>
                <motion.div
                  className="rr-recent-drag"
                  drag={active && recents.length > 1 ? "y" : false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={reduce ? 0 : 0.5}
                  dragSnapToOrigin
                  onPointerDownCapture={() => { dragged.current = false; }}
                  onDragStart={() => { dragged.current = true; dragTilt.stop(); }}
                  onDrag={(_event, info) => { if (!reduce) dragTilt.set(Math.max(-10, Math.min(10, -info.offset.y / 11))); }}
                  onDragEnd={onDragEnd}
                  onPointerCancel={() => { dragged.current = true; dragTilt.stop(); dragTilt.set(0); }}
                  style={{ width: "100%", height: "100%", touchAction: active ? "pan-x" : "auto", rotateX: active ? dragTilt : 0, transformPerspective: 900 }}
                >
                  {active ? <RecentFace recent={recent} logoSrc={publisherLogo(recent.institution, props)} onOpen={(event) => { if (event.detail === 0 || !dragged.current) onOpen(cardIndex); }} /> : <Card variant="muted" className="rr-back-card" data-institution={recent.institution}><span className="rr-peek"><span>{publisherName(recent.institution)} · {recent.editionLabel ?? `${twoDigits(recent.period)}期`} · {recent.paperTitle ?? `${twoDigits(recent.paper)}套`}</span><b>{recent.complete ? `${scoreLabel(recent.score)} 分` : `${recent.answered} / ${recent.totalQuestions ?? 130}`}</b></span></Card>}

                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </section>}
      {/* The action heading explains the purpose of publisher selection without adding an onboarding paragraph. */}
      <section className="rr-publishers" aria-label="出版机构">
        <div className="rr-section-heading"><h2>选卷估分</h2></div>
        <div className="rr-publisher-grid">
          {(props.publishers ?? DEFAULT_PUBLISHERS).map((publisher) => (
            <TiltCard key={publisher.institution} className="rr-publisher-tilt" max={3} glare={false}>
              <Card className="rr-publisher" size="compact" interactive>
                <CardContent className="rr-publisher-main">
                  <span className="rr-publisher-logo"><img src={props.publisherLogos?.[publisher.institution] ?? publisher.logoSrc} alt="" /></span>
                  <span className="rr-publisher-name">{publisher.name}</span>
                  <ChevronRight className="rr-publisher-arrow" size={18} aria-hidden="true" />
                </CardContent>
                <Button className="rr-card-hit" variant="ghost" pressScale={1} aria-label={`${publisher.name}，选择套卷`} onClick={() => onPublisher(publisher.institution)} />
              </Card>
            </TiltCard>
          ))}
        </div>
      </section>
      {props.timer?.status === "ready" && props.onTimer ? <HomeTimerCard model={props.timer} onOpen={props.onTimer} /> : null}
    </div>
  );
}
