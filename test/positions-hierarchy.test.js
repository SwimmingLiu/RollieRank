import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { positionId, validatePositionsDataset, examCategoryLabel, positionHierarchy } from "../server/positions.mjs";
import { createFixture, guestId } from "./ios-positions-fixtures.mjs";

const hierarchy = (app, values = {}) => app.request(`positions/hierarchy?${new URLSearchParams(values)}`);
function imported({ id = "legacy-hierarchy", year = 2027, count = 95, specs = [] } = {}) {
  const source = { id, label: `${year} 省考验收目录`, exam: "shengkao", year, region: "广东", publisher: "用户提供文件",
    sourceType: "user-file", sourcePage: "", downloadUrl: "", retrievedAt: "2026-11-14", sha256: "a".repeat(64), count: specs.length || count };
  const positions = Array.from({ length: source.count }, (_, i) => {
    const p = { exam: source.exam, year, region: source.region, code: String(i).padStart(6, "0"), departmentCode: "001", department: "验收部门",
      title: `岗位${String(i).padStart(3, "0")}`, unit: ["", "无", "N/A"][i % 3], location: "广东", education: "本科", major: "不限", recruits: 1,
      sourceId: id, sourceSheet: "中央党群机关", sourceRow: i + 2, ...specs[i] };
    return { ...p, id: positionId(p) };
  });
  return { schemaVersion: 1, source, positions };
}
const parentValues = (data) => Object.fromEntries(data.breadcrumbs.filter((b) => b.level !== "position").map((b) => [`${b.level}Id`, b.id]));

test("official hierarchy exposes genuine categories, keeps every position identity and restores complete typed paths", async (t) => {
  const app = await createFixture(t);
  const raw = JSON.parse(await readFile(new URL("../data/positions/guokao-2027.json", import.meta.url), "utf8"));
  const root = await hierarchy(app);
  assert.equal(root.level, "source");
  assert.equal(root.source, null);
  assert.deepEqual(root.breadcrumbs, []);
  assert.equal(root.autoAdvance, true);
  const sourceId = root.options[0].id;
  const categories = await hierarchy(app, { sourceId });
  assert.equal(categories.level, "category");
  assert.equal(categories.total, 10);
  assert.equal(categories.autoAdvance, false);
  assert.equal(categories.source.count, 19426);
  assert.equal(categories.options.some((o) => o.label === "群团机关 · 副省级"), true);
  assert.equal(new Set(raw.positions.map((p) => p.institutionCategory)).size, 6);
  // This digest was recorded from the pre-hierarchy directory, so changing both importer and validator cannot silently rewrite saved selections.
  assert.equal(createHash("sha256").update(JSON.stringify(raw.positions.map((p) => p.id))).digest("hex"), "5115870472bd7bff85ecbe621eb419a44465bc200e870ac97509c6385a36054b");
  assert.equal(raw.source.sha256, "6b3da70baabe31a4a202c6b1179040db7003a956bc85c79cd35e3fb739d9520a");
  assert.equal(raw.schemaVersion, 1);
  const exams = raw.positions.reduce((counts, p) => ({ ...counts, [p.examCategoryLabel]: (counts[p.examCategoryLabel] || 0) + 1 }), {});
  assert.deepEqual(exams, { "副省级": 1423, "行政执法类": 14008, "地市级": 3995 });
  const first = raw.positions[0];
  const restored = await hierarchy(app, { positionId: first.id });
  assert.equal(restored.level, "position");
  assert.deepEqual(restored.breadcrumbs.map((b) => b.level), ["source", "category", "department", "unit", "position"]);
  assert.deepEqual(restored.breadcrumbs.map((b) => b.label), [raw.source.label, "中央党群机关 · 副省级", "中央办公厅", "警卫局", first.title]);
  const leaf = restored.options.find((o) => o.positionId === first.id);
  assert.equal(leaf.id, first.id);
  assert.equal(leaf.code, "100110001001");
  assert.equal(leaf.position.departmentCode, "002000");
  assert.equal(leaf.position.examCategory, "中央机关及其省级直属机构综合管理类");
  assert.equal(leaf.position.sourceRow, first.sourceRow);
  const path = parentValues(restored);
  for (const [parent, expected] of [[{ sourceId }, "category"], [{ sourceId, categoryId: path.categoryId }, "department"],
    [{ sourceId, categoryId: path.categoryId, departmentId: path.departmentId }, "unit"], [path, "position"]]) {
    const result = await hierarchy(app, parent);
    assert.equal(result.level, expected);
    assert.ok(result.options.length);
  }
  const before = JSON.stringify(restored);
  await app.restart();
  assert.equal(JSON.stringify(await hierarchy(app, { positionId: first.id })), before);
});

test("invalid, cross-parent, incomplete and ambiguous parent conditions fail instead of broadening the result", async (t) => {
  const app = await createFixture(t);
  const first = await hierarchy(app, { positionId: app.positions[0].id });
  const a = parentValues(first);
  const raw = JSON.parse(await readFile(new URL("../data/positions/guokao-2027.json", import.meta.url), "utf8"));
  const different = raw.positions.find((p) => p.examCategoryLabel === "行政执法类");
  const b = parentValues(await hierarchy(app, { positionId: different.id }));
  const extra = imported({ id: "other-source-hierarchy", count: 1 });
  await app.request("positions/import", { dataset: extra });
  const c = parentValues(await hierarchy(app, { positionId: extra.positions[0].id }));
  for (const values of [
    { categoryId: a.categoryId }, { sourceId: a.sourceId, departmentId: a.departmentId },
    { sourceId: a.sourceId, categoryId: a.categoryId, unitId: a.unitId },
    { ...a, categoryId: b.categoryId }, { ...a, unitId: b.unitId },
    { ...a, sourceId: c.sourceId }, { sourceId: "missing" }, { ...a, departmentId: "missing" },
    { positionId: app.positions[0].id, sourceId: a.sourceId }, { positionId: "missing" },
    { sourceId: "" }, { pageSize: "20" }, { pageSize: "1000" }, { page: "0" }, { page: "1x" },
    { q: "字".repeat(121) }, { randomParent: "ignored-must-not-broaden" },
  ]) await assert.rejects(hierarchy(app, values), (error) => [400, 404].includes(error.statusCode), JSON.stringify(values));
  await assert.rejects(app.request(`positions/hierarchy?sourceId=${a.sourceId}&sourceId=${c.sourceId}`), (error) => error.statusCode === 400);
  await assert.rejects(app.request("positions/hierarchy", {}), (error) => error.statusCode === 405);
});

test("legacy schema-v1 imports naturally cross missing classifications and units without guessing from sheet names", async (t) => {
  const app = await createFixture(t);
  const old = imported();
  await app.request("positions/import", { dataset: old });
  const categories = await hierarchy(app, { sourceId: old.source.id });
  assert.equal(categories.level, "category");
  assert.equal(categories.autoAdvance, true);
  assert.deepEqual(categories.options.map((o) => ({ label: o.label, automatic: o.automatic })), [{ label: "", automatic: true }]);
  const parents = { sourceId: old.source.id, categoryId: categories.options[0].id };
  const departments = await hierarchy(app, parents);
  assert.equal(departments.level, "department");
  assert.equal(departments.options[0].label, "验收部门");
  assert.equal(departments.breadcrumbs[1].automatic, true);
  const units = await hierarchy(app, { ...parents, departmentId: departments.options[0].id });
  assert.equal(units.level, "unit");
  assert.equal(units.autoAdvance, true);
  assert.equal(units.options[0].automatic, true);
  assert.equal(units.options[0].label, "");
  const path = { ...parents, departmentId: departments.options[0].id, unitId: units.options[0].id };
  const page1 = await hierarchy(app, path);
  assert.equal(page1.level, "position");
  assert.equal(page1.options.length, 40);
  assert.equal(page1.total, 95);
  assert.equal(page1.pages, 3);
  assert.equal(page1.autoAdvance, false);
  assert.equal(page1.breadcrumbs[3].automatic, true);
  const page2 = await hierarchy(app, { ...path, page: "2" });
  assert.equal(page2.options[0].positionId, old.positions[40].id);
  assert.equal((await hierarchy(app, { ...path, pageSize: "100" })).options.length, 95);
  assert.equal((await hierarchy(app, { ...path, page: "999" })).page, 3);
  const last = await hierarchy(app, { positionId: old.positions.at(-1).id });
  assert.equal(last.page, 3);
  assert.ok(last.options.some((o) => o.positionId === old.positions.at(-1).id));
  assert.equal(last.breadcrumbs.length, 5);
  assert.equal(last.options[0].position.institutionCategory, undefined);
  assert.equal(last.options[0].position.sourceSheet, "中央党群机关");
});

test("mixed valid and missing fields retain all branches and search only the current level inside its selected parent", async (t) => {
  const app = await createFixture(t);
  const data = imported({ id: "mixed-hierarchy", specs: [
    { institutionCategory: "机关甲", examCategory: "中央机关及其省级直属机构综合管理类", department: "同名部门", unit: "同名单位" },
    { institutionCategory: "机关甲", examCategory: "行政执法类", department: "同名部门", unit: "同名单位" },
    { institutionCategory: "机关乙", examCategory: "市（地）级及以下直属机构综合管理类", department: "乙部门", unit: "综合处" },
    { department: "旧部门", departmentCode: "004", unit: "—" },
    { institutionCategory: "机关丙", examCategory: "专业技术类", department: "丙部门", unit: "资料科" },
  ] });
  await app.request("positions/import", { dataset: data });
  const categories = await hierarchy(app, { sourceId: data.source.id });
  assert.equal(categories.total, 5);
  assert.equal(categories.autoAdvance, false);
  assert.equal(categories.options.filter((o) => o.automatic).length, 1);
  assert.ok(categories.options.some((o) => o.label === "机关乙 · 地市级"));
  assert.ok(categories.options.some((o) => o.label === "机关丙 · 专业技术类"));
  const one = await hierarchy(app, { positionId: data.positions[0].id });
  const two = await hierarchy(app, { positionId: data.positions[1].id });
  const path = parentValues(one), other = parentValues(two);
  assert.notEqual(path.departmentId, other.departmentId);
  assert.notEqual(path.unitId, other.unitId);
  assert.equal((await hierarchy(app, { sourceId: data.source.id, categoryId: path.categoryId, q: "000000" })).total, 0);
  assert.equal((await hierarchy(app, { ...path, q: "000001" })).total, 0);
  assert.equal((await hierarchy(app, { ...path, q: "000000" })).options[0].positionId, data.positions[0].id);
  assert.equal((await hierarchy(app, { sourceId: data.source.id, q: "行政执法类" })).total, 1);
  assert.equal((await hierarchy(app, { sourceId: data.source.id, categoryId: path.categoryId, q: "001" })).total, 1);
  assert.equal((await hierarchy(app, { ...path, q: "岗位000 000000" })).total, 1);
  const auto = await hierarchy(app, { positionId: data.positions[3].id });
  assert.equal(auto.options[0].positionId, data.positions[3].id);
  assert.equal(auto.breadcrumbs.filter((b) => b.automatic).length, 2);
});

test("existing catalog, selection, real leaderboard and profile survive hierarchy reads unchanged", async (t) => {
  const app = await createFixture(t);
  await app.request("positions/selection", { guestId, positionId: app.positions[0].id });
  await app.receipt();
  await app.request("positions/participation", { guestId, name: "真实验收", attemptIds: ["attempt-ios-positions-111"] });
  const profileBefore = await app.request(`positions/profile?guestId=${guestId}`);
  const boardQuery = `positions/leaderboard?${new URLSearchParams({ guestId, versionId: app.version.id, scope: "selected" })}`;
  const boardBefore = await app.request(boardQuery);
  await hierarchy(app, { positionId: app.positions[1].id });
  const profileAfter = await app.request(`positions/profile?guestId=${guestId}`);
  assert.deepEqual(profileAfter, profileBefore);
  assert.equal(profileAfter.position.id, app.positions[0].id);
  assert.equal(profileAfter.position.examCategoryLabel, "副省级");
  const flat = await app.request("positions/catalog?q=002000");
  assert.equal(flat.pageSize, 20);
  assert.equal(flat.items[0].institutionCategory, "中央党群机关");
  const boardAfter = await app.request(boardQuery);
  assert.deepEqual({ ...boardAfter, asOf: 0 }, { ...boardBefore, asOf: 0 });
  await app.restart();
  assert.equal((await app.request(`positions/profile?guestId=${guestId}`)).positionId, app.positions[0].id);
});

test("normalization preserves unknown real categories and rejects a contradictory derived label", () => {
  assert.equal(examCategoryLabel(" 市（地）级及以下直属机构综合管理类 "), "地市级");
  assert.equal(examCategoryLabel("constructor"), "constructor");
  assert.equal(examCategoryLabel("专业技术类"), "专业技术类");
  const bad = imported({ count: 1, specs: [{ examCategory: "行政执法类", examCategoryLabel: "副省级" }] });
  assert.throws(() => validatePositionsDataset(bad), /显示值与原文不一致/);
  assert.equal(validatePositionsDataset(imported({ count: 1 })).positions[0].examCategory, undefined);
  assert.deepEqual(positionHierarchy([], new URLSearchParams()), { level: "source", source: null, breadcrumbs: [], options: [], total: 0, page: 1, pages: 1, autoAdvance: false });
});
