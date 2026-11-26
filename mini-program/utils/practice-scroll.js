// 录答案列表自动翻页规划：正常作答保持页面稳定不抖，仅在下一题贴底时柔和上滑半屏并保留上下文锚点。
const AUTO_TURN_DELAY_MS = 240;
const AUTO_TURN_MIN_DURATION_MS = 850;
const AUTO_TURN_MAX_DURATION_MS = 1250;
const AUTO_TURN_SETTLE_MS = 140;
const MANUAL_JUMP_DURATION_MS = 380;
const BOTTOM_TRIGGER_MARGIN = 18;
const TOP_TRIGGER_MARGIN = 8;
const MANUAL_TOP_OFFSET = 10;
const ANCHOR_VIEWPORT_RATIO = 0.36;
const ANCHOR_MAX_OFFSET = 210;

function easeInOutCubic(t) {
  const x = Math.max(0, Math.min(1, Number(t) || 0));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function planListScroll({ list, offset, row, keepVisible = false, animated = true }) {
  if (!list || !row || !offset) {
    return { shouldScroll: false, targetTop: 0, duration: 0, isAutoTurn: false, guardMs: 0 };
  }
  const listHeight = Math.max(1, Number(list.height) || (list.bottom - list.top) || 1);
  const above = row.top < list.top + TOP_TRIGGER_MARGIN;
  const below = row.bottom > list.bottom - BOTTOM_TRIGGER_MARGIN;
  if (keepVisible && !above && !below) {
    return { shouldScroll: false, targetTop: offset.scrollTop, duration: 0, isAutoTurn: false, guardMs: 0 };
  }
  // 顺着录答触底翻页时，将下一题停在视口偏中上（约 36%），保留上方 2~3 行已答题作锚点，既不逐行抖动也不整屏猛跳。
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
    ? Math.round(Math.max(AUTO_TURN_MIN_DURATION_MS, Math.min(AUTO_TURN_MAX_DURATION_MS, 640 + distance * 1.4)))
    : MANUAL_JUMP_DURATION_MS;
  return {
    shouldScroll: true,
    targetTop,
    duration,
    isAutoTurn,
    guardMs: isAutoTurn ? duration + AUTO_TURN_SETTLE_MS : 0,
  };
}

module.exports = {
  AUTO_TURN_DELAY_MS,
  AUTO_TURN_MIN_DURATION_MS,
  AUTO_TURN_MAX_DURATION_MS,
  AUTO_TURN_SETTLE_MS,
  MANUAL_JUMP_DURATION_MS,
  easeInOutCubic,
  planListScroll,
};
