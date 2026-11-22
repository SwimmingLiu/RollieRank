// 机构与套卷分组：全部来自服务端已发布目录，不在前端写死题量。
const ORDER = ["四海", "超格", "粉笔", "上岸村"];
const LOGO = {
  四海: "sihai",
  超格: "chaoge",
  粉笔: "fenbi",
  上岸村: "shangancun",
};

// 与网页端一致：图形、定义、类比、逻辑判断都在用户维度合为「判断推理」。
const JUDGMENT_NAMES = new Set(["判断推理", "逻辑判断", "类比推理", "图形推理", "定义判断"]);
const subjectName = name => (JUDGMENT_NAMES.has(name) ? "判断推理" : name);
const subjectId = (id, name) => (JUDGMENT_NAMES.has(name) ? "judgment" : id);
const periodDigits = "一二三四五六七八九";
const compareNames = (a, b) => a.localeCompare(b, "zh", { numeric: true });
// .raw 的题量标签属于同一机构题库，不能拆成两个“期次”。
const questionVersion = value => /^\d+题版$/.test(String(value || "").trim());

function periodNumber(period) {
  const value = String(period || "").replace(/\s+/g, "");
  const digits = value.match(/^(?:第)?(\d+)期?$/);
  if (digits) return Number(digits[1]);
  const chinese = value.match(/^(?:第)?([一二三四五六七八九]|[一二三四五六七八九]?十[一二三四五六七八九]?)期$/);
  if (!chinese) return null;
  const [tens, units] = chinese[1].split("十");
  if (units === undefined) return periodDigits.indexOf(tens) + 1;
  return (tens ? periodDigits.indexOf(tens) + 1 : 1) * 10 + (units ? periodDigits.indexOf(units) + 1 : 0);
}

function compareProjects(a, b) {
  const aPeriod = periodNumber(a.period) ?? Number.MAX_SAFE_INTEGER;
  const bPeriod = periodNumber(b.period) ?? Number.MAX_SAFE_INTEGER;
  // 按实际期数排序，同一期的副省级卷放在普通卷后。
  return compareNames(a.project, b.project) || aPeriod - bPeriod ||
    (aPeriod === Number.MAX_SAFE_INTEGER ? compareNames(a.period, b.period) : 0) ||
    Number(a.variant === "副省级") - Number(b.variant === "副省级") || compareNames(a.variant, b.variant);
}

function institutionKey(version) {
  return version.institution || "其他";
}

function groupByInstitution(versions) {
  const map = new Map();
  for (const version of versions) {
    if (version.status === "draft") continue;
    const key = institutionKey(version);
    if (!map.has(key)) map.set(key, { name: key, label: publisherName(key), logo: LOGO[key] || null, projects: [], versions: [] });
    map.get(key).versions.push(version);
  }
  const list = [...map.values()];
  list.sort((a, b) => {
    const ia = ORDER.indexOf(a.name), ib = ORDER.indexOf(b.name);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name, "zh");
  });
  for (const group of list) {
    // 同一机构按项目与期数分组，期数内按卷号升序；不把每期当作一个机构。
    const projects = new Map();
    for (const version of group.versions) {
      const variant = questionVersion(version.variant) ? "" : version.variant || "";
      const key = [version.project || "", version.period || "", variant].join("|");
      if (!projects.has(key)) {
        projects.set(key, {
          key,
          project: version.project || "",
          period: version.period || "",
          variant,
          versions: [],
        });
      }
      projects.get(key).versions.push(version);
    }
    group.projects = [...projects.values()].sort(compareProjects);
    for (const project of group.projects) {
      project.versions.sort((a, b) => Number(a.number) - Number(b.number));
    }
  }
  return list;
}

function versionTitle(version) {
  const number = version.number ? `${version.number}套` : version.title;
  return version.title || number;
}

function stripPublisherPrefix(title, institution) {
  let value = String(title || "").trim();
  const names = [publisherName(institution), institution, "花生十三", "花生", "四海", "超格", "粉笔", "上岸村"].filter(Boolean);
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(`^${escaped}\\s*[·\\-—]?\\s*`), "");
  }
  return value.trim() || String(title || "").trim();
}

function cleanPeriod(projectHead, period) {
  const head = String(projectHead || "").trim();
  let label = periodLabel(period);
  const tail = head.split(/\s+/).pop();
  if (tail && tail.length >= 2 && label.startsWith(tail) && label.length > tail.length) {
    label = label.slice(tail.length).replace(/^[·\s]+/, "");
  }
  return label;
}

function projectTitle(project, siblings = []) {
  const head = String(project.project || "").split(" · ")[0].trim();
  const period = cleanPeriod(head, project.period);
  const samePeriod = siblings.filter(item =>
    String(item.project || "").split(" · ")[0].trim() === head &&
    periodLabel(item.period) === periodLabel(project.period));
  const hasMultipleVariants = samePeriod.length > 1;
  let suffix = "";
  if (project.variant === "副省级") suffix = "（副省）";
  else if (hasMultipleVariants && /地市/.test(project.variant || "")) suffix = "（地市）";
  const base = [head, period].filter(Boolean).join(" · ");
  return base + suffix;
}

function paperCardParts(version) {
  if (numberedPaper(version)) {
    const pad = String(version.number).padStart(2, "0");
    return { numeric: true, primary: pad, unit: "套", shortTitle: "行测 " + pad + " 套", compactTitle: pad + "套" };
  }
  const clean = stripPublisherPrefix(versionTitle(version), version.institution);
  const yearExam = clean.match(/^(\d{2,4})(国考卷|省考卷|联考卷|真题卷)$/);
  if (yearExam) {
    return { numeric: true, primary: yearExam[1], unit: yearExam[2], shortTitle: clean, compactTitle: clean };
  }
  const mixed = clean.match(/^(混合组卷|模拟卷|押题卷|冲刺卷)\s*(\d+)$/);
  if (mixed) {
    const pad = String(Number(mixed[2])).padStart(2, "0");
    return { numeric: true, primary: pad, unit: mixed[1], shortTitle: mixed[1] + " " + pad, compactTitle: mixed[1] + " " + pad };
  }
  return { numeric: false, primary: clean, unit: "", shortTitle: clean, compactTitle: clean };
}

function identity(version) {
  return [publisherName(version.institution), periodLabel(version.period), version.variant].filter(Boolean).join(" · ");
}

function publisherName(name) {
  return name === "四海" ? "花生" : name;
}

function periodLabel(period) {
  const number = periodNumber(period);
  return number === null ? period || "" : `第${number}期`;
}

function numberedPaper(version) {
  return Boolean(version.number && /(?:第\s*\d+\s*套|^\d+\s*套)$/.test(version.title || ""));
}

function practiceIdentity(version) {
  const head = String(version.project || "").split(" · ")[0].trim();
  const period = cleanPeriod(head, version.period);
  const paper = numberedPaper(version)
    ? "行测" + String(version.number).padStart(2, "0") + "套"
    : stripPublisherPrefix(versionTitle(version), version.institution);
  return [publisherName(version.institution), head, period, paper].filter(Boolean).join(" · ");
}

// 答卷可能来自已下线或改名的套卷；优先用目录里的展示名，目录缺失时退回答卷自带字段。
function attemptIdentity(version, attempt) {
  if (version) return practiceIdentity(version);
  const head = String(attempt.project || "").split(" · ")[0].trim();
  const period = cleanPeriod(head, attempt.period);
  const paper = stripPublisherPrefix(attempt.paperTitle || attempt.title, attempt.institution);
  return [publisherName(attempt.institution), head, period, paper].filter(Boolean).join(" · ");
}

module.exports = {
  groupByInstitution, versionTitle, stripPublisherPrefix, cleanPeriod, projectTitle, paperCardParts,
  identity, numberedPaper, practiceIdentity, attemptIdentity,
  publisherName, periodLabel, LOGO, subjectName, subjectId,
};
