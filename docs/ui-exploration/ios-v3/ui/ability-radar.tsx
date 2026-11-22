import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip } from "chart.js";
import { Card, CardContent, CardHeader } from "./components/motion/card";
import type { SectionScore } from "./results";
import { primarySectionScores } from "../score-groups.js";

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip);
const rate = (section: SectionScore) => Math.round(section.earnedCents / section.maxCents * 1000) / 10;

// Normalised earned/max scores make subjects with different weights comparable; no extra ability score is invented.
export function AbilityRadar({ sections }: { sections: SectionScore[] }) {
  const axes = primarySectionScores(sections);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let chart: Chart<"radar"> | undefined;
    let disposed = false;
    canvas.dataset.ready = "false";
    void document.fonts.ready.then(() => {
      if (disposed) return;
      const family = getComputedStyle(canvas).fontFamily;
      chart = new Chart<"radar">(canvas, {
        type: "radar",
        data: { labels: axes.map(section => section.name), datasets: [{ label: "本卷得分率", data: axes.map(rate), fill: true, backgroundColor: "rgba(174, 128, 74, 0.18)", borderColor: "#a97b46", borderWidth: 2, pointBackgroundColor: "#9b6b35", pointBorderColor: "#fffaf2", pointBorderWidth: 2, pointRadius: 3, pointHitRadius: 12, pointHoverRadius: 5 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          // 450px画稿导出为900px PNG，低DPR设备也需至少2倍画布，避免标签和网格被二次放大。
          devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
          animation: reduce ? false : { duration: 500, easing: "easeOutQuart", onComplete: () => { canvas.dataset.ready = "true"; } },
          plugins: { legend: { display: false }, tooltip: { displayColors: false, backgroundColor: "#302d25", padding: 11, titleFont: { family, size: 13 }, bodyFont: { family, size: 13 }, callbacks: { label: item => `${Number(item.raw)}%` } } },
          scales: { r: { min: 0, max: 100, angleLines: { color: "#e7dece" }, grid: { color: "#e7dece" }, pointLabels: { color: "#6c6252", padding: 9, font: { family, size: 12, weight: 500 } }, ticks: { stepSize: 25, showLabelBackdrop: false, color: "#a19582", font: { family, size: 9 }, callback: value => value === 0 ? "" : `${value}%` } } },
        },
      });
      if (reduce) canvas.dataset.ready = "true";
    });
    return () => { disposed = true; chart?.destroy(); };
  }, [sections, reduce]);
  return <Card className="rr6-radar-card"><CardHeader><h2>能力概览</h2><span>本卷得分率</span></CardHeader><CardContent><div className="rr6-radar-plot"><canvas ref={canvasRef} role="img" aria-label={`板块得分率：${axes.map(section => `${section.name}${rate(section)}%`).join("，")}`} /></div><ul className="rr6-radar-data">{axes.map(section => <li key={section.name} data-rate={rate(section)}>{section.name}：{rate(section)}%</li>)}</ul></CardContent></Card>;
}
