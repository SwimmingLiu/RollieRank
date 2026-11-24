// 答题卡定位、版式判读与真伪答题卡校验门禁（omr-v3）。
//
// 支持公务员行测 140 题答题卡的两种版式：
//   column  每题一列、[A][B][C][D] 竖排（7 块 × 20 题，蓝/白交替）
//   row     每题一行、[A][B][C][D] 横排（7 块 × 5 行 × 4 列）
//
// 核心改进：
// 1. 光照不变的相对暗度图 + 全局 2D 网格拟合 + 直接 4 选项格对比采样（兼容阴影、低对比、连涂与空格不移位）。
// 2. 全流程尺度无关（不再写死固定像素阈值，满屏近拍、桌面远拍、不同分辨率都稳定）。
// 3. 严格的答题卡真实性门禁（网格吸附度、单选对比度、多涂率、列/组间距比例、同步轨/蓝带结构），
//    彻底杜绝书页/桌面/键盘/截图等非答题卡图片被硬凑出几十上百个假答案。

import {
  blueBands,
  boxFilter,
  buildFeatures,
  cluster1d,
  cluster1dInto,
  detectTimingTrack,
  downscaleTo,
  inkMask,
  integral,
  labelComponents,
  median,
  percentile,
  printMask,
  rotatePlanes,
  selectBlueBandStack,
} from "./omr-features.mjs";
import { recognizeColumnV3 } from "./omr-column.mjs";
import { recognizeRowV3 } from "./omr-row.mjs";

const GROUP_SIZE = 5;
const OPTIONS = ["A", "B", "C", "D"];
const OPTION_ROWS = OPTIONS.length;
const BLOCK_COUNT = 7;
const COLUMNS_PER_BLOCK = 20;
const QUESTION_COUNT = BLOCK_COUNT * COLUMNS_PER_BLOCK;

const ANSWER_BAR = QUESTION_COUNT * 0.72;
const SCALE_CANDIDATES = [2048, 1710];
const OVERSIZE_LONG_EDGE = 2260;

// 兼容导出：供外部调试或单测使用。
function pencilMarks(components, options = {}) {
  if (!components.length) return [];
  const minArea = options.minArea ?? 120;
  const minFill = options.minFill ?? 0.55;
  const solid = components.filter((c) => c.fill > minFill && c.w >= c.h * 0.8 && c.w <= c.h * 4);
  const pool = solid.length >= 12 ? solid : components;
  const medw = median(pool.map((c) => c.w));
  const medArea = median(pool.map((c) => c.area));
  const areaLo = solid.length >= 12 ? medArea * 0.3 : Math.max(minArea, medw * medw * 0.25);
  const areaHi = solid.length >= 12 ? medArea * 3.8 : Infinity;
  return components.filter(
    (c) =>
      c.fill > minFill &&
      c.area >= areaLo && c.area <= areaHi &&
      c.w >= medw * 0.45 && c.w <= medw * 2.6 &&
      c.h >= 4 && c.h <= medw * 1.8 &&
      c.w >= c.h * 0.5 && c.w <= c.h * 4.0,
  );
}

// 预检：只拒绝明显无墨迹/尺寸过小的空图，真正严格的答题卡结构校验由 recognizeSheet 门禁执行
// （因为照片可能横拍 90°/270°，需要旋转后才能确认完整结构）。
export function detectSheet(planes) {
  const { width: W, height: H } = planes;
  if (W < 200 || H < 200) return { found: false, reason: "too-small" };
  const features = buildFeatures(planes);
  if (features.inkPixels < Math.max(400, W * H * 0.0005)) {
    return { found: false, reason: "no-ink" };
  }
  const bands = blueBands(planes);
  const stack = selectBlueBandStack(bands, H);
  if (stack) {
    return {
      found: true,
      source: "blue-band",
      box: {
        left: Math.min(...stack.map((b) => b.x0)),
        top: stack[0].y0,
        right: Math.max(...stack.map((b) => b.x1)),
        bottom: stack[stack.length - 1].y1,
      },
      bands: stack,
      ink: features.ink,
      inkPixels: features.inkPixels,
    };
  }
  return {
    found: true,
    source: "candidate",
    box: { left: 0, top: 0, right: W - 1, bottom: H - 1 },
    bands: [],
    ink: features.ink,
    inkPixels: features.inkPixels,
  };
}

// 真/假答题卡核心验证门禁：同时检验网格几何、单选对比度、多涂率与物理地标，
// 只要任一硬性物理不变量不满足，立刻判无效，绝不输出硬凑的假答案。
export function validateCandidate(candidate) {
  if (!candidate || !candidate.metrics) {
    return { valid: false, reasons: ["no-candidate"], score: -1 };
  }
  const m = candidate.metrics;
  const reasons = [];

  if (m.recognized < 15) reasons.push(`too-few-recognized:${m.recognized}`);
  if (m.blocksRead < 4) reasons.push(`too-few-blocks:${m.blocksRead}`);
  if (m.paperP75 < 92) reasons.push(`dark-background:${Math.round(m.paperP75)}`);
  if (m.multiDarkRate > 0.22) reasons.push(`high-multi-dark:${m.multiDarkRate.toFixed(2)}`);
  if (m.medianContrastRatio < 2.2) reasons.push(`low-contrast-ratio:${m.medianContrastRatio.toFixed(2)}`);
  if (m.avgConfidence < 0.28) reasons.push(`low-confidence:${m.avgConfidence.toFixed(2)}`);
  if (m.widthIqr > 0.72) reasons.push(`irregular-mark-width:${m.widthIqr.toFixed(2)}`);
  if (m.heightIqr > 0.72) reasons.push(`irregular-mark-height:${m.heightIqr.toFixed(2)}`);

  if (m.style === "column") {
    if (m.groupToColRatio < 5.2 || m.groupToColRatio > 9.2) {
      reasons.push(`bad-group-ratio:${m.groupToColRatio.toFixed(2)}`);
    }
    if (m.blockSpanRatio > 1.85) reasons.push(`bad-block-span:${m.blockSpanRatio.toFixed(2)}`);
    if (m.pitchRelMad > 0.22) reasons.push(`irregular-pitch:${m.pitchRelMad.toFixed(2)}`);
    if (m.onGridRate < 0.56) reasons.push(`low-on-grid:${m.onGridRate.toFixed(2)}`);
    if (m.meanSnapErrX > 0.24) reasons.push(`high-snap-x:${m.meanSnapErrX.toFixed(2)}`);
    if (m.meanSnapErrY > 0.26) reasons.push(`high-snap-y:${m.meanSnapErrY.toFixed(2)}`);
    const hasLandmark =
      m.hasTimingTrack ||
      (m.hasBlueBands && m.onGridRate >= 0.66 && m.recognized >= 25 && m.distinctOptions >= 2);
    if (!hasLandmark) reasons.push("missing-column-landmark");
  } else if (m.style === "row") {
    if (m.colStepToPitchRatio < 4.4 || m.colStepToPitchRatio > 8.2) {
      reasons.push(`bad-col-step-ratio:${m.colStepToPitchRatio.toFixed(2)}`);
    }
    if (m.colStepUniformity > 1.42) reasons.push(`irregular-col-step:${m.colStepUniformity.toFixed(2)}`);
    if (m.rowGapRelMad > 0.24) reasons.push(`irregular-row-gap:${m.rowGapRelMad.toFixed(2)}`);
    if (m.pitchRelMad > 0.16) reasons.push(`irregular-pitch:${m.pitchRelMad.toFixed(2)}`);
    if (m.colAlignRms > 0.55) reasons.push(`bad-col-align:${m.colAlignRms.toFixed(2)}`);
    if (m.onGridRate < 0.62) reasons.push(`low-on-grid:${m.onGridRate.toFixed(2)}`);
    if (m.meanSnapErrX > 0.20) reasons.push(`high-snap-x:${m.meanSnapErrX.toFixed(2)}`);
    const hasLandmark =
      m.hasTimingTrack ||
      (m.onGridRate >= 0.78 && m.multiDarkRate <= 0.12 && m.recognized >= 35 && m.blocksRead >= 5 && m.distinctOptions >= 2);
    if (!hasLandmark) reasons.push("missing-row-landmark");
  } else {
    reasons.push("unknown-style");
  }

  if (reasons.length) return { valid: false, reasons, score: -1 };

  const score =
    m.recognized * (0.55 + 0.45 * m.avgConfidence) * (1 - m.multiDarkRate) * (0.6 + 0.4 * m.onGridRate) +
    (m.hasTimingTrack ? 18 : 0) +
    (m.hasBlueBands ? 8 : 0);
  return { valid: true, reasons: [], score };
}

function ensureComponents(planes, features) {
  if (features.components) return features.components;
  const { width: W, height: H } = planes;
  const minArea = Math.max(24, Math.round(W * H * 0.000018));
  features.components = labelComponents(features.ink, { width: W, height: H }, minArea);
  return features.components;
}

// 仅在无同步轨时回退使用的 180° 倒置判断：只在已定位的答题卡区域两侧边缘比较印刷密度，
// 避免被画面外桌面或二维码干扰。
function isUpsideDownInBox(planes, box) {
  const { width: W, height: H } = planes;
  const print = printMask(planes);
  const x0 = Math.max(0, box ? Math.round(box.left - (box.right - box.left) * 0.12) : 0);
  const x1 = Math.min(W, box ? Math.round(box.right + (box.right - box.left) * 0.12) : W);
  const y0 = Math.max(0, box ? Math.round(box.top) : 0);
  const y1 = Math.min(H, box ? Math.round(box.bottom) : H);
  const spanW = x1 - x0;
  const spanH = y1 - y0;
  if (spanW < 60 || spanH < 60) return false;
  const strip = Math.max(8, Math.round(spanW * 0.12));
  let left = 0;
  let right = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * W;
    for (let x = x0; x < x0 + strip; x++) left += print[row + x];
    for (let x = x1 - strip; x < x1; x++) right += print[row + x];
  }
  if (left + right < spanH * strip * 0.02) return false;
  return left > right * 1.5;
}

function evaluateOrientation(planes, options = {}) {
  const { width: W, height: H } = planes;
  const features = buildFeatures(planes);
  const components = ensureComponents(planes, features);
  const timingTrack = detectTimingTrack(components, W, H);
  const blueStack = selectBlueBandStack(blueBands(planes), H);
  const hasSheetLandmark = Boolean(timingTrack || blueStack);

  const candidates = [];
  if (options.style !== "row" && blueStack) {
    const col = recognizeColumnV3(planes, features, blueStack, timingTrack, options);
    if (col) {
      const check = validateCandidate(col);
      candidates.push({ result: col, check });
    }
  }

  // 列式已经高质量通过时（蓝底答题卡），不必再多跑一次行式，既快又稳。
  const strongCol = candidates.find((c) => c.check.valid && c.result.metrics.recognized >= QUESTION_COUNT * 0.55);
  if (!strongCol && options.style !== "column") {
    const row = recognizeRowV3(planes, features, timingTrack, options);
    if (row) {
      const check = validateCandidate(row);
      candidates.push({ result: row, check });
    }
  }

  candidates.sort((a, b) => b.check.score - a.check.score);
  const winner = candidates[0] || null;
  return { winner, timingTrack, blueStack, hasSheetLandmark, candidates };
}

function makeRejectedResult(hasSheetLandmark, candidates = []) {
  // 只有在确有答题卡地标且没有因结构/多涂/网格错乱被否决时，才提示「检测到答题卡但未涂黑」；
  // 书页、蓝色条纹等伪目标会因网格或单选对比失败被拒，直接提示「没有找到答题卡的选项框」。
  const structuralFailure = candidates.some((c) =>
    (c.check?.reasons || []).some(
      (r) =>
        r.startsWith("bad-") ||
        r.startsWith("irregular-") ||
        r.startsWith("high-multi-dark") ||
        r.startsWith("low-on-grid") ||
        r.startsWith("high-snap-") ||
        r.startsWith("low-contrast-ratio"),
    ),
  );
  const isBlankSheet = hasSheetLandmark && !structuralFailure;
  const reason = isBlankSheet
    ? "检测到答题卡，但没有识别到有效填涂。请确认已用 2B 铅笔涂黑选项、光线均匀后重试。"
    : "没有找到答题卡的选项框。请正对整张答题卡拍摄，保证四角完整入镜、光线均匀。";
  return {
    sheetValid: false,
    rejectionReason: reason,
    questions: [],
    layout: { engine: "omr-v3", found: false, style: null },
    warnings: [reason],
    ...(candidates.length
      ? { rejectionDetails: candidates.map((c) => ({ style: c.result?.metrics?.style, reasons: c.check?.reasons })) }
      : {}),
  };
}

function recognizeAtScale(planes, options = {}) {
  let current = planes;
  let rotation = 0;
  let anyLandmark = false;
  const allRejected = [];

  const runWithFlipCheck = (plane, baseRot) => {
    const eval0 = evaluateOrientation(plane, options);
    if (eval0.hasSheetLandmark) anyLandmark = true;
    // 1) 同步轨落在左侧 → 明确倒置 180°，直接翻转重判。
    if (eval0.timingTrack && eval0.timingTrack.side === "left" && !options.noRotate) {
      const flipped = rotatePlanes(plane, 2);
      const evalFlip = evaluateOrientation(flipped, options);
      if (evalFlip.hasSheetLandmark) anyLandmark = true;
      if (evalFlip.winner && evalFlip.winner.check.valid) {
        return { evalRes: evalFlip, rotation: (baseRot + 180) % 360 };
      }
      if (evalFlip.candidates.length) allRejected.push(...evalFlip.candidates);
    }
    if (eval0.winner && eval0.winner.check.valid) {
      // 无同步轨时，再做一次盒内左右印刷密度校验防 180° 倒置。
      if (!eval0.timingTrack && !options.noRotate && isUpsideDownInBox(plane, eval0.winner.result.layout?.box)) {
        const flipped = rotatePlanes(plane, 2);
        const evalFlip = evaluateOrientation(flipped, options);
        if (evalFlip.winner && evalFlip.winner.check.valid) {
          return { evalRes: evalFlip, rotation: (baseRot + 180) % 360 };
        }
      }
      return { evalRes: eval0, rotation: baseRot };
    }
    if (eval0.candidates.length) allRejected.push(...eval0.candidates);
    return null;
  };

  let hit = runWithFlipCheck(current, 0);
  if (!hit && !options.noRotate) {
    // 0°/180° 未通过门禁 → 尝试横拍 90°（内部同步轨自动区分 90° 与 270°）。
    const rotated = rotatePlanes(current, 1);
    hit = runWithFlipCheck(rotated, 90);
  }

  if (!hit) {
    return makeRejectedResult(anyLandmark, allRejected);
  }

  rotation = hit.rotation;
  const winner = hit.evalRes.winner;
  const result = {
    sheetValid: true,
    questions: winner.result.questions,
    layout: {
      ...winner.result.layout,
      ...(rotation ? { rotation } : {}),
    },
    warnings: winner.result.warnings,
    qualityScore: winner.check.score,
    ...(options.debug ? { debug: winner.result.debug } : {}),
  };
  return result;
}

export function recognizeSheet(planes, sheet, options = {}) {
  const pageLongEdge = Math.max(planes.width, planes.height);
  // 超高分辨率手机原图直接缩到标定尺度识别（速度快且精度稳）。
  if (!options.noScale && pageLongEdge > OVERSIZE_LONG_EDGE) {
    let best = null;
    let lastRejected = null;
    for (const target of SCALE_CANDIDATES) {
      const scaled = downscaleTo(planes, target);
      if (!scaled) continue;
      const res = recognizeAtScale(scaled, options);
      if (res.sheetValid) {
        if (!best || (res.qualityScore ?? 0) > (best.qualityScore ?? 0)) best = res;
      } else {
        lastRejected = res;
      }
    }
    if (best) {
      best.layout = { ...best.layout, scaledFrom: pageLongEdge };
      delete best.qualityScore;
      return best;
    }
    return lastRejected || makeRejectedResult(false);
  }

  const primary = recognizeAtScale(planes, options);
  if (options.noScale) {
    delete primary.qualityScore;
    return primary;
  }

  const primaryCount = primary.sheetValid ? primary.questions.filter((q) => q.answer).length : 0;
  if (primary.sheetValid && primaryCount >= ANSWER_BAR) {
    delete primary.qualityScore;
    return primary;
  }

  // 仅当原尺寸有效识别不足或未通过时，尝试标准降采样尺度（绝不采用未通过门禁的候选）。
  let best = primary.sheetValid ? primary : null;
  let anyLandmark = primary.rejectionReason?.includes("检测到答题卡") ?? false;
  for (const target of SCALE_CANDIDATES) {
    const scaled = downscaleTo(planes, target);
    if (!scaled) continue;
    const res = recognizeAtScale(scaled, options);
    if (res.sheetValid) {
      if (!best || (res.qualityScore ?? 0) > (best.qualityScore ?? 0)) {
        best = { ...res, layout: { ...res.layout, scaledFrom: pageLongEdge } };
      }
    } else if (res.rejectionReason?.includes("检测到答题卡")) {
      anyLandmark = true;
    }
  }

  if (best) {
    delete best.qualityScore;
    return best;
  }
  return primary.sheetValid === false && anyLandmark ? makeRejectedResult(true) : primary;
}

// 保留旧导出符号以便脚本/调试复用
export function readRowSheet(planes, options = {}) {
  const features = buildFeatures(planes);
  const components = ensureComponents(planes, features);
  const timingTrack = detectTimingTrack(components, planes.width, planes.height);
  const row = recognizeRowV3(planes, features, timingTrack, options);
  if (!row) {
    return {
      questions: new Array(QUESTION_COUNT).fill(null).map((_, i) => ({ number: i + 1, answer: null, confidence: 0 })),
      layout: { engine: "omr-v3", style: "row", rows: 0, blocks: 0, shear: 0, optionGap: 0 },
      warnings: ["没有找到足够的填涂痕迹。"],
    };
  }
  return row;
}

export {
  GROUP_SIZE,
  OPTIONS,
  OPTION_ROWS,
  BLOCK_COUNT,
  COLUMNS_PER_BLOCK,
  QUESTION_COUNT,
  boxFilter,
  integral,
  percentile,
  cluster1d,
  cluster1dInto,
  labelComponents,
  pencilMarks,
  inkMask,
  printMask,
  blueBands,
};
