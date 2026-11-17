export type SectionScore = { name: string; earnedCents: number; maxCents: number };
export function isJudgmentSection(name: string): boolean;
export function primarySectionScores(sections: readonly SectionScore[]): SectionScore[];
