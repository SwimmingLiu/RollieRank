// 答题卡基础图像算子、光照不变暗度图与同步轨/蓝带特征提取。

export function boxFilter(source, radius) {
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

export function integral(source) {
  const { W, H, data } = source;
  const sums = new Float64Array((W + 1) * (H + 1));
  const stride = W + 1;
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    const srcOff = y * W;
    const prevOff = y * stride;
    const curOff = (y + 1) * stride;
    for (let x = 0; x < W; x++) {
      rowSum += data[srcOff + x];
      sums[curOff + x + 1] = sums[prevOff + x + 1] + rowSum;
    }
  }
  return (x0, y0, x1, y1) => {
    const ax = Math.max(0, Math.min(W, Math.round(x0)));
    const ay = Math.max(0, Math.min(H, Math.round(y0)));
    const bx = Math.max(0, Math.min(W, Math.round(x1)));
    const by = Math.max(0, Math.min(H, Math.round(y1)));
    if (bx <= ax || by <= ay) return 0;
    return (sums[by * stride + bx] - sums[ay * stride + bx] - sums[by * stride + ax] + sums[ay * stride + ax]) / ((bx - ax) * (by - ay));
  };
}

export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = Float64Array.from(values).sort();
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

export function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function relMad(values) {
  if (values.length < 3) return 0;
  const med = median(values);
  if (Math.abs(med) < 1e-6) return 1;
  const devs = values.map((v) => Math.abs(v - med));
  return median(devs) / Math.abs(med);
}

export function iqrRatio(values) {
  if (values.length < 4) return 0;
  const med = median(values);
  if (Math.abs(med) < 1e-6) return 1;
  return (percentile(values, 0.75) - percentile(values, 0.25)) / Math.abs(med);
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function labelComponents(mask, { width, height }, minArea) {
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

export function erode1(mask, { width: W, height: H }) {
  const out = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    const row = y * W;
    for (let x = 1; x < W - 1; x++) {
      const i = row + x;
      if (mask[i] && mask[i - 1] && mask[i + 1] && mask[i - W] && mask[i + W]) out[i] = 1;
    }
  }
  return out;
}

export function cluster1d(values, tol) {
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

export function cluster1dInto(values, k, iterations = 40) {
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

// 一次算出光照不变的相对暗度图、铅笔二值掩膜、以及包含红/蓝印刷字符的细墨迹掩膜。
// 相对暗度 (bg - gray) / bg 对阴影梯度和弱反光保持稳定；中性色权重抑制红/蓝印刷底纹。
export function buildFeatures(planes) {
  if (planes._features) return planes._features;
  const { width: W, height: H, gray, sat } = planes;
  const radius = Math.max(12, Math.round(Math.min(W, H) / 28));
  const blur = boxFilter({ data: gray, W, H }, radius).data;
  const len = W * H;
  const darkness = new Float32Array(len);
  const ink = new Uint8Array(len);
  const printOrInk = new Uint8Array(len);
  let inkPixels = 0;

  for (let i = 0; i < len; i++) {
    const bg = blur[i] > 35 ? blur[i] : 35;
    const drop = bg - gray[i];
    if (drop <= 6) continue;
    const rel = drop / bg;
    const g = gray[i];
    const s = sat[i];
    if (rel > 0.09 && drop > 10 && g < 212) {
      printOrInk[i] = 1;
    }
    if (g < 220 && s < 92) {
      const satW = s <= 42 ? 1 : (92 - s) / 50;
      const d = rel > 0.05 ? Math.min(1, (rel - 0.05) / 0.45) * satW : 0;
      darkness[i] = d;
      if (rel > 0.14 && drop > 12 && s < 85 && g < 215) {
        ink[i] = 1;
        inkPixels++;
      }
    }
  }

  const darkSums = integral({ data: darkness, W, H });
  const features = { blur, darkness, darkSums, ink, printOrInk, inkPixels };
  planes._features = features;
  return features;
}

export function inkMask(planes, options = {}) {
  if (!options.contrastCut && !options.satCut && !options.grayCut) {
    return buildFeatures(planes).ink;
  }
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

export function printMask(planes) {
  const { width: W, height: H, gray, sat } = planes;
  const blur = boxFilter({ data: gray, W, H }, Math.max(5, Math.round(Math.min(W, H) / 110)));
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = blur.data[i] - gray[i] > 16 && gray[i] < 150 && sat[i] < 60 ? 1 : 0;
  }
  return mask;
}

// 蓝色答题区色带（尺度与白平衡自适应：通过纵向局部 R−B 对比分离蓝/白交替块，
// 避免冷色 LED 下全页偏蓝导致 4 条蓝带粘连，也不受左右暖色桌面边缘影响）。
export function blueBands(planes) {
  const { width: W, height: H, data } = planes;
  const diff = new Float32Array(W * H);
  if (data && data.length === W * H * 4) {
    for (let i = 0, p = 0; i < W * H; i++, p += 4) diff[i] = data[p] - data[p + 2];
  } else {
    const { sat } = planes;
    for (let i = 0; i < W * H; i++) diff[i] = sat[i] > 26 ? -20 : 0;
  }
  const blur = boxFilter({ data: diff, W, H }, Math.max(4, Math.round(Math.min(W, H) / 110)));
  const sums = integral(blur);
  const vertR = Math.max(28, Math.round(H * 0.085));
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const val = blur.data[row + x];
      const vMean = sums(x, y - vertR, x + 1, y + vertR + 1);
      mask[row + x] = val - vMean < -5.5 && val < 8 ? 1 : 0;
    }
  }
  const minArea = Math.max(800, Math.round(W * H * 0.0012));
  const raw = labelComponents(mask, { width: W, height: H }, minArea)
    .filter((c) => c.w > W * 0.28 && c.h > H * 0.025 && c.h < H * 0.30)
    .sort((a, b) => a.y0 - b.y0);
  // 顺便测出每条蓝带自身的倾斜斜率 (dy/dx)，并用横向中段 >=45% 蓝像素占比定稳健上下边界，
  // 避免倾斜角点或局部噪点把外接框 y0/y1 拉偏几十像素。
  return raw.map((c) => {
    const xL0 = c.x0 + Math.round(c.w * 0.08);
    const xL1 = c.x0 + Math.round(c.w * 0.35);
    const xR0 = c.x0 + Math.round(c.w * 0.65);
    const xR1 = c.x0 + Math.round(c.w * 0.92);
    const xM0 = c.x0 + Math.round(c.w * 0.20);
    const xM1 = c.x0 + Math.round(c.w * 0.80);
    const midWidth = Math.max(1, xM1 - xM0);
    let sumYL = 0, cntL = 0, sumYR = 0, cntR = 0;
    let robustY0 = c.y1;
    let robustY1 = c.y0;
    for (let y = c.y0; y <= c.y1; y++) {
      const row = y * W;
      for (let x = xL0; x < xL1; x++) if (mask[row + x]) { sumYL += y; cntL++; }
      for (let x = xR0; x < xR1; x++) if (mask[row + x]) { sumYR += y; cntR++; }
      let midHits = 0;
      for (let x = xM0; x < xM1; x++) if (mask[row + x]) midHits++;
      if (midHits >= midWidth * 0.45) {
        if (y < robustY0) robustY0 = y;
        if (y > robustY1) robustY1 = y;
      }
    }
    const yL = cntL ? sumYL / cntL : c.cy;
    const yR = cntR ? sumYR / cntR : c.cy;
    const dx = ((xR0 + xR1) - (xL0 + xL1)) / 2;
    const slope = dx > 20 ? (yR - yL) / dx : 0;
    const y0 = robustY1 > robustY0 + 10 ? robustY0 : c.y0;
    const y1 = robustY1 > robustY0 + 10 ? robustY1 : c.y1;
    return { ...c, y0, y1, h: y1 - y0 + 1, cy: (y0 + y1) / 2, slope: Math.abs(slope) < 0.2 ? slope : 0 };
  });
}

// 从蓝带候选中挑选最像「4 条蓝底 + 3 条白底交替的 7 块答题区」的组合。
export function selectBlueBandStack(bands, H) {
  if (bands.length < 4) return null;
  let best = null;
  // 按 y 排序后，尝试每组 4 条（一般只有 4–6 条，组合数极小）。
  const n = Math.min(bands.length, 10);
  const pick = (indices) => {
    const seq = indices.map((idx) => bands[idx]);
    const widths = seq.map((b) => b.w);
    const minW = Math.min(...widths);
    const maxW = Math.max(...widths);
    if (maxW / minW > 1.38) return;
    // 远拍时第 0 条蓝带可能与上方「准考证号」表头合并，高度偏大但下边界准确；用后 3 条中位高度归一化。
    const refH = median([seq[1].h, seq[2].h, seq[3].h]);
    const eff = seq.map((b, idx) => {
      if (idx === 0 && b.h > refH * 1.32) {
        const y0 = Math.max(b.y0, Math.round(b.y1 - refH));
        return { ...b, y0, h: b.y1 - y0, cy: (y0 + b.y1) / 2 };
      }
      return b;
    });
    // 相邻蓝带横向高度重叠且竖向留有白底答题块空隙。
    const centerSteps = [];
    for (let i = 0; i < 3; i++) {
      const a = eff[i], b = eff[i + 1];
      const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      if (overlap < Math.min(a.w, b.w) * 0.72) return;
      const gap = b.y0 - a.y1;
      const avgH = (a.h + b.h) / 2;
      if (gap < avgH * 0.22 || gap > avgH * 1.9) return;
      centerSteps.push(b.cy - a.cy);
    }
    const maxStep = Math.max(...centerSteps);
    const minStep = Math.min(...centerSteps);
    if (maxStep / minStep > 1.48) return;
    const totalSpan = eff[3].y1 - eff[0].y0;
    if (totalSpan < H * 0.28) return;
    const uniformity = 1 - (maxStep - minStep) / maxStep;
    const widthUniformity = 1 - (maxW - minW) / maxW;
    const score = totalSpan * (0.5 + 0.3 * uniformity + 0.2 * widthUniformity) * (minW / 500);
    if (!best || score > best.score) best = { bands: seq, score };
  };
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        for (let l = k + 1; l < n; l++)
          pick([i, j, k, l]);
  return best ? best.bands : null;
}

// 答题卡侧边同步轨（一串竖直等距、大小一致的实心黑色矩形块）。
// 同步轨同时给出：1) 真实答题卡强证据；2) 纸张正倒（右边缘 vs 左边缘）；3) 纸张倾角；4) 右边界。
export function detectTimingTrack(components, W, H) {
  const rect = components
    .filter(
      (c) =>
        c.fill >= 0.60 &&
        c.w >= Math.max(7, W * 0.007) && c.w <= W * 0.07 &&
        c.h >= Math.max(3, H * 0.0022) && c.h <= H * 0.028 &&
        c.w >= c.h * 1.05 && c.w <= c.h * 6.5,
    )
    .sort((a, b) => a.cy - b.cy);
  if (rect.length < 10) return null;

  const used = new Uint8Array(rect.length);
  const chains = [];
  for (let i = 0; i < rect.length; i++) {
    if (used[i]) continue;
    const chain = [rect[i]];
    used[i] = 1;
    let prevDx = null;
    let prevDy = null;
    let cur = rect[i];
    let curIdx = i;
    while (true) {
      let bestIdx = -1;
      let bestCost = Infinity;
      const maxDy = prevDy ? prevDy * 2.25 : cur.h * 4.5;
      const minDy = Math.max(cur.h * 1.1, prevDy ? prevDy * 0.65 : 0);
      for (let j = curIdx + 1; j < rect.length; j++) {
        const cand = rect[j];
        const dy = cand.cy - cur.cy;
        if (dy > maxDy) break;
        if (dy < minDy) continue;
        const dx = cand.cx - cur.cx;
        if (Math.abs(dx) > Math.max(8, cur.w * 0.55)) continue;
        if (cand.w < cur.w * 0.62 || cand.w > cur.w * 1.6) continue;
        if (cand.h < cur.h * 0.55 || cand.h > cur.h * 1.8) continue;
        let stepDy = dy;
        let stepDx = dx;
        let skipPenalty = 0;
        if (prevDy && dy > prevDy * 1.55) {
          // 允许中间漏检 1 个黑块（步长约 2 倍）。
          stepDy = dy / 2;
          stepDx = dx / 2;
          skipPenalty = 3;
        }
        if (prevDy && (stepDy < prevDy * 0.75 || stepDy > prevDy * 1.35)) continue;
        if (prevDx !== null && Math.abs(stepDx - prevDx) > Math.max(5, cur.w * 0.35)) continue;
        const cost = Math.abs(dx - (prevDx ?? 0)) + (prevDy ? Math.abs(stepDy - prevDy) * 1.5 : 0) + skipPenalty;
        if (cost < bestCost) {
          bestCost = cost;
          bestIdx = j;
        }
      }
      if (bestIdx < 0) break;
      const next = rect[bestIdx];
      const dy = next.cy - cur.cy;
      const dx = next.cx - cur.cx;
      const factor = prevDy && dy > prevDy * 1.55 ? 2 : 1;
      prevDy = prevDy ? prevDy * 0.65 + (dy / factor) * 0.35 : dy;
      prevDx = prevDx !== null ? prevDx * 0.65 + (dx / factor) * 0.35 : dx;
      chain.push(next);
      used[bestIdx] = 1;
      cur = next;
      curIdx = bestIdx;
    }
    if (chain.length >= 10) chains.push(chain);
  }
  if (!chains.length) return null;

  // 检验并筛选最像侧边同步轨的链：
  // 1) 必须笔直（线性拟合残差小）；2) 步距规律；3) 位于墨迹主体的一侧边缘（而不是棋盘/键盘里 20 条一样的竖列）。
  const validChains = [];
  for (const chain of chains) {
    const ySpan = chain[chain.length - 1].cy - chain[0].cy;
    if (ySpan < H * 0.22) continue;
    const medW = median(chain.map((c) => c.w));
    const medH = median(chain.map((c) => c.h));
    const dys = [];
    for (let i = 1; i < chain.length; i++) dys.push(chain[i].cy - chain[i - 1].cy);
    const medDy = median(dys);
    const singleDys = dys.filter((d) => d < medDy * 1.5);
    if (singleDys.length < 8 || relMad(singleDys) > 0.16) continue;
    // 线性拟合 x = a + slope * y
    const meanY = mean(chain.map((c) => c.cy));
    const meanX = mean(chain.map((c) => c.cx));
    let num = 0, den = 0;
    for (const c of chain) {
      num += (c.cy - meanY) * (c.cx - meanX);
      den += (c.cy - meanY) ** 2;
    }
    const slope = den > 0 ? num / den : 0;
    if (Math.abs(slope) > 0.16) continue;
    const intercept = meanX - slope * meanY;
    const rms = Math.sqrt(mean(chain.map((c) => (c.cx - (intercept + slope * c.cy)) ** 2)));
    if (rms > Math.max(4, medW * 0.35)) continue;
    validChains.push({
      items: chain,
      set: new Set(chain),
      count: chain.length,
      meanX,
      intercept,
      slope,
      medW,
      medH,
      medDy,
      yTop: chain[0].cy,
      yBottom: chain[chain.length - 1].cy,
      ySpan,
      rms,
    });
  }
  if (!validChains.length) return null;
  // 键盘/均匀棋盘会有大量完全相同的竖向矩形链，真实答题卡只有 1–2 条边轨。
  if (validChains.length >= 6) return null;

  // 确认这条轨位于大部分其余连通域的一侧（右侧 = 正向，左侧 = 倒置 180°）。
  const others = components.filter((c) => c.area >= 30 && c.w < W * 0.15 && c.h < H * 0.08);
  let best = null;
  for (const track of validChains) {
    let leftCount = 0;
    let rightCount = 0;
    for (const c of others) {
      if (track.set.has(c)) continue;
      if (c.cy < track.yTop - track.medDy * 2 || c.cy > track.yBottom + track.medDy * 2) continue;
      const tx = track.intercept + track.slope * c.cy;
      if (c.cx < tx - track.medW * 0.9) leftCount++;
      else if (c.cx > tx + track.medW * 0.9) rightCount++;
    }
    const total = leftCount + rightCount;
    if (total < 20) continue;
    const leftRatio = leftCount / total;
    const rightRatio = rightCount / total;
    if (leftRatio < 0.72 && rightRatio < 0.72) continue;
    const side = leftRatio >= 0.72 ? "right" : "left";
    const score = track.count * 2 + (track.ySpan / H) * 40;
    if (!best || score > best.score) best = { ...track, side, score };
  }
  return best;
}

export function downscaleTo(planes, targetLongEdge) {
  const { width: W, height: H } = planes;
  const longEdge = Math.max(W, H);
  if (longEdge < targetLongEdge * 1.1) return null;
  const factor = targetLongEdge / longEdge;
  const outW = Math.max(64, Math.round(W * factor));
  const outH = Math.max(64, Math.round(H * factor));
  const gray = new Uint8Array(outW * outH);
  const sat = new Uint8Array(outW * outH);
  const data = planes.data ? new Uint8ClampedArray(outW * outH * 4) : null;
  for (let y = 0; y < outH; y++) {
    const y0 = Math.floor((y * H) / outH);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * H) / outH));
    for (let x = 0; x < outW; x++) {
      const x0 = Math.floor((x * W) / outW);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * W) / outW));
      let g = 0, s = 0, r = 0, gg = 0, b = 0, n = 0;
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

export function rotatePlanes(planes, turns) {
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
  return { width: w, height: h, gray, sat, data };
}
