import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
// 新内置目录增加套卷；这些用例验证增减行为，基数随真实目录变化。
import { IMPORTED_PAPERS } from "../src/data/imported-papers.js";
const baselineCount = 12 + IMPORTED_PAPERS.length;

test("local API validates, persists, versions and grades without exposing answers", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-api-"));
  const dataDirectory = pathToFileURL(directory + "/");
  const api = await createApi({ dataDirectory });
  const server = createServer((request, response) =>
    api(request, response, new URL(request.url, "http://localhost").pathname),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    server.close();
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const request = async (path, body) => {
    const response = await fetch(
      base + path,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {},
    );
    return { status: response.status, data: await response.json() };
  };
  const catalog = await request("catalog");
  assert.equal(catalog.data.versions.length, baselineCount);
  assert.equal(JSON.stringify(catalog.data).includes("correctAnswer"), false);
  const example = (
    await request("sample", { versionId: catalog.data.versions[0].id })
  ).data;
  assert.notEqual(example.versionId, catalog.data.versions[0].id);
  assert.equal(example.paperTitle, "行测练习 · 示例卷");
  assert.equal(example.report.rows[0].correctAnswer, "A");
  const input = {
    title: "自定义 4 题卷",
    institution: "测试机构",
    project: "测试项目",
    period: "一期",
    variant: "通用",
    csv: "题号,题型,答案,分值\n1,政治,A,0.5\n2,言语,B,0.8\n3,逻辑,C,0.85\n4,资料,D,1.2",
  };
  assert.equal(
    (
      await request("admin/import", {
        ...input,
        csv: input.csv.replace("3,逻辑,C", "3,逻辑,E"),
      })
    ).status,
    400,
  );
  assert.equal((await request("admin")).data.versions.length, baselineCount);
  const imported = (await request("admin/import", input)).data;
  assert.equal(imported.status, "draft");
  assert.equal((await request("catalog")).data.versions.length, baselineCount);
  assert.equal(
    (
      await request("admin/status", {
        versionId: imported.id,
        status: "published",
      })
    ).status,
    200,
  );
  assert.equal((await request("catalog")).data.versions.length, baselineCount + 1);
  const submission = {
    versionId: imported.id,
    guestId: "guest-1234567890",
    attemptId: "attempt-1234567890",
    answers: ["A", "B", null, "D"],
  };
  const first = await request("submit", submission);
  assert.equal(first.status, 200);
  assert.equal(first.data.report.totalCents, 250);
  assert.equal(first.data.report.maxCents, 335);
  const second = await request("submit", submission);
  assert.deepEqual(second.data, first.data);
  const retries = await Promise.all([
    request("submit", submission),
    request("submit", submission),
  ]);
  assert.deepEqual(retries[0].data, retries[1].data);
  assert.equal(
    (await request("submit", { ...submission, answers: ["B", "B", null, "D"] }))
      .status,
    400,
  );
  const revision = (
    await request("admin/import", {
      ...input,
      revisionOf: imported.id,
      csv: input.csv.replace("1,政治,A", "1,政治,B"),
    })
  ).data;
  assert.equal(revision.versionLabel, "2.0");
  assert.equal(
    (
      await request("admin/status", {
        versionId: revision.id,
        status: "published",
      })
    ).status,
    200,
  );
  const newResult = await request("submit", {
    ...submission,
    versionId: revision.id,
    attemptId: "attempt-2234567890",
  });
  assert.equal(newResult.data.report.totalCents, 200);
  assert.equal(first.data.report.totalCents, 250);
  assert.equal(
    (
      await request("admin/status", {
        versionId: imported.id,
        status: "offline",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("submit", {
        ...submission,
        attemptId: "new-attempt-123456789",
      })
    ).status,
    400,
  );
  assert.deepEqual((await request("submit", submission)).data, first.data);
  const restartApi = await createApi({ dataDirectory });
  const restarted = createServer((req, res) =>
    restartApi(req, res, new URL(req.url, "http://localhost").pathname),
  );
  restarted.listen(0, "127.0.0.1");
  await once(restarted, "listening");
  t.after(() => {
    restarted.closeAllConnections();
    restarted.close();
  });
  const restoredCatalog = await (
    await fetch(`http://127.0.0.1:${restarted.address().port}/api/catalog`)
  ).json();
  assert.equal(
    restoredCatalog.versions.find((v) => v.id === imported.id).status,
    "offline",
  );
  assert.equal(
    restoredCatalog.versions.find((v) => v.id === revision.id).status,
    "published",
  );
  assert.ok((await request("admin")).data.audit.length >= 5);
  assert.equal(
    (
      await request("attempts/delete", {
        guestId: submission.guestId,
        attemptIds: [submission.attemptId],
      })
    ).status,
    200,
  );
});

test("a failed disk write rolls back imported drafts and audit records before allowing a retry", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-write-failure-"));
  const api = await createApi({
    dataDirectory: pathToFileURL(directory + "/"),
  });
  await mkdir(join(directory, "catalog.tmp"));
  const server = createServer((req, res) =>
    api(req, res, new URL(req.url, "http://localhost").pathname),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    server.close();
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const input = {
    title: "写入失败测试",
    institution: "测试",
    project: "测试",
    period: "一期",
    variant: "通用",
    csv: "题号,题型,答案,分值\n1,言语,A,0.8",
  };
  const send = () =>
    fetch(base + "admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  assert.equal((await send()).status, 400);
  const afterFailure = await (await fetch(base + "admin")).json();
  assert.equal(afterFailure.versions.length, baselineCount);
  assert.equal(afterFailure.audit.length, 0);
  await rm(join(directory, "catalog.tmp"), { recursive: true });
  assert.equal((await send()).status, 200);
  const afterRetry = await (await fetch(base + "admin")).json();
  assert.equal(afterRetry.versions.length, baselineCount + 1);
  assert.equal(afterRetry.audit.length, 1);
});
