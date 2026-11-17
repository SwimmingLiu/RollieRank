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

// 期数和卷别来自实际元数据，避免所有花生卷混在一列或把内部键当成期号。
export function timerCollections(papers: readonly TimerPaper[]): TimerCollection[] {
  const groups = new Map<string, TimerCollection>();
  for (const paper of papers) {
    const project = paper.project?.trim() ?? "", period = paper.period?.trim() ?? "", variant = paper.variant?.trim() ?? "";
    const id = JSON.stringify([paper.institution, project, period, variant]);
    const label = visible([period, compactVariant(variant)].filter(Boolean).join(" · ") || project || "套卷", paper.institution);
    const detail = visible(project && project !== label ? project : "", paper.institution);
    if (!groups.has(id)) groups.set(id, { id, label, detail, institution: paper.institution, papers: [] });
    groups.get(id)?.papers.push(paper);
  }
  return [...groups.values()];
}

export function timerPaperTitle(paper: TimerPaper, compact = false) {
  const title = visible(paper.title, paper.institution);
  const tail = title.split(/\s*·\s*/).at(-1) ?? title;
  return compact && (/^第\s*\d+\s*套$/.test(tail) || /^(?:混合组卷\d+|\d{4}国考卷)$/.test(tail)) ? tail : title;
}

export function timerPaperSearchText(paper: TimerPaper) {
  return [publisherName(paper.institution), timerPaperTitle(paper), paper.project, paper.period, paper.variant, paper.number].filter(value => value !== undefined).join(" ").toLocaleLowerCase("zh-CN");
}
