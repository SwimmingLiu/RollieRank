// 机构与套卷分组：全部来自服务端已发布目录，不在前端写死题量。
const ORDER = ["四海", "超格", "粉笔", "上岸村"];
// 展示名与内部标识分开：四海对外显示为「花生」，与设计稿一致。
const DISPLAY_NAME = { 四海: "花生", 超格: "超格", 粉笔: "粉笔", 上岸村: "上岸村" };
const LOGO = {
  四海: "sihai",
  超格: "chaoge",
  粉笔: "fenbi",
  上岸村: "shangancun",
};
const displayName = institution => DISPLAY_NAME[institution] || institution;

// 与网页端一致：图形、定义、类比、逻辑判断都在用户维度合为「判断推理」。
const JUDGMENT_NAMES = new Set(["判断推理", "逻辑判断", "类比推理", "图形推理", "定义判断"]);
const subjectName = name => (JUDGMENT_NAMES.has(name) ? "判断推理" : name);
const subjectId = (id, name) => (JUDGMENT_NAMES.has(name) ? "judgment" : id);

function institutionKey(version) {
  return version.institution || "其他";
}

function groupByInstitution(versions) {
  const map = new Map();
  for (const version of versions) {
    if (version.status === "draft") continue;
    const key = institutionKey(version);
    if (!map.has(key)) map.set(key, { name: key, label: displayName(key), logo: LOGO[key] || null, projects: [], versions: [] });
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
      const key = [version.project || "", version.period || "", version.variant || ""].join("|");
      if (!projects.has(key)) {
        projects.set(key, {
          key,
          project: version.project || "",
          period: version.period || "",
          variant: version.variant || "",
          versions: [],
        });
      }
      projects.get(key).versions.push(version);
    }
    group.projects = [...projects.values()].sort((a, b) =>
      String(a.project).localeCompare(String(b.project), "zh") ||
      String(a.period).localeCompare(String(b.period), "zh"));
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

function identity(version) {
  return [version.institution, version.period, version.variant].filter(Boolean).join(" · ");
}

module.exports = { groupByInstitution, versionTitle, identity, LOGO, displayName, subjectName, subjectId };
