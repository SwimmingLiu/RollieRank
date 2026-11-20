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

const visible = (text: string, institution: string) => institution === "四海" ? text.replaceAll("四海", publisherName(institution)) : text;
const compactVariant = (variant: string) => variant.replace(/地市级\s*\/\s*行政执法类/g, "地市 / 执法").replaceAll("副省级", "副省");
const natural = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
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
    const project = paper.project?.trim() ?? "", period = paper.period?.trim() ?? "", variant = paper.variant?.trim() ?? "";
    const id = JSON.stringify([paper.institution, project, period, variant]);
    const label = visible([issueLabel(period), compactVariant(variant)].filter(Boolean).join(" · ") || project || "套卷", paper.institution);
    const detail = visible(project && project !== label ? project : "", paper.institution);
    if (!groups.has(id)) groups.set(id, { id, label, detail, institution: paper.institution, papers: [] });
    groups.get(id)?.papers.push(paper);
  }
  return [...groups.values()].sort((a, b) =>
    natural.compare(a.detail || "", b.detail || "") ||
    issueNumber(a.label) - issueNumber(b.label) ||
    natural.compare(a.label, b.label) || natural.compare(a.id, b.id));
}

export function timerPaperTitle(paper: TimerPaper, compact = false) {
  const title = visible(paper.title, paper.institution);
  const tail = title.split(/\s*·\s*/).at(-1) ?? title;
  return compact && (/^第\s*\d+\s*套$/.test(tail) || /^(?:混合组卷\d+|\d{4}国考卷)$/.test(tail)) ? tail : title;
}

export function timerPaperSearchText(paper: TimerPaper) {
  return [publisherName(paper.institution), timerPaperTitle(paper), paper.project, paper.period, paper.variant, paper.number].filter(value => value !== undefined).join(" ").toLocaleLowerCase("zh-CN");
}
