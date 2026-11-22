import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(args, env = {}) {
  return new Promise((done, fail) => {
    const child = spawn("python3", ["scripts/verify-rollierank.py", ...args], { cwd: root, env: { ...process.env, ...env } });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", fail);
    child.once("exit", code => done({ code, stdout, stderr }));
  });
}

test("verification doctor reports every missing dependency instead of silently skipping", async t => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-doctor-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = await run(["doctor", "--output", directory]);
  const report = JSON.parse(await readFile(join(directory, "doctor.json"), "utf8"));
  assert.ok([0, 1].includes(result.code));
  assert.equal(typeof report.ok, "boolean");
  for (const name of ["node", "npm", "python", "playwright-python", "playwright-node", "excel-python", "chromium", "beui-dependencies", "source", "wallet-postgres", "pg-driver"]) assert.equal(typeof report.checks[name], "boolean");
  if (!report.ok) assert.ok(report.remediation && Object.keys(report.remediation).length > 0);
  assert.equal(result.stderr, "");
});

// Successful process exits must not hide absent or skipped browser coverage.
test("verification rejects skipped tests and absent summaries even when the child exits zero", async () => {
  const code = `import runpy,sys,tempfile
from pathlib import Path
module=runpy.run_path('scripts/verify-rollierank.py')
with tempfile.TemporaryDirectory() as directory:
    for index,(summary,accepted) in enumerate([
        ('ℹ tests 2\\nℹ pass 2\\nℹ fail 0\\nℹ cancelled 0\\nℹ skipped 0\\nℹ todo 0',True),
        ('# tests 2\\n# pass 1\\n# fail 0\\n# cancelled 0\\n# skipped 1\\n# todo 0',False),
        ('no tests were executed',False),
    ]):
        try:
            result=module['run_command']([sys.executable,'-c','print('+repr(summary)+')'],Path(directory)/str(index),'guard-regression',require_test_summary=True)
            assert accepted
            assert result['testSummary']['pass']==2
        except module['VerificationError']:
            assert not accepted
print('verified')`;
  const { stdout } = await promisify(execFile)("python3", ["-c", code], { cwd: root });
  assert.match(stdout, /verified/);
});

test("verification feature map has readable live recipes for every mapped feature", async () => {
  const directory = resolve(root, ".agents/skills/verify-rollierank/features");
  const index = await readFile(join(directory, "README.md"), "utf8");
  for (const [id, title] of [
    ["catalog-admin", "套卷目录与管理"], ["tool-credits", "卷豆账号和账本"], ["practice-history", "录答、评分、复盘与本机记录"],
    ["positions-rank", "报考岗位与练习榜"], ["discussion", "本卷交流与多媒体评论"],
    ["analytics", "二刷对比与成长分析"], ["corrections", "答案反馈、审核与重算"],
    ["sharing", "成绩分享与导出"], ["visual-design-audit", "视觉渲染与 UI 设计合理性审查"],
  ]) {
    assert.match(index, new RegExp(`\\(${id}\\.md\\)`));
    const feature = await readFile(join(directory, `${id}.md`), "utf8");
    assert.match(feature, new RegExp(`^# ${title}`, "m"));
    for (const section of ["## Sub-features", "## How to get to it (user POV)", "## Driving it with verification CLI", "## Gotchas"]) assert.ok(feature.includes(section), `${id}: ${section}`);
    assert.ok(feature.includes(`npm run verify -- feature ${id}`), id);
  }
});
