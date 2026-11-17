import { icon, esc, score, date, button, sectionHead, empty } from "./ui.js";

export const templateCsv =
  "题号,题型,答案,分值\n1,政治理论,A,0.5\n2,政治理论,B,0.5\n3,言语理解,C,0.8\n4,言语理解,D,0.8\n5,数量关系,A,1\n6,资料分析,B,1";

export function adminView({ admin }) {
  return `<div class="page-title"><div><span class="eyebrow">让每一套练习，都有清晰的依据</span><h1>套卷管理</h1><p>导入、校验、试算，再将套卷发布到练习目录。</p></div><span class="tag">本机管理</span></div><div class="notice"><span>${icon("info")}仅管理当前本地服务的数据。</span><p>发布和下线会真实更新本机选卷目录；正式上线时需接入管理权限。</p></div><div class="admin-tabs line-tabs">${button("admin-tab", "套卷与版本", "selected", 'data-value="catalog"')}${button("admin-tab", "导入新套卷", "", 'data-value="import"')}${button("admin-tab", "操作记录", "", 'data-value="audit"')}</div><section id="admin-panel" class="card admin-panel">${adminCatalog(admin)}</section>`;
}

export function adminCatalog(admin) {
  const statuses = {
    published: ["已发布", "success"],
    draft: ["待复核", "warning"],
    offline: ["已下线", "muted"],
  };
  return `${sectionHead("套卷与规则版本", button("admin-tab", `${icon("upload")}导入套卷`, "button primary compact", 'data-value="import"'))}<div class="admin-table"><div class="admin-table-head"><span>套卷 / 机构</span><span>版本</span><span>题量 / 满分</span><span>状态</span><span>操作</span></div>${admin.versions.map((v) => `<div class="admin-table-row"><span><b>${esc(v.title)}</b><small>${esc(v.institution)} · ${esc(v.period)} · ${esc(v.variant)}</small></span><span>v${esc(v.versionLabel)}</span><span>${v.questionCount} 题 / ${score(v.maxCents)} 分</span><span class="tag ${statuses[v.status][1]}">${statuses[v.status][0]}</span><span class="admin-row-actions">${button("admin-preview", "预览", "text-button", `data-id="${esc(v.id)}"`)}${button("admin-status", v.status === "published" ? "下线" : "发布", "text-button", `data-id="${esc(v.id)}" data-status="${v.status === "published" ? "offline" : "published"}"`)}${v.status !== "draft" ? button("admin-revise", "修订", "text-button muted", `data-id="${esc(v.id)}"`) : ""}</span></div>`).join("")}</div>`;
}

export function adminImport(admin, revision = null) {
  return `${sectionHead(revision ? `修订 ${esc(revision.title)}` : "导入一套新练习", button("csv-template", `${icon("download")}下载 CSV 模板`, "text-button"))}<form id="import-form"><div class="form-grid"><label class="field-label">套卷名称<input name="title" maxlength="100" placeholder="例如：行测专项练习 · 第 01 套" value="${esc(revision?.title ?? "")}" required/></label><label class="field-label">机构<input name="institution" maxlength="100" list="institution-options" value="${esc(revision?.institution ?? "四海")}" required/><datalist id="institution-options"><option>四海</option><option>花生十三</option></datalist></label><label class="field-label">考试项目<input name="project" maxlength="100" value="${esc(revision?.project ?? "2026 下半年 · 国考行测")}" required/></label><label class="field-label">期数<input name="period" maxlength="100" value="${esc(revision?.period ?? "一期")}" required/></label><label class="field-label">卷别<input name="variant" maxlength="100" value="${esc(revision?.variant ?? "地市级 / 行政执法类")}" required/></label><label class="field-label">规则版本<input value="${revision ? "发布时创建新的版本" : "1.0（首次发布）"}" disabled/></label></div>${revision ? `<input type="hidden" name="revisionOf" value="${esc(revision.id)}"/><p class="notice">原版成绩保持不变。题量或题型结构变化时，请作为新套卷导入。</p>` : ""}<div class="import-input-heading"><label class="field-label" for="import-csv">题目配置（CSV）</label><label class="button outline compact file-label">${icon("upload")}读取 CSV 文件<input id="import-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values"/></label></div><textarea id="import-csv" name="csv" rows="10" spellcheck="false" placeholder="${esc(templateCsv)}" required></textarea><p class="field-help">四列依次为题号、题型、答案、分值。支持 1–300 题，题号连续，分值最多两位小数。</p><div id="import-preview" aria-live="polite"></div><div class="form-actions">${button("validate-import", `${icon("check")}校验并试算`, "button outline")}<button type="submit" class="button primary" id="save-import">保存为草稿 ${icon("arrow")}</button></div></form>`;
}

export function adminAudit(admin) {
  return `${sectionHead("每一次变更，都有记录")}<div class="audit-list">${admin.audit.map((row) => `<div><span class="audit-icon">${icon(row.action.includes("发布") ? "check" : row.action.includes("导入") ? "upload" : "clock")}</span><span><b>${esc(row.action)}</b><small>${esc(row.target)}</small></span><time>${date(row.createdAt, true)}</time></div>`).join("") || empty("还没有管理操作", "导入、发布和下线后，会在这里留下记录。")}</div>`;
}
