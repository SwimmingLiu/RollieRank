"use client";
// beui.dev/components/motion/bottom-sheet

import {
  animate,
  AnimatePresence,
  motion,
  type PanInfo,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { type PointerEvent as ReactPointerEvent, type ReactNode, type TouchEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EASE_DRAWER } from "@/lib/ease";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { useMessages } from "@/lib/i18n";
import { PresenceGate } from "@/lib/presence-gate";
import { TOUCH_GESTURE_CONTENT_CLASS } from "@/lib/touch";
import { cn } from "@/lib/utils";

// Vaul-style glide: a long, fully-damped tween reads smoother than a spring on
// open — no settle/overshoot, just one clean decel. Same curve drives the
// backdrop fade so the surface and scrim move as one.
const DRAWER = { duration: 0.5, ease: EASE_DRAWER } as const;

/** English defaults. Override per instance with `labels`, or app-wide with `LocaleProvider`. */
export const bottomSheetMessages = {
  label: "Bottom sheet",
  close: "Close bottom sheet",
};

export type BottomSheetMessages = typeof bottomSheetMessages;

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heights (0-1 = fraction of viewport, or "auto"). First entry is default. */
  snapPoints?: (number | "auto")[];
  defaultSnap?: number;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  optionList?: boolean;
  /** Min drag distance (px) past current snap to dismiss. */
  dismissThreshold?: number;
  /** Override any built-in string. */
  labels?: Partial<BottomSheetMessages>;
}

export function BottomSheet({
  open,
  onOpenChange,
  snapPoints = [0.5, 0.92],
  defaultSnap = 0,
  title,
  description,
  children,
  className,
  optionList = false,
  dismissThreshold = 120,
  labels,
}: BottomSheetProps) {
  const t = useMessages("bottomSheet", bottomSheetMessages, labels);
  const [snap, setSnap] = useState(defaultSnap);
  const [mounted, setMounted] = useState(false);
  const dragControls = useDragControls();
  const dragOffset = useMotionValue(0);
  const scrimOpacity = useTransform(dragOffset, [0, 320], [1, 0], { clamp: true });
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const listTouch = useRef<{ x: number; y: number; atTop: boolean } | null>(null);
  const bodyPull = useRef<{ pointerId: number; x: number; y: number; atTop: boolean } | null>(null);
  const headerDrag = useRef<{ pointerId: number; x: number; y: number; handled: boolean } | null>(null);
  const reduce = useReducedMotion();
  const uid = useId();
  const titleId = `${uid}-title`;
  const descriptionId = `${uid}-description`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setSnap(defaultSnap);
      dragOffset.set(0);
    }
  }, [open, defaultSnap, dragOffset]);

  // Focus moves into the sheet on open, Tab stays inside it, and focus returns
  // to the opener on close. `mounted` gates it because the sheet only exists
  // once the portal can render.
  useFocusTrap(open && mounted, sheetRef, {
    onEscape: () => onOpenChange(false),
  });

  // Lock background scroll while open. overflow:hidden alone is ignored by
  // iOS Safari — boundary scrolls inside the sheet chain to the page, which
  // scrolls underneath and ends up somewhere else on close. position:fixed
  // is the lock that actually holds; restore the scroll position after.
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const onDrag = (_: unknown, info: PanInfo) => {
    dragOffset.set(Math.max(0, info.offset.y));
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (headerDrag.current) headerDrag.current.handled = true;
    const velocity = info.velocity.y;
    const offset = info.offset.y;
    const sheetHeight = sheetRef.current?.clientHeight || 360;
    const effectiveDismiss = Math.min(dismissThreshold, Math.max(84, sheetHeight * 0.34));
    const restoreScrim = () => {
      animate(dragOffset, 0, reduce
        ? { duration: 0.14, ease: EASE_DRAWER }
        : { duration: 0.36, ease: EASE_DRAWER });
    };
    if (optionList && snap === 0 && offset < 0 && !listOverflows()) {
      restoreScrim();
      return;
    }

    // Distance OR velocity dismisses; fast flicks feel immediate like iOS sheets.
    if ((velocity > 500 && offset > 28) || offset > effectiveDismiss) {
      const smaller = snapPoints.map((_, i) => i).filter((i) => i < snap);
      const stepDown = smaller.length > 0
        && offset < effectiveDismiss * 1.65
        && (optionList || velocity < 850);
      if (stepDown) {
        setSnap(smaller[smaller.length - 1]);
        restoreScrim();
      } else {
        onOpenChange(false);
      }
      return;
    }

    // Strong upward fling or pull → next snap.
    if ((velocity < -450 && offset < -20) || (offset < -64 && snap < snapPoints.length - 1)) {
      setSnap((current) => Math.min(snapPoints.length - 1, current + 1));
      restoreScrim();
      return;
    }

    // Otherwise snap to nearest by current offset.
    setSnap((current) => {
      if (offset > 72 && current > 0) return current - 1;
      if (offset < -72 && current < snapPoints.length - 1) return current + 1;
      return current;
    });
    restoreScrim();
  };

  function startHeaderDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('button, input, textarea, select, a, [data-vaul-no-drag]')) return;
    listTouch.current = null;
    if (optionList && event.isPrimary) {
      const start = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, handled: false };
      headerDrag.current = start;
      const onUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== start.pointerId) return;
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onCancel, true);
        // Wait for motion's postRender onDragEnd before applying the fallback snap transition.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (headerDrag.current !== start || start.handled) return;
          headerDrag.current = null;
          const dx = upEvent.clientX - start.x;
          const dy = upEvent.clientY - start.y;
          if (Math.abs(dy) < 72 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
          if (dy < 0 && snap < snapPoints.length - 1 && listOverflows()) {
            setSnap((current) => Math.min(snapPoints.length - 1, current + 1));
          } else if (dy > 0) {
            if (snap > 0) setSnap((current) => Math.max(0, current - 1));
            else onOpenChange(false);
          }
        }));
      };
      const onCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== start.pointerId) return;
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onCancel, true);
        if (headerDrag.current === start) headerDrag.current = null;
      };
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onCancel, true);
    }
    dragControls.start(event);
  }

  function startBodyPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [data-vaul-no-drag]')) return;
    const atTop = event.currentTarget.scrollTop <= 1;
    bodyPull.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, atTop };
  }

  function moveBodyPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const start = bodyPull.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) < 8) return;
    bodyPull.current = null;
    // Scroll-to-drag handoff: pulling down while at the top of the list drags the sheet 1:1.
    if (start.atTop && dy > 0 && dy > Math.abs(dx) * 1.25) {
      listTouch.current = null;
      dragControls.start(event);
    }
  }

  function listOverflows() {
    const body = bodyRef.current;
    return Boolean(body && body.scrollHeight > body.clientHeight + 1);
  }

  function startListTouch(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    listTouch.current = event.touches.length === 1 && touch
      ? { x: touch.clientX, y: touch.clientY, atTop: event.currentTarget.scrollTop <= 1 }
      : null;
  }

  function endListTouch(event: TouchEvent<HTMLDivElement>) {
    const start = listTouch.current;
    listTouch.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const travel = touch.clientY - start.y;
    if (Math.abs(travel) < 38 || Math.abs(travel) < Math.abs(touch.clientX - start.x)) return;
    if (travel < 0 && snap === 0 && listOverflows()) setSnap(1);
    if (travel > 0 && start.atTop) {
      if (snap > 0) setSnap(0);
      else onOpenChange(false);
    }
  }

  const snapValue = snapPoints[snap];
  const heightStyle =
    snapValue === "auto"
      ? { maxHeight: "92vh" }
      : { height: `${snapValue * 100}vh` };

  // Portal to <body>: an ancestor with backdrop-filter or transform becomes
  // the containing block for fixed descendants, which would position the
  // sheet against that ancestor instead of the viewport.
  if (!mounted) return null;

  // Two fixed siblings, no wrapper: the scrim spans the viewport edges but
  // carries a colour, and the sheet is pinned to the bottom, stops short of the
  // top edge at every snap point the component ships, and paints an opaque
  // surface either way. Both hang off `PresenceGate`, so interaction releases in
  // the same commit that starts the exit rather than when it ends.
  return createPortal(
    <AnimatePresence>
      {open ? (
        <PresenceGate key="backdrop">
          {({ gate }) => (
            <motion.button
              type="button"
              aria-label={t("close")}
              // Outside the sheet, so the focus trap never lands on it; it is
              // a pointer target, and Escape closes from the keyboard.
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={DRAWER}
              {...gate}
              onClick={() => onOpenChange(false)}
              className="pointer-events-auto fixed inset-0 z-50 bg-transparent p-0"
            >
              {/* Inner layer drives drag-linked scrim fade without clobbering enter/exit opacity or button identity. */}
              <motion.span
                aria-hidden="true"
                style={{ opacity: scrimOpacity }}
                className="pointer-events-none block h-full w-full rr-options-shade"
              />
            </motion.button>
          )}
        </PresenceGate>
      ) : null}
      {open ? (
        <PresenceGate key="sheet">
          {({ gate }) => (
            <motion.div
              ref={sheetRef}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.18, bottom: 1 }}
              dragMomentum={false}
              dragSnapToOrigin
              onDrag={onDrag}
              onDragEnd={onDragEnd}
              initial={reduce ? { y: 0, opacity: 0 } : { y: "100%" }}
              animate={reduce ? { y: 0, opacity: 1 } : { y: 0 }}
              exit={reduce ? { y: 0, opacity: 0 } : { y: "100%" }}
              transition={reduce ? { duration: 0.18, ease: EASE_DRAWER } : DRAWER}
              {...gate}
              style={{ ...heightStyle, ...gate.style }}
              className={cn(
                "pointer-events-auto fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-t-3xl outline-none will-change-transform",
                "border border-border bg-background shadow-xl",
                className,
              )}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descriptionId : undefined}
              aria-label={title ? undefined : t("label")}
              data-expanded={optionList ? snap > 0 : undefined}
            >
              <div
                onPointerDown={startHeaderDrag}
                className={optionList ? "rr-options-drag-zone" : "flex flex-col items-center px-4 pb-2 pt-3"}
              >
                {/* Option lists keep a full-width gesture area without painting a drag marker. */}
                <div
                  // A slow pull must not hand the gesture to iOS's callout,
                  // which would leave the sheet frozen mid-drag.
                  className={cn(
                    optionList ? "rr-options-drag-target touch-none" : "flex cursor-grab touch-none items-center justify-center py-1 active:cursor-grabbing",
                    TOUCH_GESTURE_CONTENT_CLASS,
                  )}
                >
                  {/* Keep every sheet's grab marker quiet and consistent with the paper theme. */}
                  <div data-slot="sheet-handle" style={{ height: 4, width: 40, borderRadius: 999, background: "#d5cfc5" }} />
                </div>
                {title || description ? (
                  <div className="mt-2 w-full">
                    {title ? (
                      <h2
                        id={titleId}
                        className="text-base font-semibold text-foreground"
                      >
                        {title}
                      </h2>
                    ) : null}
                    {description ? (
                      <p
                        id={descriptionId}
                        className="mt-0.5 text-sm text-muted-foreground"
                      >
                        {description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {/* overscroll-contain stops boundary scrolls from chaining to the page. */}
              <div ref={bodyRef} data-slot="bottom-sheet-body" className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
                onPointerDown={startBodyPointer}
                onPointerMove={moveBodyPointer}
                onPointerUp={() => { bodyPull.current = null; }}
                onPointerCancel={() => { bodyPull.current = null; }}
                onTouchStart={optionList ? startListTouch : undefined}
                onTouchEnd={optionList ? endListTouch : undefined}
                onTouchCancel={optionList ? () => { listTouch.current = null; } : undefined}
              >{children}</div>
            </motion.div>
          )}
        </PresenceGate>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
