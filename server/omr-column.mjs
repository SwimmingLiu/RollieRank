// 列式版式答题卡（每题一列、A/B/C/D 竖排，7 块 × 20 题 = 140 题）的尺度无关全局网格判读。

import { clamp01, erode1, iqrRatio, labelComponents, mean, median, percentile, relMad } from "./omr-features.mjs";

const OPTIONS = ["A", "B", "C", "D"];
const OPTION_ROWS = 4;
const BLOCK_COUNT = 7;
const GROUPS_PER_BLOCK = 4;
const GROUP_SIZE = 5;
const COLUMNS_PER_BLOCK = GROUPS_PER_BLOCK * GROUP_SIZE;
const QUESTION_COUNT = BLOCK_COUNT * COLUMNS_PER_BLOCK;

function sampleDark(darkSums, cx, cy, halfW, halfH) {
  return darkSums(cx - halfW, cy - halfH, cx + halfW, cy + halfH);
}

// 从 4 条蓝底色带构造 7 个梯形答题块（偶块=蓝底、奇块=中间白底），
// 用块自身的 [left, right] 做归一化坐标，自动消除上下透视张角。
function buildBlocksFromBlueBands(blueStack, timingTrack, W, H) {
  // 远拍时，第 1 条蓝带容易和上方蓝底「姓名/准考证号」表头粘连成一条超高色带；
  // 它的下边界仍然准确，用其余蓝带的中位高度从顶部裁回即可。
  const otherHs = [blueStack[1].h, blueStack[2].h, blueStack[3].h];
  const medBandH = median(otherHs);
  const normBands = blueStack.map((b, idx) => {
    if (idx === 0 && b.h > medBandH * 1.32) {
      return { ...b, y0: Math.max(b.y0, Math.round(b.y1 - medBandH)), h: Math.round(medBandH) };
    }
    if (idx === 3 && b.h > medBandH * 1.45) {
      return { ...b, y1: Math.min(b.y1, Math.round(b.y0 + medBandH)), h: Math.round(medBandH) };
    }
    return b;
  });
  const raw = [];
  for (let i = 0; i < 4; i++) {
    const b = normBands[i];
    raw.push({
      index: i * 2,
      blue: true,
      left: b.x0,
      right: b.x1,
      top: b.y0,
      bottom: b.y1,
      slope: b.slope || 0,
    });
    if (i < 3) {
      const next = normBands[i + 1];
      raw.push({
        index: i * 2 + 1,
        blue: false,
        left: (b.x0 + next.x0) / 2,
        right: (b.x1 + next.x1) / 2,
        top: b.y1,
        bottom: next.y0,
        slope: ((b.slope || 0) + (next.slope || 0)) / 2,
      });
    }
  }
  const medSlope = median(raw.map((b) => b.slope));
  // 先求各块中心，再用相邻块中心距作为该块的真实行块跨度 span，避免蓝底上下外扩扭曲块高。
  const centers = raw.map((b) => (b.top + b.bottom) / 2);
  return raw.map((b, i) => {
    const cy = centers[i];
    let span;
    if (i === 0) span = centers[1] - centers[0];
    else if (i === raw.length - 1) span = centers[i] - centers[i - 1];
    else span = (centers[i + 1] - centers[i - 1]) / 2;
    let right = b.right;
    if (timingTrack && timingTrack.side === "right") {
      const trackX = timingTrack.intercept + timingTrack.slope * cy - timingTrack.medW * 0.7;
      if (trackX > b.left + (b.right - b.left) * 0.65) {
        right = Math.min(right, trackX);
      }
    }
    const left = Math.max(0, b.left);
    right = Math.min(W - 1, right);
    return {
      ...b,
      left,
      right,
      width: Math.max(1, right - left),
      midX: (left + right) / 2,
      centerY: cy,
      span: Math.max(20, span),
      slope: Math.abs(b.slope - medSlope) < 0.04 ? b.slope : medSlope,
      top: Math.max(0, cy - span * 0.52),
      bottom: Math.min(H - 1, cy + span * 0.52),
    };
  });
}

// 白底无蓝带的列式答题卡（如 A4 打印国考/省考列式卡）：
// 依托右侧同步轨确定右边界，用腐蚀后的实心铅笔斑块在纵轴拟合 7 块等距周期结构
// （块内 4 行选项集中、块间题号行留空）。
function buildBlocksFromMarks(planes, features, timingTrack) {
  const { width: W, height: H } = planes;
  if (!timingTrack || timingTrack.side !== "right") return null;
  const minArea = Math.max(18, Math.round(W * H * 0.000014));
  const eroded = Math.min(W, H) >= 750 ? erode1(features.ink, { width: W, height: H }) : features.ink;
  const eComps = labelComponents(eroded, { width: W, height: H }, minArea);
  const raw = eComps.filter((c) => {
    const tx = timingTrack.intercept + timingTrack.slope * c.cy;
    if (c.cx >= tx - timingTrack.medW * 0.75) return false;
    if (c.fill < 0.45) return false;
    if (c.w < Math.max(6, W * 0.009) || c.w > W * 0.065) return false;
    if (c.h < Math.max(4, H * 0.003) || c.h > H * 0.032) return false;
    if (c.w < c.h * 0.55 || c.w > c.h * 4.2) return false;
    return true;
  });
  if (raw.length < 36) return null;
  const medArea = median(raw.map((m) => m.area));
  const medW = median(raw.map((m) => m.w));
  const medH = median(raw.map((m) => m.h));
  const marks = raw.filter(
    (m) =>
      m.area >= medArea * 0.25 && m.area <= medArea * 4.0 &&
      m.w >= medW * 0.45 && m.w <= medW * 2.3 &&
      m.h >= medH * 0.45 && m.h <= medH * 2.2,
  );
  if (marks.length < 36) return null;

  // 透视俯拍时右侧同步轨可能向外张开而水平行仍接近水平，不能直接取 -timingTrack.slope；
  // 在小倾角范围内（含 0 与 -timingTrack.slope）择优拟合 7 块周期。
  const midX = median(marks.map((m) => m.cx));
  const slopeCandidates = [0, -0.02, 0.02, -0.04, 0.04];
  if (Math.abs(timingTrack.slope) > 0.01 && Math.abs(timingTrack.slope) < 0.12) {
    slopeCandidates.push(-timingTrack.slope);
  }

  let best = { score: -Infinity, y0: 0, span: 100, slope: 0 };
  for (const slope of slopeCandidates) {
    const ys = marks.map((m) => m.cy - slope * (m.cx - midX));
    const yMin = percentile(ys, 0.02);
    const yMax = percentile(ys, 0.98);
    const ySpan = yMax - yMin;
    if (ySpan < H * 0.28) continue;

    const evalBlocks = (y0, span) => {
      let sc = 0;
      const hitBlocks = new Uint8Array(BLOCK_COUNT);
      for (let i = 0; i < ys.length; i++) {
        const rel = (ys[i] - y0) / span;
        if (rel < -0.45 || rel > BLOCK_COUNT - 0.55) continue;
        const b = Math.max(0, Math.min(BLOCK_COUNT - 1, Math.round(rel)));
        const d = Math.abs(rel - b);
        if (d <= 0.37) {
          sc += 1.0;
          hitBlocks[b] = 1;
        } else {
          sc -= 2.2;
        }
      }
      let blocksHit = 0;
      for (let b = 0; b < BLOCK_COUNT; b++) blocksHit += hitBlocks[b];
      return blocksHit >= 5 ? sc : -Infinity;
    };

    const estSpan = ySpan / 6.6;
    for (let span = estSpan * 0.78; span <= estSpan * 1.25; span += Math.max(1.2, estSpan * 0.015)) {
      const startLo = Math.max(0, yMin - span * 0.35);
      const startHi = Math.min(H - (BLOCK_COUNT - 1) * span, yMin + span * 0.85);
      for (let y0 = startLo; y0 <= startHi; y0 += Math.max(2, span * 0.03)) {
        const sc = evalBlocks(y0, span);
        if (sc > best.score) best = { score: sc, y0, span, slope };
      }
    }
  }
  if (!Number.isFinite(best.score) || best.score < marks.length * 0.50) return null;

  // 以中心块 b=3 为基准搜 (yMid, span, quad)，使透视二次项 quad 与均值行距正交，
  // 即使大俯拍梯形透视（块高从顶到底递增 35%）也能一次对齐 7 块。
  const ysBest = marks.map((m) => m.cy - best.slope * (m.cx - midX));
  const yMid0 = best.y0 + 3 * best.span;
  const span0 = best.span;
  let bestMid = yMid0;
  let bestSpan = span0;
  let bestQuad = 0;
  for (let quad = -6.0; quad <= 6.51; quad += 1.0) {
    for (let span = span0 - 10; span <= span0 + 10; span += 1.5) {
      for (let yMid = yMid0 - 12; yMid <= yMid0 + 12; yMid += 2.0) {
        const centers = Array.from({ length: BLOCK_COUNT }, (_, b) => {
          const d = b - 3;
          return yMid + d * span + d * d * quad;
        });
        const spans = centers.map((cy, b) =>
          b === 0 ? centers[1] - centers[0] : b === BLOCK_COUNT - 1 ? centers[b] - centers[b - 1] : (centers[b + 1] - centers[b - 1]) / 2,
        );
        if (Math.min(...spans) < 25) continue;
        let sc = 0;
        for (let i = 0; i < ysBest.length; i++) {
          const y = ysBest[i];
          let bestD = Infinity;
          for (let b = 0; b < BLOCK_COUNT; b++) {
            const d = Math.abs(y - centers[b]) / spans[b];
            if (d < bestD) bestD = d;
          }
          if (bestD > 0.52) continue;
          if (bestD <= 0.37) sc += 1.0;
          else sc -= 2.2;
        }
        if (sc > best.score) {
          best.score = sc;
          bestMid = yMid;
          bestSpan = span;
          bestQuad = quad;
        }
      }
    }
  }

  const centers = Array.from({ length: BLOCK_COUNT }, (_, b) => {
    const d = b - 3;
    return bestMid + d * bestSpan + d * d * bestQuad;
  });
  const spans = centers.map((cy, b) =>
    Math.max(20, b === 0 ? centers[1] - centers[0] : b === BLOCK_COUNT - 1 ? centers[b] - centers[b - 1] : (centers[b + 1] - centers[b - 1]) / 2),
  );

  // 每块左边界按跨块线性拟合（兼顾梯形透视张角，且不怕某块第 1 题留空把左边界拉偏）。
  const leftPts = [];
  for (let b = 0; b < BLOCK_COUNT; b++) {
    const bMarks = marks.filter((m) => Math.abs((m.cy - best.slope * (m.cx - midX)) - centers[b]) <= spans[b] * 0.45);
    if (bMarks.length >= 8) {
      leftPts.push([b, Math.min(...bMarks.map((m) => m.cx)) - medW * 1.4]);
    }
  }
  const globalLeft = Math.max(0, Math.round(percentile(marks.map((m) => m.cx), 0.01) - medW * 1.4));
  let leftA = globalLeft;
  let leftS = 0;
  if (leftPts.length >= 3) {
    const slopes = [];
    for (let i = 0; i < leftPts.length; i++) {
      for (let j = i + 1; j < leftPts.length; j++) {
        slopes.push((leftPts[j][1] - leftPts[i][1]) / (leftPts[j][0] - leftPts[i][0]));
      }
    }
    leftS = median(slopes);
    leftA = median(leftPts.map(([b, x]) => x - leftS * b));
  }

  const out = [];
  for (let b = 0; b < BLOCK_COUNT; b++) {
    const cy = centers[b];
    const sp = spans[b];
    const left = Math.max(0, Math.round(leftA + leftS * b));
    const trackX = timingTrack.intercept + timingTrack.slope * cy - timingTrack.medW * 0.7;
    const right = Math.min(W - 1, Math.round(trackX));
    if (right <= left + 40) return null;
    out.push({
      index: b,
      blue: false,
      left,
      right,
      width: Math.max(1, right - left),
      midX: (left + right) / 2,
      centerY: cy,
      span: sp,
      slope: best.slope,
      top: Math.max(0, cy - sp * 0.52),
      bottom: Math.min(H - 1, cy + sp * 0.52),
    });
  }
  return out;
}

function extractBlockMarks(components, blocks, timingTrack) {
  const trackSet = timingTrack ? timingTrack.set : null;
  const raw = [];
  for (const blk of blocks) {
    const bw = blk.width;
    const sp = blk.span;
    for (const c of components) {
      if (trackSet && trackSet.has(c)) continue;
      if (c.cx < blk.left + bw * 0.008 || c.cx > blk.right - bw * 0.008) continue;
      const expectedY = blk.centerY + blk.slope * (c.cx - blk.midX);
      if (Math.abs(c.cy - expectedY) > sp * 0.52) continue;
      if (c.fill < 0.42) continue;
      if (c.w < bw * 0.010 || c.w > bw * 0.058) continue;
      if (c.h < sp * 0.032 || c.h > sp * 0.25) continue;
      if (c.w < c.h * 0.48 || c.w > c.h * 4.2) continue;
      raw.push({
        ...c,
        blockIndex: blk.index,
        u: (c.cx - blk.left) / bw,
        yRel: (c.cy - expectedY) / sp,
        yDeskew: c.cy - blk.slope * (c.cx - blk.midX),
      });
    }
  }
  if (raw.length < 12) return raw;
  const medArea = median(raw.map((m) => m.area));
  const medW = median(raw.map((m) => m.w));
  const medH = median(raw.map((m) => m.h));
  return raw.filter(
    (m) =>
      m.area >= medArea * 0.22 && m.area <= medArea * 4.2 &&
      m.w >= medW * 0.42 && m.w <= medW * 2.4 &&
      m.h >= medH * 0.42 && m.h <= medH * 2.3,
  );
}

// 在 7 个块上联合拟合全局 20 列归一化坐标 u(g, s) = u0 + g * uGroup + s * uCol。
// 要求 uGroup >= 5.2 * uCol（组间必须有明显留白，排除均匀网格/条纹假阳性）。
function fitGlobalColumnGrid(marks) {
  if (marks.length < 16) return null;
  const us = marks.map((m) => m.u);
  const scoreGrid = (u0, uCol, uGroup) => {
    if (uGroup < uCol * 5.2 || uGroup > uCol * 9.2) return -Infinity;
    if (u0 + 3 * uGroup + 4 * uCol > 0.995) return -Infinity;
    const tol = uCol * 0.40;
    let score = 0;
    for (let i = 0; i < us.length; i++) {
      const u = us[i];
      // 解析求最近题组与题位，O(1) 避免内层 20 次循环。
      let g = Math.round((u - u0 - 2 * uCol) / uGroup);
      if (g < 0) g = 0;
      else if (g > 3) g = 3;
      const gStart = u0 + g * uGroup;
      let s = Math.round((u - gStart) / uCol);
      if (s < 0) s = 0;
      else if (s > 4) s = 4;
      const d = Math.abs(u - (gStart + s * uCol));
      if (d < tol) score += 1 - d / tol;
    }
    return score;
  };

  let best = { score: -Infinity, u0: 0.048, uCol: 0.038, uGroup: 0.25 };
  for (let uCol = 0.025; uCol <= 0.048; uCol += 0.0012) {
    for (let uGroup = 0.210; uGroup <= 0.280; uGroup += 0.004) {
      if (uGroup < uCol * 5.2 || uGroup > uCol * 9.2) continue;
      const maxU0 = Math.min(0.14, 0.992 - 3 * uGroup - 4 * uCol);
      for (let u0 = 0.008; u0 <= maxU0; u0 += 0.004) {
        const sc = scoreGrid(u0, uCol, uGroup);
        if (sc > best.score) best = { score: sc, u0, uCol, uGroup };
      }
    }
  }
  if (!Number.isFinite(best.score) || best.score < marks.length * 0.35) return null;

  // 精细局部搜索
  const c0 = best;
  for (let uCol = c0.uCol - 0.0016; uCol <= c0.uCol + 0.0016; uCol += 0.00025) {
    for (let uGroup = c0.uGroup - 0.005; uGroup <= c0.uGroup + 0.005; uGroup += 0.0006) {
      for (let u0 = c0.u0 - 0.005; u0 <= c0.u0 + 0.005; u0 += 0.0006) {
        const sc = scoreGrid(u0, uCol, uGroup);
        if (sc > best.score) best = { score: sc, u0, uCol, uGroup };
      }
    }
  }

  // 每块允许微小的水平微调 du ∈ [-0.012, +0.012]，吸收纸面轻微弯曲；稀疏块保持 0。
  const blockShifts = new Array(BLOCK_COUNT).fill(0);
  for (let b = 0; b < BLOCK_COUNT; b++) {
    const bMarks = marks.filter((m) => m.blockIndex === b);
    if (bMarks.length < 6) continue;
    let bestDu = 0;
    let bestSc = -Infinity;
    const tol = best.uCol * 0.40;
    for (let du = -0.012; du <= 0.0121; du += 0.001) {
      let sc = -Math.abs(du) * 18; // 轻微正则，无明显偏移时贴近全局网格
      for (const m of bMarks) {
        const u = m.u - du;
        let g = Math.round((u - best.u0 - 2 * best.uCol) / best.uGroup);
        if (g < 0) g = 0; else if (g > 3) g = 3;
        const gStart = best.u0 + g * best.uGroup;
        let s = Math.round((u - gStart) / best.uCol);
        if (s < 0) s = 0; else if (s > 4) s = 4;
        const d = Math.abs(u - (gStart + s * best.uCol));
        if (d < tol) sc += 1 - d / tol;
      }
      if (sc > bestSc) { bestSc = sc; bestDu = du; }
    }
    blockShifts[b] = bestDu;
  }

  return { ...best, blockShifts };
}

function columnXsForBlock(blk, colGrid) {
  const du = colGrid.blockShifts[blk.index] || 0;
  const xs = new Float64Array(COLUMNS_PER_BLOCK);
  for (let g = 0; g < GROUPS_PER_BLOCK; g++) {
    for (let s = 0; s < GROUP_SIZE; s++) {
      const u = colGrid.u0 + du + g * colGrid.uGroup + s * colGrid.uCol;
      xs[g * GROUP_SIZE + s] = blk.left + u * blk.width;
    }
  }
  return xs;
}

// 7 块联合定全局选项行相对位置 (relBase, relPitch)，再逐块做不超过 ±0.32*pitch 的局部精修。
// 这样单个稀疏块（例如第 7 块只答了 10 题）绝不会整体错位一行。
function fitColumnRowGrids(blocks, colGrid, marks, darkSums) {
  const blockXs = blocks.map((blk) => columnXsForBlock(blk, colGrid));
  const marksByBlock = blocks.map((blk) => marks.filter((m) => m.blockIndex === blk.index));

  const scoreBlockRow = (blk, xs, bMarks, base, pitchY, slope) => {
    const colPitchPx = colGrid.uCol * blk.width;
    const halfW = Math.max(4, colPitchPx * 0.34);
    const halfH = Math.max(3, pitchY * 0.27);
    let contrastSum = 0;
    for (let c = 0; c < COLUMNS_PER_BLOCK; c++) {
      const cx = xs[c];
      const yShift = slope * (cx - blk.midX);
      let top1 = -1;
      let top2 = -1;
      for (let r = 0; r < OPTION_ROWS; r++) {
        const v = sampleDark(darkSums, cx, base + yShift + r * pitchY, halfW, halfH);
        if (v > top1) { top2 = top1; top1 = v; }
        else if (v > top2) { top2 = v; }
      }
      if (top1 >= 0.14) contrastSum += top1 - top2;
    }
    let snapSum = 0;
    const tol = pitchY * 0.36;
    for (let i = 0; i < bMarks.length; i++) {
      const m = bMarks[i];
      const yBase = base + slope * (m.cx - blk.midX);
      let r = Math.round((m.cy - yBase) / pitchY);
      if (r < 0) r = 0; else if (r > 3) r = 3;
      const d = Math.abs(m.cy - (yBase + r * pitchY));
      if (d < tol) snapSum += (1 - d / tol) * 0.25;
    }
    return contrastSum + snapSum;
  };

  // 1) 全页联合粗搜 (relBase, relPitch)
  let bestGlobal = { score: -Infinity, relBase: -0.22, relPitch: 0.185 };
  for (let relPitch = 0.140; relPitch <= 0.235; relPitch += 0.008) {
    for (let relBase = -0.36; relBase <= -0.04; relBase += 0.015) {
      if (relBase + 3 * relPitch > 0.50) continue;
      let total = 0;
      for (let b = 0; b < BLOCK_COUNT; b++) {
        const blk = blocks[b];
        total += scoreBlockRow(
          blk, blockXs[b], marksByBlock[b],
          blk.centerY + relBase * blk.span,
          relPitch * blk.span,
          blk.slope,
        );
      }
      if (total > bestGlobal.score) bestGlobal = { score: total, relBase, relPitch };
    }
  }
  // 2) 全页联合精搜
  const g0 = bestGlobal;
  for (let relPitch = g0.relPitch - 0.010; relPitch <= g0.relPitch + 0.010; relPitch += 0.0025) {
    for (let relBase = g0.relBase - 0.020; relBase <= g0.relBase + 0.020; relBase += 0.004) {
      if (relBase + 3 * relPitch > 0.50) continue;
      let total = 0;
      for (let b = 0; b < BLOCK_COUNT; b++) {
        const blk = blocks[b];
        total += scoreBlockRow(
          blk, blockXs[b], marksByBlock[b],
          blk.centerY + relBase * blk.span,
          relPitch * blk.span,
          blk.slope,
        );
      }
      if (total > bestGlobal.score) bestGlobal = { score: total, relBase, relPitch };
    }
  }

  // 3) 逐块在全局解附近精修（±0.32 * pitchY，防相位跳格）
  const grids = [];
  for (let b = 0; b < BLOCK_COUNT; b++) {
    const blk = blocks[b];
    const pCenter = bestGlobal.relPitch * blk.span;
    const bCenter = blk.centerY + bestGlobal.relBase * blk.span;
    let best = { score: -Infinity, base: bCenter, pitchY: pCenter, slope: blk.slope };
    const pStep = Math.max(0.4, pCenter * 0.025);
    const bStep = Math.max(0.8, pCenter * 0.04);
    for (let slope = blk.slope - 0.012; slope <= blk.slope + 0.0121; slope += 0.004) {
      for (let pitchY = pCenter * 0.88; pitchY <= pCenter * 1.12; pitchY += pStep) {
        for (let base = bCenter - pCenter * 0.34; base <= bCenter + pCenter * 0.34; base += bStep) {
          const sc = scoreBlockRow(blk, blockXs[b], marksByBlock[b], base, pitchY, slope);
          if (sc > best.score) best = { score: sc, base, pitchY, slope };
        }
      }
    }
    grids.push({ ...best, xs: blockXs[b] });
  }
  return { global: bestGlobal, grids };
}

export function recognizeColumnV3(planes, features, blueStack, timingTrack, options = {}) {
  const { width: W, height: H, gray } = planes;
  const hasBlueBands = Boolean(blueStack && blueStack.length >= 4);
  const blocks = hasBlueBands
    ? buildBlocksFromBlueBands(blueStack, timingTrack, W, H)
    : buildBlocksFromMarks(planes, features, timingTrack);
  if (!blocks || blocks.length < BLOCK_COUNT) return null;
  const marks = extractBlockMarks(features.components, blocks, timingTrack);
  if (marks.length < 16) return null;

  const colGrid = fitGlobalColumnGrid(marks);
  if (!colGrid) return null;

  const rowFit = fitColumnRowGrids(blocks, colGrid, marks, features.darkSums);
  const questions = new Array(QUESTION_COUNT).fill(null).map((_, i) => ({ number: i + 1, answer: null, confidence: 0 }));

  let blocksRead = 0;
  let activeCount = 0;
  let multiDarkCount = 0;
  const contrastRatios = [];
  const debugBlocks = options.debug ? [] : null;

  for (let b = 0; b < BLOCK_COUNT; b++) {
    const blk = blocks[b];
    const grid = rowFit.grids[b];
    const colPitchPx = colGrid.uCol * blk.width;
    const halfW = Math.max(4, colPitchPx * 0.34);
    const halfH = Math.max(3, grid.pitchY * 0.27);
    let blockRead = 0;
    const picks = debugBlocks ? [] : null;

    for (let c = 0; c < COLUMNS_PER_BLOCK; c++) {
      const cx = grid.xs[c];
      const yShift = grid.slope * (cx - blk.midX);
      const values = new Float64Array(OPTION_ROWS);
      for (let r = 0; r < OPTION_ROWS; r++) {
        values[r] = sampleDark(features.darkSums, cx, grid.base + yShift + r * grid.pitchY, halfW, halfH);
      }
      let top = 0;
      for (let r = 1; r < OPTION_ROWS; r++) if (values[r] > values[top]) top = r;
      const sortedVals = [values[0], values[1], values[2], values[3]].sort((a, b) => b - a);
      const dTop = sortedVals[0];
      const second = sortedVals[1];
      const printBase = Math.min(0.28, (sortedVals[2] + sortedVals[3]) * 0.5);
      const excessTop = Math.max(0, dTop - printBase);
      const excessSecond = Math.max(0, second - printBase);
      const margin = dTop - second;
      const ratio = excessTop / (excessSecond + 0.045);
      if (dTop >= 0.16 && excessTop >= 0.11) {
        activeCount++;
        if (excessSecond >= 0.10 && excessSecond >= excessTop * 0.52) multiDarkCount++;
      }
      const index = b * COLUMNS_PER_BLOCK + c;
      if (picks) {
        picks.push({
          number: index + 1,
          cx: Math.round(cx),
          values: Array.from(values, (v) => Number(v.toFixed(3))),
          top,
          margin: Number(margin.toFixed(3)),
        });
      }
      if (dTop >= 0.19 && excessTop >= 0.145 && margin >= 0.105 && ratio >= 1.95) {
        const confidence = clamp01(margin / 0.45);
        questions[index] = { number: index + 1, answer: OPTIONS[top], confidence: Number(confidence.toFixed(3)) };
        contrastRatios.push(ratio);
        blockRead++;
      }
    }
    if (blockRead >= 3) blocksRead++;
    if (debugBlocks) {
      debugBlocks.push({
        block: b,
        read: blockRead,
        base: Math.round(grid.base),
        pitchY: Number(grid.pitchY.toFixed(1)),
        slope: Number(grid.slope.toFixed(4)),
        picks,
      });
    }
  }

  // 计算几何与统计验证指标（用于真/假答题卡门禁）
  const snapErrXs = [];
  const snapErrYs = [];
  let onGrid = 0;
  for (const m of marks) {
    const blk = blocks[m.blockIndex];
    const grid = rowFit.grids[m.blockIndex];
    const colPitchPx = colGrid.uCol * blk.width;
    let bestDx = Infinity;
    for (let c = 0; c < COLUMNS_PER_BLOCK; c++) {
      const d = Math.abs(m.cx - grid.xs[c]);
      if (d < bestDx) bestDx = d;
    }
    const yBase = grid.base + grid.slope * (m.cx - blk.midX);
    let r = Math.round((m.cy - yBase) / grid.pitchY);
    if (r < 0) r = 0; else if (r > 3) r = 3;
    const dy = Math.abs(m.cy - (yBase + r * grid.pitchY));
    const ex = bestDx / colPitchPx;
    const ey = dy / grid.pitchY;
    snapErrXs.push(ex);
    snapErrYs.push(ey);
    if (ex <= 0.32 && ey <= 0.34) onGrid++;
  }

  const box = {
    left: Math.round(Math.min(...blocks.map((b) => b.left))),
    top: Math.round(blocks[0].top),
    right: Math.round(Math.max(...blocks.map((b) => b.right))),
    bottom: Math.round(blocks[blocks.length - 1].bottom),
  };
  // 采样纸面亮度分位
  const paperSamples = [];
  const stepX = Math.max(4, Math.round((box.right - box.left) / 40));
  const stepY = Math.max(4, Math.round((box.bottom - box.top) / 40));
  for (let y = box.top; y <= box.bottom; y += stepY) {
    for (let x = box.left; x <= box.right; x += stepX) {
      paperSamples.push(gray[y * W + x]);
    }
  }

  const answered = questions.filter((q) => q.answer);
  const warnings = [];
  if (blocksRead < BLOCK_COUNT) warnings.push(`只读清了 ${blocksRead}/${BLOCK_COUNT} 个答题块。`);
  if (answered.length < QUESTION_COUNT * 0.5) warnings.push(`只识别出 ${answered.length}/${QUESTION_COUNT} 题，确认照片是否完整、光线是否足够。`);

  const metrics = {
    style: "column",
    recognized: answered.length,
    blocksRead,
    marksCount: marks.length,
    onGridRate: marks.length ? onGrid / marks.length : 0,
    meanSnapErrX: mean(snapErrXs),
    meanSnapErrY: mean(snapErrYs),
    groupToColRatio: colGrid.uGroup / colGrid.uCol,
    pitchRelMad: relMad(rowFit.grids.map((g, i) => g.pitchY / blocks[i].span)),
    blockSpanRatio: Math.max(...blocks.map((b) => b.span)) / Math.min(...blocks.map((b) => b.span)),
    activeCount,
    multiDarkCount,
    multiDarkRate: activeCount ? multiDarkCount / activeCount : 1,
    medianContrastRatio: median(contrastRatios),
    avgConfidence: answered.length ? mean(answered.map((q) => q.confidence)) : 0,
    widthIqr: iqrRatio(marks.map((m) => m.w)),
    heightIqr: iqrRatio(marks.map((m) => m.h)),
    paperP75: percentile(paperSamples, 0.75),
    hasTimingTrack: Boolean(timingTrack),
    hasBlueBands,
    distinctOptions: new Set(answered.map((q) => q.answer)).size,
  };

  return {
    questions,
    layout: {
      engine: "omr-v3",
      box,
      groups: blocksRead,
      style: "column",
      optionGap: Math.round(colGrid.uCol * median(blocks.map((b) => b.width))),
      timingTrack: Boolean(timingTrack),
    },
    warnings,
    metrics,
    ...(options.debug ? { debug: { marks: marks.length, colGrid, rowGlobal: rowFit.global, blocks: debugBlocks, metrics } } : {}),
  };
}
