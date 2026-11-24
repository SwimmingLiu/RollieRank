import { publisherName } from "./publishers";

export type TimerPaper = {
  id: string;
  institution: string;
  title: string;
  questionCount: number;
  number: number;
  project?: string;
  period?: string;
  variant?: string;
  timeLimitMinutes?: number;
  timeLimitKind?: "official" | "publisher" | "suggested";
};
export type TimerCollection = { id: string; label: string; detail: string; institution: string; papers: TimerPaper[] };

const visible = (text: string, institution: string) => institution === "四海" ? text.replace(/四海/g, publisherName(institution)) : text;
const compactVariant = (variant: string) => variant.replace(/地市级\s*\/\s*行政执法类/g, "地市 / 执法").replace(/副省级/g, "副省");
// 题量是卷内属性，不是系列层级；与原生目录共用 .raw 的目录边界。
const collectionVariant = (variant: string) => /^\d+题版$/.test(variant.trim()) ? "" : variant;
// 安卓微信精简 V8 引擎不含 Intl，缺失时回退到纯 JS 数字自然排序，避免模块加载期直接白屏。
const naturalCollator = typeof Intl !== "undefined" && typeof Intl.Collator === "function"
  ? new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" })
  : null;
function compareNatural(a: string, b: string): number {
  if (naturalCollator) return naturalCollator.compare(a, b);
  const left = a.toLowerCase().match(/\d+|\D+/g) || [];
  const right = b.toLowerCase().match(/\d+|\D+/g) || [];
  const limit = Math.min(left.length, right.length);
  for (let i = 0; i < limit; i += 1) {
    if (left[i] === right[i]) continue;
    if (/^\d+$/.test(left[i]) && /^\d+$/.test(right[i])) {
      const diff = Number(left[i]) - Number(right[i]);
      if (diff !== 0) return diff;
    }
    return left[i] < right[i] ? -1 : 1;
  }
  return left.length - right.length;
}
const issueNumber = (label: string) => {
  const value = label.split(" · ")[0]?.replace(/\s+/g, "") ?? "";
  const digits = value.match(/^(?:第)?(\d+)期$/);
  if (digits) return Number(digits[1]);
  const chinese = value.match(/^(?:第)?([一二三四五六七八九]|[一二三四五六七八九]?十[一二三四五六七八九]?)期$/);
  if (!chinese) return Number.MAX_SAFE_INTEGER;
  const source = "一二三四五六七八九";
  const [tens, units] = chinese[1].split("十");
  if (units === undefined) return source.indexOf(tens) + 1;
  return (tens ? source.indexOf(tens) + 1 : 1) * 10 + (units ? source.indexOf(units) + 1 : 0);
};
const issueLabel = (period: string) => {
  const value = period.trim();
  const number = issueNumber(value);
  return number === Number.MAX_SAFE_INTEGER ? value : `第${number}期`;
};

// 期数和卷别来自实际元数据，避免所有花生卷混在一列或把内部键当成期号。
export function timerCollections(papers: readonly TimerPaper[]): TimerCollection[] {
  const groups = new Map<string, TimerCollection>();
  for (const paper of papers) {
    const project = paper.project?.trim() ?? "", period = paper.period?.trim() ?? "", variant = collectionVariant(paper.variant?.trim() ?? "");
    const id = JSON.stringify([paper.institution, project, period, variant]);
    const label = visible([issueLabel(period), compactVariant(variant)].filter(Boolean).join(" · ") || project || "套卷", paper.institution);
    const detail = visible(project && project !== label ? project : "", paper.institution);
    if (!groups.has(id)) groups.set(id, { id, label, detail, institution: paper.institution, papers: [] });
    groups.get(id)?.papers.push(paper);
  }
  return [...groups.values()].sort((a, b) =>
    compareNatural(a.detail || "", b.detail || "") ||
    issueNumber(a.label) - issueNumber(b.label) ||
    compareNatural(a.label, b.label) || compareNatural(a.id, b.id));
}

export function timerPaperTitle(paper: TimerPaper, compact = false) {
  const title = visible(paper.title, paper.institution);
  const parts = title.split(/\s*·\s*/);
  const tail = parts[parts.length - 1] ?? title;
  return compact && (/^第\s*\d+\s*套$/.test(tail) || /^(?:混合组卷\d+|\d{4}国考卷)$/.test(tail)) ? tail : title;
}

export function timerPaperSearchText(paper: TimerPaper) {
  return [publisherName(paper.institution), timerPaperTitle(paper), paper.project, paper.period, paper.variant, paper.number].filter(value => value !== undefined).join(" ").toLowerCase();
}
