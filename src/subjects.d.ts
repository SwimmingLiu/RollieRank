export type SectionScore = { name: string; earnedCents: number; maxCents: number };
export const JUDGMENT_ID: "judgment";
export function isJudgmentSection(name: string): boolean;
export function subjectName(name: string): string;
export function subjectId(id: string, name: string): string;
export function primarySectionScores(sections: readonly SectionScore[]): SectionScore[];
