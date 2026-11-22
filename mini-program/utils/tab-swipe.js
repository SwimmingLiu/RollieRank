// 首页与练习记录之间的一级菜单左右滑动判定，与底部 tabbar 顺序保持一致。
const TABS = [
  { key: "home", url: "/pages/home/home" },
  { key: "records", url: "/pages/records/records" },
];

const LOCK_DISTANCE = 8;
const HORIZONTAL_RATIO = 1.2;
const MAX_PREVIEW_OFFSET = 28;
const PREVIEW_DAMPING = 0.16;

function targetTabForDelta(currentKey, dx) {
  const index = TABS.findIndex(item => item.key === currentKey);
  if (index === -1 || !Number.isFinite(dx) || dx === 0) return null;
  return TABS[index + (dx < 0 ? 1 : -1)] || null;
}

function createSwipeSession({ currentKey, x, y, now = Date.now(), width = 375 }) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!TABS.some(item => item.key === currentKey)) return null;
  return { currentKey, x, y, startedAt: now, width: width || 375, axis: null, moved: false };
}

function updateSwipeSession(session, { x, y }) {
  if (!session || !Number.isFinite(x) || !Number.isFinite(y)) {
    return { axis: null, offset: 0, target: null, moved: false };
  }
  const dx = x - session.x;
  const dy = y - session.y;
  if (!session.axis) {
    if (Math.hypot(dx, dy) < LOCK_DISTANCE) {
      return { axis: null, offset: 0, target: null, moved: false };
    }
    session.axis = Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO ? "x" : "y";
  }
  if (session.axis !== "x") {
    return { axis: "y", offset: 0, target: null, moved: false };
  }
  const target = targetTabForDelta(session.currentKey, dx);
  if (!target) {
    return { axis: "x", offset: 0, target: null, moved: session.moved };
  }
  session.moved = true;
  const offset = Math.round(Math.max(-MAX_PREVIEW_OFFSET, Math.min(MAX_PREVIEW_OFFSET, dx * PREVIEW_DAMPING)));
  return { axis: "x", offset, target, moved: true };
}

function finishSwipeSession(session, { x, y, now = Date.now() }) {
  if (!session || !Number.isFinite(x) || !Number.isFinite(y)) {
    return { switchTo: null, moved: false };
  }
  const dx = x - session.x;
  const dy = y - session.y;
  const distance = Math.abs(dx);
  const horizontal = distance > Math.abs(dy) * HORIZONTAL_RATIO;
  const target = targetTabForDelta(session.currentKey, dx);
  const elapsed = Math.max(1, now - session.startedAt);
  const velocity = distance / elapsed;
  const threshold = Math.max(48, session.width * 0.16);
  const deliberate = distance >= threshold || (distance >= 24 && velocity >= 0.45);
  const canSwitch = (session.axis === "x" || (!session.axis && horizontal && distance >= 24))
    && horizontal && Boolean(target) && deliberate;
  return {
    switchTo: canSwitch ? target : null,
    moved: Boolean(session.moved || canSwitch),
  };
}

module.exports = {
  TABS,
  targetTabForDelta,
  createSwipeSession,
  updateSwipeSession,
  finishSwipeSession,
};
