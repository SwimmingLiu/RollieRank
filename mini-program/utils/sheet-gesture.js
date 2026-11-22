// iPhone 风格底部抽屉手势物理引擎：
// 1. Track 阶段：1:1 实时跟手（无过渡），顶部越界橡皮筋阻尼，遮罩透明度实时联动；
// 2. Release 阶段：距离 OR 速度双判定，支持展开/回落/沿同轴滑出关闭，且收起中途可打断。
const LOCK_DISTANCE = 6;
const VERTICAL_RATIO = 1.15;
const CLOSE_DURATION = 260;

function rubberBand(distance, cap = 48, factor = 0.2) {
  if (!Number.isFinite(distance) || distance === 0) return 0;
  const sign = distance < 0 ? -1 : 1;
  const abs = Math.abs(distance);
  return sign * ((abs * factor * cap) / (abs * factor + cap));
}

function linkedShadeOpacity(offsetY, panelHeight = 360) {
  if (!Number.isFinite(offsetY) || offsetY <= 0) return 1;
  const denominator = Math.max(220, panelHeight || 360);
  return Number(Math.max(0.08, Math.min(1, 1 - offsetY / denominator)).toFixed(3));
}

function createSheetSession({
  x,
  y,
  now = Date.now(),
  panelHeight = 360,
  expandDelta = 0,
  expanded = false,
  canExpand = false,
  canDismiss = true,
  atTop = true,
  fromHandle = false,
}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x,
    y,
    startedAt: now,
    prevY: y,
    prevAt: now,
    recentVelocityY: 0,
    panelHeight: panelHeight || 360,
    expandDelta: Math.max(0, Math.round(expandDelta || 0)),
    expanded: Boolean(expanded),
    canExpand: Boolean(canExpand),
    canDismiss: Boolean(canDismiss),
    atTop: Boolean(atTop),
    fromHandle: Boolean(fromHandle),
    axis: null,
    moved: false,
    offsetY: 0,
    heightDelta: 0,
    shadeOpacity: 1,
  };
}

function updateSheetSession(session, { x, y, now = Date.now() }) {
  if (!session || !Number.isFinite(x) || !Number.isFinite(y)) {
    return { active: false, axis: null, offsetY: 0, heightDelta: 0, shadeOpacity: 1, moved: false };
  }
  const dx = x - session.x;
  const dy = y - session.y;
  const dt = now - session.prevAt;
  if (dt >= 8) {
    session.recentVelocityY = (y - session.prevY) / dt;
    session.prevY = y;
    session.prevAt = now;
  }
  if (!session.axis) {
    if (Math.hypot(dx, dy) < LOCK_DISTANCE) {
      return { active: false, axis: null, offsetY: 0, heightDelta: 0, shadeOpacity: 1, moved: false };
    }
    session.axis = Math.abs(dy) >= Math.abs(dx) * VERTICAL_RATIO ? "y" : "x";
  }
  if (session.axis !== "y") {
    return { active: false, axis: "x", offsetY: 0, heightDelta: 0, shadeOpacity: 1, moved: false };
  }
  // 列表内非顶部时把滚动还给 scroll-view；但未展开且可展开时上拉优先展开抽屉。
  const upwardExpand = dy < 0 && session.canExpand && !session.expanded;
  if (!session.fromHandle && !session.atTop && !upwardExpand) {
    return { active: false, axis: "y", offsetY: 0, heightDelta: 0, shadeOpacity: 1, moved: false };
  }
  let offsetY = 0;
  let heightDelta = 0;
  let shadeOpacity = 1;
  if (dy > 0) {
    if (session.expanded && session.expandDelta > 0) {
      // 全屏态下拉：先 1:1 实时收缩到半屏高度，继续下拉再无缝衔接为整张抽屉下滑关闭。
      heightDelta = -Math.min(session.expandDelta, Math.round(dy));
      const overflow = dy - session.expandDelta;
      if (overflow > 0) {
        offsetY = session.canDismiss
          ? Math.round(overflow)
          : Math.round(rubberBand(overflow, 48, 0.25));
        shadeOpacity = session.canDismiss
          ? linkedShadeOpacity(offsetY, session.panelHeight)
          : 1;
      }
    } else {
      // 半屏态下拉：1:1 直接跟手（无过渡），遮罩透明度按进度实时联动。
      offsetY = session.canDismiss || session.expanded
        ? Math.round(dy)
        : Math.round(rubberBand(dy, 56, 0.32));
      shadeOpacity = session.canDismiss && !session.expanded
        ? linkedShadeOpacity(offsetY, session.panelHeight)
        : session.canDismiss
          ? linkedShadeOpacity(Math.max(0, offsetY - 40), session.panelHeight * 1.15)
          : 1;
    }
  } else if (dy < 0) {
    // 向上拖动：可展开时 1:1 实时增加高度（底边锚定屏幕不悬空），超出上限后给轻量橡皮筋。
    if (session.canExpand && !session.expanded) {
      if (session.expandDelta > 0) {
        const pull = -dy;
        heightDelta = Math.min(session.expandDelta, Math.round(pull));
        const over = pull - session.expandDelta;
        if (over > 0) offsetY = -Math.round(rubberBand(over, 28, 0.18));
      } else {
        offsetY = Math.round(rubberBand(dy, 40, 0.22));
      }
    } else if (session.fromHandle) {
      offsetY = Math.round(rubberBand(dy, 28, 0.18));
    } else {
      return { active: false, axis: "y", offsetY: 0, heightDelta: 0, shadeOpacity: 1, moved: false };
    }
  }
  session.moved = true;
  session.offsetY = offsetY;
  session.heightDelta = heightDelta;
  session.shadeOpacity = shadeOpacity;
  return { active: true, axis: "y", offsetY, heightDelta, shadeOpacity, moved: true };
}

function finishSheetSession(session, { x, y, now = Date.now() }) {
  if (!session || !Number.isFinite(x) || !Number.isFinite(y)) {
    return { action: "reset", moved: false, dx: 0, dy: 0, velocityY: 0 };
  }
  const dx = x - session.x;
  const dy = y - session.y;
  const elapsed = Math.max(1, now - session.startedAt);
  const averageVelocityY = dy / elapsed;
  const velocityY = (session.recentVelocityY && Math.sign(session.recentVelocityY) === Math.sign(dy))
    ? (Math.abs(session.recentVelocityY) > Math.abs(averageVelocityY) ? session.recentVelocityY : averageVelocityY)
    : averageVelocityY;
  const vertical = Math.abs(dy) >= Math.abs(dx) * VERTICAL_RATIO;
  const moved = Boolean(session.moved || Math.hypot(dx, dy) >= 8);
  const upwardExpand = dy < 0 && session.canExpand && !session.expanded;

  if ((session.axis === "y" || (!session.axis && vertical)) && (session.fromHandle || session.atTop || upwardExpand)) {
    if (upwardExpand) {
      const expandThreshold = session.expandDelta > 0
        ? Math.min(72, Math.max(34, Math.round(session.expandDelta * 0.28)))
        : 34;
      if (dy <= -expandThreshold || (dy <= -18 && velocityY <= -0.38)) {
        return { action: "expand", moved, dx, dy, velocityY };
      }
    } else if (dy > 0) {
      if (session.expanded) {
        const strongFling = session.canDismiss && (
          (session.expandDelta > 0 && dy >= session.expandDelta + 72)
          || dy >= Math.max(180, session.panelHeight * 0.56)
          || (dy >= 48 && velocityY >= 0.95)
        );
        if (strongFling) return { action: "dismiss", moved, dx, dy, velocityY };
        const collapseThreshold = session.expandDelta > 0
          ? Math.min(68, Math.max(34, Math.round(session.expandDelta * 0.28)))
          : 34;
        if (dy >= collapseThreshold || (dy >= 20 && velocityY >= 0.38)) {
          return { action: "collapse", moved, dx, dy, velocityY };
        }
      } else if (session.canDismiss) {
        const dismissDistance = Math.max(80, session.panelHeight * 0.34);
        if (dy >= dismissDistance || (dy >= 32 && velocityY >= 0.45)) {
          return { action: "dismiss", moved, dx, dy, velocityY };
        }
      } else if (session.fromHandle && dy >= 34) {
        return { action: "collapse", moved, dx, dy, velocityY };
      }
    }
  }
  return { action: "reset", moved, dx, dy, velocityY };
}

function createPageSheetDrag(page, { onDismiss }) {
  let session = null;
  let closeTimer = null;

  function clearTimer() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function reset() {
    clearTimer();
    session = null;
    if (page.data.sheetDragY || page.data.sheetDragging || page.data.sheetClosing || page.data.sheetShadeOpacity !== 1) {
      page.setData({ sheetDragY: 0, sheetDragging: false, sheetClosing: false, sheetShadeOpacity: 1 });
    }
  }

  return {
    reset,
    onScroll(event) {
      page._sheetScrollTop = event?.detail?.scrollTop || 0;
    },
    start(event) {
      // 中途可打断：正在滑出关闭时如果用户重新按住面板，立刻接管回拖动状态。
      clearTimer();
      if (page.data.sheetClosing) {
        page.setData({ sheetClosing: false, sheetDragging: true });
      }
      if (event?.target?.dataset?.sheetNoDrag) {
        session = null;
        return;
      }
      const point = event?.touches?.length === 1 && event.touches[0];
      if (!point) {
        session = null;
        return;
      }
      const fromHandle = event.currentTarget?.dataset?.sheetZone === "handle";
      const atTop = fromHandle || !page._sheetScrollTop || page._sheetScrollTop <= 1;
      const winHeight = (wx.getWindowInfo && wx.getWindowInfo().windowHeight) || 720;
      session = createSheetSession({
        x: point.clientX,
        y: point.clientY,
        now: Date.now(),
        panelHeight: Math.round(winHeight * 0.55),
        expanded: false,
        canExpand: false,
        canDismiss: true,
        atTop,
        fromHandle,
      });
    },
    move(event) {
      if (!session) return;
      const point = event?.touches?.[0];
      if (!point) return;
      const state = updateSheetSession(session, { x: point.clientX, y: point.clientY, now: Date.now() });
      if (!state.active) return;
      if (state.offsetY !== page.data.sheetDragY || !page.data.sheetDragging || state.shadeOpacity !== page.data.sheetShadeOpacity) {
        page.setData({
          sheetDragY: state.offsetY,
          sheetDragging: true,
          sheetClosing: false,
          sheetShadeOpacity: state.shadeOpacity,
        });
      }
    },
    end(event) {
      const current = session;
      session = null;
      if (!current) return;
      const point = event?.changedTouches?.[0];
      const result = point
        ? finishSheetSession(current, { x: point.clientX, y: point.clientY, now: Date.now() })
        : { action: "reset", moved: false };
      if (result.action === "dismiss") {
        page.setData({ sheetDragging: false, sheetClosing: true, sheetShadeOpacity: 0 });
        clearTimer();
        closeTimer = setTimeout(() => {
          closeTimer = null;
          page._sheetScrollTop = 0;
          page.setData({ sheetDragY: 0, sheetDragging: false, sheetClosing: false, sheetShadeOpacity: 1 });
          onDismiss();
        }, CLOSE_DURATION);
        return;
      }
      if (page.data.sheetDragY || page.data.sheetDragging || page.data.sheetShadeOpacity !== 1) {
        page.setData({ sheetDragY: 0, sheetDragging: false, sheetClosing: false, sheetShadeOpacity: 1 });
      }
    },
    cancel() {
      session = null;
      if (page.data.sheetDragY || page.data.sheetDragging || page.data.sheetShadeOpacity !== 1) {
        page.setData({ sheetDragY: 0, sheetDragging: false, sheetClosing: false, sheetShadeOpacity: 1 });
      }
    },
  };
}

module.exports = {
  CLOSE_DURATION,
  rubberBand,
  linkedShadeOpacity,
  createSheetSession,
  updateSheetSession,
  finishSheetSession,
  createPageSheetDrag,
};
