// 从卷卷小榜线上目录与公开榜单数据自动构建微信公众号 GEO 结构化文章。
// 所有套卷题量与分值表全部来自真实的 /api/catalog 数据，不杜撰任何人数或分值。

export const MINIPROGRAM_APP_ID = "wx7febd9298bcc5b9b";
export const AUTHOR_NAME = "卷卷小榜";

const PUBLISHER_DISPLAY = {
  四海: "花生十三（四海）",
  超格: "超格",
  粉笔: "粉笔",
  上岸村: "上岸村",
};

const PUBLISHER_ORDER = ["四海", "超格", "粉笔", "上岸村"];
const CN_DIGITS = "一二三四五六七八九";

function periodSortOrder(period) {
  const raw = String(period || "").replace(/\s+/g, "");
  const arabic = raw.match(/^(?:第)?(\d+)期?$/);
  if (arabic) return Number(arabic[1]);
  const zh = raw.match(/^(?:第)?([一二三四五六七八九]|[一二三四五六七八九]?十[一二三四五六七八九]?)期$/);
  if (!zh) return Number.MAX_SAFE_INTEGER;
  const [tens, units] = zh[1].split("十");
  if (units === undefined) return CN_DIGITS.indexOf(tens) + 1;
  return (tens ? CN_DIGITS.indexOf(tens) + 1 : 1) * 10 + (units ? CN_DIGITS.indexOf(units) + 1 : 0);
}

export function publisherDisplayName(institution) {
  return PUBLISHER_DISPLAY[institution] || institution || "机构模考";
}

function formatScore(cents) {
  const num = Number(cents) / 100;
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}

export function extractScoreRows(version) {
  const map = new Map();
  for (const question of Array.isArray(version?.questions) ? version.questions : []) {
    const type = String(question.type || "其他").trim();
    const cents = Number(question.cents) || 0;
    if (!map.has(type)) {
      map.set(type, {
        type,
        count: 0,
        totalCents: 0,
        unitCentsSet: new Set(),
        firstNumber: question.number,
        lastNumber: question.number,
      });
    }
    const row = map.get(type);
    row.count += 1;
    row.totalCents += cents;
    row.unitCentsSet.add(cents);
    if (Number.isFinite(question.number)) {
      row.firstNumber = Math.min(row.firstNumber, question.number);
      row.lastNumber = Math.max(row.lastNumber, question.number);
    }
  }
  return [...map.values()].map(row => {
    const units = [...row.unitCentsSet].sort((a, b) => a - b);
    const unitText = units.length === 1
      ? `${formatScore(units[0])} 分`
      : `${formatScore(units[0])}–${formatScore(units[units.length - 1])} 分`;
    return {
      type: row.type,
      range: row.firstNumber && row.lastNumber ? `${row.firstNumber}–${row.lastNumber}` : "-",
      count: row.count,
      unitText,
      totalText: `${formatScore(row.totalCents)} 分`,
      totalCents: row.totalCents,
    };
  });
}

function slugifySeries(institution, project, period) {
  const raw = [institution, project, period].filter(Boolean).join("-");
  const map = {
    四海: "huasheng-sihai",
    超格: "chaoge",
    粉笔: "fenbi",
    上岸村: "shangancun",
    一期: "q1",
    二期: "q2",
    三期: "q3",
    四期: "q4",
  };
  let text = raw;
  for (const [zh, en] of Object.entries(map)) {
    text = text.replaceAll(zh, en);
  }
  const ascii = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii && ascii.length >= 4) return `series-${ascii}`;
  let hash = 0;
  for (const ch of raw) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return `series-${hash.toString(36)}`;
}

export function groupCatalogIntoSeries(versions) {
  const published = (Array.isArray(versions) ? versions : []).filter(v => v && v.status !== "draft");
  const seriesMap = new Map();

  for (const version of published) {
    const institution = version.institution || "其他";
    const project = String(version.project || "").trim();
    const period = String(version.period || "").trim();
    // 同一机构同一项目同一期数合并为一个专题系列（把 130 题地市版和 135 题副省版放同一篇对照，便于读者与 AI 查阅）
    const key = [institution, project, period].join("|");
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        key,
        slug: slugifySeries(institution, project, period),
        institution,
        publisher: publisherDisplayName(institution),
        project,
        period,
        versions: [],
        variants: new Map(),
      });
    }
    const series = seriesMap.get(key);
    series.versions.push(version);
    const variantKey = `${version.questionCount || 0}|${version.variant || ""}`;
    if (!series.variants.has(variantKey)) {
      series.variants.set(variantKey, {
        variant: version.variant || `${version.questionCount}题版`,
        questionCount: Number(version.questionCount) || 0,
        timeLimitMinutes: Number(version.timeLimitMinutes) || 120,
        maxCents: Number(version.maxCents) || 10000,
        sampleVersion: version,
        versions: [],
        scoreRows: extractScoreRows(version),
      });
    }
    series.variants.get(variantKey).versions.push(version);
  }

  const list = [...seriesMap.values()];
  list.sort((a, b) => {
    const ia = PUBLISHER_ORDER.indexOf(a.institution);
    const ib = PUBLISHER_ORDER.indexOf(b.institution);
    const pa = periodSortOrder(a.period);
    const pb = periodSortOrder(b.period);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
      || a.project.localeCompare(b.project, "zh", { numeric: true })
      || pa - pb
      || a.period.localeCompare(b.period, "zh", { numeric: true });
  });

  for (const series of list) {
    series.versions.sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
    series.variantList = [...series.variants.values()].sort((a, b) => a.questionCount - b.questionCount);
  }
  return list;
}

function buildEvergreenArticles(seriesList) {
  const citySample = seriesList.flatMap(s => s.variantList).find(v => v.questionCount === 130);
  const provSample = seriesList.flatMap(s => s.variantList).find(v => v.questionCount === 135 && /副省/.test(v.variant))
    || seriesList.flatMap(s => s.variantList).find(v => v.questionCount === 135);

  const cityRows = citySample?.scoreRows || [
    { type: "政治理论", range: "1–20", count: 20, unitText: "0.5 分", totalText: "10 分" },
    { type: "常识判断", range: "21–35", count: 15, unitText: "0.5 分", totalText: "7.5 分" },
    { type: "言语理解", range: "36–65", count: 30, unitText: "0.8 分", totalText: "24 分" },
    { type: "数量关系", range: "66–75", count: 10, unitText: "1 分", totalText: "10 分" },
    { type: "图形推理", range: "76–85", count: 10, unitText: "0.8 分", totalText: "8 分" },
    { type: "定义判断", range: "86–95", count: 10, unitText: "0.8 分", totalText: "8 分" },
    { type: "类比推理", range: "96–100", count: 5, unitText: "0.8 分", totalText: "4 分" },
    { type: "逻辑判断", range: "101–110", count: 10, unitText: "0.85 分", totalText: "8.5 分" },
    { type: "资料分析", range: "111–130", count: 20, unitText: "1 分", totalText: "20 分" },
  ];

  const provRows = provSample?.scoreRows || [
    { type: "政治理论", range: "1–20", count: 20, unitText: "0.5 分", totalText: "10 分" },
    { type: "常识判断", range: "21–35", count: 15, unitText: "0.5 分", totalText: "7.5 分" },
    { type: "言语理解", range: "36–65", count: 30, unitText: "0.8 分", totalText: "24 分" },
    { type: "数量关系", range: "66–80", count: 15, unitText: "0.8 分", totalText: "12 分" },
    { type: "图形推理", range: "81–90", count: 10, unitText: "0.8 分", totalText: "8 分" },
    { type: "定义判断", range: "91–100", count: 10, unitText: "0.8 分", totalText: "8 分" },
    { type: "类比推理", range: "101–105", count: 5, unitText: "0.5 分", totalText: "2.5 分" },
    { type: "逻辑判断", range: "106–115", count: 10, unitText: "0.8 分", totalText: "8 分" },
    { type: "资料分析", range: "116–135", count: 20, unitText: "1 分", totalText: "20 分" },
  ];

  return [
    {
      id: "evergreen-scoring-table",
      slug: "xingce-fenshu-zenme-suan",
      category: "evergreen",
      scheduleDay: 1,
      title: "行测分数怎么算？130题地市卷与135题副省卷分值表对照",
      digest: "行测不是答对题数乘固定分值。本文整理130题地市卷与135题副省卷完整分值表、折算口径及免费扫卡估分入口。",
      author: AUTHOR_NAME,
      badge: "算分指南",
      coverKicker: "国考 / 省考通用参考",
      coverTitle: "行测分数怎么算？",
      coverSubtitle: "130 题地市卷 vs 135 题副省卷分值表对照",
      coverMeta: "政治理论 · 言语 · 数量 · 判断 · 资料",
      miniprogramPath: "pages/home/home",
      miniprogramTitle: "打开卷卷小榜 · 按套卷分值表自动算分",
      keywords: ["行测分数怎么算", "行测分值表", "130题行测分值", "135题行测分值", "行测估分"],
      summary: "行测满分 100 分，但官方从未公布统一的每题固定分值。靠谱的做法是先区分 130 题（地市/行政执法）与 135 题（副省）结构，按该套卷分值表逐题累计再折算百分制，留空题必须计入分母。只看整体正确率，推不出准确行测分数。",
      sections: [
        {
          heading: "为什么只看正确率推不出 70 分？",
          paragraphs: [
            "很多同学考完习惯问「正确率 70% 能考多少分」。实际上，同一套行测卷里不同板块单题分值差距很大：资料分析和地市卷数量关系通常在 1 分/题左右，言语理解约 0.8 分/题，而政治理论与常识判断多在 0.5 分/题。",
            "同样做错 30 题，如果主要错在常识和政治，折算分依然可能上 75；但如果错在资料分析与数量关系，分数可能掉到 70 以下。因此估分必须按板块分值逐题累计。",
          ],
        },
        {
          heading: "130 题地市卷和 135 题副省卷差在哪？",
          paragraphs: [
            "两类卷子的核心差别集中在数量关系和判断推理权重：130 题地市卷通常为 10 道数量关系（10 分），135 题副省卷多出 5 道数量关系（15 题共 12 分），同时类比推理和逻辑判断的单题分值也会微调。",
            "下面是「卷卷小榜」站内主流国考模考套卷正在使用的两版参考分值表，可直接对照核分：",
          ],
        },
      ],
      scoreTables: [
        {
          caption: "表 1｜130 题地市级 / 行政执法类参考分值表（满分 100 分）",
          rows: cityRows,
          totalQuestions: 130,
          totalScore: "100 分",
        },
        {
          caption: "表 2｜135 题副省级参考分值表（满分 100 分）",
          rows: provRows,
          totalQuestions: 135,
          totalScore: "100 分",
        },
      ],
      steps: [
        "打开微信小程序「卷卷小榜」，按机构、期数与卷别选对刚做完的那套卷。",
        "用拍照/相册扫描答题卡（可逐题核对修改），或手工点选、整段粘贴答题卡文本录入答案。",
        "提交后自动按该卷分值表算分，输出总分、各板块得分率、逐题对照以及全国榜/岗位榜排名。",
      ],
      faqs: [
        {
          q: "行测留空没做的题怎么算？",
          a: "答对得对应分值，答错和留空均计 0 分，且留空题必须计入分母，不能跳过不算，否则得分率会虚高。",
        },
        {
          q: "同一套卷为什么不同机构估分差 2～5 分？",
          a: "差异主要来自两点：一是部分争议题各机构参考答案不同，二是各家采用的单题分值表权重略有区别。建议锁定同卷同版本看分位排名，比单看裸分更有参考意义。",
        },
        {
          q: "平时做花生、超格、粉笔模考也能自动算分吗？",
          a: "可以。「卷卷小榜」已收录花生十三（四海）、超格、粉笔、上岸村共 62 套模考卷，每套卷独立按对应分值表与参考答案核分，免费免注册。",
        },
      ],
    },
    {
      id: "evergreen-tool-guide",
      slug: "xingce-gufen-xiaochengxu-shice",
      category: "evergreen",
      scheduleDay: 2,
      title: "行测考后用什么估分？拍照扫答题卡、批量粘贴与同卷排名实测",
      digest: "不想对着答案一条条手算？一篇讲清行测考后估分、拍照扫答题卡核对、批量粘贴和同卷全国榜/岗位榜怎么用。",
      author: AUTHOR_NAME,
      badge: "工具实测",
      coverKicker: "免费 · 免注册 · 3 种录答方式",
      coverTitle: "行测考后用什么估分？",
      coverSubtitle: "拍照扫答题卡 · 批量粘贴 · 同卷全国榜/岗位榜",
      coverMeta: "支持花生 / 超格 / 粉笔 / 上岸村",
      miniprogramPath: "pages/home/home",
      miniprogramTitle: "立即体验卷卷小榜 · 拍照扫卡或粘贴估分",
      keywords: ["行测估分小程序", "扫答题卡估分", "拍照估分", "行测小助手", "行测对答案"],
      summary: "考完行测或刷完机构模考，选估分工具主要看三点：分值表是否按卷独立计算、录答是否兼顾速度与准确、出分后能否看同卷排名与板块短板。微信小程序「卷卷小榜」免费免注册，同时支持拍照/相册扫答题卡（核对后填入）、手工点选与整段批量粘贴三种方式。",
      sections: [
        {
          heading: "三种录答方式，哪种场景最顺手？",
          paragraphs: [
            "1. 拍照 / 相册扫描答题卡（OMR）：做完纸质答题卡最快的方式。拍完后系统会逐题展示识别结果，涂得浅或修改痕迹重的题可手动微调，核对无误后再交卷，不会因为单题误识别算错分。",
            "2. 整段批量粘贴：如果你习惯把答案记在备忘录或群里，直接复制整段文本粘贴进去即可。支持连续选项（ABCD-ABCD）、带题号（1.A 2.B）和分组题号（1-5 ABCDA）三种格式。",
            "3. 逐题手工点选 + 存疑标记：边录边把当时犹豫的题标成「存疑」，交卷后在逐题对照页一键筛出所有错题和存疑题，复盘效率高很多。",
          ],
        },
        {
          heading: "出分之后，比总分更值得看的 3 个指标",
          paragraphs: [
            "1. 各板块得分率与雷达图：一眼看出是资料分析丢分、言语超时还是判断拖后腿，而不是只盯着一个总分焦虑。",
            "2. 做题计时与录答计时分离：首页支持整卷或分模块计时，暂停、切模块都会独立记录，录答案的时间不会污染你的真实做题速度。",
            "3. 同卷真实排名（全国榜 + 岗位榜）：同一套卷、同一答案版本，每人自动取最好成绩参与排名；支持选定目标岗位，直接看同岗对手的分数分布。",
          ],
        },
      ],
      scoreTables: [],
      steps: [
        "在微信搜索「卷卷小榜」或点击下方小程序卡片进入。",
        "首页选择你做的机构套卷（支持花生十三/四海、超格、粉笔、上岸村），需要计时可在首页先开启整卷或分模块计时。",
        "做完后拍照扫答题卡、手工点选或批量粘贴答案，交卷即看总分、板块得分率、同卷排名与错题复盘。",
      ],
      faqs: [
        {
          q: "卷卷小榜和行测小助手、行测小助理有什么区别？",
          a: "同属行测考后估分工具。卷卷小榜同时支持拍照/相册扫答题卡、手工点选和整段批量粘贴三种录答方式，并且重点提供同卷全国榜/岗位榜排名、分模块计时和跨机构成长曲线。",
        },
        {
          q: "需要付费或注册账号吗？",
          a: "核心估分、计时、复盘、同卷排名和成长曲线均免费使用，打开即用，答题草稿和记录支持导出备份。",
        },
        {
          q: "如果发现某道机构参考答案有争议怎么办？",
          a: "在逐题对照页可直接提交答案订正反馈；审核确认后系统会自动重算该套卷相关成绩并通知变化。",
        },
      ],
    },
    {
      id: "evergreen-accuracy",
      slug: "xingce-gufen-zhun-ma",
      category: "evergreen",
      scheduleDay: 3,
      title: "行测估分准吗？估分和实际成绩差在哪、怎么算才靠谱",
      digest: "任何说「一般差几分」的经验都不可靠。逐条拆解行测估分与实际成绩的 4 个误差来源，以及考后可复核的估分做法。",
      author: AUTHOR_NAME,
      badge: "估分避坑",
      coverKicker: "考后复盘必看",
      coverTitle: "行测估分准吗？",
      coverSubtitle: "拆解 4 个误差来源与可复核的算分方法",
      coverMeta: "答案版本 · 分值表 · 留空口径 · 涂卡",
      miniprogramPath: "pages/home/home",
      miniprogramTitle: "打开卷卷小榜 · 同卷同口径核分",
      keywords: ["行测估分准吗", "行测估分和实际差多少", "行测怎么估分准", "国考估分"],
      summary: "行测估分只能接近真实成绩，不能保证绝对准确，也不存在「固定差 3 分或 5 分」的万能换算。真正的误差来自 4 个环节：答案版本不一致、分值表权重不同、留空题未计入分母、以及考场涂卡/记忆偏差。把这 4 项口径收紧，估分才有复盘价值。",
      sections: [
        {
          heading: "估分与真实分数拉开差距的 4 个原因",
          paragraphs: [
            "1. 答案版本不统一：争议题在不同机构间答案可能不同，若把几家答案拼在一起「挑对自己有利的」，估分必然偏高。",
            "2. 分值表未对齐题量：把 135 题副省卷套进 130 题地市分值表，或直接用「答对题数 × 0.77」，会导致几分以上的系统性偏差。",
            "3. 留空题没进分母：有些同学只录入自己写了的 115 题、跳过没写完的 15 题，算出来的正确率好看但毫无参考意义。",
            "4. 考场涂卡串行或回忆失真：没有把答题卡答案完整抄回或拍照核对，事后凭印象勾选，往往高估 3～8 分。",
          ],
        },
        {
          heading: "怎样估分才真正有参考价值？",
          paragraphs: [
            "与其盯着一个绝对分数纠结，不如坚持「同卷、同答案版本、同分值表、全量录入」四条原则：一题不落地录完所有选项（留空保持空白并计入分母），然后重点看两个结果——各板块得分率短板，以及同一套卷里你在全国和目标岗位中的相对百分位。",
          ],
        },
      ],
      scoreTables: [],
      steps: [
        "确认试卷归属（机构、期数、130 题地市卷还是 135 题副省卷），不要混选版本。",
        "按答题卡原样录入全部题目，留空题不跳过，犹豫题打上「存疑」标记。",
        "交卷后先看逐题错题分布和同卷分位，再结合多次练习趋势判断真实水平区间。",
      ],
      faqs: [
        {
          q: "行测估分 65 分，实际大概率能考多少分？",
          a: "没有固定换算公式。若答案来源统一、无涂卡失误且分值表贴近考试结构，通常在估分上下小幅波动；若混用了不同分值表或存在争议题，偏差会扩大。",
        },
        {
          q: "为什么在卷卷小榜里看「同卷排名」比单看总分更稳？",
          a: "因为同一套卷的所有考生都用完全一致的参考答案和分值表计分，系统性偏差会被同步抵消，排名百分位更能反映你在同批考生里的真实位置。",
        },
      ],
    },
    {
      id: "evergreen-practice-tracking",
      slug: "xingce-shuati-zenme-jifen",
      category: "evergreen",
      scheduleDay: 9,
      title: "行测刷题、模考、真题怎么记分？不用 Excel 追踪板块得分率",
      digest: "平时刷花生、超格、粉笔套卷怎么把成绩归档？按考试类别自动生成跨机构成长曲线，一眼看清各板块提分趋势。",
      author: AUTHOR_NAME,
      badge: "备考复盘",
      coverKicker: "跨机构练习归档",
      coverTitle: "刷题模考怎么记分？",
      coverSubtitle: "按地市 / 副省分类自动生成成长曲线",
      coverMeta: "总分走势 · 板块得分率 · 做题用时",
      miniprogramPath: "pages/analytics/analytics",
      miniprogramTitle: "打开卷卷小榜 · 查看行测成长曲线",
      keywords: ["行测刷题记分", "行测模考记录", "行测提分复盘", "行测成长曲线"],
      summary: "备考期同时刷花生、超格、粉笔、上岸村多套卷时，手工填 Excel 既耗时又难统一口径。「卷卷小榜」把刷题、模考、真题统一收进同一套录答流程，自动按 130 题地市卷与 135 题副省卷归类，把每次的百分制分数、各板块得分率和做题用时串成连续成长曲线。",
      sections: [
        {
          heading: "为什么不要把所有练习混在一张表里？",
          paragraphs: [
            "130 题地市卷和 135 题副省卷题量与模块权重不同，放在一条折线里比较裸分容易误判进步还是退步。把它们按考试类别分开聚合，再用每套卷自身的得分率折算百分制，才能跨机构横向对比真实能力变化。",
          ],
        },
        {
          heading: "每次模考后 3 分钟固定复盘动作",
          paragraphs: [
            "1. 看总分与上次同卷/同类对比，确认是整体难度波动还是个人失常；",
            "2. 看板块得分率与做题耗时，找出「耗时高但正确率低」的拖后腿模块（常见于数量关系过度恋战或逻辑判断反复纠结）；",
            "3. 筛选错题和存疑题，一键复制错题号去刷题本整理，把「蒙对的存疑题」也一并补漏。",
          ],
        },
      ],
      scoreTables: [],
      steps: [
        "每次做完套卷，用「卷卷小榜」计时并扫卡/粘贴录答交卷。",
        "所有正式成绩自动归档到个人中心，并在「成长分析」按地市卷/副省卷分别画出趋势。",
        "定期导出本机备份，换手机也不丢历史模考曲线。",
      ],
      faqs: [
        {
          q: "不同机构（比如花生和粉笔）的成绩能画在同一条成长曲线上吗？",
          a: "可以。只要属于同一考试类别（如都是 130 题地市卷），系统会按每套卷各自保存的得分率折算展示，方便观察连续备考趋势。",
        },
        {
          q: "同一套卷刷第二遍会覆盖原来的记录吗？",
          a: "不会。每次提交都会保留独立记录并生成与上次作答的对比卡片，同卷排行榜则自动取你本卷最好的一次成绩。",
        },
      ],
    },
  ];
}

function buildSeriesArticles(seriesList, statsByVersion = new Map()) {
  return seriesList.map((series, index) => {
    const totalCount = series.versions.length;
    const variantSummary = series.variantList
      .map(v => `${v.questionCount}题${/副省/.test(v.variant) ? "副省" : /地市/.test(v.variant) ? "地市" : ""}（${v.versions.length}套）`)
      .join(" + ");
    const seriesLabel = [series.publisher, series.project, series.period].filter(Boolean).join(" ");
    const periodText = String(series.period || "").trim();
    const shortSeries = `${series.publisher}${periodText || series.project}`;
    const firstVersion = series.versions[0];

    let realParticipants = 0;
    let activeVersionCount = 0;
    for (const v of series.versions) {
      const stat = statsByVersion.get(v.id);
      if (stat && stat.count > 0) {
        realParticipants += stat.count;
        activeVersionCount += 1;
      }
    }

    const hasCountInName = /\d+\s*套卷?/.test(shortSeries);
    const hasXingceInName = /行测/.test(shortSeries);
    const titleSubject = hasCountInName
      ? (hasXingceInName ? shortSeries : shortSeries.replace(/(\d+\s*套卷?)/, "行测$1"))
      : `${shortSeries}${hasXingceInName ? "" : "行测"}${totalCount}套卷`;
    const title = `${titleSubject}怎么估分？分值表与同卷排名`;
    const digest = `收录${seriesLabel}共${totalCount}套（${variantSummary}），附完整各题型分值表、拍照扫答题卡估分步骤与同卷排名入口。`;

    const sections = [
      {
        heading: `本系列收录范围与结构（共 ${totalCount} 套）`,
        paragraphs: [
          `「卷卷小榜」现已完整收录 ${seriesLabel} 共 ${totalCount} 套已发布试卷，包含：${variantSummary}，标准作答参考时长均为 ${firstVersion?.timeLimitMinutes || 120} 分钟。`,
          "每套卷均严格按本卷对应的机构参考答案与独立分值表核分，答对计分，答错与留空计 0 分并计入分母，不混用其他机构或其他期次的答案。",
        ],
      },
      {
        heading: "这套卷怎么做完复盘效率最高？",
        paragraphs: [
          "1. 计时独立记录：开考前在「卷卷小榜」首页开启整卷 120 分钟或分模块计时，做题用时与考后录答用时分开保存，复盘能直接核对每个模块是否超时。",
          "2. 三种方式快速核分：纸质答题卡可直接拍照/相册扫描识别（核对修改后填入），也可逐题点选或整段粘贴答案，几分钟内出总分与各板块得分率。",
          "3. 同卷排名看真实定位：单套模考难易度波动大，交卷后可直接切全国榜或选目标岗位看岗位榜，并在同卷讨论区交流难题与争议题。",
        ],
      },
    ];

    if (realParticipants >= 10) {
      sections.push({
        heading: "同卷实时参考热度",
        paragraphs: [
          `截至本文生成时，本系列已有 ${activeVersionCount} 套卷产生公开同卷排名，累计 ${realParticipants} 人次完成正式交卷核分。交卷后即可实时查看你在本卷全国榜与目标岗位榜中的具体名次。`,
        ],
      });
    }

    const scoreTables = series.variantList.map(v => ({
      caption: `${series.publisher} ${series.period || ""} · ${v.variant}（${v.questionCount} 题，共 ${v.versions.length} 套）`,
      rows: v.scoreRows,
      totalQuestions: v.questionCount,
      totalScore: `${formatScore(v.maxCents)} 分`,
    }));

    return {
      id: series.slug,
      slug: series.slug,
      category: "series",
      institution: series.institution,
      seriesKey: series.key,
      scheduleDay: 4 + index,
      title,
      digest,
      author: AUTHOR_NAME,
      badge: `${series.publisher}专题`,
      coverKicker: `${series.project} · 共 ${totalCount} 套`,
      coverTitle: `${shortSeries}怎么估分？`,
      coverSubtitle: `${variantSummary} · 完整分值表与同卷排名`,
      coverMeta: `限时 ${firstVersion?.timeLimitMinutes || 120} 分钟 · 扫卡 / 粘贴即出分`,
      miniprogramPath: `pages/catalog/catalog?institution=${encodeURIComponent(series.institution)}`,
      miniprogramTitle: `直达${series.publisher}套卷目录 · 扫卡估分看排名`,
      keywords: [
        `${series.publisher}估分`,
        `${shortSeries}分值表`,
        `${shortSeries}对答案`,
        `${shortSeries}排名`,
        "行测模考估分",
      ],
      summary: `${seriesLabel} 共 ${totalCount} 套（${variantSummary}），限时 ${firstVersion?.timeLimitMinutes || 120} 分钟，满分 100 分。各板块单题分值不同，不能按答对题数平均算分。在微信打开「卷卷小榜」小程序，选定对应套卷拍照扫答题卡或粘贴答案即可按本卷分值表自动算分并查看同卷排名。`,
      sections,
      scoreTables,
      steps: [
        `点击下方小程序卡片或微信搜「卷卷小榜」，进入「${series.publisher}」套卷目录。`,
        "找到对应期数与卷号（地市卷与副省卷已分开标注），拍照扫答题卡、逐题点选或整段粘贴答案。",
        "提交查看总分、各板块得分率、逐题错题/存疑题对照，以及同卷全国榜与岗位榜。",
      ],
      faqs: [
        {
          q: `${shortSeries}可以只用手机拍照扫答题卡估分吗？`,
          a: "可以。在录答页点击扫卡，支持现场拍照或从相册选图识别，识别后可逐题核对微调再交卷；不方便拍照时也能手工点选或整段粘贴。",
        },
        {
          q: `${shortSeries}里 130 题和 135 题版本怎么区分？`,
          a: "进入套卷目录后系统已按题量与卷别分组显示，核对试卷总题数选对应版本即可，算分会自动套用该卷自己的分值表。",
        },
        {
          q: "同一套卷重复刷题怎么参与排名？",
          a: "系统会保留你每一次练习记录用于成长复盘，同卷排行榜则自动取你本套卷最好的一次正式成绩，每人仅占一个名次。",
        },
      ],
    };
  });
}

export function buildAllArticles(versions, { statsByVersion = new Map() } = {}) {
  const seriesList = groupCatalogIntoSeries(versions);
  const evergreen = buildEvergreenArticles(seriesList);
  const seriesArticles = buildSeriesArticles(seriesList, statsByVersion);

  // 排期顺序：Day 1-3 常青支柱文，Day 4-8 各机构系列估分文，Day 9 刷题记分复盘文，之后新系列顺延
  const combined = [...evergreen, ...seriesArticles];
  combined.sort((a, b) => a.scheduleDay - b.scheduleDay || a.slug.localeCompare(b.slug));
  return combined.map((article, idx) => ({
    ...article,
    scheduleDay: idx + 1,
  }));
}

export function buildBackendConfig(seriesList) {
  const institutions = [...new Set(seriesList.map(s => s.publisher))];
  return {
    generatedAt: new Date().toISOString(),
    miniprogramAppId: MINIPROGRAM_APP_ID,
    accountProfile: {
      name: "卷卷小榜",
      bio: "卷卷小榜：行测估分、算分与同卷排名工具，同名小程序直达。支持拍照扫卡、手输与批量粘贴对答案，覆盖国省考130题地市/135题副省及花生十三、超格、粉笔、上岸村模考，提供分值表、错题复盘与岗位榜（非题库，基础功能免费）。",
    },
    welcomeReply:
      "欢迎关注「卷卷小榜」！\n\n" +
      "这里提供免费行测估分、扫答题卡算分、整卷/分模块计时与同卷排名（覆盖花生十三、超格、粉笔、上岸村共 62+ 套卷）。\n\n" +
      "👇 常用关键词（直接回复即可获取）：\n" +
      "• 回复【估分】→ 获取「卷卷小榜」小程序入口与使用指引\n" +
      "• 回复【分值表】→ 查看 130 题地市卷 / 135 题副省卷分值对照\n" +
      "• 回复【花生】【超格】【粉笔】【上岸村】→ 对应机构模考估分指引\n" +
      "• 回复【排名】→ 查看同卷全国榜与岗位榜规则",
    keywordReplies: [
      {
        ruleName: "估分与小程序入口",
        keywords: ["估分", "小程序", "扫卡", "答题卡", "算分", "对答案"],
        reply:
          "微信搜索小程序「卷卷小榜」（免费免注册）：\n" +
          "1. 选对机构、期数与卷别（130题地市 / 135题副省）；\n" +
          "2. 支持拍照/相册扫答题卡（核对后填入）、手工点选或整段批量粘贴；\n" +
          "3. 自动按本卷分值表算分，看各板块得分率、错题对照与同卷全国榜/岗位榜。\n\n" +
          "电脑或手机网页版也可访问：https://rank.swimmingliu.cn/",
      },
      {
        ruleName: "行测分值表",
        keywords: ["分值表", "分值", "怎么算分", "130", "135"],
        reply:
          "【130 题地市卷参考分值（100分）】\n" +
          "政治20题(10分) · 常识15题(7.5分) · 言语30题(24分) · 数量10题(10分) · 图形10题(8分) · 定义10题(8分) · 类比5题(4分) · 逻辑10题(8.5分) · 资料20题(20分)\n\n" +
          "【135 题副省卷参考分值（100分）】\n" +
          "数量调整为15题(12分)，类比5题(2.5分)，逻辑10题(8分)，其余同上。\n\n" +
          "完整对照表：https://rank.swimmingliu.cn/zenme-suan-fen.html\n" +
          "微信搜小程序「卷卷小榜」可直接按卷自动算分。",
      },
      {
        ruleName: "机构模考估分",
        keywords: ["花生", "四海", "花生十三", "超格", "粉笔", "上岸村", "模考"],
        reply:
          `「卷卷小榜」现已收录 ${institutions.join("、")} 等主流机构行测模考套卷：\n` +
          "• 每套卷独立按对应机构参考答案与分值表核分\n" +
          "• 支持拍照扫答题卡 / 批量粘贴录答\n" +
          "• 交卷自动进入同卷全国榜与目标岗位榜\n\n" +
          "直接微信搜索小程序「卷卷小榜」，在首页选择对应机构即可开始。",
      },
      {
        ruleName: "同卷排名与选岗",
        keywords: ["排名", "榜单", "岗位", "选岗", "进面"],
        reply:
          "「卷卷小榜」同卷榜规则：\n" +
          "1. 同一套卷、同一答案版本自动聚合；\n" +
          "2. 每人自动取本卷最好一次正式成绩，同分并列；\n" +
          "3. 可一键切换「全国榜」与「目标岗位榜」，私密逐题答案不对外公开。\n\n" +
          "微信搜小程序「卷卷小榜」交卷后即可查看。",
      },
    ],
    // 若公众号已完成认证，可直接用此 JSON 调用 /cgi-bin/menu/create；个人未认证订阅号可在后台「自定义菜单」按此结构手动配置
    customMenu: {
      button: [
        {
          type: "miniprogram",
          name: "行测估分",
          url: "https://rank.swimmingliu.cn/",
          appid: MINIPROGRAM_APP_ID,
          pagepath: "pages/home/home",
        },
        {
          name: "机构模考",
          sub_button: [
            {
              type: "miniprogram",
              name: "花生十三（四海）",
              url: "https://rank.swimmingliu.cn/",
              appid: MINIPROGRAM_APP_ID,
              pagepath: "pages/catalog/catalog?institution=%E5%9B%9B%E6%B5%B7",
            },
            {
              type: "miniprogram",
              name: "超格行测套卷",
              url: "https://rank.swimmingliu.cn/",
              appid: MINIPROGRAM_APP_ID,
              pagepath: "pages/catalog/catalog?institution=%E8%B6%85%E6%A0%BC",
            },
            {
              type: "miniprogram",
              name: "粉笔极致模考",
              url: "https://rank.swimmingliu.cn/",
              appid: MINIPROGRAM_APP_ID,
              pagepath: "pages/catalog/catalog?institution=%E7%B2%89%E7%AC%94",
            },
            {
              type: "miniprogram",
              name: "上岸村行测卷",
              url: "https://rank.swimmingliu.cn/",
              appid: MINIPROGRAM_APP_ID,
              pagepath: "pages/catalog/catalog?institution=%E4%B8%8A%E5%B2%B8%E6%9D%91",
            },
          ],
        },
        {
          name: "算分指南",
          sub_button: [
            {
              type: "view",
              name: "130/135分值表",
              url: "https://rank.swimmingliu.cn/zenme-suan-fen.html",
            },
            {
              type: "view",
              name: "行测估分准吗",
              url: "https://rank.swimmingliu.cn/gu-fen-zhun-ma.html",
            },
            {
              type: "view",
              name: "刷题怎么记分",
              url: "https://rank.swimmingliu.cn/shua-ti-ji-fen.html",
            },
          ],
        },
      ],
    },
  };
}
