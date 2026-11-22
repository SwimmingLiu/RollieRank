import { execFile, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const exec = promisify(execFile);
const username = "rollierank_wallet_test";

function tool(name) {
  const dir = process.env.PG_BINDIR || spawnSync("pg_config", ["--bindir"], { encoding: "utf8" }).stdout?.trim();
  const fromConfig = dir && join(dir, name);
  return fromConfig && existsSync(fromConfig) ? fromConfig : name;
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer().once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

export async function startWalletPostgres() {
  const root = await mkdtemp(join(tmpdir(), "rollierank-test-pg-"));
  const data = join(root, "data");
  const log = join(root, "postgres.log");
  const control = tool("pg_ctl");
  const options = { timeout: 60_000 };
  let started = false;
  try {
    // This disposable cluster only needs to survive the test process.
    await exec(tool("initdb"), ["-D", data, "-U", username, "-A", "trust", "--no-locale", "--no-sync", "-E", "UTF8"], options);
    const port = await availablePort();
    await exec(control, ["-D", data, "-l", log, "-w", "-t", "10", "-o",
      `-h 127.0.0.1 -p ${port} -k '' -c shared_buffers=16MB -c 'default_transaction_isolation=repeatable read'`, "start"], options);
    started = true;
    return {
      url: `postgresql://${username}@127.0.0.1:${port}/postgres?sslmode=disable`,
      async close() {
        await exec(control, ["-D", data, "-m", "fast", "-w", "-t", "10", "stop"], options);
        await rm(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (started || existsSync(join(data, "postmaster.pid"))) {
      await exec(control, ["-D", data, "-m", "fast", "-w", "-t", "10", "stop"], options).catch(() => {});
    }
    throw new Error(`无法启动隔离 PostgreSQL。检查 PostgreSQL 工具和 ${root} 的启动日志。`, { cause: error });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const ready = ["initdb", "pg_ctl", "postgres"].every(name => spawnSync(tool(name), ["--version"]).status === 0);
  process.exitCode = ready ? 0 : 1;
}
