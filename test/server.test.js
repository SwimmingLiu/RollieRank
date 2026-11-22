import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("local preview serves the app and excludes source PDFs and repository files", async (t) => {
  // 启动服务会补入新增目录；测试必须使用独立数据目录，避免写入用户已有套卷与提交。
  const dataDirectory = await mkdtemp(join(tmpdir(), "rollierank-assets-"));
  t.after(() => rm(dataDirectory, { recursive: true, force: true }));
  const server = spawn(process.execPath, ["scripts/serve.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, PORT: "4174", ROLLIERANK_DATA_DIR: dataDirectory },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => server.kill());
  await once(server.stdout, "data", { signal: AbortSignal.timeout(5000) });
  // 原测试允许下载整套参考答案；现需验证提交前隔离答案，公开元数据改走 catalog API。
  for (const [path, type] of [
    ["/", "text/html"],
    ["/styles.css", "text/css"],
    ["/src/app.js", "text/javascript"],
    ["/api/catalog", "application/json"],
    ["/favicon.svg", "image/svg+xml"],
  ]) {
    const response = await fetch("http://127.0.0.1:4174" + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get("content-type").includes(type), path);
    assert.ok((await response.text()).length > 0, path);
  }
  for (const path of [
    "/.git/config",
    "/.raw/test.pdf",
    "/package.json",
    "/src/%2e%2e/package.json",
    "/src/data/papers.js",
    // 新生成的题库同样含参考答案，不能通过静态资源端点下载。
    "/src/data/imported-papers.js",
    "/src//data/papers.js",
    "/src/DATA/papers.js",
    "/src/data%2fpapers.js",
    "/server/api.mjs",
    "/.local/catalog.json",
  ]) {
    assert.equal(
      (await fetch("http://127.0.0.1:4174" + path)).status,
      404,
      path,
    );
  }
});
