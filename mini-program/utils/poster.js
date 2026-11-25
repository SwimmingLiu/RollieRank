const WIDTH = 450;
const PAD = 22;
const INNER = WIDTH - PAD * 2;
const DEFAULT_STYLE = "ticket";

// 微信小游戏/小程序 Canvas 2D 在 iOS/WebKit 下仅接受标准 100 倍数字重（100–900）与整数像素字号，
// 非法字重（如 650/750/450）会被静默忽略并回退到默认 10px sans-serif。
function canvasFont(weight, size, family) {
  const numeric = Number(weight);
  const clamped = Number.isFinite(numeric)
    ? Math.max(100, Math.min(900, Math.round(numeric / 100) * 100))
    : 400;
  const px = Math.max(1, Math.round(Number(size) || 12));
  return `${clamped} ${px}px ${family}`;
}

const SHORT_NAMES = {
  政治理论: "政治",
  常识判断: "常识",
  言语理解: "言语",
  数量关系: "数量",
  判断推理: "判断",
  资料分析: "资料",
};

const STYLES = [
  {
    key: "ticket",
    label: "票根",
    name: "麦穗票根",
    swatch: "#ebd3a4",
    layout: "bars",
    dark: false,
    topBg: "#f5e6c6",
    topBg0: "#f8edd4",
    topBg1: "#f0ddb5",
    topHighlight: "rgba(255, 255, 255, 0.52)",
    bodyBg: "#fffdf8",
    surfaceBg: "#faf5eb",
    surfaceBorder: "#efe6d6",
    bestBg: "#fdf2ef",
    bestBorder: "#f0d0c9",
    border: "#e5d8c0",
    perfLine: "#d6c3a1",
    notchBg: "#f5f1e9",
    rule: "#efe7d8",
    topInk: "#1f1912",
    topMuted: "#7a684d",
    ink: "#262018",
    muted: "#8a7b64",
    subtle: "#9c8d76",
    chipBg: "rgba(255, 253, 248, 0.82)",
    chipBorder: "rgba(194, 163, 108, 0.48)",
    chipInk: "#54422a",
    rulerTrack: "rgba(140, 114, 72, 0.15)",
    rulerMark: "rgba(246, 232, 200, 0.92)",
    rulerSubMark: "rgba(140, 114, 72, 0.14)",
    rulerStart: "#c99b54",
    rulerEnd: "#d97366",
    pinHalo: "rgba(217, 115, 102, 0.25)",
    pinBorder: "#fffdf8",
    barTrack: "#ebe2d2",
    barFill: "#b6874a",
    barFill0: "#c89957",
    barFill1: "#a9793e",
    barBest: "#d97366",
    barBest0: "#e38477",
    barBest1: "#cc6255",
    barLow: "#bfb29d",
    barLow0: "#c9bda8",
    barLow1: "#b2a48d",
    refLine: "rgba(182, 135, 74, 0.36)",
    ok: "#558551",
    okBg: "#e6f0e3",
    okInk: "#3f6c3b",
    no: "#d97366",
    noBg: "#fae7e4",
    noInk: "#c4584c",
    bl: "#cfc4b0",
    blBg: "#efeae0",
    blInk: "#8b7c67",
    donutInner: "rgba(182, 135, 74, 0.16)",
    radarHalo: "#fbf6ec",
    radarHaloStroke: "#efe6d5",
    radarGrid: "#e4d7bf",
    radarMid: "#ece1cd",
    radarStroke: "#bf7a52",
    radarFill0: "rgba(227, 140, 124, 0.30)",
    radarFill1: "rgba(182, 135, 74, 0.14)",
    radarDot: "#b6874a",
    radarDotBest: "#d97366",
    radarDotStroke: "#fffdf8",
    radarLabel: "#4f4333",
    radarLabelLow: "#7c6f5c",
    qrBg: "#ffffff",
    qrBorder: "#ebdacc",
    qrHalo: "rgba(217, 115, 102, 0.12)",
  },
  {
    key: "rings",
    label: "圆环",
    name: "圆环仪表",
    swatch: "#d9a25f",
    layout: "rings",
    dark: false,
    topBg: "#f5e6c6",
    topBg0: "#f8edd4",
    topBg1: "#f0ddb5",
    topHighlight: "rgba(255, 255, 255, 0.52)",
    bodyBg: "#fffdf8",
    surfaceBg: "#faf5eb",
    surfaceBorder: "#efe6d6",
    bestBg: "#fdf2ef",
    bestBorder: "#f0d0c9",
    border: "#e5d8c0",
    perfLine: "#d6c3a1",
    notchBg: "#f5f1e9",
    rule: "#efe7d8",
    topInk: "#1f1912",
    topMuted: "#7a684d",
    ink: "#262018",
    muted: "#8a7b64",
    subtle: "#9c8d76",
    chipBg: "rgba(255, 253, 248, 0.82)",
    chipBorder: "rgba(194, 163, 108, 0.48)",
    chipInk: "#54422a",
    rulerTrack: "rgba(140, 114, 72, 0.15)",
    rulerMark: "rgba(246, 232, 200, 0.92)",
    rulerSubMark: "rgba(140, 114, 72, 0.14)",
    rulerStart: "#c99b54",
    rulerEnd: "#d97366",
    pinHalo: "rgba(217, 115, 102, 0.25)",
    pinBorder: "#fffdf8",
    barTrack: "#eee5d4",
    barFill: "#b6874a",
    barFill0: "#c89957",
    barFill1: "#a9793e",
    barBest: "#d97366",
    barBest0: "#e38477",
    barBest1: "#cc6255",
    barLow: "#b8aa95",
    barLow0: "#c4b7a3",
    barLow1: "#aa9b84",
    refLine: "rgba(182, 135, 74, 0.36)",
    ok: "#558551",
    okBg: "#e6f0e3",
    okInk: "#3f6c3b",
    no: "#d97366",
    noBg: "#fae7e4",
    noInk: "#c4584c",
    bl: "#d5cab6",
    blBg: "#efeae0",
    blInk: "#8b7c67",
    donutInner: "rgba(182, 135, 74, 0.16)",
    radarHalo: "#fbf6ec",
    radarHaloStroke: "#efe6d5",
    radarGrid: "#e4d7bf",
    radarMid: "#ece1cd",
    radarStroke: "#bf7a52",
    radarFill0: "rgba(227, 140, 124, 0.30)",
    radarFill1: "rgba(182, 135, 74, 0.14)",
    radarDot: "#b6874a",
    radarDotBest: "#d97366",
    radarDotStroke: "#fffdf8",
    radarLabel: "#4f4333",
    radarLabelLow: "#7c6f5c",
    qrBg: "#ffffff",
    qrBorder: "#ebdacc",
    qrHalo: "rgba(217, 115, 102, 0.12)",
  },
  {
    key: "coral",
    label: "珊瑚",
    name: "珊瑚暖笺",
    swatch: "#f2c6ba",
    layout: "bars",
    dark: false,
    topBg: "#f8e2da",
    topBg0: "#fbeae3",
    topBg1: "#f3d5ca",
    topHighlight: "rgba(255, 255, 255, 0.56)",
    bodyBg: "#fffdf9",
    surfaceBg: "#fcf6f2",
    surfaceBorder: "#f3e2da",
    bestBg: "#fdf0ec",
    bestBorder: "#efc8be",
    border: "#ecd4ca",
    perfLine: "#dfb7a8",
    notchBg: "#f5f1e9",
    rule: "#f2e4dd",
    topInk: "#281b18",
    topMuted: "#866258",
    ink: "#281d19",
    muted: "#8e7369",
    subtle: "#a38a80",
    chipBg: "rgba(255, 253, 249, 0.84)",
    chipBorder: "rgba(213, 122, 106, 0.36)",
    chipInk: "#6b3c33",
    rulerTrack: "rgba(166, 98, 84, 0.14)",
    rulerMark: "rgba(248, 226, 218, 0.92)",
    rulerSubMark: "rgba(166, 98, 84, 0.14)",
    rulerStart: "#d9927c",
    rulerEnd: "#d45d4f",
    pinHalo: "rgba(212, 93, 79, 0.24)",
    pinBorder: "#fffdf9",
    barTrack: "#f2e2da",
    barFill: "#cf856c",
    barFill0: "#dc957d",
    barFill1: "#c1745c",
    barBest: "#d45d4f",
    barBest0: "#e07063",
    barBest1: "#c44d40",
    barLow: "#cab9b0",
    barLow0: "#d4c5bc",
    barLow1: "#bca99f",
    refLine: "rgba(207, 133, 108, 0.36)",
    ok: "#558551",
    okBg: "#e6f0e3",
    okInk: "#3f6c3b",
    no: "#d45d4f",
    noBg: "#fbe6e2",
    noInk: "#c04b3e",
    bl: "#d4c4bc",
    blBg: "#f2ebe6",
    blInk: "#8f7a70",
    donutInner: "rgba(207, 133, 108, 0.16)",
    radarHalo: "#fdf7f4",
    radarHaloStroke: "#f3e4dc",
    radarGrid: "#ebd5ca",
    radarMid: "#f1e0d7",
    radarStroke: "#cf6d5c",
    radarFill0: "rgba(212, 93, 79, 0.28)",
    radarFill1: "rgba(217, 146, 124, 0.12)",
    radarDot: "#cf856c",
    radarDotBest: "#d45d4f",
    radarDotStroke: "#fffdf9",
    radarLabel: "#543a33",
    radarLabelLow: "#8a7068",
    qrBg: "#ffffff",
    qrBorder: "#f0d7ce",
    qrHalo: "rgba(212, 93, 79, 0.12)",
  },
  {
    key: "ink",
    label: "墨纸",
    name: "松烟墨纸",
    swatch: "#2a241d",
    layout: "bars",
    dark: true,
    topBg: "#231f1a",
    topBg0: "#2b251f",
    topBg1: "#1c1814",
    topHighlight: "rgba(250, 240, 220, 0.08)",
    bodyBg: "#2b251f",
    surfaceBg: "#332c24",
    surfaceBorder: "#443a30",
    bestBg: "#412d28",
    bestBorder: "#684239",
    border: "#463c32",
    perfLine: "#54483a",
    notchBg: "#f5f1e9",
    rule: "#3d342b",
    topInk: "#fbf5e8",
    topMuted: "#b9a78c",
    ink: "#f7f0e3",
    muted: "#b6a68d",
    subtle: "#968770",
    chipBg: "rgba(250, 243, 230, 0.08)",
    chipBorder: "rgba(232, 190, 116, 0.36)",
    chipInk: "#e8be74",
    rulerTrack: "rgba(250, 243, 230, 0.13)",
    rulerMark: "rgba(28, 24, 20, 0.90)",
    rulerSubMark: "rgba(250, 243, 230, 0.12)",
    rulerStart: "#deb064",
    rulerEnd: "#e47c6d",
    pinHalo: "rgba(228, 124, 109, 0.32)",
    pinBorder: "#231f1a",
    barTrack: "#433a30",
    barFill: "#d6a65c",
    barFill0: "#e4b970",
    barFill1: "#c29147",
    barBest: "#e47c6d",
    barBest0: "#ee8e80",
    barBest1: "#d46a5b",
    barLow: "#7b6f5e",
    barLow0: "#8c7f6c",
    barLow1: "#6c6050",
    refLine: "rgba(222, 176, 100, 0.34)",
    ok: "#7cb275",
    okBg: "rgba(124, 178, 117, 0.17)",
    okInk: "#9ad193",
    no: "#e47c6d",
    noBg: "rgba(228, 124, 109, 0.17)",
    noInk: "#f0998c",
    bl: "#8c7f6c",
    blBg: "rgba(250, 243, 230, 0.09)",
    blInk: "#b8aa95",
    donutInner: "rgba(222, 176, 100, 0.15)",
    radarHalo: "#312a22",
    radarHaloStroke: "#42382e",
    radarGrid: "#4e4337",
    radarMid: "#433a30",
    radarStroke: "#e0ab6c",
    radarFill0: "rgba(228, 124, 109, 0.34)",
    radarFill1: "rgba(214, 166, 92, 0.15)",
    radarDot: "#deb064",
    radarDotBest: "#e47c6d",
    radarDotStroke: "#2b251f",
    radarLabel: "#ebe1ce",
    radarLabelLow: "#9e8f79",
    qrBg: "#fffdf8",
    qrBorder: "#564a3d",
    qrHalo: "rgba(232, 190, 116, 0.18)",
  },
];

function getStyle(key) {
  return STYLES.find(item => item.key === key) || STYLES[0];
}

function shortSubject(name) {
  return SHORT_NAMES[name] || String(name || "").slice(0, 2);
}

function splitScoreParts(scoreText) {
  const raw = String(scoreText || "0.00");
  const idx = raw.indexOf(".");
  if (idx < 0) return { scoreInt: raw, scoreDec: "" };
  return { scoreInt: raw.slice(0, idx), scoreDec: raw.slice(idx) };
}

function enrichBands(bands) {
  const list = Array.isArray(bands) ? bands : [];
  let maxRate = 0;
  let bestIndex = -1;
  list.forEach((band, idx) => {
    const rate = Number(band.rate) || 0;
    if (rate > maxRate) {
      maxRate = rate;
      bestIndex = idx;
    }
  });
  return list.map((band, idx) => {
    const rate = Math.max(0, Math.min(1, Number(band.rate) || 0));
    const pctInt = Math.round(rate * 100);
    const hasCounts = band.hasCounts !== undefined
      ? Boolean(band.hasCounts)
      : Number.isFinite(band.count) && Number.isFinite(band.correct) && band.count > 0;
    const countLabel = hasCounts
      ? `${band.correct} / ${band.count}`
      : `${band.earned} / ${band.max}`;
    const countShort = hasCounts
      ? `${band.correct}/${band.count}`
      : `${band.earned}/${band.max}`;
    return {
      ...band,
      short: shortSubject(band.name),
      pctInt,
      hasCounts,
      countLabel,
      countShort,
      isBest: maxRate > 0 && idx === bestIndex,
      isLow: pctInt < 65,
    };
  });
}

function bandCountUnit(bands) {
  const list = enrichBands(bands);
  return list.length && list.every(item => item.hasCounts) ? "对题 / 总题" : "得分 / 满分";
}

function outcomeMetrics(summary) {
  const correct = Number(summary?.correct) || 0;
  const wrong = Number(summary?.wrong) || 0;
  const blank = Number(summary?.blank) || 0;
  const total = correct + wrong + blank;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const okPct = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  const noPct = total > 0 ? Math.round((wrong / total) * 1000) / 10 : 0;
  const blPct = total > 0 ? Math.max(0, Math.round((100 - okPct - noPct) * 10) / 10) : 0;
  return { correct, wrong, blank, total, accuracy, okPct, noPct, blPct };
}

function rulerTicks(maxLabel) {
  const maxNum = Number(maxLabel) || 100;
  const fmt = v => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10));
  return ["0", fmt(maxNum * 0.5), fmt(maxNum)];
}

// ============ CRISP CANVAS VECTOR ICON HELPERS ============
function drawSparkleIcon(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.beginPath();
  const k = r * 0.26;
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + k * 0.4, cy - k * 0.4, cx + r, cy);
  ctx.quadraticCurveTo(cx + k * 0.4, cy + k * 0.4, cx, cy + r);
  ctx.quadraticCurveTo(cx - k * 0.4, cy + k * 0.4, cx - r, cy);
  ctx.quadraticCurveTo(cx - k * 0.4, cy - k * 0.4, cx, cy - r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawCheckIcon(ctx, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 4.8, cy + 0.3);
  ctx.lineTo(cx - 1.5, cy + 3.7);
  ctx.lineTo(cx + 5.1, cy - 3.5);
  ctx.stroke();
  ctx.restore();
}

function drawCrossIcon(ctx, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 3.8, cy - 3.8);
  ctx.lineTo(cx + 3.8, cy + 3.8);
  ctx.moveTo(cx + 3.8, cy - 3.8);
  ctx.lineTo(cx - 3.8, cy + 3.8);
  ctx.stroke();
  ctx.restore();
}

function drawBlankIcon(ctx, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  if (ctx.setLineDash) ctx.setLineDash([2.6, 2.4]);
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTrendArrow(ctx, cx, cy, up, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (up) {
    ctx.moveTo(cx - 3.6, cy + 3.6);
    ctx.lineTo(cx + 3.6, cy - 3.6);
    ctx.moveTo(cx - 0.8, cy - 3.6);
    ctx.lineTo(cx + 3.6, cy - 3.6);
    ctx.lineTo(cx + 3.6, cy + 0.8);
  } else {
    ctx.moveTo(cx - 3.6, cy - 3.6);
    ctx.lineTo(cx + 3.6, cy + 3.6);
    ctx.moveTo(cx - 0.8, cy + 3.6);
    ctx.lineTo(cx + 3.6, cy + 3.6);
    ctx.lineTo(cx + 3.6, cy - 0.8);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSectionIcon(ctx, kind, x, y, theme) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(18 / 14, 18 / 14);
  if (kind === "radar") {
    ctx.beginPath();
    ctx.moveTo(7, 1.5);
    ctx.lineTo(12, 4.4);
    ctx.lineTo(12, 9.8);
    ctx.lineTo(7, 12.7);
    ctx.lineTo(2, 9.8);
    ctx.lineTo(2, 4.4);
    ctx.closePath();
    ctx.strokeStyle = theme.barFill;
    ctx.lineWidth = 1.3;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, 4.3);
    ctx.lineTo(9.6, 5.8);
    ctx.lineTo(9.6, 8.6);
    ctx.lineTo(7, 10.1);
    ctx.lineTo(4.4, 8.6);
    ctx.lineTo(4.4, 5.8);
    ctx.closePath();
    ctx.fillStyle = theme.barBest;
    ctx.globalAlpha = 0.28;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.barBest;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  } else if (kind === "bars") {
    const bar = (bx, by, bw, bh, c) => {
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 1.3) : ctx.rect(bx, by, bw, bh);
      ctx.fillStyle = c;
      ctx.fill();
    };
    bar(1.8, 7.2, 2.6, 5.2, theme.barFill);
    bar(5.7, 4.6, 2.6, 7.8, theme.barFill);
    bar(9.6, 2.0, 2.6, 10.4, theme.barBest);
  } else if (kind === "rings") {
    ctx.beginPath();
    ctx.arc(7, 7, 5, 0, Math.PI * 2);
    ctx.strokeStyle = theme.barFill;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(7, 7, 5, -Math.PI / 2, Math.PI * 0.72);
    ctx.strokeStyle = theme.barBest;
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(7, 7, 1.9, 0, Math.PI * 2);
    ctx.fillStyle = theme.barFill;
    ctx.fill();
  } else if (kind === "clock") {
    ctx.beginPath();
    ctx.arc(7, 7, 5, 0, Math.PI * 2);
    ctx.strokeStyle = theme.barFill;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, 4.2);
    ctx.lineTo(7, 7.2);
    ctx.lineTo(9.2, 8.6);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  ctx.restore();
}

function drawDonut(ctx, size, summary, styleOrKey) {
  const theme = typeof styleOrKey === "string" ? getStyle(styleOrKey) : (styleOrKey || STYLES[0]);
  const { correct, wrong, blank, total, accuracy } = outcomeMetrics(summary);
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(9, Math.round(size * 0.088));
  const r = (size - stroke) / 2 - 1.5;

  ctx.save();
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";

  // Base track
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = theme.barTrack;
  ctx.stroke();

  if (total > 0) {
    const segs = [
      { count: correct, color: theme.ok },
      { count: wrong, color: theme.no },
      { count: blank, color: theme.bl },
    ].filter(s => s.count > 0);
    if (segs.length === 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5);
      ctx.strokeStyle = segs[0].color;
      ctx.stroke();
    } else {
      const capRad = stroke / (2 * r);
      const minGap = capRad * 1.5;
      let start = -Math.PI / 2;
      const spans = segs.map(s => {
        const span = (s.count / total) * Math.PI * 2;
        const item = { ...s, start, span };
        start += span;
        return item;
      });
      const ordered = [...spans].sort((a, b) => b.span - a.span);
      for (const seg of ordered) {
        const inset = Math.min(minGap * 0.5, seg.span * 0.25);
        const a0 = seg.start + inset;
        const a1 = Math.max(a0 + 0.015, seg.start + seg.span - inset);
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a1);
        ctx.strokeStyle = seg.color;
        ctx.stroke();
      }
    }
  }

  // Clean open center with editorial Fraunces accuracy + quiet label
  ctx.textBaseline = "middle";
  const numStr = String(accuracy);
  const numSize = Math.round(size * 0.29);
  const signSize = Math.round(size * 0.145);
  ctx.font = canvasFont(700, numSize, "Fraunces, Georgia, serif");
  const numW = ctx.measureText(numStr).width;
  ctx.font = canvasFont(600, signSize, "Nunito, sans-serif");
  const signW = ctx.measureText("%").width;
  const totalW = numW + signW + 1;
  const baseX = cx - totalW / 2;

  ctx.textAlign = "left";
  ctx.fillStyle = theme.ink;
  ctx.font = canvasFont(700, numSize, "Fraunces, Georgia, serif");
  ctx.fillText(numStr, baseX, cy - size * 0.08);
  ctx.fillStyle = theme.muted;
  ctx.font = canvasFont(600, signSize, "Nunito, sans-serif");
  ctx.fillText("%", baseX + numW + 1, cy - size * 0.035);

  ctx.textAlign = "center";
  ctx.fillStyle = theme.subtle;
  ctx.font = canvasFont(500, Math.round(size * 0.12), "Nunito, FangYuan, sans-serif");
  ctx.fillText("正确率", cx, cy + size * 0.185);
  ctx.restore();
}

function drawMiniRing(ctx, size, pctInt, isBest, isLow, styleOrKey) {
  const theme = typeof styleOrKey === "string" ? getStyle(styleOrKey) : (styleOrKey || STYLES[0]);
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(6, Math.round(size * 0.084));
  const r = (size - stroke) / 2 - 1.5;
  const pct = Math.max(0, Math.min(100, Number(pctInt) || 0));
  const color0 = isBest ? theme.barBest0 : isLow ? theme.barLow0 : theme.barFill0;
  const color1 = isBest ? theme.barBest1 : isLow ? theme.barLow1 : theme.barFill1;

  ctx.save();
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = theme.barTrack;
  ctx.stroke();

  if (pct > 0) {
    const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    grad.addColorStop(0, color0);
    grad.addColorStop(1, color1);
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (pct / 100) * Math.PI * 2);
    ctx.strokeStyle = grad;
    ctx.stroke();
  }

  ctx.textBaseline = "middle";
  const numStr = String(pct);
  const numSize = Math.round(size * 0.295);
  const signSize = Math.round(size * 0.16);
  ctx.font = canvasFont(700, numSize, "Fraunces, Georgia, serif");
  const numW = ctx.measureText(numStr).width;
  ctx.font = canvasFont(600, signSize, "Nunito, sans-serif");
  const signW = ctx.measureText("%").width;
  const startX = cx - (numW + signW + 0.5) / 2;

  ctx.textAlign = "left";
  ctx.fillStyle = isBest ? theme.barBest : theme.ink;
  ctx.font = canvasFont(700, numSize, "Fraunces, Georgia, serif");
  ctx.fillText(numStr, startX, cy + 0.5);
  ctx.fillStyle = isBest ? theme.barBest : theme.subtle;
  ctx.font = canvasFont(600, signSize, "Nunito, sans-serif");
  ctx.fillText("%", startX + numW + 0.5, cy + 2);
  ctx.restore();
}

function drawRichRadar(ctx, bands, x, y, width, height, styleOrKey) {
  const theme = typeof styleOrKey === "string" ? getStyle(styleOrKey) : (styleOrKey || STYLES[0]);
  const enriched = enrichBands(bands);
  if (enriched.length < 3) return;

  const centerX = x + width / 2;
  const centerY = y + height / 2 + 2;
  const radius = Math.min(width / 2 - 116, height / 2 - 64);
  if (radius <= 12) return;

  const axes = enriched.map((_, index) => {
    const angle = (index * Math.PI * 2) / enriched.length - Math.PI / 2;
    return [Math.cos(angle), Math.sin(angle)];
  });

  const plot = values => {
    ctx.beginPath();
    axes.forEach(([dx, dy], index) => {
      const px = centerX + dx * radius * values[index];
      const py = centerY + dy * radius * values[index];
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  };

  ctx.save();
  // Soft circular halo
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 8, 0, Math.PI * 2);
  ctx.fillStyle = theme.radarHalo;
  ctx.fill();
  ctx.strokeStyle = theme.radarHaloStroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Concentric polygons (100% solid, 75% dashed, 50% solid — cleaner open center)
  [1, 0.75, 0.5].forEach(tick => {
    ctx.save();
    if (tick === 0.75 && ctx.setLineDash) ctx.setLineDash([3, 3]);
    plot(enriched.map(() => tick));
    ctx.strokeStyle = tick === 1 ? theme.radarGrid : theme.radarMid;
    ctx.lineWidth = tick === 1 ? 1 : 0.85;
    ctx.stroke();
    ctx.restore();
  });

  // Spokes
  ctx.strokeStyle = theme.radarMid;
  ctx.lineWidth = 0.85;
  for (const [dx, dy] of axes) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + dx * radius, centerY + dy * radius);
    ctx.stroke();
  }

  // Data polygon with radial tint
  plot(enriched.map(b => b.rate));
  const grad = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, radius);
  grad.addColorStop(0, theme.radarFill0);
  grad.addColorStop(1, theme.radarFill1);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = theme.radarStroke;
  ctx.lineWidth = 2.3;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Vertex dots (double-ring glow on strongest)
  axes.forEach(([dx, dy], index) => {
    const band = enriched[index];
    const px = centerX + dx * radius * band.rate;
    const py = centerY + dy * radius * band.rate;
    if (band.isBest) {
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = theme.pinHalo;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(px, py, band.isBest ? 5 : 3.8, 0, Math.PI * 2);
    ctx.fillStyle = band.isBest ? theme.radarDotBest : band.isLow ? theme.barLow : theme.radarDot;
    ctx.fill();
    ctx.strokeStyle = theme.radarDotStroke;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  });

  // Two-line vertex labels (Name + calmer Fraunces %) with subtle sparkle on strongest
  ctx.textBaseline = "middle";
  axes.forEach(([dx, dy], index) => {
    const band = enriched[index];
    const isTopBot = Math.abs(dx) < 0.15;
    ctx.textAlign = isTopBot ? "center" : dx > 0 ? "left" : "right";
    const labelX = centerX + dx * (radius + (isTopBot ? 0 : 16));
    const baseY = centerY + dy * (radius + (isTopBot ? (dy < 0 ? 37 : 34) : 14));
    const maxW = isTopBot ? 154 : Math.max(92, width / 2 - Math.abs(dx) * (radius + 16) - 4);

    ctx.fillStyle = band.isBest ? theme.barBest : band.isLow ? theme.radarLabelLow : theme.radarLabel;
    ctx.font = canvasFont(band.isBest ? 700 : 600, 16, "Nunito, FangYuan, sans-serif");
    if (band.isBest) {
      const tw = ctx.measureText(band.name).width;
      const sx = isTopBot ? labelX - tw / 2 - 9 : dx > 0 ? labelX + 5 : labelX - tw - 10;
      const tx = isTopBot ? labelX + 7 : dx > 0 ? labelX + 15 : labelX;
      drawSparkleIcon(ctx, sx, baseY - 10, 5.4, theme.barBest);
      ctx.fillText(band.name, tx, baseY - 10, maxW);
    } else {
      ctx.fillText(band.name, labelX, baseY - 10, maxW);
    }

    ctx.fillStyle = band.isBest ? theme.barBest : band.isLow ? theme.subtle : theme.muted;
    ctx.font = canvasFont(band.isBest ? 700 : 600, 14, "Fraunces, Georgia, serif");
    ctx.fillText(`${band.pctInt}%`, labelX, baseY + 10, maxW);
  });

  ctx.restore();
}

function timingHeight(timing) {
  if (!timing) return 0;
  return 68 + (timing.modules?.length || 0) * 38;
}

function ringsBlockHeight(bands) {
  const rows = Math.max(1, Math.ceil((bands?.length || 0) / 3));
  return rows * 174 - 12;
}

function posterHeight(mode, bands, timing, comparison, styleKey = DEFAULT_STYLE) {
  const theme = getStyle(styleKey);
  const isRings = theme.layout === "rings";
  const footerSlot = 132;

  if (mode === "score") {
    const outcomeH = isRings ? 72 : 146;
    const visualH = isRings ? ringsBlockHeight(bands) + 14 : 186;
    return 317 + outcomeH + visualH + 130;
  }
  if (mode === "radar") {
    return 131 + 342 + 130;
  }
  if (mode === "types") {
    const typesH = isRings ? 40 + ringsBlockHeight(bands) : 286;
    return 131 + typesH + footerSlot;
  }
  const outcomeH = isRings ? 72 : 146;
  const vsH = comparison ? 54 : 0;
  const radarH = 342;
  const typesH = isRings ? 40 + ringsBlockHeight(bands) : 286;
  const timeH = timing ? timingHeight(timing) + 18 : 0;
  return 317 + outcomeH + vsH + 14 + radarH + 18 + typesH + timeH + footerSlot;
}

function drawPoster(ctx, { mode, style = DEFAULT_STYLE, summary, bands, timing, comparison, images = {} }) {
  const theme = getStyle(style);
  const isRings = theme.layout === "rings";
  const enriched = enrichBands(bands);
  const bestBand = enriched.find(b => b.isBest) || null;
  const height = posterHeight(mode, enriched, timing, comparison, theme.key);
  const hasHero = mode === "full" || mode === "score";
  const topH = hasHero ? 282 : 96;
  const perfY = topH + 11;

  const text = (value, x, y, size, color = theme.ink, weight = 500, family = "Nunito, FangYuan, sans-serif", limit, align = "left") => {
    const fallbackLimit = align === "right" ? x - PAD : align === "center" ? INNER : WIDTH - x - PAD;
    const maxW = limit !== undefined ? limit : fallbackLimit;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = canvasFont(weight, size, family);
    ctx.textAlign = align;
    ctx.fillText(String(value), x, y, Math.max(20, maxW));
    ctx.restore();
  };

  const roundPath = (x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  const hline = (y, color = theme.rule) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(WIDTH - PAD, y);
    ctx.stroke();
    ctx.restore();
  };

  // Clip outer ticket shell
  ctx.save();
  roundPath(0.5, 0.5, WIDTH - 1, height - 1, 24);
  ctx.fillStyle = theme.bodyBg;
  ctx.fill();
  ctx.clip();

  // Tactile warm gradient top ticket surface
  const topGrad = ctx.createLinearGradient(0, 0, WIDTH * 0.4, perfY);
  topGrad.addColorStop(0, theme.topBg0);
  topGrad.addColorStop(1, theme.topBg1);
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, WIDTH, perfY);

  // Delicate cotton-letterpress inner top sheen
  ctx.strokeStyle = theme.topHighlight;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(22, 1.5);
  ctx.lineTo(WIDTH - 22, 1.5);
  ctx.stroke();

  // Auto-sized rank trophy chip (measured first so masthead title never overlaps)
  const trophyImg = theme.dark ? (images.trophyGold || images.trophy) : images.trophy;
  let chipLeft = WIDTH - PAD;
  const drawChip = (labelText, strongText, showTrophy) => {
    const chipH = 36;
    const cy = 24;
    let chipW = 104;
    let strongW = 0;
    let labelW = 0;
    ctx.save();
    if (showTrophy) {
      ctx.font = canvasFont(700, 18, "Fraunces, Georgia, serif");
      strongW = ctx.measureText(strongText).width;
      ctx.font = canvasFont(600, 14, "Nunito, sans-serif");
      labelW = ctx.measureText(labelText).width;
      chipW = Math.max(86, Math.ceil(12 + 18 + 6 + strongW + 4 + labelW + 12));
    } else {
      ctx.font = canvasFont(700, 17, "Fraunces, Georgia, serif");
      strongW = ctx.measureText(strongText).width;
      chipW = Math.max(92, Math.ceil(strongW + 26));
    }
    ctx.restore();
    const cx = WIDTH - PAD - chipW;
    chipLeft = cx;
    roundPath(cx, cy, chipW, chipH, 18);
    ctx.fillStyle = theme.chipBg;
    ctx.fill();
    ctx.strokeStyle = theme.chipBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (showTrophy) {
      if (trophyImg) ctx.drawImage(trophyImg, cx + 12, cy + 9, 18, 18);
      const sx = cx + 36;
      text(strongText, sx, cy + 24, 18, theme.topInk, 700, "Fraunces, Georgia, serif", strongW + 8);
      text(labelText, sx + strongW + 4, cy + 23.5, 14, theme.topMuted, 600, "Nunito, sans-serif", labelW + 8);
    } else {
      text(strongText, cx + chipW / 2, cy + 24, 17, theme.topInk, 700, "Fraunces, Georgia, serif", chipW - 12, "center");
    }
  };
  if (summary.rank) {
    drawChip(`/ ${summary.count || 0}`, `#${summary.rank}`, true);
  } else if (!hasHero) {
    drawChip("", `${summary.score} 分`, false);
  }

  // Masthead
  if (images.publisher) {
    ctx.save();
    roundPath(PAD, 22, 40, 40, 10);
    ctx.clip();
    ctx.drawImage(images.publisher, PAD, 22, 40, 40);
    ctx.restore();
  }
  const titleX = images.publisher ? PAD + 50 : PAD;
  const titleLimit = Math.max(120, chipLeft - titleX - 10);
  const subParts = [summary.seriesName, summary.dateStamp].filter(Boolean).join(" · ");
  text(summary.paperName || summary.identity, titleX, 41, 22, theme.topInk, 700, "FangYuan, Nunito, sans-serif", titleLimit);
  if (subParts) text(subParts, titleX, 64, 15, theme.topMuted, 500, "Nunito, FangYuan, sans-serif", titleLimit);

  // Hero Score (Editorial Split Integer + Decimal Fraunces) + Trophy + Precision Score Ruler
  if (hasHero) {
    const { scoreInt, scoreDec } = splitScoreParts(summary.score);
    const isThreeDigit = scoreInt.length >= 3;
    const intSize = isThreeDigit ? 76 : 92;
    const decSize = isThreeDigit ? 40 : 50;
    ctx.save();
    ctx.font = canvasFont(700, intSize, "Fraunces, Georgia, serif");
    const intW = ctx.measureText(scoreInt).width;
    ctx.restore();

    text(scoreInt, PAD, 168, intSize, theme.topInk, 700, "Fraunces, Georgia, serif", 200);
    if (scoreDec) {
      ctx.save();
      ctx.globalAlpha = 0.78;
      text(scoreDec, PAD + intW + 2, 168, decSize, theme.topInk, 600, "Fraunces, Georgia, serif", 116);
      ctx.restore();
    }

    const maxLabel = `/ ${summary.max} 分`;
    text(maxLabel, PAD, 200, 17, theme.topMuted, 600);

    // Optional delta pill only in compact score mode (full mode already carries a dedicated VS row)
    if (mode === "score" && comparison && comparison.deltaCents !== 0) {
      const isUp = comparison.deltaTone === "up";
      ctx.save();
      ctx.font = canvasFont(600, 17, "Nunito, FangYuan, sans-serif");
      const maxW = ctx.measureText(maxLabel).width;
      ctx.font = canvasFont(700, 15, "Nunito, sans-serif");
      const dw = ctx.measureText(comparison.deltaText).width;
      ctx.restore();
      const pillX = PAD + Math.ceil(maxW) + 10;
      const pillY = 180;
      const pillW = Math.ceil(26 + dw + 12);
      roundPath(pillX, pillY, pillW, 27, 13.5);
      ctx.fillStyle = isUp ? theme.okBg : theme.noBg;
      ctx.fill();
      const fg = isUp ? theme.okInk : theme.noInk;
      drawTrendArrow(ctx, pillX + 14, pillY + 13.5, isUp, fg);
      text(comparison.deltaText, pillX + 24, pillY + 18.5, 15, fg, 700, "Nunito, sans-serif", dw + 6);
    }

    // Trophy keepsake illustration (with refined double-ring warm medallion on dark ink)
    if (theme.dark) {
      const mx = WIDTH - PAD - 72;
      const my = 140;
      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, 61, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(232, 190, 116, 0.34)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mx, my, 55, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(246, 232, 202, 0.92)";
      ctx.fill();
      ctx.restore();
    }
    if (images.keepsake) {
      ctx.drawImage(images.keepsake, WIDTH - PAD - 160, 84, 174, 116);
    }

    // Precision Score Ruler Gauge
    const rulerY = 232;
    const rulerH = 9;
    const rawPct = Math.max(0, Math.min(100, Number(summary.scorePct) || 0));
    const pinPct = Math.max(2, Math.min(98, rawPct));
    roundPath(PAD, rulerY, INNER, rulerH, 4.5);
    ctx.fillStyle = theme.rulerTrack;
    ctx.fill();

    // Subtle 10% micro-ticks
    ctx.fillStyle = theme.rulerSubMark;
    for (let t = 1; t < 10; t++) {
      if (t % 2.5 === 0) continue;
      ctx.fillRect(PAD + (INNER * t) / 10 - 0.5, rulerY + 1.5, 1, rulerH - 3);
    }

    const fillW = Math.max(9, (INNER * rawPct) / 100);
    if (rawPct > 0) {
      const grad = ctx.createLinearGradient(PAD, rulerY, PAD + INNER, rulerY);
      grad.addColorStop(0, theme.rulerStart);
      grad.addColorStop(1, theme.rulerEnd);
      roundPath(PAD, rulerY, fillW, rulerH, 4.5);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Quarter tick notches
    ctx.fillStyle = theme.rulerMark;
    for (const frac of [0.25, 0.5, 0.75]) {
      ctx.fillRect(PAD + INNER * frac - 0.75, rulerY - 2, 1.5, rulerH + 4);
    }

    // Luminous halo + coral pointer dot
    const pinX = PAD + (INNER * pinPct) / 100;
    const pinY = rulerY + rulerH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(pinX, pinY, 12, 0, Math.PI * 2);
    ctx.fillStyle = theme.pinHalo;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pinX, pinY, 7.6, 0, Math.PI * 2);
    ctx.fillStyle = theme.rulerEnd;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = theme.pinBorder;
    ctx.stroke();
    ctx.restore();

    // Tick numbers (3 clean landmarks: 0 / mid / max)
    const ticks = rulerTicks(summary.max);
    ticks.forEach((label, idx) => {
      const frac = ticks.length > 1 ? idx / (ticks.length - 1) : 0;
      const align = idx === 0 ? "left" : idx === ticks.length - 1 ? "right" : "center";
      text(label, PAD + INNER * frac, rulerY + 31, 14, theme.topMuted, 600, "Nunito, sans-serif", 56, align);
    });
  }

  // Perforation tear line & notches
  ctx.save();
  if (ctx.setLineDash) ctx.setLineDash([4, 4]);
  ctx.strokeStyle = theme.perfLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(18, perfY);
  ctx.lineTo(WIDTH - 18, perfY);
  ctx.stroke();
  ctx.restore();

  for (const nx of [0, WIDTH]) {
    ctx.beginPath();
    ctx.arc(nx, perfY, 11, 0, Math.PI * 2);
    ctx.fillStyle = theme.notchBg;
    ctx.fill();
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  let cursor = perfY + 24;

  // Outcome block (hide blank item when blank === 0 to reduce visual clutter)
  if (hasHero) {
    const metrics = outcomeMetrics(summary);
    const hasBlank = metrics.blank > 0;
    if (isRings) {
      const barY = cursor + 2;
      const barH = 10;
      const segs = [
        { pct: metrics.okPct, color: theme.ok },
        { pct: metrics.noPct, color: theme.no },
        { pct: metrics.blPct, color: theme.bl },
      ].filter(s => s.pct > 0);
      if (!segs.length) {
        roundPath(PAD, barY, INNER, barH, 5);
        ctx.fillStyle = theme.barTrack;
        ctx.fill();
      } else {
        const gap = 3;
        const usable = INNER - gap * (segs.length - 1);
        let sx = PAD;
        segs.forEach((seg, idx) => {
          const sw = idx === segs.length - 1 ? PAD + INNER - sx : Math.max(4, (usable * seg.pct) / 100);
          roundPath(sx, barY, sw, barH, 5);
          ctx.fillStyle = seg.color;
          ctx.fill();
          sx += sw + gap;
        });
      }
      const items = hasBlank
        ? [
            { label: "正确", value: String(metrics.correct), color: theme.ok, align: "left", x: PAD },
            { label: "错误", value: String(metrics.wrong), color: theme.no, align: "center", x: WIDTH / 2 },
            { label: "未答", value: String(metrics.blank), color: theme.bl, align: "right", x: WIDTH - PAD },
          ]
        : [
            { label: "正确", value: String(metrics.correct), color: theme.ok, align: "left", x: PAD },
            { label: "错误", value: String(metrics.wrong), color: theme.no, align: "right", x: WIDTH - PAD },
          ];
      items.forEach(item => {
        ctx.save();
        ctx.font = canvasFont(500, 16, "Nunito, FangYuan, sans-serif");
        const lblW = ctx.measureText(item.label).width;
        ctx.font = canvasFont(700, 22, "Fraunces, Georgia, serif");
        const valW = ctx.measureText(item.value).width;
        ctx.restore();
        const totalW = 10 + 7 + lblW + 6 + valW;
        const startX = item.align === "left" ? item.x : item.align === "center" ? item.x - totalW / 2 : item.x - totalW;
        ctx.beginPath();
        ctx.arc(startX + 5, barY + 34, 5, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
        text(item.label, startX + 17, barY + 40, 16, theme.muted, 500, "Nunito, FangYuan, sans-serif", lblW + 8);
        text(item.value, startX + 17 + lblW + 6, barY + 40, 22, theme.ink, 700, "Fraunces, Georgia, serif", valW + 8);
      });
      hline(cursor + 62);
      cursor += 72;
    } else {
      ctx.save();
      ctx.translate(PAD, cursor);
      drawDonut(ctx, 124, summary, theme);
      ctx.restore();

      const chipsX = PAD + 138;
      const chipGap = hasBlank ? 8 : 10;
      const tiles = hasBlank
        ? [
            { kind: "ok", value: metrics.correct, label: "正确", bg: theme.okBg, fg: theme.okInk },
            { kind: "no", value: metrics.wrong, label: "错误", bg: theme.noBg, fg: theme.noInk },
            { kind: "bl", value: metrics.blank, label: "未答", bg: theme.blBg, fg: theme.blInk },
          ]
        : [
            { kind: "ok", value: metrics.correct, label: "正确", bg: theme.okBg, fg: theme.okInk },
            { kind: "no", value: metrics.wrong, label: "错误", bg: theme.noBg, fg: theme.noInk },
          ];
      const chipW = (WIDTH - PAD - chipsX - chipGap * (tiles.length - 1)) / tiles.length;
      const chipH = 112;
      const chipY = cursor + 6;
      const valSize = hasBlank ? 28 : 32;
      tiles.forEach((tile, idx) => {
        const tx = chipsX + idx * (chipW + chipGap);
        roundPath(tx, chipY, chipW, chipH, 16);
        ctx.fillStyle = theme.surfaceBg;
        ctx.fill();
        ctx.strokeStyle = theme.surfaceBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        const icx = tx + chipW / 2;
        const icy = chipY + 26;
        ctx.beginPath();
        ctx.arc(icx, icy, 15, 0, Math.PI * 2);
        ctx.fillStyle = tile.bg;
        ctx.fill();
        if (tile.kind === "ok") drawCheckIcon(ctx, icx, icy, tile.fg);
        else if (tile.kind === "no") drawCrossIcon(ctx, icx, icy, tile.fg);
        else drawBlankIcon(ctx, icx, icy, tile.fg);

        text(tile.value, icx, chipY + 72, valSize, theme.ink, 700, "Fraunces, Georgia, serif", chipW - 10, "center");
        text(tile.label, icx, chipY + 96, 15, theme.muted, 500, "Nunito, FangYuan, sans-serif", chipW - 10, "center");
      });
      hline(cursor + 138);
      cursor += 146;
    }
  }

  // Optional VS comparison row in full mode
  if (mode === "full" && comparison) {
    text("较上次", PAD, cursor + 33, 16, theme.muted, 500);
    text(`${comparison.previousScore} → ${comparison.currentScore}`, PAD + 66, cursor + 33, 18, theme.ink, 700, "Fraunces, Georgia, serif", 200);
    const toneColor = comparison.deltaTone === "up" ? theme.okInk : comparison.deltaTone === "down" ? theme.noInk : theme.muted;
    const deltaLabel = comparison.deltaText + (comparison.deltaCents !== 0 ? " 分" : "");
    text(deltaLabel, WIDTH - PAD, cursor + 33, 17, toneColor, 700, "Nunito, FangYuan, sans-serif", 130, "right");
    hline(cursor + 52);
    cursor += 54;
  }

  const drawBarGradient = (x, y, w, h, isBest, isLow) => {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, isBest ? theme.barBest0 : isLow ? theme.barLow0 : theme.barFill0);
    grad.addColorStop(1, isBest ? theme.barBest1 : isLow ? theme.barLow1 : theme.barFill1);
    return grad;
  };

  const unitLegend = bandCountUnit(enriched);

  const drawMiniEqualizer = y => {
    const boxH = 172;
    roundPath(PAD, y, INNER, boxH, 16);
    ctx.fillStyle = theme.surfaceBg;
    ctx.fill();
    ctx.strokeStyle = theme.surfaceBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    drawSectionIcon(ctx, "bars", PAD + 14, y + 12, theme);
    text("各科表现", PAD + 39, y + 28, 18, theme.ink, 700, "FangYuan, Nunito, sans-serif", 140);

    const colW = (INNER - 20) / Math.max(1, enriched.length);
    enriched.forEach((band, idx) => {
      const cx = PAD + 10 + colW * idx + colW / 2;
      const pctColor = band.isBest ? theme.barBest : band.isLow ? theme.subtle : theme.muted;
      text(`${band.pctInt}%`, cx, y + 60, 15, pctColor, 700, "Fraunces, Georgia, serif", colW - 2, "center");
      const trackW = 20;
      const trackH = 58;
      const trackX = cx - trackW / 2;
      const trackY = y + 70;
      roundPath(trackX, trackY, trackW, trackH, 10);
      ctx.fillStyle = theme.barTrack;
      ctx.fill();
      const fillH = Math.max(band.pctInt > 0 ? 9 : 0, (trackH * band.pctInt) / 100);
      if (fillH > 0) {
        roundPath(trackX, trackY + trackH - fillH, trackW, fillH, 10);
        ctx.fillStyle = drawBarGradient(trackX, trackY + trackH - fillH, trackW, fillH, band.isBest, band.isLow);
        ctx.fill();
      }
      text(band.short, cx, y + 152, 15, band.isBest ? theme.barBest : theme.muted, band.isBest ? 700 : 600, "Nunito, FangYuan, sans-serif", colW - 2, "center");
    });
  };

  const drawVerticalBars = y => {
    drawSectionIcon(ctx, "bars", PAD, y + 6, theme);
    text("各科表现", PAD + 25, y + 22, 20, theme.ink, 700, "FangYuan, Nunito, sans-serif", 160);
    text(unitLegend, WIDTH - PAD, y + 22, 13, theme.subtle, 500, "Nunito, FangYuan, sans-serif", 120, "right");

    const cardY = y + 38;
    const cardH = 248;
    roundPath(PAD, cardY, INNER, cardH, 18);
    ctx.fillStyle = theme.surfaceBg;
    ctx.fill();
    ctx.strokeStyle = theme.surfaceBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    const trackTop = cardY + 48;
    const trackH = 116;
    const refY = trackTop + trackH * 0.2;
    ctx.save();
    if (ctx.setLineDash) ctx.setLineDash([4, 4]);
    ctx.strokeStyle = theme.refLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD + 8, refY);
    ctx.lineTo(WIDTH - PAD - 42, refY);
    ctx.stroke();
    ctx.restore();
    text("80%", WIDTH - PAD - 8, refY + 4, 12, theme.subtle, 600, "Nunito, sans-serif", 32, "right");

    const colW = (INNER - 46) / Math.max(1, enriched.length);
    enriched.forEach((band, idx) => {
      const cx = PAD + 8 + colW * idx + colW / 2;
      text(`${band.pctInt}%`, cx, cardY + 33, 18, band.isBest ? theme.barBest : theme.ink, 700, "Fraunces, Georgia, serif", colW - 2, "center");
      const trackW = Math.min(28, colW - 18);
      const tx = cx - trackW / 2;
      roundPath(tx, trackTop, trackW, trackH, 9);
      ctx.fillStyle = theme.barTrack;
      ctx.fill();
      const fillH = Math.max(band.pctInt > 0 ? 10 : 0, (trackH * band.pctInt) / 100);
      if (fillH > 0) {
        roundPath(tx, trackTop + trackH - fillH, trackW, fillH, 9);
        ctx.fillStyle = drawBarGradient(tx, trackTop + trackH - fillH, trackW, fillH, band.isBest, band.isLow);
        ctx.fill();
      }
      text(band.short, cx, trackTop + trackH + 30, 16, band.isBest ? theme.barBest : theme.ink, band.isBest ? 700 : 600, "Nunito, FangYuan, sans-serif", colW - 2, "center");
      text(band.countShort, cx, trackTop + trackH + 53, 14, theme.subtle, 500, "Nunito, sans-serif", colW - 2, "center");
    });
  };

  const drawRingsGrid = (y, showHeading) => {
    let top = y;
    if (showHeading) {
      drawSectionIcon(ctx, "rings", PAD, y + 6, theme);
      text("各科表现", PAD + 25, y + 22, 20, theme.ink, 700, "FangYuan, Nunito, sans-serif", 170);
      text(unitLegend, WIDTH - PAD, y + 22, 13, theme.subtle, 500, "Nunito, FangYuan, sans-serif", 120, "right");
      top = y + 40;
    }
    const gap = 12;
    const tileW = (INNER - gap * 2) / 3;
    const tileH = 162;
    enriched.forEach((band, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const tx = PAD + col * (tileW + gap);
      const ty = top + row * (tileH + gap);
      roundPath(tx, ty, tileW, tileH, 16);
      ctx.fillStyle = band.isBest ? theme.bestBg : theme.surfaceBg;
      ctx.fill();
      ctx.strokeStyle = band.isBest ? theme.bestBorder : theme.surfaceBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      const ringSize = 82;
      ctx.save();
      ctx.translate(tx + (tileW - ringSize) / 2, ty + 12);
      drawMiniRing(ctx, ringSize, band.pctInt, band.isBest, band.isLow, theme);
      ctx.restore();

      text(band.name, tx + tileW / 2, ty + 119, 16, band.isBest ? theme.barBest : theme.ink, 700, "Nunito, FangYuan, sans-serif", tileW - 10, "center");
      text(band.countLabel, tx + tileW / 2, ty + 143, 15, theme.subtle, 500, "Nunito, sans-serif", tileW - 10, "center");
    });
  };

  const drawRadarSection = y => {
    drawSectionIcon(ctx, "radar", PAD, y + 6, theme);
    text("能力轮廓", PAD + 25, y + 22, 20, theme.ink, 700, "FangYuan, Nunito, sans-serif", 160);
    drawRichRadar(ctx, enriched, PAD, y + 36, INNER, 306, theme);
  };

  const drawTiming = y => {
    hline(y);
    drawSectionIcon(ctx, "clock", PAD, y + 14, theme);
    text("做题用时", PAD + 25, y + 30, 20, theme.ink, 700, "FangYuan, Nunito, sans-serif", 140);
    text(`${timing.actual} / 计划 ${timing.planned} 分`, WIDTH - PAD, y + 30, 15, theme.muted, 500, "Nunito, FangYuan, sans-serif", 240, "right");
    (timing.modules || []).forEach((item, index) => {
      const rowY = y + 58 + index * 38;
      hline(rowY - 13);
      text(item.name, PAD, rowY + 11, 16, theme.muted, 500);
      text(item.planned + " 分", WIDTH / 2, rowY + 11, 16, theme.subtle, 500, "Nunito, FangYuan, sans-serif", 110, "center");
      text(item.actual, WIDTH - PAD, rowY + 11, 16, theme.ink, 700, "Fraunces, Georgia, serif", 110, "right");
    });
  };

  if (mode === "score") {
    cursor += 14;
    if (isRings) drawRingsGrid(cursor, false);
    else drawMiniEqualizer(cursor);
  } else if (mode === "radar") {
    drawRadarSection(cursor);
  } else if (mode === "types") {
    if (isRings) drawRingsGrid(cursor, true);
    else drawVerticalBars(cursor);
  } else if (mode === "full") {
    cursor += 14;
    drawRadarSection(cursor);
    cursor += 342 + 18;
    if (isRings) {
      drawRingsGrid(cursor, true);
      cursor += 40 + ringsBlockHeight(enriched);
    } else {
      drawVerticalBars(cursor);
      cursor += 286;
    }
    if (timing) {
      drawTiming(cursor + 18);
    }
  }

  // Clean QR Footer with vertically centered logo & QR code
  const footerTop = height - 114;
  hline(footerTop);
  const brandY = footerTop + 34;
  if (images.brand) {
    ctx.save();
    roundPath(PAD, brandY, 44, 44, 11);
    ctx.clip();
    ctx.drawImage(images.brand, PAD, brandY, 44, 44);
    ctx.restore();
  }
  text("卷卷小榜", PAD + 56, brandY + 19, 21, theme.ink, 700, "FangYuan, Nunito, sans-serif", 210);
  text("扫码同卷估分看排名", PAD + 56, brandY + 42, 15, theme.subtle, 500, "Nunito, FangYuan, sans-serif", 220);

  if (images.qrcode) {
    const qrSize = 76;
    const qrX = WIDTH - PAD - qrSize;
    const qrY = footerTop + 18;
    const qcx = qrX + qrSize / 2;
    const qcy = qrY + qrSize / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(qcx, qcy, qrSize / 2 + 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = theme.qrHalo;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(qcx, qcy, qrSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = theme.qrBg;
    ctx.fill();
    ctx.strokeStyle = theme.qrBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(qcx, qcy, qrSize / 2 - 2.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(images.qrcode, qrX + 2.5, qrY + 2.5, qrSize - 5, qrSize - 5);
    ctx.restore();
  }

  ctx.restore();
  // Outer ticket border stroke
  roundPath(0.5, 0.5, WIDTH - 1, height - 1, 24);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.stroke();
}

module.exports = {
  WIDTH,
  STYLES,
  DEFAULT_STYLE,
  canvasFont,
  getStyle,
  splitScoreParts,
  enrichBands,
  bandCountUnit,
  outcomeMetrics,
  rulerTicks,
  drawDonut,
  drawMiniRing,
  drawRichRadar,
  posterHeight,
  drawPoster,
};
