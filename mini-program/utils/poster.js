const WIDTH = 450;
const PAD = 26;
const INNER = WIDTH - PAD * 2;
const DEFAULT_STYLE = "ticket";

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
    return {
      ...band,
      short: shortSubject(band.name),
      pctInt,
      isBest: maxRate > 0 && idx === bestIndex,
      isLow: pctInt < 65,
    };
  });
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
  return ["0", fmt(maxNum * 0.25), fmt(maxNum * 0.5), fmt(maxNum * 0.75), fmt(maxNum)];
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
  ctx.lineWidth = 1.9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 4.3, cy + 0.3);
  ctx.lineTo(cx - 1.3, cy + 3.3);
  ctx.lineTo(cx + 4.5, cy - 3.1);
  ctx.stroke();
  ctx.restore();
}

function drawCrossIcon(ctx, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 3.3, cy - 3.3);
  ctx.lineTo(cx + 3.3, cy + 3.3);
  ctx.moveTo(cx + 3.3, cy - 3.3);
  ctx.lineTo(cx - 3.3, cy + 3.3);
  ctx.stroke();
  ctx.restore();
}

function drawBlankIcon(ctx, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.55;
  ctx.lineCap = "round";
  if (ctx.setLineDash) ctx.setLineDash([2.4, 2.2]);
  ctx.beginPath();
  ctx.arc(cx, cy, 4.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTrendArrow(ctx, cx, cy, up, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (up) {
    ctx.moveTo(cx - 3.2, cy + 3.2);
    ctx.lineTo(cx + 3.2, cy - 3.2);
    ctx.moveTo(cx - 0.8, cy - 3.2);
    ctx.lineTo(cx + 3.2, cy - 3.2);
    ctx.lineTo(cx + 3.2, cy + 0.8);
  } else {
    ctx.moveTo(cx - 3.2, cy - 3.2);
    ctx.lineTo(cx + 3.2, cy + 3.2);
    ctx.moveTo(cx - 0.8, cy + 3.2);
    ctx.lineTo(cx + 3.2, cy + 3.2);
    ctx.lineTo(cx + 3.2, cy - 0.8);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSectionIcon(ctx, kind, x, y, theme) {
  ctx.save();
  ctx.translate(x, y);
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
  const stroke = Math.max(8, Math.round(size * 0.094));
  const r = (size - stroke) / 2 - 1.5;

  ctx.save();
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";

  // Base track
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = theme.barTrack;
  ctx.stroke();

  // Inner watch-dial hairline
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - stroke / 2 - 4.5, 0, Math.PI * 2);
  ctx.strokeStyle = theme.donutInner;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

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
      const minGap = capRad * 1.35;
      let start = -Math.PI / 2;
      // Draw largest arc first so tiny accent arcs sit crisply on top without ugly overlap
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

  // Editorial Fraunces integer + compact % sign
  ctx.textBaseline = "middle";
  const numStr = String(accuracy);
  const numSize = Math.round(size * 0.235);
  const signSize = Math.round(size * 0.125);
  ctx.font = `750 ${numSize}px Fraunces, Georgia, serif`;
  const numW = ctx.measureText(numStr).width;
  ctx.font = `600 ${signSize}px Nunito, sans-serif`;
  const signW = ctx.measureText("%").width;
  const totalW = numW + signW + 1;
  const baseX = cx - totalW / 2;

  ctx.textAlign = "left";
  ctx.fillStyle = theme.ink;
  ctx.font = `750 ${numSize}px Fraunces, Georgia, serif`;
  ctx.fillText(numStr, baseX, cy - size * 0.055);
  ctx.fillStyle = theme.muted;
  ctx.font = `600 ${signSize}px Nunito, sans-serif`;
  ctx.fillText("%", baseX + numW + 1, cy - size * 0.025);

  ctx.textAlign = "center";
  ctx.fillStyle = theme.subtle;
  ctx.font = `500 ${Math.round(size * 0.10)}px Nunito, FangYuan, sans-serif`;
  ctx.fillText("正确率", cx, cy + size * 0.16);
  ctx.restore();
}

function drawMiniRing(ctx, size, pctInt, isBest, isLow, styleOrKey) {
  const theme = typeof styleOrKey === "string" ? getStyle(styleOrKey) : (styleOrKey || STYLES[0]);
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(5, size * 0.092);
  const r = (size - stroke) / 2 - 1;
  const pct = Math.max(0, Math.min(100, Number(pctInt) || 0));
  const color = isBest ? theme.barBest : isLow ? theme.barLow : theme.barFill;

  ctx.save();
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = theme.barTrack;
  ctx.stroke();

  if (pct > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (pct / 100) * Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  ctx.textBaseline = "middle";
  const numStr = String(pct);
  const numSize = Math.round(size * 0.255);
  const signSize = Math.round(size * 0.145);
  ctx.font = `750 ${numSize}px Fraunces, Georgia, serif`;
  const numW = ctx.measureText(numStr).width;
  ctx.font = `600 ${signSize}px Nunito, sans-serif`;
  const signW = ctx.measureText("%").width;
  const startX = cx - (numW + signW + 0.5) / 2;

  ctx.textAlign = "left";
  ctx.fillStyle = isBest ? theme.barBest : theme.ink;
  ctx.font = `750 ${numSize}px Fraunces, Georgia, serif`;
  ctx.fillText(numStr, startX, cy + 0.5);
  ctx.fillStyle = isBest ? theme.barBest : theme.subtle;
  ctx.font = `600 ${signSize}px Nunito, sans-serif`;
  ctx.fillText("%", startX + numW + 0.5, cy + 2);
  ctx.restore();
}

function drawRichRadar(ctx, bands, x, y, width, height, styleOrKey) {
  const theme = typeof styleOrKey === "string" ? getStyle(styleOrKey) : (styleOrKey || STYLES[0]);
  const enriched = enrichBands(bands);
  if (enriched.length < 3) return;

  const centerX = x + width / 2;
  const centerY = y + height / 2 + 2;
  const radius = Math.min(width / 2 - 86, height / 2 - 44);
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

  // Concentric polygons (outer solid, 75% dashed, 50% solid, 25% subtle)
  [1, 0.75, 0.5, 0.25].forEach(tick => {
    ctx.save();
    if (tick === 0.75 && ctx.setLineDash) ctx.setLineDash([3, 3]);
    plot(enriched.map(() => tick));
    ctx.strokeStyle = tick === 1 ? theme.radarGrid : theme.radarMid;
    ctx.lineWidth = tick === 0.25 ? 0.8 : 1;
    ctx.stroke();
    ctx.restore();
  });

  // Spokes
  ctx.strokeStyle = theme.radarMid;
  ctx.lineWidth = 1;
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
  ctx.lineWidth = 2.2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Vertex dots (double-ring glow on strongest)
  axes.forEach(([dx, dy], index) => {
    const band = enriched[index];
    const px = centerX + dx * radius * band.rate;
    const py = centerY + dy * radius * band.rate;
    if (band.isBest) {
      ctx.beginPath();
      ctx.arc(px, py, 8.5, 0, Math.PI * 2);
      ctx.fillStyle = theme.pinHalo;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(px, py, band.isBest ? 4.8 : 3.6, 0, Math.PI * 2);
    ctx.fillStyle = band.isBest ? theme.radarDotBest : band.isLow ? theme.barLow : theme.radarDot;
    ctx.fill();
    ctx.strokeStyle = theme.radarDotStroke;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  });

  // Two-line vertex labels (Name + Fraunces %) with bespoke 4-point sparkle on strongest
  ctx.textBaseline = "middle";
  axes.forEach(([dx, dy], index) => {
    const band = enriched[index];
    const isTopBot = Math.abs(dx) < 0.15;
    ctx.textAlign = isTopBot ? "center" : dx > 0 ? "left" : "right";
    const labelX = centerX + dx * (radius + (isTopBot ? 0 : 18));
    const baseY = centerY + dy * (radius + (isTopBot ? (dy < 0 ? 28 : 22) : 14));
    const maxW = isTopBot ? 110 : Math.max(66, width / 2 - radius - 18);

    ctx.fillStyle = band.isBest ? theme.barBest : band.isLow ? theme.radarLabelLow : theme.radarLabel;
    ctx.font = `${band.isBest ? 700 : 600} 11.5px Nunito, FangYuan, sans-serif`;
    if (band.isBest) {
      const tw = ctx.measureText(band.name).width;
      const sx = isTopBot ? labelX - tw / 2 - 7 : dx > 0 ? labelX + 4 : labelX - tw - 8;
      const tx = isTopBot ? labelX + 5 : dx > 0 ? labelX + 12 : labelX;
      drawSparkleIcon(ctx, sx, baseY - 7, 4.6, theme.barBest);
      ctx.fillText(band.name, tx, baseY - 7, maxW);
    } else {
      ctx.fillText(band.name, labelX, baseY - 7, maxW);
    }

    ctx.fillStyle = band.isBest ? theme.barBest : band.isLow ? theme.subtle : theme.barFill;
    ctx.font = "750 11px Fraunces, Georgia, serif";
    ctx.fillText(`${band.pctInt}%`, labelX, baseY + 7.5, maxW);
  });

  ctx.restore();
}

function timingHeight(timing) {
  if (!timing) return 0;
  return 56 + (timing.modules?.length || 0) * 30;
}

function ringsBlockHeight(bands) {
  const rows = Math.max(1, Math.ceil((bands?.length || 0) / 3));
  return rows * 134 - 10;
}

function posterHeight(mode, bands, timing, comparison, styleKey = DEFAULT_STYLE) {
  const theme = getStyle(styleKey);
  const isRings = theme.layout === "rings";
  const footerH = 98;

  if (mode === "score") {
    const outcomeH = isRings ? 58 : 124;
    const visualH = isRings ? ringsBlockHeight(bands) + 16 : 144;
    return 286 + outcomeH + visualH + footerH;
  }
  if (mode === "radar") {
    return 118 + 278 + footerH;
  }
  if (mode === "types") {
    const typesH = isRings ? 34 + ringsBlockHeight(bands) : 238;
    return 118 + typesH + footerH;
  }
  const outcomeH = isRings ? 58 : 124;
  const vsH = comparison ? 44 : 0;
  const radarH = 278;
  const typesH = isRings ? 34 + ringsBlockHeight(bands) : 238;
  const timeH = timing ? timingHeight(timing) + 18 : 0;
  return 286 + outcomeH + vsH + 14 + radarH + 14 + typesH + timeH + footerH;
}

function drawPoster(ctx, { mode, style = DEFAULT_STYLE, summary, bands, timing, comparison, images = {} }) {
  const theme = getStyle(style);
  const isRings = theme.layout === "rings";
  const enriched = enrichBands(bands);
  const bestBand = enriched.find(b => b.isBest) || null;
  const height = posterHeight(mode, enriched, timing, comparison, theme.key);
  const hasHero = mode === "full" || mode === "score";
  const topH = hasHero ? 254 : 84;
  const perfY = topH + 11;

  const text = (value, x, y, size, color = theme.ink, weight = 450, family = "Nunito, FangYuan, sans-serif", limit = WIDTH - x - PAD, align = "left") => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textAlign = align;
    ctx.fillText(String(value), x, y, Math.max(20, limit));
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

  // Masthead
  if (images.publisher) {
    ctx.save();
    roundPath(PAD, 22, 32, 32, 8);
    ctx.clip();
    ctx.drawImage(images.publisher, PAD, 22, 32, 32);
    ctx.restore();
  }
  const titleX = images.publisher ? PAD + 42 : PAD;
  const subParts = [summary.seriesName, summary.dateStamp].filter(Boolean).join(" · ");
  text(summary.paperName || summary.identity, titleX, 36, 15.5, theme.topInk, 650, "FangYuan, Nunito, sans-serif", 224);
  if (subParts) text(subParts, titleX, 53, 11, theme.topMuted, 500, "Nunito, FangYuan, sans-serif", 224);

  // Auto-sized rank trophy chip
  const trophyImg = theme.dark ? (images.trophyGold || images.trophy) : images.trophy;
  const drawChip = (labelText, strongText, showTrophy) => {
    const chipH = 28;
    const cy = 24;
    let chipW = 86;
    let strongW = 0;
    let labelW = 0;
    ctx.save();
    if (showTrophy) {
      ctx.font = "750 13.5px Fraunces, Georgia, serif";
      strongW = ctx.measureText(strongText).width;
      ctx.font = "600 11px Nunito, sans-serif";
      labelW = ctx.measureText(labelText).width;
      chipW = Math.max(70, Math.ceil(10 + 14 + 5 + strongW + 4 + labelW + 10));
    } else {
      ctx.font = "750 12.5px Fraunces, Georgia, serif";
      strongW = ctx.measureText(strongText).width;
      chipW = Math.max(72, Math.ceil(strongW + 22));
    }
    ctx.restore();
    const cx = WIDTH - PAD - chipW;
    roundPath(cx, cy, chipW, chipH, 14);
    ctx.fillStyle = theme.chipBg;
    ctx.fill();
    ctx.strokeStyle = theme.chipBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (showTrophy) {
      if (trophyImg) ctx.drawImage(trophyImg, cx + 10, cy + 7, 14, 14);
      const sx = cx + 29;
      text(strongText, sx, cy + 19, 13.5, theme.topInk, 750, "Fraunces, Georgia, serif", strongW + 8);
      text(labelText, sx + strongW + 4, cy + 18.5, 11, theme.topMuted, 600, "Nunito, sans-serif", labelW + 8);
    } else {
      text(strongText, cx + chipW / 2, cy + 19, 12.5, theme.topInk, 750, "Fraunces, Georgia, serif", chipW - 12, "center");
    }
  };
  if (summary.rank) {
    drawChip(`/ ${summary.count || 0}`, `#${summary.rank}`, true);
  } else if (!hasHero) {
    drawChip("", `${summary.score} 分`, false);
  }

  // Hero Score (Editorial Split Integer + Decimal Fraunces) + Trophy + Precision Score Ruler
  if (hasHero) {
    const { scoreInt, scoreDec } = splitScoreParts(summary.score);
    const isThreeDigit = scoreInt.length >= 3;
    const intSize = isThreeDigit ? 70 : 84;
    const decSize = isThreeDigit ? 38 : 44;
    ctx.save();
    ctx.font = `750 ${intSize}px Fraunces, Georgia, serif`;
    const intW = ctx.measureText(scoreInt).width;
    ctx.restore();

    text(scoreInt, PAD, 155, intSize, theme.topInk, 750, "Fraunces, Georgia, serif", 190);
    if (scoreDec) {
      ctx.save();
      ctx.globalAlpha = 0.78;
      text(scoreDec, PAD + intW + 2, 154, decSize, theme.topInk, 600, "Fraunces, Georgia, serif", 96);
      ctx.restore();
    }

    text(`/ ${summary.max} 分`, PAD, 182, 12.5, theme.topMuted, 500);

    // Optional delta pill with bespoke vector trend arrow
    if (comparison && comparison.deltaCents !== 0) {
      const isUp = comparison.deltaTone === "up";
      const pillX = PAD + 66;
      const pillY = 167;
      ctx.save();
      ctx.font = "700 11px Nunito, sans-serif";
      const dw = ctx.measureText(comparison.deltaText).width;
      ctx.restore();
      const pillW = Math.ceil(22 + dw + 10);
      roundPath(pillX, pillY, pillW, 21, 10.5);
      ctx.fillStyle = isUp ? theme.okBg : theme.noBg;
      ctx.fill();
      const fg = isUp ? theme.okInk : theme.noInk;
      drawTrendArrow(ctx, pillX + 12, pillY + 10.5, isUp, fg);
      text(comparison.deltaText, pillX + 20, pillY + 14.5, 11, fg, 700, "Nunito, sans-serif", dw + 6);
    }

    // Trophy keepsake illustration (with refined double-ring warm medallion on dark ink)
    if (theme.dark) {
      const mx = WIDTH - PAD - 72;
      const my = 130;
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
      ctx.drawImage(images.keepsake, WIDTH - PAD - 160, 74, 174, 116);
    }

    // Precision Score Ruler Gauge
    const rulerY = 212;
    const rulerH = 8;
    const rawPct = Math.max(0, Math.min(100, Number(summary.scorePct) || 0));
    const pinPct = Math.max(2, Math.min(98, rawPct));
    roundPath(PAD, rulerY, INNER, rulerH, 4);
    ctx.fillStyle = theme.rulerTrack;
    ctx.fill();

    // Subtle 10% micro-ticks
    ctx.fillStyle = theme.rulerSubMark;
    for (let t = 1; t < 10; t++) {
      if (t % 2.5 === 0) continue;
      ctx.fillRect(PAD + (INNER * t) / 10 - 0.5, rulerY + 1.5, 1, rulerH - 3);
    }

    const fillW = Math.max(8, (INNER * rawPct) / 100);
    if (rawPct > 0) {
      const grad = ctx.createLinearGradient(PAD, rulerY, PAD + INNER, rulerY);
      grad.addColorStop(0, theme.rulerStart);
      grad.addColorStop(1, theme.rulerEnd);
      roundPath(PAD, rulerY, fillW, rulerH, 4);
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
    ctx.arc(pinX, pinY, 11.5, 0, Math.PI * 2);
    ctx.fillStyle = theme.pinHalo;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pinX, pinY, 7.2, 0, Math.PI * 2);
    ctx.fillStyle = theme.rulerEnd;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = theme.pinBorder;
    ctx.stroke();
    ctx.restore();

    // Tick numbers
    const ticks = rulerTicks(summary.max);
    ticks.forEach((label, idx) => {
      const frac = idx / 4;
      const align = idx === 0 ? "left" : idx === 4 ? "right" : "center";
      text(label, PAD + INNER * frac, rulerY + 25.5, 10, theme.topMuted, 600, "Nunito, sans-serif", 50, align);
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

  let cursor = perfY + 21;

  // Outcome block (Donut + 3 Bespoke Vector Icon Tiles for A1; Segmented Bar for A2)
  if (hasHero) {
    const metrics = outcomeMetrics(summary);
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
      const items = [
        { label: "正确", value: String(metrics.correct), color: theme.ok, align: "left", x: PAD },
        { label: "错误", value: String(metrics.wrong), color: theme.no, align: "center", x: WIDTH / 2 },
        { label: "未答", value: String(metrics.blank), color: theme.bl, align: "right", x: WIDTH - PAD },
      ];
      items.forEach(item => {
        ctx.save();
        ctx.font = "500 12px Nunito, FangYuan, sans-serif";
        const lblW = ctx.measureText(item.label).width;
        ctx.font = "750 15px Fraunces, Georgia, serif";
        const valW = ctx.measureText(item.value).width;
        ctx.restore();
        const totalW = 8 + 6 + lblW + 5 + valW;
        const startX = item.align === "left" ? item.x : item.align === "center" ? item.x - totalW / 2 : item.x - totalW;
        ctx.beginPath();
        ctx.arc(startX + 4, barY + 28, 4, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
        text(item.label, startX + 14, barY + 32, 12, theme.muted, 500, "Nunito, FangYuan, sans-serif", lblW + 6);
        text(item.value, startX + 14 + lblW + 5, barY + 32, 15, theme.ink, 750, "Fraunces, Georgia, serif", valW + 6);
      });
      hline(cursor + 52);
      cursor += 58;
    } else {
      ctx.save();
      ctx.translate(PAD, cursor);
      drawDonut(ctx, 104, summary, theme);
      ctx.restore();

      const chipsX = PAD + 120;
      const chipGap = 8;
      const chipW = (WIDTH - PAD - chipsX - chipGap * 2) / 3;
      const chipH = 94;
      const chipY = cursor + 5;
      const tiles = [
        { kind: "ok", value: metrics.correct, label: "正确", bg: theme.okBg, fg: theme.okInk },
        { kind: "no", value: metrics.wrong, label: "错误", bg: theme.noBg, fg: theme.noInk },
        { kind: "bl", value: metrics.blank, label: "未答", bg: theme.blBg, fg: theme.blInk },
      ];
      tiles.forEach((tile, idx) => {
        const tx = chipsX + idx * (chipW + chipGap);
        roundPath(tx, chipY, chipW, chipH, 15);
        ctx.fillStyle = theme.surfaceBg;
        ctx.fill();
        ctx.strokeStyle = theme.surfaceBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        const icx = tx + chipW / 2;
        const icy = chipY + 23;
        ctx.beginPath();
        ctx.arc(icx, icy, 12, 0, Math.PI * 2);
        ctx.fillStyle = tile.bg;
        ctx.fill();
        if (tile.kind === "ok") drawCheckIcon(ctx, icx, icy, tile.fg);
        else if (tile.kind === "no") drawCrossIcon(ctx, icx, icy, tile.fg);
        else drawBlankIcon(ctx, icx, icy, tile.fg);

        text(tile.value, icx, chipY + 60, 21, theme.ink, 750, "Fraunces, Georgia, serif", chipW - 8, "center");
        text(tile.label, icx, chipY + 78, 10.5, theme.muted, 500, "Nunito, FangYuan, sans-serif", chipW - 8, "center");
      });
      hline(cursor + 118);
      cursor += 124;
    }
  }

  // Optional VS comparison row in full mode
  if (mode === "full" && comparison) {
    text("较上次", PAD, cursor + 26, 12.5, theme.muted, 500);
    text(`${comparison.previousScore} → ${comparison.currentScore}`, PAD + 52, cursor + 26, 13.5, theme.ink, 700, "Fraunces, Georgia, serif", 180);
    const toneColor = comparison.deltaTone === "up" ? theme.okInk : comparison.deltaTone === "down" ? theme.noInk : theme.muted;
    const deltaLabel = comparison.deltaText + (comparison.deltaCents !== 0 ? " 分" : "");
    text(deltaLabel, WIDTH - PAD, cursor + 26, 13, toneColor, 700, "Nunito, FangYuan, sans-serif", 110, "right");
    hline(cursor + 42);
    cursor += 44;
  }

  const drawBestBadgeRight = (y, label) => {
    ctx.save();
    ctx.font = "650 11.5px Nunito, FangYuan, sans-serif";
    const tw = ctx.measureText(label).width;
    ctx.restore();
    drawSparkleIcon(ctx, WIDTH - PAD - tw - 9, y - 4, 4.6, theme.barBest);
    text(label, WIDTH - PAD, y, 11.5, theme.barBest, 650, "Nunito, FangYuan, sans-serif", 160, "right");
  };

  const drawBarGradient = (x, y, w, h, isBest, isLow) => {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, isBest ? theme.barBest0 : isLow ? theme.barLow0 : theme.barFill0);
    grad.addColorStop(1, isBest ? theme.barBest1 : isLow ? theme.barLow1 : theme.barFill1);
    return grad;
  };

  const drawMiniEqualizer = y => {
    const boxH = 130;
    roundPath(PAD, y, INNER, boxH, 16);
    ctx.fillStyle = theme.surfaceBg;
    ctx.fill();
    ctx.strokeStyle = theme.surfaceBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    drawSectionIcon(ctx, "bars", PAD + 14, y + 12, theme);
    text("六科表现", PAD + 33, y + 23.5, 12.5, theme.ink, 650, "FangYuan, Nunito, sans-serif", 120);
    if (bestBand) {
      const bestLabel = `${bestBand.short} ${bestBand.pctInt}%`;
      ctx.save();
      ctx.font = "700 11.5px Nunito, FangYuan, sans-serif";
      const tw = ctx.measureText(bestLabel).width;
      ctx.restore();
      drawSparkleIcon(ctx, WIDTH - PAD - 16 - tw - 9, y + 19.5, 4.4, theme.barBest);
      text(bestLabel, WIDTH - PAD - 16, y + 23.5, 11.5, theme.barBest, 700, "Nunito, FangYuan, sans-serif", 120, "right");
    }

    const colW = (INNER - 24) / Math.max(1, enriched.length);
    enriched.forEach((band, idx) => {
      const cx = PAD + 12 + colW * idx + colW / 2;
      const pctColor = band.isBest ? theme.barBest : band.isLow ? theme.subtle : theme.muted;
      text(`${band.pctInt}%`, cx, y + 47, 10.5, pctColor, 750, "Fraunces, Georgia, serif", colW - 4, "center");
      const trackW = 16;
      const trackH = 50;
      const trackX = cx - trackW / 2;
      const trackY = y + 54;
      roundPath(trackX, trackY, trackW, trackH, 8);
      ctx.fillStyle = theme.barTrack;
      ctx.fill();
      const fillH = Math.max(band.pctInt > 0 ? 7 : 0, (trackH * band.pctInt) / 100);
      if (fillH > 0) {
        roundPath(trackX, trackY + trackH - fillH, trackW, fillH, 8);
        ctx.fillStyle = drawBarGradient(trackX, trackY + trackH - fillH, trackW, fillH, band.isBest, band.isLow);
        ctx.fill();
      }
      text(band.short, cx, y + 118, 10.5, band.isBest ? theme.barBest : theme.muted, band.isBest ? 700 : 500, "Nunito, FangYuan, sans-serif", colW - 2, "center");
    });
  };

  const drawVerticalBars = y => {
    drawSectionIcon(ctx, "bars", PAD, y + 6, theme);
    text("板块分布", PAD + 19, y + 17.5, 13.5, theme.ink, 650, "FangYuan, Nunito, sans-serif", 140);
    if (bestBand) drawBestBadgeRight(y + 17.5, `${bestBand.name} ${bestBand.pctInt}%`);

    const cardY = y + 30;
    const cardH = 202;
    roundPath(PAD, cardY, INNER, cardH, 18);
    ctx.fillStyle = theme.surfaceBg;
    ctx.fill();
    ctx.strokeStyle = theme.surfaceBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    const trackTop = cardY + 36;
    const trackH = 104;
    const refY = trackTop + trackH * 0.2;
    ctx.save();
    if (ctx.setLineDash) ctx.setLineDash([4, 4]);
    ctx.strokeStyle = theme.refLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD + 10, refY);
    ctx.lineTo(WIDTH - PAD - 36, refY);
    ctx.stroke();
    ctx.restore();
    text("80%", WIDTH - PAD - 10, refY + 3.5, 9, theme.subtle, 600, "Nunito, sans-serif", 26, "right");

    const colW = (INNER - 40) / Math.max(1, enriched.length);
    enriched.forEach((band, idx) => {
      const cx = PAD + 10 + colW * idx + colW / 2;
      text(`${band.pctInt}%`, cx, cardY + 26, 13.5, band.isBest ? theme.barBest : theme.ink, 750, "Fraunces, Georgia, serif", colW - 4, "center");
      const trackW = Math.min(24, colW - 18);
      const tx = cx - trackW / 2;
      roundPath(tx, trackTop, trackW, trackH, 8);
      ctx.fillStyle = theme.barTrack;
      ctx.fill();
      const fillH = Math.max(band.pctInt > 0 ? 8 : 0, (trackH * band.pctInt) / 100);
      if (fillH > 0) {
        roundPath(tx, trackTop + trackH - fillH, trackW, fillH, 8);
        ctx.fillStyle = drawBarGradient(tx, trackTop + trackH - fillH, trackW, fillH, band.isBest, band.isLow);
        ctx.fill();
      }
      text(band.short, cx, trackTop + trackH + 22, 11.5, band.isBest ? theme.barBest : theme.ink, band.isBest ? 700 : 600, "Nunito, FangYuan, sans-serif", colW - 2, "center");
      text(`${band.earned}/${band.max}`, cx, trackTop + trackH + 38, 9.5, theme.subtle, 500, "Nunito, sans-serif", colW - 2, "center");
    });
  };

  const drawRingsGrid = (y, showHeading) => {
    let top = y;
    if (showHeading) {
      drawSectionIcon(ctx, "rings", PAD, y + 6, theme);
      text("六科微表盘", PAD + 19, y + 17.5, 13.5, theme.ink, 650, "FangYuan, Nunito, sans-serif", 150);
      if (bestBand) drawBestBadgeRight(y + 17.5, `${bestBand.name} ${bestBand.pctInt}%`);
      top = y + 32;
    }
    const gap = 10;
    const tileW = (INNER - gap * 2) / 3;
    const tileH = 124;
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

      const ringSize = 62;
      ctx.save();
      ctx.translate(tx + (tileW - ringSize) / 2, ty + 11);
      drawMiniRing(ctx, ringSize, band.pctInt, band.isBest, band.isLow, theme);
      ctx.restore();

      text(band.name, tx + tileW / 2, ty + 92, 11.5, band.isBest ? theme.barBest : theme.ink, 650, "Nunito, FangYuan, sans-serif", tileW - 10, "center");
      text(`${band.earned} / ${band.max} 分`, tx + tileW / 2, ty + 110, 10, theme.subtle, 500, "Nunito, sans-serif", tileW - 10, "center");
    });
  };

  const drawRadarSection = y => {
    drawSectionIcon(ctx, "radar", PAD, y + 6, theme);
    text("能力轮廓", PAD + 19, y + 17.5, 13.5, theme.ink, 650, "FangYuan, Nunito, sans-serif", 140);
    if (bestBand) drawBestBadgeRight(y + 17.5, `${bestBand.name} ${bestBand.pctInt}%`);
    drawRichRadar(ctx, enriched, PAD, y + 26, INNER, 246, theme);
  };

  const drawTiming = y => {
    hline(y);
    drawSectionIcon(ctx, "clock", PAD, y + 14, theme);
    text("做题用时", PAD + 19, y + 25.5, 13.5, theme.ink, 650, "FangYuan, Nunito, sans-serif", 120);
    text(`${timing.actual} · 计划 ${timing.planned} 分（${timing.difference}）`, WIDTH - PAD, y + 25.5, 11, theme.muted, 450, "Nunito, FangYuan, sans-serif", 240, "right");
    (timing.modules || []).forEach((item, index) => {
      const rowY = y + 50 + index * 30;
      hline(rowY - 12);
      text(item.name, PAD, rowY + 6, 12, theme.muted);
      text(item.planned + " 分", WIDTH / 2, rowY + 6, 12, theme.subtle, 450, "Nunito, FangYuan, sans-serif", 100, "center");
      text(item.actual, WIDTH - PAD, rowY + 6, 12, theme.ink, 650, "Fraunces, Georgia, serif", 100, "right");
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
    cursor += 278 + 14;
    if (isRings) {
      drawRingsGrid(cursor, true);
      cursor += 34 + ringsBlockHeight(enriched);
    } else {
      drawVerticalBars(cursor);
      cursor += 238;
    }
    if (timing) {
      drawTiming(cursor + 14);
    }
  }

  // Clean QR Footer with subtle double-ring halo
  const footerTop = height - 92;
  hline(footerTop);
  const brandY = footerTop + 26;
  if (images.brand) {
    ctx.save();
    roundPath(PAD, brandY, 34, 34, 9);
    ctx.clip();
    ctx.drawImage(images.brand, PAD, brandY, 34, 34);
    ctx.restore();
  }
  text("卷卷小榜", PAD + 44, brandY + 14, 14.5, theme.ink, 650, "FangYuan, Nunito, sans-serif", 180);
  text("扫码同卷估分看排名", PAD + 44, brandY + 31, 11, theme.subtle, 500, "Nunito, FangYuan, sans-serif", 190);

  if (images.qrcode) {
    const qrSize = 64;
    const qrX = WIDTH - PAD - qrSize;
    const qrY = footerTop + 13;
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
  getStyle,
  splitScoreParts,
  enrichBands,
  outcomeMetrics,
  rulerTicks,
  drawDonut,
  drawMiniRing,
  drawRichRadar,
  posterHeight,
  drawPoster,
};
