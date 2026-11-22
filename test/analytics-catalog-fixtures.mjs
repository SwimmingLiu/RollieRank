import { IMPORTED_PAPERS } from "../src/data/imported-papers.js";
import { gradeVersion } from "../src/model.js";

// 直接使用已导入题库的真实权重，避免130/135题的分组回归被相同虚构分值掩盖。
export function catalogAttempt({ paperId, id = paperId, createdAt = 1, answer = "A" }) {
  const paper = IMPORTED_PAPERS.find(item => item.id === paperId);
  if (!paper) throw new Error(`Missing imported paper ${paperId}`);
  const questions = Array.from({ length: paper.questionCount }, (_, index) => {
    const section = paper.sections.find(item => index + 1 >= item.start && index + 1 <= item.end);
    return { number: index + 1, type: section.name, typeId: section.id, cents: section.cents, correctAnswer: paper.answerKey[index] };
  });
  const answers = Array(paper.questionCount).fill(answer);
  return { id, paperId, versionId: `${paperId}:v1`, paperTitle: paper.title, institution: paper.institution,
    project: paper.project, period: paper.period, variant: paper.variant, createdAt, answers,
    report: gradeVersion({ questions, scoringRule: paper.scoringRule }, answers) };
}
