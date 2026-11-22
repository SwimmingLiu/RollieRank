// 答题卡定位与判读。
//
// 版式：公务员行测答题卡，140 题、每题 4 个选项、7 个行块、每块 20 题。
// 照片可能是两种排布：
//   column  每题占一列，[A][B][C][D] 竖排（4 个选项格上下排列）
//   row     每题占一行，[A][B][C][D] 横排
// 两种排布里，涂黑的格子都是一块横向铅笔斑块，未涂的格子保留印刷字符。
// 所以判读不需要印刷网格：先找铅笔斑块，再在斑块周围按选项间距取样比对。
//
// 坐标全部从图片自身检测：行块来自蓝底答题区的色带（白底卡退回到红框或墨迹密度带），
// 题列与选项行来自墨迹自身的排列，不写死像素。

const GROUP_SIZE = 5; // 每大题块 5 题一组
const OPTIONS = ["A", "B", "C", "D"];
const OPTION_ROWS = OPTIONS.length;
const BLOCK_COUNT = 7;
const COLUMNS_PER_BLOCK = 20;
const QUESTION_COUNT = BLOCK_COUNT * COLUMNS_PER_BLOCK;
// 行式版式：一块 4 列 × 5 行 = 20 题，全卡 7 块共 35 行。
const ROW_GROUP_ROWS = 5;
const ROW_COUNT_NEEDED = (QUESTION_COUNT / COLUMNS_PER_BLOCK) * ROW_GROUP_ROWS;

// ---------- 基础算子 ----------

// 均值滤波用积分图实现：滑动窗口版本在边界会漏加像素，换成积分图后处处一致。
function boxFilter(source, radius) {
  const width = source.W;
  const height = source.H;
  const sums = integral(source);
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[y * width + x] = sums(x - radius, y - radius, x + radius + 1, y + radius + 1);
    }
  }
  return { data: out, W: width, H: height };
}

function integral(source) {
  const { W, H, data } = source;
  const sums = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) {
      rowSum += data[y * W + x];
      sums[(y + 1) * (W + 1) + (x + 1)] = sums[y * (W + 1) + (x + 1)] + rowSum;
    }
  }
  return (x0, y0, x1, y1) => {
    const ax = Math.max(0, Math.min(W, Math.round(x0)));
    const ay = Math.max(0, Math.min(H, Math.round(y0)));
    const bx = Math.max(0, Math.min(W, Math.round(x1)));
    const by = Math.max(0, Math.min(H, Math.round(y1)));
    if (bx <= ax || by <= ay) return 0;
    const s = sums;
    const w = W + 1;
    return (s[by * w + bx] - s[ay * w + bx] - s[by * w + ax] + s[ay * w + ax]) / ((bx - ax) * (by - ay));
  };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = Float64Array.from(values).sort();
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

// 中位数：数据集很小，直接排序比走 Float64Array 的排序路径更直观。
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

function labelComponents(mask, { width, height }, minArea) {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const out = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let x0 = width, x1 = 0, y0 = height, y1 = 0, area = 0, sumX = 0, sumY = 0;
    while (top) {
      const p = stack[--top];
      const x = p % width;
      const y = (p - x) / width;
      area++;
      sumX += x;
      sumY += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < width - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (y > 0 && mask[p - width] && !seen[p - width]) { seen[p - width] = 1; stack[top++] = p - width; }
      if (y < height - 1 && mask[p + width] && !seen[p + width]) { seen[p + width] = 1; stack[top++] = p + width; }
    }
    if (area < minArea) continue;
    out.push({
      cx: sumX / area, cy: sumY / area,
      x0, x1, y0, y1,
      w: x1 - x0 + 1, h: y1 - y0 + 1,
      area, fill: area / ((x1 - x0 + 1) * (y1 - y0 + 1)),
    });
  }
  return out;
}

// 一维聚类：把相邻且间距小于 tol 的数值并成一段。
function cluster1d(values, tol) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const groups = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > tol) { groups.push(current); current = []; }
    current.push(sorted[i]);
  }
  groups.push(current);
  return groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
}

// k-means：把一维数值切成 k 段并返回中心。用于恢复固定的选项行数。
function cluster1dInto(values, k, iterations = 40) {
  const sorted = Float64Array.from(values).sort();
  if (sorted.length < k) return [];
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.round(((i + 0.5) / k) * (sorted.length - 1))]);
  for (let step = 0; step < iterations; step++) {
    const buckets = Array.from({ length: k }, () => []);
    for (const v of sorted) {
      let best = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < k; i++) {
        const d = Math.abs(v - centers[i]);
        if (d < bestDistance) { bestDistance = d; best = i; }
      }
      buckets[best].push(v);
    }
    const next = buckets.map((bucket, i) => (bucket.length ? bucket.reduce((a, b) => a + b, 0) / bucket.length : centers[i]));
    if (next.every((c, i) => Math.abs(c - centers[i]) < 0.02)) { centers = next; break; }
    centers = next;
  }
  return centers.slice().sort((a, b) => a - b);
}

// ---------- 掩膜 ----------

// 铅笔涂黑：相对局部背景明显更暗、彩度低。用局部对比而不是全局阈值，
// 蓝色底纹的答题卡在全局阈值下会把整片背景算成墨。
export function inkMask(planes, options = {}) {
  const { width: W, height: H, gray, sat } = planes;
  const contrastCut = options.contrastCut ?? 24;
  const satCut = options.satCut ?? 90;
  const grayCut = options.grayCut ?? 210;
  const blur = boxFilter({ data: gray, W, H }, Math.max(9, Math.round(Math.min(W, H) / 38)));
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = blur.data[i] - gray[i] > contrastCut && sat[i] < satCut && gray[i] < grayCut ? 1 : 0;
  }
  return mask;
}

// 印刷字符与细线：暗但面积很小。用来定位选项行、给空白题留出位置。
export function printMask(planes) {
  const { width: W, height: H, gray, sat } = planes;
  const blur = boxFilter({ data: gray, W, H }, Math.max(5, Math.round(Math.min(W, H) / 110)));
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = blur.data[i] - gray[i] > 16 && gray[i] < 150 && sat[i] < 60 ? 1 : 0;
  }
  return mask;
}

// 蓝色答题区色带：行测答题卡的主体答题区印成浅蓝底，是整页最稳的锚点。
export function blueBands(planes) {
  const { width: W, height: H, data } = planes;
  const diff = new Int16Array(W * H);
  if (data && data.length === W * H * 4) {
    for (let i = 0, p = 0; i < W * H; i++, p += 4) diff[i] = data[p] - data[p + 2];
  } else {
    // 没有原始通道时用饱和度近似：蓝底彩度高于灰白纸面，但这条路径精度有限。
    const { sat } = planes;
    for (let i = 0; i < W * H; i++) diff[i] = sat[i] > 26 ? -20 : 0;
  }
  const blur = boxFilter({ data: Float32Array.from(diff, (v) => v), W, H }, Math.max(5, Math.round(Math.min(W, H) / 90)));
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = blur.data[i] < -8 ? 1 : 0;
  const bands = labelComponents(mask, { width: W, height: H }, Math.round(W * H * 0.004))
    .filter((c) => c.w > W * 0.45 && c.h > Math.min(W, H) * 0.025)
    .sort((a, b) => a.y0 - b.y0);
  return bands;
}

// ---------- 版式检测 ----------

// 铅笔斑块：填涂痕比印刷字大得多，且横向。
//
// 右侧的条码/定位标记会形成一串竖直等距的小块，和填涂痕尺寸相近，
// 必须按「结构」而不是位置剔除：同一个 x 附近、y 间距稳定小于 32px 的一串 ≥6 个，
// 就是条码，不是作答。位置判据（x > 0.93W）在纸张倾斜的照片上会误伤真实作答格。
function pencilMarks(components, options = {}) {
  if (!components.length) return [];
  const minArea = options.minArea ?? 240;
  const minFill = options.minFill ?? 0.6;
  // 尺度锚点取「实心横条」的中位宽度与中位面积，而不是全部连通域的中位宽度。
  // 高分辨率照片上印刷笔画有上千个，按全部连通域定阈值会把真实填涂块整批丢掉；
  // 面积下限也必须跟着锚点走，否则同一张卡在不同分辨率下会丢掉不同比例的填涂。
  const solid = components.filter((c) => c.fill > minFill && c.w >= c.h * 0.8 && c.w <= c.h * 4);
  const pool = solid.length >= 12 ? solid : components;
  const widths = pool.map((c) => c.w).sort((a, b) => a - b);
  const medw = widths[widths.length >> 1];
  const areas = pool.map((c) => c.area).sort((a, b) => a - b);
  const medArea = areas[areas.length >> 1];
  const areaLo = solid.length >= 12 ? medArea * 0.35 : Math.max(minArea, medw * medw * 0.3);
  const areaHi = solid.length >= 12 ? medArea * 3.5 : Infinity;
  const candidates = components.filter(
    (c) =>
      c.fill > minFill &&
      c.area >= areaLo && c.area <= areaHi &&
      c.w >= medw * 0.45 && c.w <= medw * 2.6 &&
      c.h >= 8 && c.h <= medw * 1.7 &&
      c.w >= c.h * 0.5 && c.w <= c.h * 3.6,
  );
  if (candidates.length < 12) return candidates;
  const barred = new Set();
  for (const a of candidates) {
    const chain = candidates
      .filter((b) => Math.abs(b.cx - a.cx) <= 20 && Math.abs(b.cy - a.cy) <= 220)
      .sort((x, y) => x.cy - y.cy);
    if (chain.length < 6) continue;
    const diffs = [];
    for (let i = 1; i < chain.length; i++) diffs.push(chain[i].cy - chain[i - 1].cy);
    const mean = diffs.reduce((x, y) => x + y, 0) / diffs.length;
    const sd = Math.sqrt(diffs.reduce((x, v) => x + (v - mean) ** 2, 0) / diffs.length);
    if (mean < 32 && sd < 5) for (const item of chain) barred.add(item);
  }
  return candidates.filter((c) => !barred.has(c));
}

// 照片是不是被横着拍的：看印刷文字的基线方向。
//
// 正放的纸上，文字和表格线都是横的，墨迹在 y 方向高度集中、在 x 方向铺得开；
// 横拍时正好相反。所以比较「行投影」和「列投影」的锐度（归一化平方和），
// 谁更锐，文字就朝谁的方向排。
export function textOrientation(planes) {
  const { width: W, height: H } = planes;
  const print = planes.print || printMask(planes);
  // 只看答題区：整页的行/列方差被标题和空白带偏，测不出文字方向。
  const x0 = Math.round(W * 0.12);
  const x1 = Math.round(W * 0.88);
  const y0 = Math.round(H * 0.15);
  const y1 = Math.round(H * 0.9);
  const rows = new Float64Array(Math.max(1, y1 - y0));
  const cols = new Float64Array(Math.max(1, x1 - x0));
  let total = 0;
  for (let y = y0; y < y1; y++) {
    const base = y * W;
    for (let x = x0; x < x1; x++) {
      if (print[base + x]) { rows[y - y0]++; cols[x - x0]++; total++; }
    }
  }
  if (total < 400) return null;
  // 文字行在「行投影」上形成细而高的峰，列投影则被摊平；
  // 用「峰值与均值的比」比方差更稳，不受整页墨量影响。
  const sharpness = (hist) => {
    let sum = 0;
    let max = 0;
    for (const v of hist) { sum += v; if (v > max) max = v; }
    const mean = sum / hist.length;
    return mean > 0 ? max / mean : 0;
  };
  return { rowPeak: sharpness(rows), colPeak: sharpness(cols), total };
}

// 按填涂斑块分布判断版式。
//   column  每题一列、4 个选项上下排 → 横向相邻的两个墨迹属于相邻两题，y 差约等于一两行选项高；
//   row     每题一行、4 个选项左右排 → 横向相邻的两个墨迹常常是同一题的相邻选项，y 差接近 0。
// 所以看横向相邻墨迹的 y 差分布：多数差值有一个可测的正距离 → column。
//
// 用全页墨迹而不是只看第一块：白底卡的答题区可能不在 paperBox 的第一等分里，
// 只取第一块会拿到空区域，版式判断直接返回 null。
export function detectLayout(marks, blocks) {
  if (marks.length < 40) return null;
  const sorted = [...marks].sort((a, b) => a.cx - b.cx);
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].cx - sorted[i - 1].cx);
  const gapTypical = median(gaps);
  const diffs = [];
  for (let i = 1; i < sorted.length; i++) {
    // 只要横向相邻：间隔接近组内列距，跳过题组之间的空档。
    if (sorted[i].cx - sorted[i - 1].cx > gapTypical * 1.6) continue;
    diffs.push(Math.abs(sorted[i].cy - sorted[i - 1].cy));
  }
  if (diffs.length < 6) return null;
  const separation = median(diffs);
  // column 版式：相邻两题隔着一两行选项，中位差在 20–70px；row 版式：多数相邻选项同排，差接近个位数。
  return {
    style: separation >= 14 ? "column" : "row",
    separation,
    optionGap: gapTypical,
  };
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// 定位答题区：蓝带优先；没有蓝带时退回墨迹最密的水平段。
// 白纸纸面：按行/列亮度找连续的亮区。桌面和阴影比纸暗得多，阈值取全页亮度的中高分位。
function paperBox(planes) {
  const { width: W, height: H, gray } = planes;
  const rowMean = new Float64Array(H);
  const colMean = new Float64Array(W);
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = 0; x < W; x++) sum += gray[y * W + x];
    rowMean[y] = sum / W;
  }
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = 0; y < H; y++) sum += gray[y * W + x];
    colMean[x] = sum / H;
  }
  const bright = Math.max(percentile(rowMean, 0.5), percentile(colMean, 0.5));
  const cut = bright * 0.78;
  const span = (values) => {
    const on = [];
    for (let i = 0; i < values.length; i++) if (values[i] >= cut) on.push(i);
    if (on.length < values.length * 0.3) return null;
    // 取最长连续段，容忍少量暗缝（文字行会压低局部均值）。
    let best = null;
    let start = on[0];
    let prev = on[0];
    for (let i = 1; i < on.length; i++) {
      if (on[i] - prev > 40) {
        if (!best || prev - start > best[1] - best[0]) best = [start, prev];
        start = on[i];
      }
      prev = on[i];
    }
    if (!best || prev - start > best[1] - best[0]) best = [start, prev];
    return best;
  };
  const rows = span(rowMean);
  const cols = span(colMean);
  if (!rows || !cols) return null;
  if (rows[1] - rows[0] < H * 0.3 || cols[1] - cols[0] < W * 0.3) return null;
  return { left: cols[0], top: rows[0], right: cols[1], bottom: rows[1] };
}

// 在纸面框里找真正的答题区：涂黑痕集中在中下部，标题区只有稀疏文字。
// 用行墨迹量的累计分布切出「中间 80% 墨迹」所在的上下界，再各留 6% 余量。
function refineToAnswerStrip(planes, box, ink) {
  const { width: W } = planes;
  const top = Math.max(0, Math.round(box.top));
  const bottom = Math.min(planes.height - 1, Math.round(box.bottom));
  if (bottom - top < 60) return null;
  const rowInk = new Float64Array(bottom - top + 1);
  for (let y = top; y <= bottom; y++) {
    let count = 0;
    for (let x = 0; x < W; x++) count += ink[y * W + x];
    rowInk[y - top] = count;
  }
  const total = rowInk.reduce((a, b) => a + b, 0);
  if (total < 200) return null;
  let acc = 0;
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < rowInk.length; i++) {
    acc += rowInk[i];
    if (lo < 0 && acc >= total * 0.1) lo = i;
    if (hi < 0 && acc >= total * 0.9) hi = i;
  }
  if (lo < 0 || hi < 0 || hi <= lo) return null;
  const pad = Math.round((hi - lo) * 0.06);
  const stripTop = top + Math.max(0, lo - pad);
  const stripBottom = top + Math.min(rowInk.length - 1, hi + pad);
  if (stripBottom - stripTop < (bottom - top) * 0.2) return null;
  return { ...box, top: stripTop, bottom: stripBottom };
}

// 定位答题区：蓝带 → 白纸区域 → 墨迹密度带。
// 灰白底的答题卡没有蓝带，但纸面本身比桌面亮得多，用行/列亮度就能框出纸面。
export function detectSheet(planes) {
  const { width: W, height: H, gray } = planes;
  const bands = blueBands(planes);
  const ink = inkMask(planes);
  const inkPixels = ink.reduce((a, b) => a + b, 0);
  if (bands.length >= 2) {
    return {
      found: true,
      source: "blue-band",
      box: { left: Math.min(...bands.map((b) => b.x0)), top: bands[0].y0, right: Math.max(...bands.map((b) => b.x1)), bottom: bands[bands.length - 1].y1 },
      bands,
      ink,
      inkPixels,
    };
  }
  const paper = paperBox(planes);
  if (paper) {
    // 白纸框可能把标题区、桌面边缘一起框进来。真正的答题区是纸面里墨迹最密的水平段，
    // 用它再收一次上下边界。
    const refined = refineToAnswerStrip(planes, paper, ink);
    return { found: true, source: "paper", box: refined || paper, bands: [], ink, inkPixels };
  }
  const density = boxFilter({ data: Float32Array.from(ink), W, H }, Math.max(6, Math.round(Math.min(W, H) / 120)));
  const rowSums = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = 0; x < W; x++) sum += density.data[y * W + x];
    rowSums[y] = sum / W;
  }
  const peak = Math.max(...rowSums);
  if (peak < 0.02) return { found: false, reason: "no-ink" };
  const threshold = peak * 0.3;
  let top = -1, bottom = -1;
  for (let y = 0; y < H; y++) if (rowSums[y] >= threshold) { if (top < 0) top = y; bottom = y; }
  if (top < 0) return { found: false, reason: "no-band" };
  const columnSums = new Float64Array(W);
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = top; y <= bottom; y++) sum += density.data[y * W + x];
    columnSums[x] = sum / (bottom - top + 1);
  }
  let left = -1, right = -1;
  for (let x = 0; x < W; x++) if (columnSums[x] >= threshold * 0.55) { if (left < 0) left = x; right = x; }
  if (left < 0) return { found: false, reason: "no-column" };
  return {
    found: true,
    source: "ink-density",
    box: { left, top, right, bottom },
    bands: [],
    ink,
    inkPixels,
  };
}

// 把整页答案区切成 7 个行块。
//
// 答题区按大题块交替印成蓝底和浅底，所以「蓝段 + 浅段」交替出现正好对应 7 个块。
// 蓝底比白纸明显偏蓝，用 R−B 的竖向均值就能把两种底色分开，不必依赖印刷线条。
// 没有蓝底的白纸卡退回墨迹密度带。
export function splitBlocks(planes, sheet) {
  const { width: W, height: H, data } = planes;
  const { top, bottom } = sheet.box;
  const span = bottom - top;
  if (span < H * 0.2) return null;
  // 只有确认存在蓝底色带（source === "blue-band"）时才用双底色分段。
  // 白底红框的卡上，红线和暖色阴影同样会形成「交替段」，按它切块会切出
  // 195/54/92px 这种长短不一的假块，整份答案错位。
  if (sheet.source === "blue-band" && data && data.length === W * H * 4) {
    const segmented = colorSegments(planes, top, bottom);
    if (segmented) return segmented;
  }
  return Array.from({ length: BLOCK_COUNT }, (_, i) => ({ top: top + (span * i) / BLOCK_COUNT, bottom: top + (span * (i + 1)) / BLOCK_COUNT }));
}

// 用 R−B 的竖向均值找蓝底与浅底的交替段落。
function colorSegments(planes, top, bottom) {
  const { width: W, data } = planes;
  const x0 = Math.round(W * 0.2);
  const x1 = Math.round(W * 0.8);
  const rows = [];
  for (let y = Math.round(top); y <= Math.round(bottom); y++) {
    let sum = 0;
    let n = 0;
    for (let x = x0; x < x1; x += 2) {
      const p = (y * W + x) * 4;
      sum += data[p] - data[p + 2];
      n++;
    }
    rows.push({ y, value: n ? sum / n : 0 });
  }
  // 平滑后按 0 附近分割：蓝底为负、浅底为正。
  const smoothed = rows.map((row, i) => {
    const lo = Math.max(0, i - 4);
    const hi = Math.min(rows.length - 1, i + 4);
    let sum = 0;
    for (let k = lo; k <= hi; k++) sum += rows[k].value;
    return { y: row.y, value: sum / (hi - lo + 1) };
  });
  const levels = smoothed.map((s) => s.value).sort((a, b) => a - b);
  const low = levels[Math.round((levels.length - 1) * 0.1)];
  const high = levels[Math.round((levels.length - 1) * 0.9)];
  if (high - low < 12) return null; // 没有明显的双底色
  const cut = (low + high) / 2;
  const segments = [];
  let start = smoothed[0].y;
  let blue = smoothed[0].value < cut;
  for (let i = 1; i < smoothed.length; i++) {
    const nowBlue = smoothed[i].value < cut;
    if (nowBlue !== blue) {
      segments.push({ top: start, bottom: smoothed[i].y, blue });
      start = smoothed[i].y;
      blue = nowBlue;
    }
  }
  segments.push({ top: start, bottom: smoothed[smoothed.length - 1].y, blue });
  // 丢掉过薄的毛刺段（印刷边框、阴影）。
  const minHeight = (bottom - top) * 0.04;
  const kept = segments.filter((s) => s.bottom - s.top >= minHeight);
  if (kept.length < BLOCK_COUNT) return null;
  if (kept.length === BLOCK_COUNT) return kept;
  // 段数多于 7 时，把相邻的高度相近段合并到 7 段。
  while (kept.length > BLOCK_COUNT) {
    let bestIndex = 0;
    let bestHeight = Infinity;
    for (let i = 0; i < kept.length - 1; i++) {
      const merged = kept[i].bottom - kept[i].top + (kept[i + 1].bottom - kept[i + 1].top);
      if (merged < bestHeight) { bestHeight = merged; bestIndex = i; }
    }
    kept[bestIndex] = { top: kept[bestIndex].top, bottom: kept[bestIndex + 1].bottom, blue: kept[bestIndex].blue };
    kept.splice(bestIndex + 1, 1);
  }
  return kept;
}

// ---------- 判读 ----------

// 在 (cx, cy) 处取墨迹比例：比较填涂块与周围未填格。
function inkAt(sums, cx, cy, halfW, halfH) {
  return sums(cx - halfW, cy - halfH, cx + halfW, cy + halfH);
}

// 选项行的几何基准来自印刷的 [A][B][C][D] 字符行，而不是铅笔痕。
//
// 理由：涂黑只覆盖一个格子，同一行另外几个格子的字符还在，所以「标签行」始终可测；
// 铅笔痕的 y 受倾斜和笔迹形状影响，逐题猜行会整列错位。
// printedRowBands 在给定区域里找出印刷字符的 y 行带，返回每带中心。
export function printedRowBands(planes, region) {
  const { width: W } = planes;
  const print = planes.print || printMask(planes);
  const x0 = Math.max(0, Math.round(region.left));
  const x1 = Math.min(W, Math.round(region.right));
  const y0 = Math.max(0, Math.round(region.top));
  const y1 = Math.min(planes.height, Math.round(region.bottom));
  if (x1 - x0 < 8 || y1 - y0 < 8) return [];
  const profile = [];
  for (let y = y0; y < y1; y++) {
    let count = 0;
    for (let x = x0; x < x1; x++) count += print[y * W + x];
    profile.push({ y, count });
  }
  const peak = Math.max(...profile.map((p) => p.count));
  if (peak < 6) return [];
  const threshold = peak * 0.28;
  const bands = [];
  let start = -1;
  for (let i = 0; i < profile.length; i++) {
    const on = profile[i].count >= threshold;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      if (i - start >= 3) bands.push({ top: profile[start].y, bottom: profile[i - 1].y, peak: Math.max(...profile.slice(start, i).map((p) => p.count)) });
      start = -1;
    }
  }
  if (start >= 0 && profile.length - start >= 3) bands.push({ top: profile[start].y, bottom: profile[profile.length - 1].y, peak: Math.max(...profile.slice(start).map((p) => p.count)) });
  // 紧邻的碎带合并（字符上下的细笔画会把一行切成两段）。
  const merged = [];
  for (const band of bands) {
    const last = merged[merged.length - 1];
    if (last && band.top - last.bottom <= 4) {
      last.bottom = band.bottom;
      last.peak = Math.max(last.peak, band.peak);
    } else merged.push({ ...band });
  }
  return merged.map((band) => {
    // 横向字符簇数：题号带只印 5 个数字（约 10 簇），选项带印 5 题 × 4 组 [x]（约 15–20 簇）。
    const occupied = new Uint8Array(x1 - x0);
    for (let y = band.top; y <= band.bottom; y++) {
      for (let x = x0; x < x1; x++) if (print[y * W + x]) occupied[x - x0] = 1;
    }
    let clusters = 0;
    let inside = false;
    for (const value of occupied) {
      if (value && !inside) clusters++;
      inside = value === 1;
    }
    return { top: band.top, bottom: band.bottom, center: (band.top + band.bottom) / 2, peak: band.peak, clusters };
  });
}

// 列式版式：每题一列，4 个选项上下排。
//
// 一整块 = 4 个题组 × 5 列。每个题组用自己的印刷标签行作为 4 条选项行，
// 再把每列的填涂块落到最近的一条上。
// 把一块里的题列切成 4 组：取 x 方向上最大的 3 个间隙作为组边界。
function splitIntoFourGroups(cells) {
  if (cells.length <= 4) return [cells];
  const gaps = [];
  for (let i = 1; i < cells.length; i++) gaps.push({ at: i, size: cells[i].cx - cells[i - 1].cx });
  // 组间列距明显大于组内列距（实测 2.5–3 倍）。只在明显大的间隙处切：一块
  // 20 题的块常常只有其中两组有人作答，强行切成 4 组会把一整组拆散，
  // 答案落到相邻组的题号上。
  const typical = median(gaps.map((g) => g.size));
  const cuts = gaps
    .filter((g) => g.size >= Math.max(typical * 2.2, typical + 24))
    .sort((a, b) => b.size - a.size)
    .slice(0, 3)
    .map((g) => g.at)
    .sort((a, b) => a - b);
  const groups = [];
  let start = 0;
  for (const cut of cuts) {
    groups.push(cells.slice(start, cut));
    start = cut;
  }
  groups.push(cells.slice(start));
  return groups;
}

// 组内题位：count 个等距位置。空题、漏检会让格子的数量少于题数，
// 直接按顺序编号会整组错位，所以用格子本身拟合这几个位置。
function fitColumnSlots(cells, count) {
  if (!cells.length) return null;
  const first = cells[0].cx;
  const last = cells[cells.length - 1].cx;
  let best = null;
  for (let pitch = 24; pitch <= 48; pitch += 0.25) {
    for (let shift = 0; shift < count; shift++) {
      const start = first - shift * pitch;
      if (start + (count - 1) * pitch < last - pitch * 0.6) continue;
      let cost = 0;
      for (const cell of cells) {
        let nearest = Infinity;
        for (let i = 0; i < count; i++) nearest = Math.min(nearest, Math.abs(cell.cx - (start + i * pitch)));
        cost += nearest;
      }
      if (!best || cost < best.cost) best = { cost, pitch, start };
    }
  }
  if (!best) return null;
  return Array.from({ length: count }, (_, i) => best.start + i * best.pitch);
}

// 保留的候选行网格数量：足够覆盖「残差相近但相位不同」的几种拟合。
const GRID_POOL = 24;

function pickGridByMargin(candidates, groups, sums, halfW, halfH) {
  let best = null;
  for (const candidate of candidates) {
    let score = 0;
    for (let g = 0; g < groups.length; g++) {
      const base = candidate.base + g * candidate.groupStep;
      const rows = Array.from({ length: OPTION_ROWS }, (_, r) => base + r * candidate.pitch);
      for (const cell of groups[g]) {
        const values = rows.map((y) => inkAt(sums, cell.cx, y, halfW, halfH));
        const sorted = [...values].sort((a, b) => b - a);
        score += sorted[0] - sorted[1];
      }
    }
    if (!best || score > best.score) best = { ...candidate, score };
  }
  return best;
}

function readColumnBlock(marks, block, style, sums, planes, debugBlocks) {
  const { width: W } = planes;
  const inBlock = marks.filter((m) => m.cy >= block.top - 14 && m.cy <= block.bottom + 14 && m.cx < W * 0.94);
  const answers = new Array(COLUMNS_PER_BLOCK).fill(null);
  if (inBlock.length < OPTION_ROWS) return { answers, columns: 0, read: 0 };

  // 一、题列：同一题的墨迹在 x 上聚成一列。
  const columns = [];
  const sorted = [...inBlock].sort((a, b) => a.cx - b.cx);
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].cx - current[current.length - 1].cx > 24) { columns.push(current); current = []; }
    current.push(sorted[i]);
  }
  columns.push(current);
  // 行块上下相邻，上一块的 D 行会从 y 窗口的下缘漏进来，同一题列因此可能有两个
  // 墨迹。取离本块中心最近的那个：漏进来的墨迹在块外一整个行距，离中心远。
  const centerY = (block.top + block.bottom) / 2;
  const cells = columns.map((group) => {
    let pick = group[0];
    for (const mark of group) {
      if (Math.abs(mark.cy - centerY) < Math.abs(pick.cy - centerY)) pick = mark;
    }
    return { cx: pick.cx, cy: pick.cy, width: pick.w, height: pick.h };
  });

  // 二、题组：一块固定 4 组 × 5 题。组间列距最大，取最大的 3 个间隙作组边界。
  // 不能靠「间距是否超过阈值」判定：空白题会让组内出现大间隙，阈值法会把一组拆成两组。
  const groups = splitIntoFourGroups(cells);

  // 三、整块联合拟合行网格：第 g 组第 r 行的 y = base + g*groupStep + r*pitch。
  // 逐组单独估行距会被缺题和透视线带偏；整块一起拟合时四组互相约束，
  // 残差最小的那组参数就是真实行网格。groupStep 允许非零，因为同一块内
  // 相邻组在照片上会略微下移。
  const halfW = Math.max(10, Math.round(median(cells.map((c) => c.width)) * 0.45));
  const halfH = Math.max(5, Math.round(median(cells.map((c) => c.height)) * 0.35));
  const ysAll = cells.map((c) => c.cy);
  const yMin = Math.min(...ysAll);
  // 「残差最小」不等于「压在真实选项行上」：题列的 cy 由填涂项决定，行网格
  // 整体错开一个行距时残差也可能很小。而且一两个杂点（标签碎片、透印）会把
  // 最低格子拉低一两个行距，真实 A 行反而落在 base 搜索窗之外，整块答案平移。
  // 所以 base 窗口向下放宽，先按 (行距, 组偏移) 各留一个残差最小的网格，
  // 再用填涂对比度挑——网格压对时正确选项的墨迹明显最高，错一格则分摊到相邻两行。
  const shortlist = [];
  for (let pitch = 22; pitch <= 42; pitch += 0.5) {
    for (let groupStep = -40; groupStep <= 40; groupStep += 2) {
      let best = null;
      for (let base = yMin - pitch * 0.6; base <= yMin + pitch * 2.4; base += 1) {
        let cost = 0;
        for (let g = 0; g < groups.length; g++) {
          for (const cell of groups[g]) {
            let nearest = Infinity;
            for (let r = 0; r < OPTION_ROWS; r++) {
              nearest = Math.min(nearest, Math.abs(cell.cy - (base + g * groupStep + r * pitch)));
            }
            cost += nearest;
          }
        }
        if (!best || cost < best.cost) best = { cost, pitch, groupStep, base };
      }
      shortlist.push(best);
    }
  }
  shortlist.sort((a, b) => a.cost - b.cost);
  const grid = pickGridByMargin(shortlist.slice(0, GRID_POOL), groups, sums, halfW, halfH);
  if (!grid) return { answers, columns: cells.length, read: 0 };

  // 四、按拟合出的行网格复核：每个格子在 4 条候选行上取墨迹，最高者即答案。
  // 同时要求「最高行」与「离填涂块最近的行」一致，两者冲突时不猜。
  let readCount = 0;
  const debugPicks = debugBlocks ? [] : null;
  for (let g = 0; g < groups.length; g++) {
    const base = grid.base + g * grid.groupStep;
    const rows = Array.from({ length: OPTION_ROWS }, (_, r) => base + r * grid.pitch);
    // 组内 5 个题位等距。空白题不会留下墨迹，靠「按顺序数格子」会把后面的题全部错位，
    // 所以先用本组的格子拟合 5 个题位，再把每个格子落到最近的题位上。
    const slots = fitColumnSlots(groups[g], GROUP_SIZE);
    for (const cell of groups[g]) {
      const values = rows.map((y) => inkAt(sums, cell.cx, y, halfW, halfH));
      const top = values.indexOf(Math.max(...values));
      const others = values.filter((_, r) => r !== top);
      const margin = values[top] - Math.max(...others);
      const nearest = rows.reduce((best, y, r) => (Math.abs(cell.cy - y) < Math.abs(cell.cy - rows[best]) ? r : best), 0);
      let slot = GROUP_SIZE - 1;
      if (slots) {
        slot = 0;
        for (let i = 1; i < GROUP_SIZE; i++) {
          if (Math.abs(cell.cx - slots[i]) < Math.abs(cell.cx - slots[slot])) slot = i;
        }
      } else slot = Math.min(groups[g].indexOf(cell), GROUP_SIZE - 1);
      const index = g * GROUP_SIZE + slot;
      if (debugPicks) {
        debugPicks.push({
          index,
          cx: Math.round(cell.cx),
          cy: Math.round(cell.cy),
          values: values.map((v) => Math.round(v)),
          top,
          nearest,
          margin: Math.round(margin),
          rows: rows.map((y) => Math.round(y)),
        });
      }
      if (margin > 0.2 && nearest === top && index < COLUMNS_PER_BLOCK) {
        answers[index] = { option: OPTIONS[top], confidence: clamp01(margin), values };
        readCount++;
      }
    }
  }
  if (debugBlocks) {
    debugBlocks.push({
      block: block.index ?? null,
      columns: cells.length,
      groups: groups.map((g) => g.map((c) => [Math.round(c.cx), Math.round(c.cy)])),
      grid: { pitch: grid.pitch, groupStep: grid.groupStep, base: Math.round(grid.base), cost: Math.round(grid.cost), score: Math.round(grid.score) },
      picks: debugPicks,
    });
  }
  return { answers, columns: cells.length, read: readCount, grid };
}

// ---------- 行式版式 ----------
//
// 白底公务员答题卡是「每题一行、4 个选项横排」：一列纵向排 5 题，4 列并排
// 组成一个 20 题的块，共 7 块。手机拍这类卡会带 2–6° 倾斜和透视，
// 同一行墨迹在照片上是斜的（一张卡能斜出 30px，比行距还大），
// 所以先按「行投影最锐」估一个剪切量，把坐标映射回水平行再谈几何。

// 1px 腐蚀：表格红线只有 1–2px 粗，会和涂黑块连成一片，
// 腐蚀后红线断开，涂黑块仍是独立连通域。
function erode1(mask, { width: W, height: H }) {
  const out = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (mask[i] && mask[i - 1] && mask[i + 1] && mask[i - W] && mask[i + W]) out[i] = 1;
    }
  }
  return out;
}

// 填涂块：形状接近横条。尺寸阈值按本图的中位面积自适应，
// 写死面积在白底卡上会把一半填涂判成噪点（这类卡的格子只有 20×10px）。
function fillMarks(components) {
  const base = components.filter(
    (c) => c.fill > 0.5 && c.w >= 10 && c.w <= 90 && c.h >= 6 && c.h <= 40 && c.w >= c.h * 0.8 && c.w <= c.h * 4,
  );
  if (base.length < 12) return base;
  const areas = base.map((c) => c.area).sort((a, b) => a - b);
  const medArea = areas[areas.length >> 1];
  return base.filter((c) => c.area >= medArea * 0.35 && c.area <= medArea * 3.5);
}

// 行投影锐度最大的剪切量。斜着拍的卡上，一行墨迹被摊到十几行像素里；
// 剪切对齐后它们落回同一条线，投影平方和出现明显峰值。
function estimateRowShear(marks, W) {
  const score = (slope) => {
    const ys = marks.map((m) => m.cy + slope * (m.cx - W / 2)).sort((a, b) => a - b);
    let total = 0;
    for (let i = 0; i < ys.length; ) {
      let j = i;
      while (j + 1 < ys.length && ys[j + 1] - ys[i] < 9) j++;
      total += (j - i + 1) ** 2;
      i = j + 1;
    }
    return total;
  };
  let best = { slope: 0, value: score(0) };
  for (let s = -0.1; s <= 0.1001; s += 0.004) {
    const value = score(s);
    if (value > best.value) best = { slope: s, value };
  }
  for (let s = best.slope - 0.004; s <= best.slope + 0.0041; s += 0.0004) {
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

// 一行里的墨迹簇。题号、[A]、涂黑块各是一簇：
// 未涂的选项是细笔画（质量 10–60），涂黑块是实心块（质量 150–350），
// 所以「最重的一簇」就是这一题涂的选项。
function rowRuns(ink, { width: W, height: H }, rowY, x0, x1, slope = 0, halfBand = 8) {
  const prof = new Float64Array(W);
  for (let x = x0; x < x1; x++) {
    // rowY 是去斜后的行坐标，读原图时要按剪切量还原回这条线在照片上的位置。
    const center = rowY - slope * (x - W / 2);
    for (let dy = -halfBand; dy <= halfBand; dy++) {
      const y = Math.round(center + dy);
      if (y >= 0 && y < H) prof[x] += ink[y * W + x];
    }
  }
  const runs = [];
  let start = -1;
  for (let x = x0; x < x1; x++) {
    const on = prof[x] >= 2;
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
    if (last && run.lo - last.hi <= 9) {
      last.hi = run.hi;
      last.mass += run.mass;
      last.cx = (last.lo + last.hi) / 2;
    } else merged.push({ ...run });
  }
  return merged;
}

// 选项格定位。
//
// 一块里 4 个题列的选项间距相同（同一张表，透视变化很慢），所以先联合估一个
// 全块共用的 pitch，再逐列只定相位 x0。单独给每列拟合 (x0, pitch) 会各自
// 锁到不同的错误间距上（实测同一块里出现 26/34.5/30/32 四种结果）。
// 打分按墨迹质量加权：涂黑块的簇远重于印刷字符，但字符负责定住相位。
function fitBlockLattices(columnsRuns, x0s, x1s) {
  const scoreColumn = (g, start, pitch) => {
    let score = 0;
    for (const runs of columnsRuns[g]) {
      for (const run of runs) {
        let nearest = Infinity;
        for (let q = 0; q < OPTION_ROWS; q++) nearest = Math.min(nearest, Math.abs(run.cx - (start + q * pitch)));
        if (nearest < 14) score += (14 - nearest) * (0.6 + Math.min(run.mass, 300) / 300);
      }
    }
    return score;
  };
  // 相位取「最靠左的自洽解」：表格右边框和选项格等距，会把整条格子往右推一格，
  // 两种相位得分只差几个百分点。选项 A 一定在题列最左边，所以取左侧的那个。
  const bestPhase = (g, pitch) => {
    const scores = [];
    for (let start = x0s[g]; start <= x1s[g] - 3 * pitch; start += 0.5) {
      scores.push({ start, score: scoreColumn(g, start, pitch) });
    }
    if (!scores.length) return null;
    let best = scores[0];
    for (const item of scores) if (item.score > best.score) best = item;
    for (const item of scores) {
      if (item.start < best.start && item.score >= best.score * 0.85) return item;
    }
    return best;
  };
  let overall = null;
  for (let pitch = 28; pitch <= 42; pitch += 0.25) {
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
  if (!overall) return null;

  // 相位校正：4 列的选项格沿横向等距排列，某一列整体偏了整整一格时，
  // 它单看也能自洽（选项 A 的题号会和 [A] 连在一起，把相位往左拽半格）。
  // 用其余 3 列外推这一列应在的位置，偏了接近一格就拉回来。
  const phases = [...overall.phases];
  const n = phases.length;
  const meanG = (n - 1) / 2;
  const meanS = phases.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
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
      // 偏离整格的相位通常得分只差几个百分点，几何约束优先；
      // 只有明显更差（说明外推本身被透视带偏）才保留原位。
      if (scoreColumn(g, shifted, overall.pitch) >= scoreColumn(g, phases[g], overall.pitch) * 0.85) phases[g] = shifted;
    }
  }
  return {
    pitch: overall.pitch,
    x: phases.map((start) => Array.from({ length: OPTION_ROWS }, (_, q) => start + q * overall.pitch)),
  };
}

// 题列中心：k-means 对离群点敏感（页面左侧的二维码碎块会把第一列拽走），
// 所以先聚一次，丢掉只有 1 个点的簇，再在剩下的点上重聚。
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

function kmeans1d(values, k, iterations = 40) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return [];
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor((i + 0.5) * sorted.length / k))]);
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

// 行式整卡判读。
export function readRowSheet(planes, options = {}) {
  const { width: W, height: H } = planes;
  const ink = options.ink || inkMask(planes);
  const marks = options.marks
    || fillMarks(labelComponents(erode1(ink, planes), { width: W, height: H }, 40));
  const warnings = [];
  const questions = new Array(QUESTION_COUNT).fill(null).map((_, i) => ({ number: i + 1, answer: null, confidence: 0 }));
  const empty = (reason) => ({
    questions,
    layout: { engine: "omr-v2", style: "row", rows: 0, blocks: 0, shear: 0, optionGap: 0 },
    warnings: [...warnings, reason],
  });
  if (marks.length < 40) return empty("没有找到足够的填涂痕迹。");

  // 二、题行：反复丢掉稀疏行（页眉手写、二维码碎块），再按 5 行为一块切开。
  const denseRows = (list, shift) => {
    let rows = clusterRows(list.map((m) => ({ ...m, y: m.cy + shift * (m.cx - W / 2) })), 9);
    for (let pass = 0; pass < 4; pass++) {
      const kept = rows.filter((row) => row.length >= 3);
      if (kept.length === rows.length) break;
      if (!kept.length) return [];
      rows = clusterRows(kept.flat(), 9);
    }
    return rows;
  };
  // 选连续 35 行：墨迹越密越好，同时惩罚不规则的断档。
  // 页眉手写也是一行 12 个墨迹，只按密度会把它选进来；它和答题区之间隔着大半个页面。
  const pickWindow = (rows) => {
    const info = rows.map((row) => ({ y: row.reduce((a, b) => a + b.y, 0) / row.length, items: row }));
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

  // 一、剪切：页眉手写和二维码碎块会把角度带偏。
  // 先用全部墨迹粗估，选出答题行以后再用这些行的墨迹重估，直到角度稳定。
  let slope = estimateRowShear(marks, W);
  let window = pickWindow(denseRows(marks, slope));
  for (let pass = 0; pass < 3 && window.length; pass++) {
    const refined = estimateRowShear(window.flatMap((row) => row.items), W);
    if (Math.abs(refined - slope) < 0.0015) break;
    slope = refined;
    window = pickWindow(denseRows(marks, slope));
  }
  if (window.length < ROW_GROUP_ROWS) return empty("没有找到成行的填涂痕迹。");
  const blockCount = Math.floor(window.length / ROW_GROUP_ROWS);

  // 三、右侧竖条码：x 上最靠右、与左侧墨迹隔着 45px 以上、自己又很窄的一簇。
  // 它和最后一列题隔着条形码留白（实测 ≥50px），列与列之间只隔一个选项间距。
  // 单独一块判断会被「最后一列全填同一个选项」骗到，所以再要求各块的条码位置
  // 随块号单调右移（纸是斜放的），过不了这条全局校验就一块也不动。
  // 页面左侧的二维码、装订线碎块会落在第一列左边很远的位置，把题列聚类拽偏。
  // 每一行最左边那个墨迹就是第一列的作答，取各行最小 x 的中位数做左护栏。
  const blocks = [];
  for (let b = 0; b < blockCount; b++) {
    const rows = window.slice(b * ROW_GROUP_ROWS, (b + 1) * ROW_GROUP_ROWS);
    const mins = rows.filter((row) => row.items.length).map((row) => Math.min(...row.items.map((m) => m.cx)));
    const cut = mins.length ? median(mins) - 150 : 0;
    blocks.push(rows.map((row) => ({ ...row, items: row.items.filter((m) => m.cx >= cut) })));
  }
  const ladders = blocks.map((block) => {
    const marks = block.flatMap((row) => row.items);
    if (marks.length < 12) return null;
    const xs = [...marks].sort((a, b) => a.cx - b.cx);
    let j = xs.length - 1;
    while (j > 0 && xs[xs.length - 1].cx - xs[j - 1].cx <= 28) j--;
    const group = xs.slice(j);
    if (group.length >= 3 && j > 0 && group[0].cx - xs[j - 1].cx >= 45) return group;
    return null;
  });
  const found = ladders.map((g, i) => (g ? { i, x: g.reduce((a, m) => a + m.cx, 0) / g.length } : null)).filter(Boolean);
  const consistent = found.length >= Math.max(4, blockCount - 2)
    && found.every((item, i) => i === 0 || item.x >= found[i - 1].x - 12);
  if (!consistent) ladders.fill(null);
  const ladderDebug = ladders.map((g) => (g ? Math.round(g.reduce((a, m) => a + m.cx, 0) / g.length) : 0));

  // 四、逐块：4 个题列 → 选项格 → 每行最重的一簇。
  let blocksRead = 0;
  const latticeDebug = [];
  const blockDebug = [];
  for (let b = 0; b < blockCount; b++) {
    const block = blocks[b];
    const all = block.flatMap((row) => row.items);
    const ladder = ladders[b];
    const left = Math.max(1, Math.round(Math.min(...all.map((m) => m.cx))) - 120);
    const right = Math.min(W - 1, ladder ? Math.round(Math.min(...ladder.map((m) => m.cx))) - 8 : W - 1);
    // 题列边界用印刷字符定：整列空白时墨迹聚类会把两列并成一列，
    // 但 [A][B][C][D] 和题号一定印在纸上。把 5 行的字符簇并起来，
    // 列与列之间隔着 ~55px 留白，列内最大间隔只有 ~35px。
    const fullRuns = block.map((row) => rowRuns(ink, planes, row.y, left, right, slope));
    const spans = [];
    for (const runs of fullRuns) for (const run of runs) spans.push([run.lo, run.hi]);
    spans.sort((a, c) => a[0] - c[0]);
    const mergedSpans = [];
    for (const span of spans) {
      const last = mergedSpans[mergedSpans.length - 1];
      if (last && span[0] - last[1] <= 18) last[1] = Math.max(last[1], span[1]);
      else mergedSpans.push([...span]);
    }
    const gaps = [];
    for (let i = 1; i < mergedSpans.length; i++) gaps.push({ at: i, size: mergedSpans[i][0] - mergedSpans[i - 1][1] });
    const cuts = gaps.filter((g) => g.size >= 32).sort((a, c) => c.size - a.size).slice(0, 3).map((g) => g.at).sort((a, c) => a - c);
    const bounds = [];
    let start = 0;
    for (const cut of cuts) { bounds.push([mergedSpans[start][0], mergedSpans[cut - 1][1]]); start = cut; }
    bounds.push([mergedSpans[start][0], mergedSpans[mergedSpans.length - 1][1]]);
    let groupBounds = bounds.length === 4 && cuts.length === 3
      ? [bounds[0][0], bounds[1][0], bounds[2][0], bounds[3][0], bounds[3][1] + 6]
      : null;
    if (!groupBounds) {
      // 兜底：印刷字符没分干净时回到墨迹聚类。
      const items = ladder ? all.filter((m) => !ladder.includes(m)) : all;
      const columns = columnCenters(items.map((m) => m.cx), 4);
      if (columns.length < 4) continue;
      groupBounds = [columns[0] - 80, (columns[0] + columns[1]) / 2, (columns[1] + columns[2]) / 2, (columns[2] + columns[3]) / 2, columns[3] + 85];
      if (ladder) groupBounds[4] = Math.min(groupBounds[4], Math.min(...ladder.map((m) => m.cx)) - 10);
    }
    if (options.debug) blockDebug.push({ b, marks: all.length, ladder: ladder ? ladder.length : 0, bounds: groupBounds.map((v) => Math.round(v)) });

    const x0s = groupBounds.slice(0, 4).map((v) => Math.max(1, Math.round(v) + 6));
    const x1s = groupBounds.slice(1, 5).map((v) => Math.min(W - 1, Math.round(v)));
    const columnsRuns = x0s.map((x0, g) => fullRuns.map((runs) => runs.filter((r) => r.hi >= x0 && r.lo < x1s[g])));
    const fit = fitBlockLattices(columnsRuns, x0s, x1s);

    let read = 0;
    for (let g = 0; g < 4; g++) {
      const runsPerRow = columnsRuns[g];
      if (!runsPerRow.length || !fit || !fit.x[g]) continue;
      const lattice = { x: fit.x[g], pitch: fit.pitch };
      if (options.debug) latticeDebug.push({ b, g, pitch: +lattice.pitch.toFixed(1), x: lattice.x.map((v) => Math.round(v)) });
      // 一题一题判：用这一行的墨迹斑块（填涂如果和相邻印刷字连成一簇，
      // 簇心会偏到两格中间），所以答案位置取斑块中心，不取簇心。
      const picked = block.map((row) => {
        const inColumn = row.items.filter((m) => m.cx >= x0s[g] - 6 && m.cx < x1s[g] && (!ladder || !ladder.includes(m)));
        if (!inColumn.length) return null;
        let top = null;
        for (const mark of inColumn) {
          let q = 0;
          for (let k = 1; k < OPTION_ROWS; k++) if (Math.abs(mark.cx - lattice.x[k]) < Math.abs(mark.cx - lattice.x[q])) q = k;
          const distance = Math.abs(mark.cx - lattice.x[q]);
          if (!top || distance < top.distance) top = { mark, q, distance };
        }
        return top;
      });
      for (let r = 0; r < block.length; r++) {
        const top = picked[r];
        if (!top) continue;
        read++;
        if (top.distance > lattice.pitch * 0.45) continue;
        const index = b * COLUMNS_PER_BLOCK + g * ROW_GROUP_ROWS + r;
        if (index >= QUESTION_COUNT) continue;
        questions[index] = {
          number: index + 1,
          answer: OPTIONS[top.q],
          confidence: clamp01(1 - top.distance / (lattice.pitch * 0.45)),
        };
      }
    }
    if (read >= 12) blocksRead++;
  }

  const answered = questions.filter((q) => q.answer).length;
  if (blocksRead < blockCount) warnings.push(`只读清了 ${blocksRead}/${blockCount} 个答题块。`);
  if (answered < QUESTION_COUNT * 0.5) warnings.push(`只识别出 ${answered}/${QUESTION_COUNT} 题，确认照片是否完整、光线是否足够。`);
  return {
    questions,
    layout: {
      engine: "omr-v2",
      style: "row",
      rows: window.length,
      blocks: blockCount,
      shear: Number(slope.toFixed(4)),
      optionGap: 0,
    },
    warnings,
    ...(options.debug ? { debug: { marks: marks.length, rows: window.length, slope, blocks: blockDebug, lattices: latticeDebug } } : {}),
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// 列式版式（蓝底答题区、每题一列、4 个选项竖排）的整卡判读。
function recognizeColumn(planes, sheet, style, ink, options = {}) {
  const debug = options.debug === true;
  const { width: W, height: H } = planes;
  const sums = integral({ data: Float32Array.from(ink), W, H });
  const components = labelComponents(ink, { width: W, height: H }, 90);
  // 右侧竖条码/定位块成串排列，会被误当成填涂。它们是页面最右侧的窄列，先剔掉。
  const marks = pencilMarks(components, options.markFilter || {}).filter((m) => m.cx < W * 0.94);
  const blocks = splitBlocks(planes, sheet);
  if (!style) {
    return {
      questions: [],
      layout: { engine: "omr-v2", box: sheet.box, groups: 0, style: null },
      warnings: ["没有找到足够的填涂痕迹。"],
      ...(debug ? { debug: { marks: marks.length, components: components.length } } : {}),
    };
  }
  if (!blocks) {
    return {
      questions: [],
      layout: { engine: "omr-v2", box: sheet.box, groups: 0, style: style.style },
      warnings: ["没有找到答题区。"],
      ...(debug ? { debug: { marks: marks.length, bands: (sheet.bands || []).length } } : {}),
    };
  }
  const readBlock = readColumnBlock;
  const debugBlocks = debug ? [] : null;
  const questions = new Array(QUESTION_COUNT).fill(null).map(() => ({ answer: null, confidence: 0 }));
  const warnings = [];
  let blocksRead = 0;
  for (let index = 0; index < blocks.length; index++) {
    const block = { ...blocks[index], index };
    const result = readBlock(marks, block, style, sums, planes, debugBlocks);
    if (!result) continue;
    const count = result.columns ?? result.rows ?? 0;
    if (count >= 4) blocksRead++;
    for (let i = 0; i < COLUMNS_PER_BLOCK; i++) {
      const cell = result.answers[i];
      const number = index * COLUMNS_PER_BLOCK + i + 1;
      if (cell && cell.option) {
        questions[number - 1] = { answer: cell.option, confidence: cell.confidence };
      }
    }
  }
  if (blocksRead < blocks.length) warnings.push(`只读清了 ${blocksRead}/${blocks.length} 个答题块。`);
  const answered = questions.filter((q) => q.answer).length;
  if (answered < QUESTION_COUNT * 0.5) warnings.push(`只识别出 ${answered}/${QUESTION_COUNT} 题，确认照片是否完整、光线是否足够。`);
  return {
    questions: questions.map((q, i) => ({ number: i + 1, ...q })),
    layout: { engine: "omr-v2", box: sheet.box, groups: blocksRead, style: style.style, optionGap: Math.round(style.optionGap) },
    warnings,
    ...(debug
      ? {
          debug: {
            marks: marks.length,
            components: components.length,
            blocks: blocks.map((b) => ({ top: Math.round(b.top), bottom: Math.round(b.bottom) })),
            grids: debugBlocks,
            style,
          },
        }
      : {}),
  };
}

// 识别整张答题卡：返回 140 题的答案与视图数据。
//
// 两种版式的几何完全不同，与其靠统计量猜版式，不如先用列式读：
// 蓝底卡一定走列式，而且列式读得像样时就没必要再试行式。
// 列式读不清（白底行式卡的典型结果）时才走行式，两者取答得多的那份。
export function recognizeSheet(planes, sheet, options = {}) {
  // 长边明显超出标定尺度时，原尺寸判读又慢又容易给出「像样但错」的结果
  // （实测 3000px 以上最多能错 30 题）。直接按候选尺度各读一次，取答得多的：
  // 行式卡行距小，要更大的绝对像素；列式卡在 1710 附近最稳。
  const pageLongEdge = Math.max(planes.width, planes.height);
  if (!options.noScale && pageLongEdge > OVERSIZE_LONG_EDGE) {
    let best = null;
    for (const target of SCALE_CANDIDATES) {
      const scaled = downscaleTo(planes, target);
      if (!scaled) continue;
      const scaledResult = recognizeSheet(scaled, detectSheet(scaled), { ...options, noScale: true });
      const count = scaledResult.questions.filter((q) => q.answer).length;
      if (!best || count > best.count) best = { result: scaledResult, count };
    }
    if (best) {
      best.result.layout = { ...best.result.layout, scaledFrom: pageLongEdge };
      return best.result;
    }
  }
  let current = planes;
  let currentSheet = sheet && sheet.found ? sheet : detectSheet(current);
  let rotation = 0;
  // 手机照片常被横拍、竖拍或拍倒了，JPEG 里又不一定写 Orientation。
  // 横拍（90°/270°）读不出任何东西，试一次就知道；拍倒（180°）却会读出
  // 一整份「像样但全错」的答案，必须靠版面方向先判出来，不能只比谁答得多。
  if (!options.noRotate) {
    // 横拍（90°/270°）：先按原方向读一次，读不出东西再转 90°。这两种方向下
    // 引擎会直接返回空，不会读出「像样但全错」的结果，所以试一次是安全的。
    const probe = recognizeOriented(current, currentSheet, { ...options, ink: currentSheet?.ink });
    if (probe.questions.filter((q) => q.answer).length < QUESTION_COUNT * 0.25) {
      const rotated = rotatePlanes(current, 1);
      const rotatedSheet = detectSheet(rotated);
      const attempt = recognizeOriented(rotated, rotatedSheet, { ...options, ink: rotatedSheet.ink });
      if (attempt.questions.filter((q) => q.answer).length > probe.questions.filter((q) => q.answer).length) {
        current = rotated;
        currentSheet = rotatedSheet;
        rotation = 90;
      }
    }
    // 拍倒（180°）：这个方向能读出完整答案，只是题序和选项全反，必须靠
    // 版面方向判出来。右侧条码的印刷密度是左右两侧的 2–3 倍，倒置时倒转。
    if (isUpsideDown(current)) {
      current = rotatePlanes(current, 2);
      currentSheet = detectSheet(current);
      rotation = (rotation + 180) % 360;
    }
  }
  const result = recognizeOriented(current, currentSheet, { ...options, ink: currentSheet?.ink });
  if (rotation) result.layout = { ...result.layout, rotation };
  if (options.noScale) return result;

  // 分辨率兜底：引擎的几何阈值在 1710–2048px 长边上标定过，阈值里既有相对量
  // 也有绝对像素。原尺寸读不满时按候选尺度重读，取答得多的那份；都不满就保留
  // 原结果并写明低置信，不静默给错答案。
  const answered = result.questions.filter((q) => q.answer).length;
  if (answered >= ANSWER_BAR) return result;
  let best = { result, count: answered };
  for (const target of SCALE_CANDIDATES) {
    const scaled = downscaleTo(planes, target);
    if (!scaled) continue;
    const scaledResult = recognizeSheet(scaled, detectSheet(scaled), { ...options, noScale: true });
    const count = scaledResult.questions.filter((q) => q.answer).length;
    if (count > best.count) best = { result: scaledResult, count };
  }
  if (best.result !== result) {
    best.result.layout = { ...best.result.layout, scaledFrom: Math.max(planes.width, planes.height) };
    return best.result;
  }
  result.warnings = [
    ...(result.warnings ?? []),
    `识别置信度低：只读出 ${answered}/${QUESTION_COUNT} 题，请确认照片完整、光线均匀，或裁到答题区再试。`,
  ];
  return result;
}

// 标定尺度：三张样张的长边是 1710–1920px。候选尺度两个就够：2048 给行距小的
// 行式卡，1710 给列式卡；再多试只会变慢。超过 2260 的图不再看原尺寸结果。
const ANSWER_BAR = QUESTION_COUNT * 0.75;
const SCALE_CANDIDATES = [2048, 1710];
const OVERSIZE_LONG_EDGE = 2260;

function downscaleTo(planes, targetLongEdge) {
  const { width: W, height: H } = planes;
  const longEdge = Math.max(W, H);
  // 只降不升——放大要插值，而填涂掩膜对插值很敏感；和目标差距不到 10% 也没意义。
  if (longEdge < targetLongEdge * 1.1) return null;
  const factor = targetLongEdge / longEdge;
  const outW = Math.max(64, Math.round(W * factor));
  const outH = Math.max(64, Math.round(H * factor));
  const gray = new Uint8Array(outW * outH);
  const sat = new Uint8Array(outW * outH);
  const data = planes.data ? new Uint8ClampedArray(outW * outH * 4) : null;
  // 面积平均：缩小本来就要抗锯齿，最近邻会把 1px 的表格线和印刷笔画整条丢掉。
  for (let y = 0; y < outH; y++) {
    const y0 = Math.floor((y * H) / outH);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * H) / outH));
    for (let x = 0; x < outW; x++) {
      const x0 = Math.floor((x * W) / outW);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * W) / outW));
      let g = 0;
      let s = 0;
      let r = 0;
      let gg = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * W;
        for (let xx = x0; xx < x1; xx++) {
          g += planes.gray[row + xx];
          s += planes.sat[row + xx];
          if (data) {
            const q = (row + xx) * 4;
            r += planes.data[q];
            gg += planes.data[q + 1];
            b += planes.data[q + 2];
          }
          n++;
        }
      }
      const di = y * outW + x;
      gray[di] = g / n;
      sat[di] = s / n;
      if (data) {
        const q = di * 4;
        data[q] = r / n;
        data[q + 1] = gg / n;
        data[q + 2] = b / n;
        data[q + 3] = 255;
      }
    }
  }
  return { width: outW, height: outH, gray, sat, data };
}

// 顺时针旋转 90°×turns。
function rotatePlanes(planes, turns) {
  const { width: W, height: H } = planes;
  const rotate90 = (source, w, h) => {
    const out = new source.constructor(h * w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) out[x * h + (h - 1 - y)] = source[y * w + x];
    }
    return out;
  };
  let gray = planes.gray;
  let sat = planes.sat;
  let data = planes.data;
  let w = W;
  let h = H;
  for (let turn = 0; turn < turns; turn++) {
    gray = rotate90(gray, w, h);
    sat = rotate90(sat, w, h);
    if (data) {
      const out = new Uint8ClampedArray(h * w * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const si = (y * w + x) * 4;
          const di = (x * h + (h - 1 - y)) * 4;
          out[di] = data[si];
          out[di + 1] = data[si + 1];
          out[di + 2] = data[si + 2];
          out[di + 3] = 255;
        }
      }
      data = out;
    }
    const nextW = h;
    h = w;
    w = nextW;
  }
  void planes.print;
  return { width: w, height: h, gray, sat, data };
}

// 判断照片是不是被上下颠倒。
//
// 这类答题卡右侧印着一条竖直的条码/定位梯，那一侧边缘的印刷密度是另一侧的 2–3 倍。
// 反过来时左右互换，指标随之倒转：实测正向 left/right ≈ 0.3，倒置 ≈ 3.0。
// 这个线索比「字正不正」好测——印刷字符的正反在灰度上完全没有差别。
function isUpsideDown(planes) {
  const { width: W, height: H } = planes;
  const print = planes.print || printMask(planes);
  const strip = Math.max(8, Math.round(W * 0.12));
  let left = 0;
  let right = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < strip; x++) left += print[y * W + x];
    for (let x = W - strip; x < W; x++) right += print[y * W + x];
  }
  if (left + right < H * strip * 0.02) return false;
  return left > right * 1.5;
}

function recognizeOriented(planes, sheet, options) {
  const ink = options.ink || sheet?.ink || inkMask(planes);
  const debug = options.debug === true;
  const forced = options.style;
  if (forced === "row") return readRowSheet(planes, { ...options, ink });

  const style = forced
    ? { style: forced, optionGap: options.optionGap || 0 }
    : detectLayout(pencilMarks(labelComponents(ink, { width: planes.width, height: planes.height }, 90)));
  const column = style ? recognizeColumn(planes, sheet, style, ink, options) : null;
  const columnAnswered = column ? column.questions.filter((q) => q.answer).length : 0;
  if (column && columnAnswered >= QUESTION_COUNT * 0.6) return column;

  const row = readRowSheet(planes, { ...options, ink });
  const rowAnswered = row.questions.filter((q) => q.answer).length;
  if (rowAnswered > columnAnswered) return row;
  return column || {
    questions: [],
    layout: { engine: "omr-v2", box: sheet.box, groups: 0, style: null },
    warnings: ["没有找到足够的填涂痕迹。"],
    ...(debug ? { debug: { marks: 0 } } : {}),
  };
}

export { GROUP_SIZE, OPTIONS, OPTION_ROWS, BLOCK_COUNT, COLUMNS_PER_BLOCK, QUESTION_COUNT, boxFilter, integral, percentile, cluster1d, cluster1dInto, labelComponents, pencilMarks };
