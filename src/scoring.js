export const QUESTION_COUNT = 130;
export const OPTIONS = ['A', 'B', 'C', 'D'];

export const SECTIONS = [
  { id: 'politics', name: '政治理论', short: '政治', start: 1, end: 20 },
  { id: 'general', name: '常识判断', short: '常识', start: 21, end: 35 },
  { id: 'verbal', name: '言语理解', short: '言语', start: 36, end: 65 },
  { id: 'quant', name: '数量关系', short: '数量', start: 66, end: 75 },
  { id: 'reasoning', name: '判断推理', short: '判断', start: 76, end: 110 },
  { id: 'data', name: '资料分析', short: '资料', start: 111, end: 130 },
];

// 国考 130 题（地市级 / 行政执法）经典分值：满 100 分，无折算小数。
export const DEFAULT_RULES = [
  { id: 'politics', name: '政治理论', start: 1, end: 20, count: 20, cents: 50 },
  { id: 'general', name: '常识判断', start: 21, end: 35, count: 15, cents: 50 },
  { id: 'verbal', name: '言语理解', start: 36, end: 65, count: 30, cents: 80 },
  { id: 'quant', name: '数量关系', start: 66, end: 75, count: 10, cents: 100 },
  { id: 'graphic', name: '图形推理', start: 76, end: 85, count: 10, cents: 80 },
  { id: 'definition', name: '定义判断', start: 86, end: 95, count: 10, cents: 80 },
  { id: 'analogy', name: '类比推理', start: 96, end: 100, count: 5, cents: 80 },
  { id: 'logic', name: '逻辑判断', start: 101, end: 110, count: 10, cents: 85 },
  { id: 'data', name: '资料分析', start: 111, end: 130, count: 20, cents: 100 },
];

// 国考 135 题（副省级）经典分值：满 100 分，无折算小数。
export const PROVINCIAL_RULES = [
  { id: 'politics', name: '政治理论', start: 1, end: 20, count: 20, cents: 50 },
  { id: 'common', name: '常识判断', start: 21, end: 35, count: 15, cents: 50 },
  { id: 'language', name: '言语理解', start: 36, end: 65, count: 30, cents: 80 },
  { id: 'quantity', name: '数量关系', start: 66, end: 80, count: 15, cents: 80 },
  { id: 'graphic', name: '图形推理', start: 81, end: 90, count: 10, cents: 80 },
  { id: 'definition', name: '定义判断', start: 91, end: 100, count: 10, cents: 80 },
  { id: 'analogy', name: '类比推理', start: 101, end: 105, count: 5, cents: 50 },
  { id: 'logic', name: '逻辑判断', start: 106, end: 115, count: 10, cents: 80 },
  { id: 'data', name: '资料分析', start: 116, end: 135, count: 20, cents: 100 },
];

export function validateRules(rules) {
  if (!Array.isArray(rules) || rules.length !== DEFAULT_RULES.length) throw new Error('评分规则不完整。');
  const occupied = new Set();
  let total = 0;
  for (const standard of DEFAULT_RULES) {
    const matches = rules.filter(rule => rule.id === standard.id);
    if (matches.length !== 1) throw new Error('评分题型缺失或重复。');
    const rule = matches[0];
    const isReasoning = ['graphic', 'definition', 'analogy', 'logic'].includes(rule.id);
    if (!Number.isInteger(rule.start) || !Number.isInteger(rule.end) || rule.start < 1 || rule.end > 130 || rule.end - rule.start + 1 !== standard.count) {
      throw new Error(`${standard.name}应包含连续的 ${standard.count} 题。`);
    }
    if (rule.cents !== standard.cents || rule.name !== standard.name || rule.count !== standard.count) throw new Error('分值和题量须与 130 题评分参考一致。');
    if (isReasoning ? rule.start < 76 || rule.end > 110 : rule.start !== standard.start || rule.end !== standard.end) {
      throw new Error('判断推理的子题型须在 76–110 题内，其他模块题号固定。');
    }
    for (let q = rule.start; q <= rule.end; q++) {
      if (occupied.has(q)) throw new Error(`第 ${q} 题的题型范围重叠。`);
      occupied.add(q);
      total += rule.cents;
    }
  }
  if (occupied.size !== QUESTION_COUNT || total !== 10000) throw new Error('规则须覆盖全部 130 题，满分为 100 分。');
  return rules;
}

export function sectionFor(question) {
  return SECTIONS.find(section => question >= section.start && question <= section.end);
}

export function ruleFor(question, rules = DEFAULT_RULES) {
  return rules.find(rule => question >= rule.start && question <= rule.end);
}

export function formatScore(cents) {
  return (cents / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function scorePaper(answerKey, answers, rules = DEFAULT_RULES) {
  validateRules(rules);
  if (typeof answerKey !== 'string' || !/^[A-D]{130}$/.test(answerKey)) throw new Error('参考答案必须包含完整的 130 个选项。');
  if (!Array.isArray(answers) || answers.length !== QUESTION_COUNT || !answers.every(answer => answer === null || OPTIONS.includes(answer))) {
    throw new Error('个人答案须为 130 个 A、B、C、D 或空值。');
  }
  const rows = Array.from(answerKey, (correctAnswer, index) => {
    const question = index + 1;
    const rule = ruleFor(question, rules);
    const answer = answers[index];
    const status = answer === null ? 'blank' : answer === correctAnswer ? 'correct' : 'wrong';
    return { question, type: rule.name, typeId: rule.id, sectionId: sectionFor(question).id, answer, correctAnswer, status, maxCents: rule.cents, cents: status === 'correct' ? rule.cents : 0 };
  });
  const breakdown = rules.map(rule => {
    const questions = rows.filter(row => row.typeId === rule.id);
    return { ...rule, correct: questions.filter(row => row.status === 'correct').length, answered: questions.filter(row => row.status !== 'blank').length, centsEarned: questions.reduce((sum, row) => sum + row.cents, 0), maxCents: rule.count * rule.cents };
  });
  return { rows, breakdown, totalCents: rows.reduce((sum, row) => sum + row.cents, 0), correct: rows.filter(row => row.status === 'correct').length, wrong: rows.filter(row => row.status === 'wrong').length, blank: rows.filter(row => row.status === 'blank').length };
}

export function exportCsv(paper, report) {
  const labels = { correct: '正确', wrong: '错误', blank: '未作答' };
  const quote = value => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ['套卷', '题号', '题型', '我的答案', '参考答案', '结果', '题目分值', '得分'],
    ...report.rows.map(row => [paper.title, row.question, row.type, row.answer ?? '', row.correctAnswer, labels[row.status], formatScore(row.maxCents), formatScore(row.cents)]),
  ];
  return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n');
}
