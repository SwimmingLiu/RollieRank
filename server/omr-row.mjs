// 行式版式答题卡（每题一行、A/B/C/D 横排，7 块 × 5 行 × 4 列 = 140 题）的尺度无关全局网格判读。

import {
  clamp01,
  erode1,
  iqrRatio,
  labelComponents,
  mean,
  median,
  percentile,
  relMad,
} from "./omr-features.mjs";

const OPTIONS = ["A", "B", "C", "D"];
const OPTION_ROWS = 4;
const BLOCK_COUNT = 7;
const ROW_GROUP_ROWS = 5;
const COLUMNS_PER_BLOCK = 20;
const QUESTION_COUNT = BLOCK_COUNT * COLUMNS_PER_BLOCK;
const ROW_COUNT_NEEDED = BLOCK_COUNT * ROW_GROUP_ROWS;

function sampleDark(darkSums, cx, cy, halfW, halfH) {
  return darkSums(cx - halfW, cy - halfH, cx + halfW, cy + halfH);
}

function isOnTimingTrack(c, timingTrack) {
  if (!timingTrack) return false;
  if (c.cy < timingTrack.yTop - timingTrack.medDy * 2 || c.cy > timingTrack.yBottom + timingTrack.medDy * 2) return false;
  const tx = timingTrack.intercept + timingTrack.slope * c.cy;
  return Math.abs(c.cx - tx) <= Math.max(10, timingTrack.medW * 0.95);
}

function extractRowMarks(components, W, H, timingTrack) {
  const base = components.filter(
    (c) =>
      !isOnTimingTrack(c, timingTrack) &&
      c.fill >= 0.45 &&
      c.w >= Math.max(6, W * 0.0055) && c.w <= W * 0.075 &&
      c.h >= Math.max(4, H * 0.0024) && c.h <= H * 0.036 &&
      c.w >= c.h * 0.78 && c.w <= c.h * 4.5,
  );
  if (base.length < 16) return base;
  const medArea = median(base.map((c) => c.area));
  const medW = median(base.map((c) => c.w));
  const medH = median(base.map((c) => c.h));
  return base.filter(
    (c) =>
      c.area >= medArea * 0.28 && c.area <= medArea * 3.8 &&
      c.w >= medW * 0.45 && c.w <= medW * 2.4 &&
      c.h >= medH * 0.45 && c.h <= medH * 2.2,
  );
}

function estimateRowShear(marks, W, rowTol) {
  const score = (slope) => {
    const ys = marks.map((m) => m.cy + slope * (m.cx - W / 2)).sort((a, b) => a - b);
    let total = 0;
    for (let i = 0; i < ys.length; ) {
      let j = i;
      while (j + 1 < ys.length && ys[j + 1] - ys[i] < rowTol) j++;
      total += (j - i + 1) ** 2;
      i = j + 1;
    }
    return total;
  };
  let best = { slope: 0, value: score(0) };
  for (let s = -0.12; s <= 0.1201; s += 0.004) {
    const value = score(s);
    if (value > best.value) best = { slope: s, value };
  }
  for (let s = best.slope - 0.004; s <= best.slope + 0.0041; s += 0.0005) {
    const value = score(s);
    if (value > best.value) best = { slope: s, value };
  }
  return best.slope;
}

function clusterRows(list, gap) {
  if (!list.length) return [];
  const sorted = [...list].sort((a, b) => a.y - b.y);
  const rows = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - current[current.length - 1].y > gap) {
      rows.push(current);
      current = [];
    }
    current.push(sorted[i]);
  }
  rows.push(current);
  return rows;
}

function rowRuns(mask, { width: W, height: H }, rowY, x0, x1, slope, halfBand, mergeGap) {
  const prof = new Float64Array(W);
  for (let x = x0; x < x1; x++) {
    const center = rowY - slope * (x - W / 2);
    for (let dy = -halfBand; dy <= halfBand; dy++) {
      const y = Math.round(center + dy);
      if (y >= 0 && y < H) prof[x] += mask[y * W + x];
    }
  }
  const runs = [];
  let start = -1;
  const minColHits = Math.max(2, Math.round(halfBand * 0.25));
  for (let x = x0; x < x1; x++) {
    const on = prof[x] >= minColHits;
    if (on && start < 0) start = x;
    if ((!on || x === x1 - 1) && start >= 0) {
      const end = on ? x : x - 1;
      if (end - start >= 2) {
        let mass = 0;
        for (let k = start; k <= end; k++) mass += prof[k];
        runs.push({ lo: start, hi: end, mass, cx: (start + end) / 2 });
      }
      start = -1;
    }
  }
  const merged = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && run.lo - last.hi <= mergeGap) {
      last.hi = run.hi;
      last.mass += run.mass;
      last.cx = (last.lo + last.hi) / 2;
    } else merged.push({ ...run });
  }
  return merged;
}

function kmeans1d(values, k, iterations = 40) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return [];
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(((i + 0.5) * sorted.length) / k))]);
  for (let it = 0; it < iterations; it++) {
    const buckets = Array.from({ length: k }, () => []);
    for (const v of values) {
      let best = 0;
      for (let c = 1; c < k; c++) if (Math.abs(v - centers[c]) < Math.abs(v - centers[best])) best = c;
      buckets[best].push(v);
    }
    const next = buckets.map((b, i) => (b.length ? b.reduce((x, y) => x + y, 0) / b.length : centers[i]));
    const settled = next.every((c, i) => Math.abs(c - centers[i]) < 0.01);
    centers = next;
    if (settled) break;
  }
  return centers.sort((a, b) => a - b);
}

function columnCenters(values, k) {
  const drop = new Set();
  for (let pass = 0; pass < 2; pass++) {
    const kept = values.filter((v) => !drop.has(v));
    if (kept.length < k) break;
    const centers = kmeans1d(kept, k);
    const counts = new Array(k).fill(0);
    const nearest = new Map();
    for (const v of kept) {
      let best = 0;
      for (let c = 1; c < k; c++) if (Math.abs(v - centers[c]) < Math.abs(v - centers[best])) best = c;
      counts[best]++;
      nearest.set(v, best);
    }
    let dropped = false;
    for (const [v, c] of nearest) if (counts[c] <= 1) { drop.add(v); dropped = true; }
    if (!dropped) return centers;
  }
  const kept = values.filter((v) => !drop.has(v));
  return kept.length >= k ? kmeans1d(kept, k) : kmeans1d(values, k);
}

// 尺度自适应的 4 列选项格拟合：
// 以真实填涂斑块（columnsMarks）为主锚点、印刷字符簇（columnsRuns）为辅锚点，
// 避免 3 位题号（101–140）与红色表格边框把选项间距拉宽。
function fitBlockLattices(columnsRuns, columnsMarks, x0s, x1s, pitchRange = null) {
  const widths = x0s.map((x0, g) => x1s[g] - x0);
  const avgColW = median(widths);
  if (avgColW < 30) return null;
  const pitchMin = pitchRange ? pitchRange[0] : Math.max(10, avgColW * 0.13);
  const pitchMax = pitchRange ? pitchRange[1] : Math.max(pitchMin + 4, avgColW * 0.245);
  const pitchStep = Math.max(0.25, (pitchMax - pitchMin) / 56);
  const startStep = Math.max(0.5, avgColW * 0.004);

  const scoreColumn = (g, start, pitch) => {
    const tol = pitch * 0.42;
    let score = 0;
    // 1) 印刷与墨迹簇（保证整列全选同一字母时仍有 4 选项相位锚定）
    for (const runs of columnsRuns[g]) {
      for (const run of runs) {
        let nearest = Infinity;
        for (let q = 0; q < OPTION_ROWS; q++) {
          const d = Math.abs(run.cx - (start + q * pitch));
          if (d < nearest) nearest = d;
        }
        if (nearest < tol) score += ((tol - nearest) / tol) * (0.55 + Math.min(run.mass, 300) / 360);
      }
    }
    // 2) 真实铅笔斑块强约束：填涂块必须精准落在 A/B/C/D 之一，不可被挤到 A 左侧或 D 右侧
    const cMarks = columnsMarks[g] || [];
    for (const m of cMarks) {
      if (m.cx < start - pitch * 0.45 || m.cx > start + 3.45 * pitch) {
        score -= 1.8;
        continue;
      }
      let nearest = Infinity;
      for (let q = 0; q < OPTION_ROWS; q++) {
        const d = Math.abs(m.cx - (start + q * pitch));
        if (d < nearest) nearest = d;
      }
      if (nearest < tol) score += ((tol - nearest) / tol) * 2.8;
    }
    return score;
  };

  const bestPhase = (g, pitch) => {
    const scores = [];
    const maxStart = x1s[g] - 3 * pitch;
    if (maxStart < x0s[g]) return null;
    for (let start = x0s[g]; start <= maxStart; start += startStep) {
      scores.push({ start, score: scoreColumn(g, start, pitch) });
    }
    if (!scores.length) return null;
    let best = scores[0];
    for (const item of scores) if (item.score > best.score) best = item;
    for (const item of scores) {
      if (item.start < best.start && item.score >= best.score * 0.88) return item;
    }
    return best;
  };

  let overall = null;
  for (let pitch = pitchMin; pitch <= pitchMax + 1e-6; pitch += pitchStep) {
    const phases = [];
    let total = 0;
    for (let g = 0; g < columnsRuns.length; g++) {
      const best = bestPhase(g, pitch);
      if (!best) { total = -Infinity; break; }
      phases.push(best.start);
      total += best.score;
    }
    if (!overall || total > overall.score) overall = { score: total, pitch, phases };
  }
  if (!overall || !Number.isFinite(overall.score)) return null;

  // 水平 4 列相位一致性校正
  const phases = [...overall.phases];
  const n = phases.length;
  const meanG = (n - 1) / 2;
  const meanS = mean(phases);
  let num = 0, den = 0;
  for (let g = 0; g < n; g++) { num += (g - meanG) * (phases[g] - meanS); den += (g - meanG) ** 2; }
  if (den > 0) {
    const step = num / den;
    for (let g = 0; g < n; g++) {
      const predicted = meanS + step * (g - meanG);
      const delta = predicted - phases[g];
      const k = Math.round(delta / overall.pitch);
      if (k === 0 || Math.abs(delta) < overall.pitch * 0.6) continue;
      const shifted = phases[g] + k * overall.pitch;
      if (shifted < x0s[g] || shifted > x1s[g] - 3 * overall.pitch) continue;
      if (scoreColumn(g, shifted, overall.pitch) >= scoreColumn(g, phases[g], overall.pitch) * 0.85) phases[g] = shifted;
    }
  }
  return {
    pitch: overall.pitch,
    phases,
    scoreColumn,
    x: phases.map((start) => Array.from({ length: OPTION_ROWS }, (_, q) => start + q * overall.pitch)),
  };
}

// 鲁棒一元线性拟合 y = a + s * x（中位斜率 + 中位截距），避免单个异常块带偏整列。
function robustLine(points) {
  if (!points.length) return null;
  if (points.length === 1) return { a: points[0][1], s: 0 };
  const slopes = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j][0] - points[i][0];
      if (Math.abs(dx) > 0.5) slopes.push((points[j][1] - points[i][1]) / dx);
    }
  }
  const s = slopes.length ? median(slopes) : 0;
  const a = median(points.map(([x, y]) => y - s * x));
  return { a, s };
}

export function recognizeRowV3(planes, features, timingTrack, options = {}) {
  const { width: W, height: H, gray } = planes;
  const ink = options.ink || features.ink;
  const minArea = Math.max(18, Math.round(W * H * 0.000012));
  const eroded = Math.min(W, H) >= 750 ? erode1(ink, { width: W, height: H }) : ink;
  const components = labelComponents(eroded, { width: W, height: H }, minArea);
  let marks = options.marks || extractRowMarks(components, W, H, timingTrack);
  // 若已检出右侧同步轨，先按同步轨所在区域过滤答题卡外的桌面/键盘/卷面杂斑。
  if (timingTrack && timingTrack.side === "right") {
    const padY = timingTrack.medDy * 3;
    const inSheet = marks.filter((m) => {
      if (m.cy < timingTrack.yTop - padY || m.cy > timingTrack.yBottom + padY) return false;
      const tx = timingTrack.intercept + timingTrack.slope * m.cy;
      return m.cx < tx - timingTrack.medW * 0.6;
    });
    if (inSheet.length >= 24) marks = inSheet;
  }
  const questions = new Array(QUESTION_COUNT).fill(null).map((_, i) => ({ number: i + 1, answer: null, confidence: 0 }));
  if (marks.length < 24) return null;

  const medW = median(marks.map((m) => m.w));
  const medH = median(marks.map((m) => m.h));
  const rowTol = Math.max(5, Math.round(medH * 0.78));

  const denseRows = (list, shift, minPerRow = 3) => {
    let rows = clusterRows(list.map((m) => ({ ...m, y: m.cy + shift * (m.cx - W / 2) })), rowTol);
    for (let pass = 0; pass < 4; pass++) {
      const kept = rows.filter((row) => row.length >= minPerRow);
      if (kept.length === rows.length) break;
      if (!kept.length) return [];
      rows = clusterRows(kept.flat(), rowTol);
    }
    return rows;
  };

  const pickWindow = (rows) => {
    const info = rows.map((row) => ({ y: mean(row.map((m) => m.y)), items: row }));
    if (info.length <= ROW_COUNT_NEEDED) return info;
    let best = { start: 0, score: -Infinity };
    for (let i = 0; i + ROW_COUNT_NEEDED <= info.length; i++) {
      const slice = info.slice(i, i + ROW_COUNT_NEEDED);
      const gaps = [];
      for (let j = 1; j < slice.length; j++) gaps.push(slice[j].y - slice[j - 1].y);
      const pitch = median(gaps);
      let score = 0;
      for (let j = 0; j < slice.length; j++) score += Math.min(5, slice[j].items.length);
      for (const gap of gaps) score -= Math.max(0, gap - pitch * 2.2) * 0.6;
      if (score > best.score) best = { start: i, score };
    }
    return info.slice(best.start, best.start + ROW_COUNT_NEEDED);
  };

  const selectRows = (shift) => {
    let list = denseRows(marks, shift, 3);
    if (list.length < ROW_COUNT_NEEDED) {
      const relaxed = denseRows(marks, shift, 2);
      if (relaxed.length >= list.length) list = relaxed;
    }
    return pickWindow(list);
  };

  // 一、倾斜估计与题行窗口定位
  let slope = estimateRowShear(marks, W, rowTol);
  let window = selectRows(slope);
  for (let pass = 0; pass < 3 && window.length >= 15; pass++) {
    const refined = estimateRowShear(window.flatMap((row) => row.items), W, rowTol);
    if (Math.abs(refined - slope) < 0.0012) break;
    slope = refined;
    window = selectRows(slope);
  }
  if (window.length < ROW_GROUP_ROWS * 4) return null;
  const blockCount = Math.min(BLOCK_COUNT, Math.floor(window.length / ROW_GROUP_ROWS));

  // 二、计算行距与左右边界护栏（全部按图内尺度自适应）
  const intraGaps = [];
  for (let b = 0; b < blockCount; b++) {
    for (let r = 1; r < ROW_GROUP_ROWS; r++) {
      intraGaps.push(window[b * ROW_GROUP_ROWS + r].y - window[b * ROW_GROUP_ROWS + r - 1].y);
    }
  }
  const rowPitch = median(intraGaps);
  if (rowPitch < Math.max(8, medH * 1.15)) return null;

  const allWindowMarks = window.flatMap((row) => row.items);
  const sheetSpanW = Math.max(
    medW * 16,
    percentile(allWindowMarks.map((m) => m.cx), 0.96) - percentile(allWindowMarks.map((m) => m.cx), 0.04),
  );

  const blocks = [];
  for (let b = 0; b < blockCount; b++) {
    const rows = window.slice(b * ROW_GROUP_ROWS, (b + 1) * ROW_GROUP_ROWS);
    const mins = rows.filter((row) => row.items.length).map((row) => Math.min(...row.items.map((m) => m.cx)));
    const leftGuard = mins.length ? median(mins) - sheetSpanW * 0.16 : 0;
    blocks.push(rows.map((row) => ({ ...row, items: row.items.filter((m) => m.cx >= leftGuard) })));
  }

  // 若全局同步轨未检出，按块尺度自适应剔除右侧窄条码列。
  const ladders = blocks.map((block) => {
    if (timingTrack) return null;
    const bMarks = block.flatMap((row) => row.items);
    if (bMarks.length < 10) return null;
    const xs = [...bMarks].sort((a, b) => a.cx - b.cx);
    let j = xs.length - 1;
    while (j > 0 && xs[xs.length - 1].cx - xs[j - 1].cx <= medW * 1.6) j--;
    const group = xs.slice(j);
    if (group.length >= 3 && j > 0 && group[0].cx - xs[j - 1].cx >= medW * 1.8) return group;
    return null;
  });
  const ladderFound = ladders.map((g, i) => (g ? { i, x: mean(g.map((m) => m.cx)) } : null)).filter(Boolean);
  const ladderConsistent =
    ladderFound.length >= Math.max(4, blockCount - 2) &&
    ladderFound.every((item, i) => i === 0 || item.x >= ladderFound[i - 1].x - medW * 0.8);
  if (!ladderConsistent) ladders.fill(null);

  // 三、尺度自适应 4 题列边界与选项格拟合
  const halfBand = Math.max(4, Math.round(medH * 0.72));
  const runMergeGap = Math.max(4, Math.round(medW * 0.42));
  const spanMergeGap = Math.max(8, Math.round(medW * 0.85));
  const minColGap = Math.max(14, Math.round(medW * 1.45));
  // 使用中性暗墨迹 ink（而非无饱和度过滤的红线掩膜），避免红色表格线和左侧二维码把第 0 列拽宽。
  const runMask = ink;

  const blockRaw = [];
  for (let b = 0; b < blockCount; b++) {
    const block = blocks[b];
    const all = block.flatMap((row) => row.items);
    if (!all.length) { blockRaw.push(null); continue; }
    const ladder = ladders[b];
    const midY = mean(block.map((row) => row.y));
    const left = Math.max(1, Math.round(Math.min(...all.map((m) => m.cx)) - sheetSpanW * 0.13));
    let right = Math.min(W - 1, Math.round(Math.max(...all.map((m) => m.cx)) + sheetSpanW * 0.13));
    if (timingTrack && timingTrack.side === "right") {
      const tx = Math.round(timingTrack.intercept + timingTrack.slope * midY - timingTrack.medW * 0.75);
      if (tx > left + sheetSpanW * 0.5) right = Math.min(right, tx);
    } else if (ladder) {
      right = Math.min(right, Math.round(Math.min(...ladder.map((m) => m.cx))) - Math.max(6, Math.round(medW * 0.35)));
    }

    const fullRuns = block.map((row) => rowRuns(runMask, planes, row.y, left, right, slope, halfBand, runMergeGap));
    const spans = [];
    for (const runs of fullRuns) for (const run of runs) spans.push([run.lo, run.hi]);
    spans.sort((a, c) => a[0] - c[0]);
    const mergedSpans = [];
    for (const span of spans) {
      const last = mergedSpans[mergedSpans.length - 1];
      if (last && span[0] - last[1] <= spanMergeGap) last[1] = Math.max(last[1], span[1]);
      else mergedSpans.push([...span]);
    }
    const gaps = [];
    for (let i = 1; i < mergedSpans.length; i++) gaps.push({ at: i, size: mergedSpans[i][0] - mergedSpans[i - 1][1] });
    const cuts = gaps
      .filter((g) => g.size >= minColGap)
      .sort((a, c) => c.size - a.size)
      .slice(0, 3)
      .map((g) => g.at)
      .sort((a, c) => a - c);

    let groupBounds = null;
    if (cuts.length === 3) {
      const bounds = [];
      let start = 0;
      for (const cut of cuts) { bounds.push([mergedSpans[start][0], mergedSpans[cut - 1][1]]); start = cut; }
      bounds.push([mergedSpans[start][0], mergedSpans[mergedSpans.length - 1][1]]);
      const colWidths = bounds.map((bd) => bd[1] - bd[0]);
      if (Math.min(...colWidths) > medW * 2.5 && Math.max(...colWidths) / Math.min(...colWidths) <= 1.85) {
        groupBounds = [bounds[0][0], bounds[1][0], bounds[2][0], bounds[3][0], bounds[3][1] + Math.max(6, Math.round(medW * 0.3))];
      }
    }
    blockRaw.push({ b, block, all, ladder, left, right, fullRuns, groupBounds });
  }

  // 用跨块线性模型补齐未能清晰分出 4 列的个别块（避免整列空白的块把 3 列硬切成 4 列）。
  // 若印刷字符切分成功块不足 3 个，则优先从填满 4 列（marks >= 17）的块里做 k-means 来建跨块直线。
  const goodBounds = blockRaw.filter((item) => item && item.groupBounds);
  const kMeansBounds = [];
  if (goodBounds.length < 3) {
    for (const item of blockRaw) {
      if (!item || item.groupBounds) continue;
      const items = item.ladder ? item.all.filter((m) => !item.ladder.includes(m)) : item.all;
      if (items.length < 17) continue;
      const cols = columnCenters(items.map((m) => m.cx), 4);
      if (cols.length < 4) continue;
      const steps = [cols[1] - cols[0], cols[2] - cols[1], cols[3] - cols[2]];
      if (Math.min(...steps) < medW * 2.5 || Math.max(...steps) / Math.min(...steps) > 1.55) continue;
      const step = median(steps);
      const gb = [cols[0] - step * 0.48, (cols[0] + cols[1]) / 2, (cols[1] + cols[2]) / 2, (cols[2] + cols[3]) / 2, cols[3] + step * 0.52];
      if (item.ladder) gb[4] = Math.min(gb[4], Math.min(...item.ladder.map((m) => m.cx)) - 8);
      kMeansBounds.push({ b: item.b, groupBounds: gb });
    }
  }
  const boundPool = goodBounds.length >= 3 ? goodBounds : [...goodBounds, ...kMeansBounds];
  const boundLines = boundPool.length >= 3
    ? Array.from({ length: 5 }, (_, k) => robustLine(boundPool.map((item) => [item.b, item.groupBounds[k]])))
    : null;

  const blockFits = [];
  for (let b = 0; b < blockCount; b++) {
    const item = blockRaw[b];
    if (!item) { blockFits.push(null); continue; }
    let groupBounds = item.groupBounds;
    if (!groupBounds && boundLines) {
      groupBounds = boundLines.map((line) => line.a + line.s * b);
    }
    if (!groupBounds) {
      const items = item.ladder ? item.all.filter((m) => !item.ladder.includes(m)) : item.all;
      const cols = columnCenters(items.map((m) => m.cx), 4);
      if (cols.length < 4) { blockFits.push(null); continue; }
      const step = (cols[3] - cols[0]) / 3;
      groupBounds = [cols[0] - step * 0.48, (cols[0] + cols[1]) / 2, (cols[1] + cols[2]) / 2, (cols[2] + cols[3]) / 2, cols[3] + step * 0.52];
      if (item.ladder) groupBounds[4] = Math.min(groupBounds[4], Math.min(...item.ladder.map((m) => m.cx)) - 8);
    }
    const padX = Math.max(4, Math.round(medW * 0.25));
    const x0s = groupBounds.slice(0, 4).map((v) => Math.max(1, Math.round(v) + padX));
    const x1s = groupBounds.slice(1, 5).map((v) => Math.min(W - 1, Math.round(v)));
    const columnsRuns = x0s.map((x0, g) => item.fullRuns.map((runs) => runs.filter((r) => r.hi >= x0 && r.lo < x1s[g])));
    const itemsClean = item.ladder ? item.all.filter((m) => !item.ladder.includes(m)) : item.all;
    const columnsMarks = x0s.map((x0, g) => itemsClean.filter((m) => m.cx >= x0 - medW * 0.3 && m.cx <= x1s[g] + medW * 0.2));
    const fit = fitBlockLattices(columnsRuns, columnsMarks, x0s, x1s);
    blockFits.push(fit ? { ...item, groupBounds, x0s, x1s, columnsRuns, columnsMarks, fit } : null);
  }

  const validFits = blockFits.filter(Boolean);
  if (validFits.length < 4) return null;

  // 全局 optionPitch 一致性约束：个别离群块在全局中位 pitch ±8% 内重拟合。
  const globalPitch = median(validFits.map((bf) => bf.fit.pitch));
  for (let b = 0; b < blockCount; b++) {
    const bf = blockFits[b];
    if (!bf) continue;
    if (Math.abs(bf.fit.pitch - globalPitch) > globalPitch * 0.10) {
      const refit = fitBlockLattices(bf.columnsRuns, bf.columnsMarks, bf.x0s, bf.x1s, [globalPitch * 0.92, globalPitch * 1.08]);
      if (refit) bf.fit = refit;
    }
  }

  // 纵向跨块相位一致性校正：同一题列 g 的选项 A 横坐标在 7 块间呈平滑直线。
  // 拟合直线时优先用有 >=2 个真实填涂块的块，避免整列留空（如第 7 块 136–140 题）拉偏直线；
  // 整列留空的块直接对齐到跨块直线预测位置，防止相位漂移到 3 位题号上产生误读。
  const colLines = Array.from({ length: 4 }, (_, g) => {
    const populated = blockFits.filter((bf) => bf && (bf.columnsMarks[g]?.length || 0) >= 2);
    const src = populated.length >= 3 ? populated : blockFits.filter(Boolean);
    return robustLine(src.map((bf) => [bf.b, bf.fit.phases[g]]));
  });
  for (const bf of blockFits) {
    if (!bf) continue;
    for (let g = 0; g < 4; g++) {
      const line = colLines[g];
      if (!line) continue;
      const pred = line.a + line.s * bf.b;
      const markCount = bf.columnsMarks[g]?.length || 0;
      if (markCount <= 1) {
        if (pred >= 1 && pred + 3 * bf.fit.pitch < W - 1) {
          bf.fit.phases[g] = pred;
          bf.fit.x[g] = Array.from({ length: OPTION_ROWS }, (_, q) => pred + q * bf.fit.pitch);
        }
        continue;
      }
      const delta = pred - bf.fit.phases[g];
      const k = Math.round(delta / bf.fit.pitch);
      if (k === 0 || Math.abs(delta) < bf.fit.pitch * 0.58) continue;
      const shifted = bf.fit.phases[g] + k * bf.fit.pitch;
      if (shifted < bf.x0s[g] || shifted > bf.x1s[g] - 3 * bf.fit.pitch) continue;
      if (bf.fit.scoreColumn(g, shifted, bf.fit.pitch) >= bf.fit.scoreColumn(g, bf.fit.phases[g], bf.fit.pitch) * 0.78) {
        bf.fit.phases[g] = shifted;
        bf.fit.x[g] = Array.from({ length: OPTION_ROWS }, (_, q) => shifted + q * bf.fit.pitch);
      }
    }
  }

  // 四、直接按 4 选项格采样连续相对暗度比对（解决阴影、浅涂、多涂与非答题卡文本误判）
  let blocksRead = 0;
  let activeCount = 0;
  let multiDarkCount = 0;
  const contrastRatios = [];
  const snapErrXs = [];
  let snapIn25 = 0;
  let snapTotal = 0;
  const latticeDebug = [];
  const blockDebug = [];

  for (let b = 0; b < blockCount; b++) {
    const bf = blockFits[b];
    if (!bf) continue;
    if (options.debug) {
      blockDebug.push({ b, marks: bf.all.length, bounds: bf.groupBounds.map((v) => Math.round(v)), pitch: Number(bf.fit.pitch.toFixed(1)) });
    }
    const pitch = bf.fit.pitch;
    const halfW = Math.max(4, Math.min(medW * 0.48, pitch * 0.35));
    const halfH = Math.max(3, Math.min(medH * 0.60, rowPitch * 0.30));
    let blockRead = 0;

    for (let g = 0; g < 4; g++) {
      const xs = bf.fit.x[g];
      if (!xs) continue;
      if (options.debug) latticeDebug.push({ b, g, pitch: Number(pitch.toFixed(1)), x: xs.map((v) => Math.round(v)) });

      // 统计本列内所有检测到的墨迹斑块对 4 格的吸附误差（真卡极小 ~0.08，书页/杂斑约 0.25）
      for (const row of bf.block) {
        for (const m of row.items) {
          if (m.cx < bf.x0s[g] - pitch * 0.35 || m.cx > bf.x1s[g] + pitch * 0.2) continue;
          if (bf.ladder && bf.ladder.includes(m)) continue;
          let bestD = Infinity;
          for (let q = 0; q < OPTION_ROWS; q++) {
            const d = Math.abs(m.cx - xs[q]);
            if (d < bestD) bestD = d;
          }
          const normD = bestD / pitch;
          snapErrXs.push(normD);
          snapTotal++;
          if (normD <= 0.28) snapIn25++;
        }
      }

      for (let r = 0; r < bf.block.length; r++) {
        const row = bf.block[r];
        const values = new Float64Array(OPTION_ROWS);
        for (let q = 0; q < OPTION_ROWS; q++) {
          const cx = xs[q];
          const cy = row.y - slope * (cx - W / 2);
          values[q] = sampleDark(features.darkSums, cx, cy, halfW, halfH);
        }
        let top = 0;
        for (let q = 1; q < OPTION_ROWS; q++) if (values[q] > values[top]) top = q;
        let second = -1;
        for (let q = 0; q < OPTION_ROWS; q++) if (q !== top && values[q] > second) second = values[q];
        const dTop = values[top];
        const margin = dTop - second;
        const ratio = dTop / (second + 0.03);
        if (dTop >= 0.16) {
          activeCount++;
          if (second >= 0.16 && second >= dTop * 0.55) multiDarkCount++;
        }
        const index = b * COLUMNS_PER_BLOCK + g * ROW_GROUP_ROWS + r;
        if (index >= QUESTION_COUNT) continue;
        if (dTop >= 0.19 && margin >= 0.105 && ratio >= 1.75) {
          const confidence = clamp01(margin / 0.50);
          questions[index] = { number: index + 1, answer: OPTIONS[top], confidence: Number(confidence.toFixed(3)) };
          contrastRatios.push(ratio);
          blockRead++;
        }
      }
    }
    if (blockRead >= 4) blocksRead++;
  }

  // 计算验证门禁指标
  const activeFits = blockFits.filter(Boolean);
  const colSteps = [];
  for (const bf of activeFits) {
    for (let g = 0; g < 3; g++) colSteps.push(bf.fit.phases[g + 1] - bf.fit.phases[g]);
  }
  const medColStep = median(colSteps);
  const colStepUniformity = colSteps.length ? Math.max(...colSteps) / Math.max(1, Math.min(...colSteps)) : 9;
  const colAlignResiduals = [];
  for (let g = 0; g < 4; g++) {
    const line = colLines[g];
    if (!line) continue;
    for (const bf of activeFits) {
      colAlignResiduals.push((bf.fit.phases[g] - (line.a + line.s * bf.b)) ** 2);
    }
  }
  const colAlignRms = colAlignResiduals.length ? Math.sqrt(mean(colAlignResiduals)) / globalPitch : 9;

  const box = {
    left: Math.max(0, Math.round(Math.min(...activeFits.map((bf) => bf.x0s[0])))),
    right: Math.min(W - 1, Math.round(Math.max(...activeFits.map((bf) => bf.x1s[3])))),
    top: Math.max(0, Math.round(window[0].y - rowPitch)),
    bottom: Math.min(H - 1, Math.round(window[window.length - 1].y + rowPitch)),
  };
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
  if (blocksRead < blockCount) warnings.push(`只读清了 ${blocksRead}/${blockCount} 个答题块。`);
  if (answered.length < QUESTION_COUNT * 0.5) warnings.push(`只识别出 ${answered.length}/${QUESTION_COUNT} 题，确认照片是否完整、光线是否足够。`);

  const metrics = {
    style: "row",
    recognized: answered.length,
    blocksRead,
    blockCount,
    marksCount: marks.length,
    onGridRate: snapTotal ? snapIn25 / snapTotal : 0,
    meanSnapErrX: snapErrXs.length ? mean(snapErrXs) : 1,
    rowGapRelMad: relMad(intraGaps),
    pitchRelMad: relMad(activeFits.map((bf) => bf.fit.pitch)),
    colStepToPitchRatio: globalPitch ? medColStep / globalPitch : 0,
    colStepUniformity,
    colAlignRms,
    activeCount,
    multiDarkCount,
    multiDarkRate: activeCount ? multiDarkCount / activeCount : 1,
    medianContrastRatio: median(contrastRatios),
    avgConfidence: answered.length ? mean(answered.map((q) => q.confidence)) : 0,
    widthIqr: iqrRatio(marks.map((m) => m.w)),
    heightIqr: iqrRatio(marks.map((m) => m.h)),
    paperP75: percentile(paperSamples, 0.75),
    hasTimingTrack: Boolean(timingTrack || ladderConsistent),
    hasBlueBands: false,
    distinctOptions: new Set(answered.map((q) => q.answer)).size,
  };

  return {
    questions,
    layout: {
      engine: "omr-v3",
      style: "row",
      box,
      rows: window.length,
      blocks: blockCount,
      shear: Number(slope.toFixed(4)),
      optionGap: Math.round(globalPitch),
      timingTrack: Boolean(timingTrack || ladderConsistent),
    },
    warnings,
    metrics,
    ...(options.debug ? { debug: { marks: marks.length, rows: window.length, slope, blocks: blockDebug, lattices: latticeDebug, metrics } } : {}),
  };
}
