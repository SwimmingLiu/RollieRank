import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { createPositionsService } from "../server/positions.mjs";

const python = process.env.POSITIONS_PYTHON || "python3";
let dependencies = true;
try { execFileSync(python, ["-c", "import xlrd,openpyxl"], { stdio: "pipe" }); } catch { dependencies = false; }
const options = { skip: dependencies ? false : "Excel CLI checks need scripts/positions-requirements.txt (set POSITIONS_PYTHON if using a virtual environment)." };
const importer = fileURLToPath(new URL("../scripts/import-positions.py", import.meta.url));
const metadata = { exam: "shengkao", year: 2027, region: "广东", publisher: "测试来源", sourceType: "user-file",
  sourcePage: "", downloadUrl: "", retrievedAt: "2026-11-14", label: "省考测试表", id: "province-2027-test" };
const flags = (meta) => ["--exam", meta.exam, "--year", String(meta.year), "--region", meta.region,
  "--publisher", meta.publisher, "--source-type", meta.sourceType, "--source-page", meta.sourcePage,
  "--download-url", meta.downloadUrl, "--retrieved-at", meta.retrievedAt, "--label", meta.label, "--source-id", meta.id];

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-positions-excel-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    directory,
    async workbook(rows, { formats = {}, merges = [], name = "岗位表", file = "positions.xlsx" } = {}) {
      const path = join(directory, file);
      execFileSync(python, ["-c", [
        "import sys,json,openpyxl", "p=json.loads(sys.argv[2]); b=openpyxl.Workbook(); s=b.active; s.title=p['name']",
        "for row in p['rows']: s.append(row)", "for key,value in p['formats'].items(): s[key].number_format=value",
        "for cells in p['merges']: s.merge_cells(cells)", "b.save(sys.argv[1])",
      ].join("\n"), path, JSON.stringify({ rows, formats, merges, name })], { stdio: "pipe" });
      return path;
    },
    async convert(path, { meta = metadata, extra = [], output = "result.json" } = {}) {
      const target = join(directory, output);
      try {
        const stdout = execFileSync(python, [importer, path, "--output", target, ...flags(meta), ...extra], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        return { code: 0, report: JSON.parse(stdout), dataset: JSON.parse(await readFile(target, "utf8")), target };
      } catch (error) {
        let report;
        try { report = JSON.parse(error.stderr); } catch { report = { error: error.stderr }; }
        return { code: error.status, report, target };
      }
    },
  };
}

test("province XLSX aliases, title rows, merged departments and displayed zero padding preserve identifiers", options, async (t) => {
  const app = await fixture(t);
  const path = await app.workbook([
    ["省考岗位目录"], ["岗位代码", "招录单位", "岗位名称", "学历要求", "专业要求", "招录人数"],
    [7, "省某机关", "行政管理", "本科", "法学", 2], ["000008", null, "综合管理", "硕士", "不限", 1],
  ], { formats: { A3: "000000" }, merges: ["B3:B4"] });
  const result = await app.convert(path);
  assert.equal(result.code, 0);
  assert.deepEqual(result.dataset.positions.map((p) => p.code), ["000007", "000008"]);
  assert.deepEqual(result.dataset.positions.map((p) => p.department), ["省某机关", "省某机关"]);
  assert.equal(result.dataset.positions[0].sourceRow, 3);
  assert.equal(result.dataset.source.sourceType, "user-file");
  assert.equal(result.dataset.source.sourcePage, "");
  assert.match(result.dataset.source.sha256, /^[a-f0-9]{64}$/);
});

test("explicit column mapping handles nonstandard province headers and distinct departments sharing a code", options, async (t) => {
  const app = await fixture(t);
  const path = await app.workbook([["职位编号", "机关", "职务"], ["001", "甲机关", "管理"], ["001", "乙机关", "管理"]]);
  const unmapped = await app.convert(path);
  assert.notEqual(unmapped.code, 0);
  const map = join(app.directory, "columns.json");
  await writeFile(map, JSON.stringify({ code: "职位编号", department: "机关", title: "职务" }));
  const result = await app.convert(path, { extra: ["--columns", map, "--sheet", "岗位表"] });
  assert.equal(result.code, 0);
  assert.equal(new Set(result.dataset.positions.map((p) => p.id)).size, 2);
  const later = await app.convert(path, { meta: { ...metadata, year: 2028 }, extra: ["--columns", map], output: "later.json" });
  assert.notEqual(result.dataset.positions[0].id, later.dataset.positions[0].id);
  const missing = await app.convert(path, { extra: ["--sheet", "不存在"] });
  assert.match(missing.report.error, /找不到工作表/);
});

test("duplicate identities report both rows and leave a previously generated catalog intact", options, async (t) => {
  const app = await fixture(t);
  const path = await app.workbook([["职位代码", "部门名称", "职位名称"], ["0001", "部门", "岗位甲"], ["0001", "部门", "岗位乙"]]);
  const output = join(app.directory, "result.json");
  await writeFile(output, "previous catalog");
  const result = await app.convert(path);
  assert.equal(result.code, 1);
  assert.match(result.report.error, /第 3 行.*重复岗位编码.*第 2 行/);
  assert.equal(await readFile(output, "utf8"), "previous catalog");
});

test("unsafe numeric, formula, scientific-text identifiers and nonempty incomplete rows fail with coordinates", options, async (t) => {
  const app = await fixture(t);
  for (const [value, error] of [[1234567890123456, /无法可靠还原/], ["3.0011E+11", /科学计数法/], ["=1+1", /不能使用公式/], [null, /编码为空/]]) {
    const path = await app.workbook([["职位代码", "部门名称", "职位名称"], [value, "部门", "岗位"]]);
    const result = await app.convert(path);
    assert.equal(result.code, 1);
    assert.match(result.report.error, /岗位表 第 2 行/);
    assert.match(result.report.error, error);
  }
  const empty = await app.workbook([["职位代码", "部门名称", "职位名称"]]);
  assert.match((await app.convert(empty)).report.error, /没有可导入/);
});

test("official XLS archive can be reimported identically and its sha/counts match the shipped directory", options, async (t) => {
  const app = await fixture(t);
  const archive = fileURLToPath(new URL("../data/positions/sources/guokao-2027.zip", import.meta.url));
  const path = execFileSync(python, ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.extract(z.namelist()[0],sys.argv[2]))", archive, app.directory], { encoding: "utf8" }).trim();
  const shipped = JSON.parse(await readFile(new URL("../data/positions/guokao-2027.json", import.meta.url), "utf8"));
  const meta = { ...shipped.source, sourceType: "published" };
  const result = await app.convert(path, { meta });
  assert.equal(result.code, 0);
  assert.deepEqual(result.dataset.positions, shipped.positions);
  assert.equal(result.dataset.source.sha256, shipped.source.sha256);
  assert.equal(result.dataset.source.count, 19426);
  assert.deepEqual(result.dataset.source.sheets.map((s) => s.count), [99, 312, 18193, 822]);
  // Verify the retained classifications against the original cells, independently of the importer and its normalized JSON.
  const originalDigest = execFileSync(python, ["-c", [
    "import xlrd,sys,json,hashlib", "b=xlrd.open_workbook(sys.argv[1]); rows=[]",
    "for s in b.sheets():",
    " if s.nrows<3: continue",
    " headers=s.row_values(1); a=headers.index('机构性质'); e=headers.index('考试类别')",
    " for row in range(2,s.nrows): rows.append([s.name,row+1,s.cell_value(row,a),s.cell_value(row,e)])",
    "print(hashlib.sha256(json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode()).hexdigest())",
  ].join("\n"), path], { encoding: "utf8", stdio: "pipe" }).trim();
  const actual = result.dataset.positions.map((p) => [p.sourceSheet, p.sourceRow, p.institutionCategory, p.examCategory]);
  assert.equal(createHash("sha256").update(JSON.stringify(actual)).digest("hex"), originalDigest);
});

test("classification columns retain exact source text, normalize only known exams and keep older tables without inferred categories", options, async (t) => {
  const app = await fixture(t);
  const path = await app.workbook([
    ["岗位代码", "部门名称", "岗位名称", "机构性质", "考试类别"],
    ["000001", "部门", "岗位甲", "真实机关甲", "中央机关及其省级直属机构综合管理类"],
    ["000002", "部门", "岗位乙", "真实机关乙", "市（地）级及以下直属机构综合管理类"],
    ["000003", "部门", "岗位丙", "真实机关甲", "行政执法类"],
    ["000004", "部门", "岗位丁", "真实机关丙", "专业技术类"],
  ], { name: "不同于机构性质的工作表" });
  const result = await app.convert(path);
  assert.equal(result.code, 0);
  assert.deepEqual(result.dataset.positions.map((p) => p.examCategoryLabel), ["副省级", "地市级", "行政执法类", "专业技术类"]);
  assert.equal(result.dataset.positions[0].institutionCategory, "真实机关甲");
  assert.equal(result.dataset.positions[0].examCategory, "中央机关及其省级直属机构综合管理类");
  const old = await app.workbook([["岗位代码", "部门名称", "岗位名称"], ["000001", "部门", "旧岗位"]], { name: "中央党群机关" });
  const legacy = await app.convert(old);
  assert.equal(legacy.dataset.positions[0].institutionCategory, undefined);
  assert.equal(legacy.dataset.positions[0].examCategory, undefined);
});

test("service parses an actual chunked Excel upload with Python before publishing; parser failure leaves the catalog intact", options, async (t) => {
  const app = await fixture(t);
  const path = await app.workbook([["职位代码", "部门名称", "职位名称"], ["00001", "测试部门", "测试岗位"]]);
  const store = { versions: [], receipts: {}, audit: [], features: {} };
  const service = await createPositionsService({ readCatalog: () => store, mutateCatalog: async (callback) => {
    const before = structuredClone(store);
    try { const result = callback(store); await writeFile(join(app.directory, "catalog.json"), JSON.stringify(store)); return result; }
    catch (error) { Object.assign(store, before); throw error; }
  }, dataDirectory: pathToFileURL(app.directory + "/"), datasets: [], pythonExecutable: python });
  const request = async (path, input) => {
    let result;
    await service({ pathname: `/api/positions/${path}`, method: "POST", input, send: (status, data) => { result = { status, data }; } });
    return result;
  };
  const guestId = "guest-import-12345";
  const upload = async (bytes, fileName = "province.xlsx") => {
    const started = await request("import/start", { guestId, fileName, size: bytes.length, metadata });
    const input = { guestId, uploadId: started.data.uploadId };
    await request("import/chunk", { ...input, index: 0, chunk: bytes.toString("base64") });
    return request("import/finish", input);
  };
  const imported = await upload(await readFile(path));
  assert.equal(imported.data.imported, 1);
  assert.equal(store.features.positions.catalogs[metadata.id].positions[0].code, "00001");
  assert.match(await readFile(join(app.directory, "catalog.json"), "utf8"), /00001/);
  await assert.rejects(upload(Buffer.from("broken workbook")), /Excel 文件损坏/);
  assert.equal(Object.keys(store.features.positions.catalogs).length, 1);
});
