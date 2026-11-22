import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createApi } from "../../server/api.mjs";
import { createWalletDatabase, migrateWalletDatabase } from "../../server/tool-credits-postgres.mjs";
import { startWalletPostgres } from "./wallet-postgres.mjs";

export async function createWalletTestServer({
  groupApproved = false, clock, exchange, fetchImpl, verifyInviteVisit, port = 0, postgres, env = {}, moderation,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-wallet-"));
  const dataDirectory = pathToFileURL(directory + sep);
  let local;
  let database;
  let databaseEnv;
  let api;
  try {
    if (postgres !== false) {
      const server = postgres ?? (local = await startWalletPostgres());
      databaseEnv = { TEST_DATABASE_URL: server.url, TEST_DATABASE_SCHEMA: "rollierank_test_" + randomBytes(8).toString("hex") };
      database = createWalletDatabase({ env: databaseEnv, testEnvironment: true });
      await migrateWalletDatabase(database);
    }
    api = await createApi({
      dataDirectory, moderation,
      toolCreditOptions: {
        database, testEnvironment: true,
        env: {
          ...(groupApproved ? { ROLLIERANK_WECHAT_GROUP_INVITE_APPROVED: "1" } : {}),
          ...(fetchImpl ? { ROLLIERANK_WECHAT_APP_ID: "wallet-test-app", ROLLIERANK_WECHAT_APP_SECRET: ["local", "app", "fixture"].join("-") } : {}),
          ...env,
        },
        fetchImpl,
        exchange: fetchImpl ? undefined : exchange ?? (async code => code.startsWith("wallet-test-") ? code.slice("wallet-test-".length) : null),
        clock, verifyInviteVisit,
      },
    });
  } catch (error) {
    await database?.close();
    await local?.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  const server = createServer(async (request, response) => {
    response.setHeader("X-RollieRank-Environment", "test");
    const { pathname } = new URL(request.url, "http://localhost");
    try {
      if (await api(request, response, pathname)) return;
      response.writeHead(404).end("Not found");
    } catch {
      response.writeHead(500).end("Test server error");
    }
  });
  try {
    server.listen(port, "127.0.0.1");
    await once(server, "listening");
  } catch (error) {
    await database?.close();
    await local?.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin, database, databaseEnv,
    async json(path, body, headers = {}) {
      const response = await fetch(new URL(path, origin), {
        method: body === undefined ? "GET" : "POST",
        headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, data, headers: response.headers };
    },
    async close() {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      await database?.close();
      await local?.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const server = await createWalletTestServer({ port: Number(process.argv[2] || 0) });
  console.log(server.origin);
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => { await server.close(); process.exit(0); });
  }
}
