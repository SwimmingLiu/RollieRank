import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveSubjectDimension, subjectDimensions } from "../src/subjects.js";
import { buildInsights, publicLeaderboardRow, publicParticipants, publicResult, SCORE_BANDS } from "./insights.mjs";
import { defaultNickname, isDefaultNickname } from "./wechat-profile.mjs";
import {
  accountIdForGuest,
  assertGuestNotOwnedByOther,
  findReceiptForIdentity,
  linkAccountGuest,
  linkedGuestIds,
  resolveRequestAccount,
} from "./account-identity.mjs";

const run = promisify(execFile);
const guestPattern = /^[\w-]{10,80}$/;
const fileLimit = 20 * 1024 * 1024;
const chunkLimit = 192 * 1024;
const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), { statusCode });
};
const string = (value, name, maximum = 300, optional = false) => {
  if (optional && (value === undefined || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))
    fail(`${name}不能为空，且不能超过 ${maximum} 字或含控制字符。`);
  return value.trim();
};
const url = (value, name) => {
  const result = string(value, name, 2000);
  let parsed;
  try { parsed = new URL(result); } catch { fail(`${name}需要完整的 HTTP 或 HTTPS 地址。`); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) fail(`${name}地址无效。`);
  return result;
};
const guest = (value) => {
  if (typeof value !== "string" || !guestPattern.test(value)) fail("本机身份凭证无效，请刷新后重试。");
  return value;
};
const integer = (value, name, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${name}应为 ${min}–${max} 的整数。`);
  return value;
};
const paging = (query) => {
  const read = (key, fallback, max) => {
    const raw = query.get(key);
    if (raw !== null && !/^[1-9]\d{0,5}$/.test(raw)) fail("分页参数无效。");
    return integer(raw === null ? fallback : Number(raw), key, 1, max);
  };
  return { page: read("page", 1, 100000), pageSize: read("pageSize", 20, 100) };
};

export function positionId(position) {
  return "pos:" + [position.exam, position.year, position.region, position.departmentCode || position.department, position.code]
    .map((value) => encodeURIComponent(String(value))).join(":");
}

const examCategoryLabels = new Map([["中央机关及其省级直属机构综合管理类", "副省级"], ["市(地)级及以下直属机构综合管理类", "地市级"],
  ["副省级", "副省级"], ["地市级", "地市级"], ["行政执法类", "行政执法类"]]);
export function examCategoryLabel(value = "") {
  if (typeof value !== "string") return "";
  const compact = value.replace(/\s+/g, "").replaceAll("（", "(").replaceAll("）", ")");
  return examCategoryLabels.get(compact) ?? value;
}

function sourceMetadata(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("岗位来源信息无效。");
  const id = string(raw.id, "来源 ID", 100);
  if (!/^[a-zA-Z0-9._-]+$/.test(id) || ["__proto__", "constructor", "prototype"].includes(id)) fail("来源 ID 无效，请使用字母、数字、点、下划线或连字符。");
  if (!["guokao", "shengkao"].includes(raw.exam)) fail("考试类型应为国考或省考。");
  const retrievedAt = string(raw.retrievedAt, "获取日期", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(retrievedAt) || Number.isNaN(Date.parse(retrievedAt)) || new Date(retrievedAt).toISOString().slice(0, 10) !== retrievedAt)
    fail("获取日期应为有效的 YYYY-MM-DD 日期。");
  const sourceType = raw.sourceType ?? "published";
  if (!["published", "user-file"].includes(sourceType)) fail("来源类型无效。");
  const sourceUrl = (value, name) => sourceType === "user-file" && !value ? "" : url(value, name);
  return { id, label: string(raw.label, "目录名称"), exam: raw.exam,
    year: integer(raw.year, "招考年度", 2000, 2100), region: string(raw.region, "地区", 80),
    publisher: string(raw.publisher, "来源机构", 200), sourceType, sourcePage: sourceUrl(raw.sourcePage, "来源页面"),
    announcementPage: sourceUrl(raw.announcementPage || raw.sourcePage, "公告页面"),
    downloadUrl: sourceUrl(raw.downloadUrl, "下载地址"), retrievedAt,
    fileName: string(raw.fileName, "原文件名", 240, true),
  };
}

export function validatePositionsDataset(input) {
  if (input?.schemaVersion !== 1 || !Array.isArray(input.positions) || !input.positions.length || input.positions.length > 50000)
    fail("岗位目录需要 schemaVersion: 1 和 1–50000 个岗位。");
  const source = sourceMetadata(input.source);
  const sha256 = string(input.source.sha256, "文件 SHA-256", 64);
  if (!/^[a-f0-9]{64}$/.test(sha256)) fail("文件 SHA-256 无效。");
  const seen = new Map();
  const positions = input.positions.map((raw, index) => {
    const where = `岗位 ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(`${where}无效。`);
    const p = { exam: source.exam, year: source.year, region: source.region,
      code: string(raw.code, `${where}编码`, 120), departmentCode: string(raw.departmentCode, "部门编码", 120, true),
      department: string(raw.department, `${where}部门`), title: string(raw.title, `${where}名称`),
      unit: string(raw.unit, "用人单位", 4000, true), location: string(raw.location, "工作地点", 4000, true),
      education: string(raw.education, "学历", 4000, true), major: string(raw.major, "专业", 4000, true),
      recruits: raw.recruits === null || raw.recruits === undefined ? null : integer(raw.recruits, "招录人数", 0, 100000),
      sourceId: source.id, sourceSheet: string(raw.sourceSheet, "工作表", 120), sourceRow: integer(raw.sourceRow, "原表行号", 1, 100001) };
    // Earlier schema-v1 catalogs have no classification columns; preserve genuine optional values without inventing a category from sheet names.
    for (const field of ["institutionCategory", "examCategory"])
      if (raw[field] !== undefined) p[field] = string(raw[field], "原表类别", 4000, true);
    if (raw.examCategoryLabel !== undefined || p.examCategory !== undefined) {
      p.examCategoryLabel = examCategoryLabel(p.examCategory);
      if (raw.examCategoryLabel !== undefined && raw.examCategoryLabel !== p.examCategoryLabel) fail(`${where}的考试类别显示值与原文不一致。`);
    }
    if (/[\r\n\t]/.test(p.code + p.departmentCode) || /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(p.code)) fail(`${where}编码应为原始文本，不能使用科学计数法。`);
    for (const field of ["exam", "year", "region", "sourceId"])
      if (raw[field] !== p[field]) fail(`${where}的${field}与目录来源不一致。`);
    p.id = positionId(p);
    if (raw.id !== p.id) fail(`${where}标识与编码不一致。`);
    if (seen.has(p.id)) fail(`${p.sourceSheet} 第 ${p.sourceRow} 行与 ${seen.get(p.id)} 重复岗位编码 ${p.code}。`);
    seen.set(p.id, `${p.sourceSheet} 第 ${p.sourceRow} 行`);
    return p;
  });
  if (input.source.count !== positions.length) fail("来源岗位数量与实际记录数不一致。");
  const counts = new Map();
  for (const p of positions) counts.set(p.sourceSheet, (counts.get(p.sourceSheet) || 0) + 1);
  return { schemaVersion: 1, source: { ...source, sha256, count: positions.length,
    sheets: [...counts].map(([name, count]) => ({ name, count })) }, positions };
}

const namespace = (store) => {
  store.features ??= {};
  store.features.positions ??= { members: {}, catalogs: {} };
  const state = store.features.positions;
  state.members ??= {};
  state.catalogs ??= {};
  return state;
};
const readNamespace = (store) => store.features?.positions ?? { members: {}, catalogs: {} };
const memberFor = (store, id) => {
  const members = readNamespace(store).members ?? {};
  return Object.hasOwn(members, id) ? members[id] : undefined;
};
const anonymous = (id) => defaultNickname(id);

// 正式提交在同一落盘事务内默认入榜；明确撤回的成员保持退出，重试不会复制回执。
export function includeSubmittedAttempt(store, { guestId, attempt, name, accountId = null }) {
  if (!attempt || attempt.isSample || !guestPattern.test(attempt.id) || !Array.isArray(attempt.answers) || !attempt.report ||
      !store.versions.some((version) => version.id === attempt.versionId && version.status !== "draft")) return false;
  const id = guest(guestId);
  const state = namespace(store);
  const members = state.members;
  const previous = memberFor(store, id) ?? {};
  const existingOwner = previous.accountId ?? accountIdForGuest(store, id) ?? null;
  if (typeof accountId === "string" && guestPattern.test(accountId) && existingOwner && existingOwner !== accountId) {
    fail("该本机身份已关联其他微信账号，请重新登录后再试。", 403);
  }
  const resolvedAccountId = existingOwner || (typeof accountId === "string" && guestPattern.test(accountId) ? accountId : null);
  if (previous.participationOptOut === true) return false;
  if (resolvedAccountId && state.accountOptOut?.[resolvedAccountId]?.optOut === true) return false;
  const suppliedName = typeof name === "string" ? name.normalize("NFKC").trim().replace(/\s+/g, " ") : "";
  const validSupplied = suppliedName && suppliedName.length <= 16 && !/[\x00-\x1f]/.test(suppliedName) && !isDefaultNickname(suppliedName);
  const displayName = validSupplied
    ? suppliedName
    : (!isDefaultNickname(previous.name) ? previous.name : anonymous(id));
  const attemptIds = [...new Set([...(previous.attemptIds ?? []), attempt.id])];
  const hasAccountSelection = Boolean(resolvedAccountId && state.accountSelections && Object.hasOwn(state.accountSelections, resolvedAccountId));
  const inheritedPositionId = hasAccountSelection
    ? state.accountSelections[resolvedAccountId].positionId
    : previous.positionId;
  if (
    previous.name === displayName &&
    previous.attemptIds?.length === attemptIds.length &&
    previous.attemptIds?.includes(attempt.id) &&
    (previous.accountId ?? null) === resolvedAccountId &&
    previous.positionId === inheritedPositionId
  ) return false;
  members[id] = {
    ...previous,
    name: displayName,
    attemptIds,
    participationOptOut: false,
    ...(resolvedAccountId ? { accountId: resolvedAccountId } : {}),
    ...(inheritedPositionId !== undefined ? { positionId: inheritedPositionId } : {}),
    updatedAt: Date.now(),
  };
  return true;
}

// 旧目录只迁移一轮；原有显式空选择保留为撤回，不能在重启或每次读取时强行加回。
export function initializeDefaultParticipation(store) {
  const state = namespace(store);
  if (state.defaultParticipationMigration === 1) return false;
  for (const member of Object.values(state.members)) {
    if (Array.isArray(member.attemptIds) && member.attemptIds.length === 0 && member.participationOptOut === undefined)
      member.participationOptOut = true;
  }
  for (const [key, attempt] of Object.entries(store.receipts ?? {})) {
    const separator = key.indexOf(":");
    const guestId = separator > 0 ? key.slice(0, separator) : "";
    if (!guestPattern.test(guestId) || key.slice(separator + 1) !== attempt?.id) continue;
    includeSubmittedAttempt(store, { guestId, attempt });
  }
  state.defaultParticipationMigration = 1;
  return true;
}

const hierarchyFields = ["sourceId", "categoryId", "departmentId", "unitId"];
const missingLabels = new Set(["", "-", "--", "—", "无", "暂无", "不详", "未提供", "未分类", "不适用", "无要求", "不限", "n/a", "null"]);
const meaningful = (value) => typeof value === "string" && !missingLabels.has(value.trim().toLowerCase()) ? value.trim() : "";
const hierarchyId = (level, parent, key) => `ph-${level}-${createHash("sha256").update(JSON.stringify([1, level, parent, key])).digest("base64url")}`;

function hierarchyGroups(positions, level, parent) {
  const groups = new Map();
  for (const position of positions) {
    let key, label, search, automatic = false;
    if (level === "category") {
      const institution = meaningful(position.institutionCategory);
      const exam = meaningful(examCategoryLabel(position.examCategory));
      key = [institution, exam];
      label = key.filter(Boolean).join(" · ");
      search = label;
      automatic = !label;
    } else if (level === "department") {
      key = [position.departmentCode || "", position.department];
      label = position.department;
      search = `${label} ${position.departmentCode || ""}`;
    } else {
      label = meaningful(position.unit);
      key = [label];
      search = label;
      automatic = !label;
    }
    const encoded = JSON.stringify(key);
    if (!groups.has(encoded)) groups.set(encoded, { id: hierarchyId(level, parent, key), label, search, automatic, positions: [] });
    groups.get(encoded).positions.push(position);
  }
  return [...groups.values()];
}

export function positionHierarchy(datasets, query) {
  const allowed = new Set([...hierarchyFields, "positionId", "q", "page", "pageSize"]);
  for (const key of query.keys()) {
    if (!allowed.has(key) || query.getAll(key).length !== 1) fail("层级查询包含未知或重复参数。");
  }
  for (const key of [...hierarchyFields, "positionId"])
    if (query.has(key) && (!query.get(key) || query.get(key).length > 2000)) fail("层级 ID 无效。");
  const search = (query.get("q") || "").trim().toLocaleLowerCase("zh-CN");
  if (search.length > 120) fail("搜索词不能超过 120 字。");
  const tokens = search.split(/\s+/).filter(Boolean);
  const requestedSize = query.get("pageSize") ?? "40";
  if (!["40", "100"].includes(requestedSize)) fail("层级每页条数只能为 40 或 100。");
  if (query.has("page") && !/^[1-9]\d{0,5}$/.test(query.get("page"))) fail("分页参数无效。");
  let requestedPage = integer(query.has("page") ? Number(query.get("page")) : 1, "page", 1, 100000);
  const pageSize = Number(requestedSize);
  let source = null, positions = [], nodes, level = "source";
  const breadcrumbs = [];
  const sourceNodes = datasets.map((d) => ({ id: d.source.id, label: d.source.label, search: d.source.label,
    source: { ...d.source, ...(d.origin ? { origin: d.origin } : {}) }, positions: d.positions }));
  const selectedPositionId = query.get("positionId");
  let selectedPosition;
  const parents = hierarchyFields.map((key) => query.get(key));
  if (selectedPositionId) {
    if (parents.some(Boolean)) fail("恢复岗位路径时不能混用其他父级 ID。");
    const found = sourceNodes.find((node) => node.positions.some((p) => p.id === selectedPositionId));
    if (!found) fail("找不到该岗位，请刷新目录。", 404);
    selectedPosition = found.positions.find((p) => p.id === selectedPositionId);
    parents[0] = found.id;
  } else {
    let missingParent = false;
    for (const parent of parents) {
      if (!parent) missingParent = true;
      else if (missingParent) fail("请按来源、类别、部门、单位的顺序提供完整父条件。");
    }
  }
  nodes = sourceNodes;
  for (let depth = 0; depth < 4; depth++) {
    const currentLevel = ["source", "category", "department", "unit"][depth];
    let parent = parents[depth];
    if (selectedPosition && depth > 0) parent = nodes.find((node) => node.positions.some((p) => p.id === selectedPosition.id))?.id;
    if (!parent) break;
    const node = nodes.find((item) => item.id === parent);
    if (!node) fail("父节点不存在或不属于当前路径。", 404);
    breadcrumbs.push({ level: currentLevel, id: node.id, label: node.label, ...(node.automatic ? { automatic: true } : {}) });
    if (depth === 0) source = node.source;
    positions = node.positions;
    level = ["category", "department", "unit", "position"][depth];
    nodes = level === "position" ? positions.map((position) => ({ id: position.id, label: position.title,
      search: `${position.title} ${position.code}`, positionId: position.id, code: position.code, position }))
      : hierarchyGroups(positions, level, node.id);
  }
  const matches = nodes.filter((node) => tokens.every((token) => node.search.toLocaleLowerCase("zh-CN").includes(token)));
  if (selectedPosition) {
    breadcrumbs.push({ level: "position", id: selectedPosition.id, label: selectedPosition.title });
    if (!query.has("page") && !search) requestedPage = Math.floor(matches.findIndex((node) => node.positionId === selectedPosition.id) / pageSize) + 1;
  }
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(requestedPage, pages);
  const options = matches.slice((page - 1) * pageSize, page * pageSize).map((node) => ({ id: node.id, label: node.label,
    ...(node.automatic ? { automatic: true } : {}),
    ...(node.position ? { positionId: node.positionId, code: node.code, position: node.position } : {}) }));
  return { level, source, breadcrumbs, options, total: matches.length, page, pages,
    autoAdvance: nodes.length === 1 && options.length === 1 && (level === "source" || options[0].automatic === true) };
}

export async function createPositionsService({ readCatalog, mutateCatalog, dataDirectory, datasets, billing,
  pythonExecutable = process.env.POSITIONS_PYTHON || "python3" }) {
  const bundled = (datasets ?? [JSON.parse(await readFile(new URL("../data/positions/guokao-2027.json", import.meta.url), "utf8"))])
    .map(validatePositionsDataset);
  const uploads = new Map();
  const directories = (store) => [...bundled.map((d) => ({ ...d, origin: "bundled-official" })),
    ...Object.values(readNamespace(store).catalogs ?? {}).map((d) => ({ ...d, origin: "user-import" }))];
  const allPositions = (store) => directories(store).flatMap((d) => d.positions);
  const findPosition = (store, id) => id ? allPositions(store).find((p) => p.id === id) ?? null : null;
  const effectivePositionId = (store, id, authAccountId = null) => {
    const member = memberFor(store, id);
    if (!authAccountId) return member?.positionId ?? null;
    const selections = readNamespace(store).accountSelections;
    if (selections && Object.hasOwn(selections, authAccountId)) {
      return selections[authAccountId].positionId ?? null;
    }
    let latest = null;
    for (const linkedId of linkedGuestIds(store, { accountId: authAccountId, guestId: id })) {
      const linked = memberFor(store, linkedId);
      if (!linked || linked.positionId === undefined) continue;
      if (!latest || (linked.updatedAt || 0) >= (latest.updatedAt || 0)) latest = linked;
    }
    return latest?.positionId ?? null;
  };
  const profile = (store, id, authAccountId = null) => {
    const member = memberFor(store, id);
    const selectedPositionId = effectivePositionId(store, id, authAccountId);
    const guests = linkedGuestIds(store, { accountId: authAccountId, guestId: id });
    const attemptSet = new Set();
    let bestName = !isDefaultNickname(member?.name) ? member.name : "";
    let latestUpdatedAt = member?.updatedAt ?? null;
    for (const linkedId of guests) {
      const linked = memberFor(store, linkedId);
      if (!linked) continue;
      if (!bestName && !isDefaultNickname(linked.name)) bestName = linked.name;
      if ((linked.updatedAt || 0) > (latestUpdatedAt || 0)) latestUpdatedAt = linked.updatedAt;
      for (const aid of linked.attemptIds ?? []) {
        const receipt = store.receipts?.[`${linkedId}:${aid}`]
          ?? (authAccountId ? findReceiptForIdentity(store, { guestId: linkedId, attemptId: aid, accountId: authAccountId })?.receipt : null);
        if (receipt && !receipt.isSample) attemptSet.add(aid);
      }
    }
    const accountSelection = authAccountId ? readNamespace(store).accountSelections?.[authAccountId] : null;
    if ((accountSelection?.updatedAt || 0) > (latestUpdatedAt || 0)) latestUpdatedAt = accountSelection.updatedAt;
    return {
      positionId: selectedPositionId,
      position: findPosition(store, selectedPositionId),
      participation: { name: bestName || anonymous(id), attemptIds: [...attemptSet] },
      updatedAt: latestUpdatedAt,
      scope: authAccountId ? "account" : "guest",
    };
  };
  // 榜单、群体统计和公开详情共用范围校验，避免岗位切换后出现跨范围的数据。
  const rankingScope = (store, query, requireViewer = false, viewerAccountId = null) => {
    const versionId = query.get("versionId");
    const version = store.versions.find((item) => item.id === versionId && item.status !== "draft");
    if (!version) fail("找不到这套卷版本。", 404);
    const viewerId = requireViewer || query.has("guestId") ? guest(query.get("guestId")) : null;
    const requestedScope = query.get("scope") || "selected";
    if (!["selected", "nationwide", "position"].includes(requestedScope)) fail("榜单范围无效。");
    const selected = viewerId ? effectivePositionId(store, viewerId, viewerAccountId) : null;
    const targetId = requestedScope === "selected" ? selected : requestedScope === "position" ? query.get("positionId") : null;
    const position = findPosition(store, targetId);
    if (targetId && !position) fail("该岗位不存在，请重新选择。", 404);
    if (requestedScope === "position" && !targetId) fail("请选择要查看的岗位。");
    return { version, viewerId, targetId, position, scope: targetId ? "position" : "nationwide",
      selectionMissing: requestedScope === "selected" && !selected };
  };
  const publish = async (dataset) => mutateCatalog((store) => {
    if (directories(store).some((d) => d.source.id === dataset.source.id)) fail("此来源 ID 已存在，请使用新的目录 ID。", 409);
    const ids = new Set(allPositions(store).map((p) => p.id));
    const duplicate = dataset.positions.find((p) => ids.has(p.id));
    if (duplicate) fail(`目录已包含该年度、地区和部门的岗位编码 ${duplicate.code}，未写入任何岗位。`, 409);
    namespace(store).catalogs[dataset.source.id] = dataset;
    return { imported: dataset.positions.length, source: { ...dataset.source, origin: "user-import" } };
  });
  const getUpload = (input) => {
    guest(input.guestId);
    const upload = uploads.get(input.uploadId);
    if (!upload || upload.guestId !== input.guestId || Date.now() - upload.createdAt > 15 * 60 * 1000)
      fail("导入会话已失效，请重新选择文件。", 410);
    return upload;
  };
  const parseExcel = async (upload, buffer) => {
    const base = dataDirectory ? fileURLToPath(new URL("positions-imports/", dataDirectory)) : join(tmpdir(), "rollierank-positions-imports");
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(join(base, "import-"));
    try {
      const path = join(directory, `positions.${upload.extension}`);
      const output = join(directory, "positions.json");
      await writeFile(path, buffer);
      const meta = upload.metadata;
      const args = [fileURLToPath(new URL("../scripts/import-positions.py", import.meta.url)), path, "--output", output];
      for (const [flag, field] of [["exam", "exam"], ["year", "year"], ["region", "region"], ["source-page", "sourcePage"],
        ["download-url", "downloadUrl"], ["retrieved-at", "retrievedAt"], ["publisher", "publisher"], ["label", "label"],
        ["source-id", "id"], ["announcement-page", "announcementPage"], ["source-type", "sourceType"]]) args.push(`--${flag}`, String(meta[field]));
      try { await run(pythonExecutable, args, { timeout: 60000, maxBuffer: 128 * 1024 }); }
      catch (error) {
        let detail;
        try { detail = JSON.parse(error.stderr?.trim()).error; } catch { /* Python startup failures have no JSON output. */ }
        fail(detail || "Excel 解析未完成，请检查 Python 与岗位导入依赖，或改用转换后的 JSON 文件。", 422);
      }
      const parsed = JSON.parse(await readFile(output, "utf8"));
      parsed.source.fileName = upload.fileName;
      return validatePositionsDataset(parsed);
    } finally { await rm(directory, { recursive: true, force: true }); }
  };

  // The hierarchical browser is a separate read path so existing flat catalog and selection callers remain compatible.
  const paths = new Set(["hierarchy", "catalog", "profile", "selection", "participation", "withdraw", "leaderboard", "insights", "public-result", "import", "import/start", "import/chunk", "import/finish", "import/cancel"]);
  async function handle({ request, pathname, method, input = {}, query = new URLSearchParams(), send }) {
    if (!pathname.startsWith("/api/positions/")) return false;
    const path = pathname.slice("/api/positions/".length);
    if (!paths.has(path)) return false;
    const isGet = ["hierarchy", "catalog", "profile", "leaderboard", "insights", "public-result"].includes(path);
    if (method !== (isGet ? "GET" : "POST")) fail("此接口不支持该请求方法。", 405);
    const store = readCatalog();
    if (path === "hierarchy") {
      send(200, positionHierarchy(directories(store), query));
    } else if (path === "catalog") {
      const { page, pageSize } = paging(query);
      const search = String(query.get("q") ?? "").trim().toLocaleLowerCase("zh-CN");
      if (search.length > 120) fail("搜索词不能超过 120 字。");
      const all = allPositions(store);
      const tokens = search.split(/\s+/).filter(Boolean);
      const items = all.filter((p) => (!query.get("year") || String(p.year) === query.get("year")) &&
        (!query.get("exam") || p.exam === query.get("exam")) && (!query.get("region") || p.region === query.get("region")) &&
        tokens.every((token) => [p.code, p.departmentCode, p.department, p.unit, p.title, p.location].join(" ").toLocaleLowerCase("zh-CN").includes(token)));
      const pages = Math.max(1, Math.ceil(items.length / pageSize));
      const current = Math.min(page, pages);
      send(200, { items: items.slice((current - 1) * pageSize, current * pageSize), total: items.length, page: current, pageSize, pages,
        facets: { years: [...new Set(all.map((p) => p.year))].sort((a, b) => b - a), exams: [...new Set(all.map((p) => p.exam))], regions: [...new Set(all.map((p) => p.region))] },
        sources: directories(store).map((d) => ({ ...d.source, origin: d.origin })) });
    } else if (path === "profile") {
      const authAccount = await resolveRequestAccount(billing, request);
      const id = guest(query.get("guestId"));
      send(200, profile(store, id, authAccount?.id ?? null));
    } else if (path === "selection") {
      const authAccount = await resolveRequestAccount(billing, request);
      const id = guest(input.guestId);
      const result = await mutateCatalog((current) => {
        if (input.positionId !== null && !findPosition(current, input.positionId)) fail("岗位不存在，请刷新目录后重新选择。", 404);
        const state = namespace(current);
        const now = Date.now();
        const accountId = authAccount?.id ?? null;
        if (accountId) assertGuestNotOwnedByOther(current, accountId, id);
        const existingMember = memberFor(current, id);
        const ownerAccountId = accountId && (accountIdForGuest(current, id) === accountId || linkAccountGuest(current, accountId, id))
          ? accountId
          : null;
        state.members[id] = {
          ...existingMember,
          positionId: input.positionId,
          ...(ownerAccountId ? { accountId: ownerAccountId } : {}),
          updatedAt: now,
        };
        if (accountId) {
          state.accountSelections ??= {};
          state.accountSelections[accountId] = { positionId: input.positionId, updatedAt: now };
          for (const linkedId of linkedGuestIds(current, { accountId, guestId: id })) {
            if (linkedId === id || !Object.hasOwn(state.members, linkedId)) continue;
            state.members[linkedId] = { ...state.members[linkedId], positionId: input.positionId, updatedAt: now };
          }
        }
        return profile(current, id, accountId);
      });
      send(200, result);
    } else if (path === "participation" || path === "withdraw") {
      const authAccount = await resolveRequestAccount(billing, request);
      const id = guest(input.guestId);
      const result = await mutateCatalog((current) => {
        const state = namespace(current);
        const accountId = authAccount?.id ?? null;
        if (accountId) assertGuestNotOwnedByOther(current, accountId, id);
        const previous = memberFor(current, id) ?? {};
        let attemptIds = [];
        let name = previous.name || anonymous(id);
        if (path === "participation") {
          name = string(input.name, "匿名昵称", 16);
          if (/[\r\n\t]/.test(name)) fail("匿名昵称不能换行或包含制表符。");
          if (!Array.isArray(input.attemptIds) || input.attemptIds.length > 2000 || new Set(input.attemptIds).size !== input.attemptIds.length)
            fail("请选择不重复的答卷，每次最多 2000 份。");
          if (input.versionId !== undefined && !current.versions.some((v) => v.id === input.versionId)) fail("找不到这套卷版本。", 404);
          for (const aid of input.attemptIds) {
            if (typeof aid !== "string" || !guestPattern.test(aid)) fail("答卷凭证无效。");
            const receipt = findReceiptForIdentity(current, { guestId: id, attemptId: aid, accountId })?.receipt;
            if (!receipt || receipt.isSample || (input.versionId && receipt.versionId !== input.versionId)) fail("请选择当前身份已提交的同版本真实答卷。", 403);
          }
          const otherVersions = input.versionId ? (previous.attemptIds ?? []).filter((aid) => {
            const receipt = findReceiptForIdentity(current, { guestId: id, attemptId: aid, accountId })?.receipt;
            return receipt && !receipt.isSample && receipt.versionId !== input.versionId;
          }) : [];
          attemptIds = [...otherVersions, ...input.attemptIds];
        }
        const now = Date.now();
        const optOut = path === "withdraw" || attemptIds.length === 0;
        const ownerAccountId = accountId && (accountIdForGuest(current, id) === accountId || linkAccountGuest(current, accountId, id))
          ? accountId
          : null;
        // 兼容管理接口继续支持明确撤回；默认提交与一次性迁移都尊重这一选择。
        state.members[id] = {
          ...previous,
          name,
          attemptIds,
          participationOptOut: optOut,
          ...(ownerAccountId ? { accountId: ownerAccountId } : {}),
          updatedAt: now,
        };
        if (accountId) {
          state.accountOptOut ??= {};
          state.accountOptOut[accountId] = { optOut, updatedAt: now };
          for (const linkedId of linkedGuestIds(current, { accountId, guestId: id })) {
            if (linkedId === id || !Object.hasOwn(state.members, linkedId)) continue;
            state.members[linkedId] = optOut
              ? { ...state.members[linkedId], attemptIds: [], participationOptOut: true, updatedAt: now }
              : { ...state.members[linkedId], participationOptOut: false, updatedAt: now };
          }
        }
        return profile(current, id, accountId);
      });
      send(200, result);
    } else if (path === "insights" || path === "public-result") {
      const authAccount = await resolveRequestAccount(billing, request);
      const viewerAccountId = authAccount?.id ?? null;
      const context = rankingScope(store, query, path === "insights", viewerAccountId);
      const { version, viewerId, targetId, position, scope, selectionMissing } = context;
      const participants = publicParticipants({ store, members: readNamespace(store).members ?? {}, version, positionId: targetId });
      if (path === "insights") {
        const attemptId = guest(query.get("attemptId"));
        const ownReceipt = findReceiptForIdentity(store, { guestId: viewerId, attemptId, accountId: viewerAccountId })?.receipt;
        if (!ownReceipt || ownReceipt.isSample || ownReceipt.versionId !== version.id)
          fail("完成本卷练习后可查看统计。", 403);
        const band = query.get("band") || "all";
        if (band !== "all" && !SCORE_BANDS.some((item) => item.id === band)) fail("分数段无效。");
        send(200, { versionId: version.id, scope, position, selectionMissing, answerRevision: version.answerRevision ?? 0,
          ...buildInsights({ version, ownReceipt, participants, band }), asOf: Date.now() });
      } else {
        const id = query.get("publicId");
        if (typeof id !== "string" || !/^public-[a-f0-9]{24}$/.test(id)) fail("公开成绩标识无效。");
        const person = participants.find((item) => item.publicId === id);
        if (!person) fail("该成绩当前未在此范围公开。", 404);
        send(200, { versionId: version.id, scope, position, participantCount: participants.length,
          result: publicResult(person), asOf: Date.now() });
      }
    } else if (path === "leaderboard") {
      const authAccount = await resolveRequestAccount(billing, request);
      const viewerAccountId = authAccount?.id ?? null;
      const { version, viewerId, targetId, position, scope, selectionMissing } = rankingScope(store, query, false, viewerAccountId);
      // 按完整板块选一次最佳；公开成员标识和超越比例沿用同一范围、同一去重口径。
      const dimension = resolveSubjectDimension(version.questions, query.get("dimension") || "total");
      if (dimension !== "total" && !subjectDimensions(version.questions).some((type) => type.id === dimension)) fail("题型不存在。");
      const participants = publicParticipants({ store, members: readNamespace(store).members ?? {}, version, positionId: targetId, dimension });
      const rows = participants.map((person) => publicLeaderboardRow(person, viewerId, viewerAccountId));
      const { page, pageSize } = paging(query);
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      const current = Math.min(page, pages);
      send(200, { versionId: version.id, dimension, scope, position, selectionMissing, count: rows.length,
        rows: rows.slice((current - 1) * pageSize, current * pageSize), self: rows.find((row) => row.isMe) ?? null,
        page: current, pageSize, pages, asOf: Date.now() });
    } else if (path === "import") {
      send(200, await publish(validatePositionsDataset(input.dataset)));
    } else if (path === "import/start") {
      const id = guest(input.guestId);
      for (const [key, value] of uploads) if (Date.now() - value.createdAt > 15 * 60 * 1000) uploads.delete(key);
      if (uploads.size >= 3) fail("已有导入任务，请稍后重试。", 429);
      const fileName = string(input.fileName, "文件名", 240);
      const extension = fileName.split(".").at(-1).toLowerCase();
      if (!["xls", "xlsx", "json"].includes(extension)) fail("请选择 Excel 或岗位目录 JSON 文件。");
      const size = integer(input.size, "文件字节数", 1, fileLimit);
      const metadata = extension === "json" ? null : sourceMetadata(input.metadata);
      const uploadId = randomUUID();
      uploads.set(uploadId, { guestId: id, fileName, extension, size, metadata, createdAt: Date.now(), chunks: [], bytes: 0, finishing: false });
      send(200, { uploadId, chunkSize: chunkLimit });
    } else if (path === "import/chunk") {
      const upload = getUpload(input);
      if (upload.finishing) fail("此文件正在解析。", 409);
      integer(input.index, "分块序号", 0, Math.ceil(fileLimit / chunkLimit));
      if (typeof input.chunk !== "string" || input.chunk.length > chunkLimit * 4 / 3 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.chunk) || !input.chunk.length)
        fail("文件分块无效或过大。");
      const chunk = Buffer.from(input.chunk, "base64");
      if (input.index < upload.chunks.length) {
        if (!upload.chunks[input.index].equals(chunk)) fail("重试分块与已接收内容不一致。", 409);
      } else {
        if (input.index !== upload.chunks.length || upload.bytes + chunk.length > upload.size) fail("分块顺序或文件大小不一致。", 409);
        upload.chunks.push(chunk);
        upload.bytes += chunk.length;
      }
      send(200, { nextIndex: upload.chunks.length, bytes: upload.bytes });
    } else if (path === "import/cancel") {
      const upload = getUpload(input);
      if (upload.finishing) fail("文件正在解析，请等待结果。", 409);
      uploads.delete(input.uploadId);
      send(200, { cancelled: true });
    } else if (path === "import/finish") {
      const upload = getUpload(input);
      if (upload.finishing || upload.bytes !== upload.size) fail("文件尚未上传完整或正在解析。", 409);
      upload.finishing = true;
      try {
        const buffer = Buffer.concat(upload.chunks);
        let dataset;
        if (upload.extension === "json") {
          let parsed;
          try { parsed = JSON.parse(buffer.toString("utf8").replace(/^\uFEFF/, "")); } catch { fail("岗位目录 JSON 格式无效。"); }
          dataset = validatePositionsDataset(parsed);
        } else dataset = await parseExcel(upload, buffer);
        send(200, await publish(dataset));
      } finally { uploads.delete(input.uploadId); }
    }
    return true;
  }
  return handle;
}
