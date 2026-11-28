// 录答案列表自动跟手滚动规划：
// 1. 屏内舒适区作答保持画面稳定不抖动；
// 2. 下一题进入底部约 1.7 行触发区时，用 260~380ms 干脆缓出轻推到视口中部舒适区；
// 3. 绝不长时间锁死点击，用户快录或触碰列表随时打断滚动并立即响应。
const AUTO_TURN_DELAY_MS = 70;
const AUTO_TURN_MIN_DURATION_MS = 260;
const AUTO_TURN_MAX_DURATION_MS = 380;
const AUTO_TURN_SETTLE_MS = 0;
const MANUAL_JUMP_DURATION_MS = 300;
const BOTTOM_TRIGGER_MARGIN = 112;
const TOP_TRIGGER_MARGIN = 12;
const MANUAL_TOP_OFFSET = 10;
const ANCHOR_VIEWPORT_RATIO = 0.48;
const ANCHOR_MAX_OFFSET = 270;

function easeInOutCubic(t) {
  const x = Math.max(0, Math.min(1, Number(t) || 0));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutCubic(t) {
  const x = Math.max(0, Math.min(1, Number(t) || 0));
  return 1 - Math.pow(1 - x, 3);
}

function planListScroll({ list, offset, row, keepVisible = false, animated = true }) {
  if (!list || !row || !offset) {
    return { shouldScroll: false, targetTop: 0, duration: 0, isAutoTurn: false, guardMs: 0 };
  }
  const listHeight = Math.max(1, Number(list.height) || (list.bottom - list.top) || 1);
  const triggerMargin = Math.min(BOTTOM_TRIGGER_MARGIN, Math.round(listHeight * 0.24));
  const above = row.top < list.top + TOP_TRIGGER_MARGIN;
  const below = row.bottom > list.bottom - triggerMargin;
  if (keepVisible && !above && !below) {
    return { shouldScroll: false, targetTop: offset.scrollTop, duration: 0, isAutoTurn: false, guardMs: 0 };
  }
  // 顺着录答接近视口底部时，只轻推 2~3 行让下一题稳稳停在中部拇指区，不大幅度甩屏。
  const isAutoTurn = Boolean(keepVisible && below);
  const anchorOffset = isAutoTurn
    ? Math.min(Math.round(listHeight * ANCHOR_VIEWPORT_RATIO), ANCHOR_MAX_OFFSET)
    : MANUAL_TOP_OFFSET;
  const targetTop = Math.max(0, Math.round(offset.scrollTop + (row.top - list.top) - anchorOffset));
  const distance = Math.abs(targetTop - offset.scrollTop);
  if (distance < 6) {
    return { shouldScroll: false, targetTop: offset.scrollTop, duration: 0, isAutoTurn: false, guardMs: 0 };
  }
  if (!animated) {
    return { shouldScroll: true, targetTop, duration: 0, isAutoTurn: false, guardMs: 0 };
  }
  const duration = isAutoTurn
    ? Math.round(Math.max(AUTO_TURN_MIN_DURATION_MS, Math.min(AUTO_TURN_MAX_DURATION_MS, 240 + distance * 0.45)))
    : MANUAL_JUMP_DURATION_MS;
  return {
    shouldScroll: true,
    targetTop,
    duration,
    isAutoTurn,
    guardMs: 0,
  };
}

module.exports = {
  AUTO_TURN_DELAY_MS,
  AUTO_TURN_MIN_DURATION_MS,
  AUTO_TURN_MAX_DURATION_MS,
  AUTO_TURN_SETTLE_MS,
  MANUAL_JUMP_DURATION_MS,
  BOTTOM_TRIGGER_MARGIN,
  easeInOutCubic,
  easeOutCubic,
  planListScroll,
};
