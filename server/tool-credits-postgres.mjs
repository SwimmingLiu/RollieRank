import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const migrationDirectory = new URL("migrations/wallet/", import.meta.url);
const schemaPattern = /^[a-z_][a-z0-9_]{0,62}$/;
const { Pool, types } = pg;

function int8(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError("卷豆账本数值超出安全整数范围。");
  return number;
}

export function createWalletDatabase({ env = process.env, testEnvironment = false, migration = false } = {}) {
  const liveSchema = env.DATABASE_SCHEMA?.trim() || "public";
  const schema = testEnvironment ? env.TEST_DATABASE_SCHEMA?.trim() || "rollierank_test" : liveSchema;
  const runtimeUrl = (testEnvironment ? env.TEST_DATABASE_URL : env.DATABASE_URL)?.trim();
  const migrationUrl = (testEnvironment ? env.TEST_MIGRATION_DATABASE_URL : env.MIGRATION_DATABASE_URL)?.trim();
  const connectionString = (migration && migrationUrl) || runtimeUrl;
  if (!connectionString) return null;
  if (!schemaPattern.test(schema) || (testEnvironment && (schema === "public" || schema === liveSchema))) {
    throw new Error("卷豆 PostgreSQL schema 无效，测试服务需要独立的测试 schema。");
  }
  if (!/^postgres(?:ql)?:\/\//.test(connectionString)) throw new Error("卷豆 PostgreSQL 连接 URL 格式无效。");

  const pool = new Pool({
    connectionString, max: 10, connectionTimeoutMillis: 5000, allowExitOnIdle: true,
    application_name: "rollierank-wallet",
    types: {
      getTypeParser: (oid, format) => oid === 20 && format !== "binary" ? int8 : types.getTypeParser(oid, format),
    },
  });
  pool.on("error", () => process.stderr.write("卷豆 PostgreSQL 空闲连接已断开。\n"));

  async function transaction(operation, { readOnly = false } = {}) {
    const client = await pool.connect();
    let discard;
    try {
      // 获取账户锁后必须读到已提交的占用，即使数据库角色默认使用其他隔离级别。
      await client.query(readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch (rollbackError) { discard = rollbackError; }
      throw error;
    } finally {
      client.release(discard);
    }
  }

  return { schema, transaction, close: () => pool.end() };
}

export function postgresTransactionLock(client, key) {
  return client.query("SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 0))", [key]);
}

export async function migrateWalletDatabase(database) {
  const migrations = await Promise.all(
    (await readdir(migrationDirectory)).filter(name => /^\d+_.*\.sql$/.test(name)).sort().map(async name => {
      const body = await readFile(new URL(name, migrationDirectory), "utf8");
      return { name: "wallet/" + name, body, checksum: createHash("sha256").update(body).digest("hex") };
    }),
  );
  return database.transaction(async (client) => {
    // 沿用 Go 后端的迁移锁及校验方式，独立记录避免影响 Go 的就绪判断。
    await postgresTransactionLock(client, "rollierank:migrations");
    const namespace = await client.query("SELECT pg_catalog.to_regnamespace($1) AS schema", [database.schema]);
    if (!namespace.rows[0].schema) await client.query(`CREATE SCHEMA "${database.schema}"`);
    await client.query(`CREATE TABLE IF NOT EXISTS wallet_schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    )`);
    const applied = [];
    for (const migration of migrations) {
      const { rows: [existing] } = await client.query("SELECT checksum FROM wallet_schema_migrations WHERE name = $1", [migration.name]);
      if (existing) {
        if (existing.checksum !== migration.checksum) throw new Error(`已执行的迁移 ${migration.name} 被修改。`);
        continue;
      }
      await client.query(migration.body);
      await client.query("INSERT INTO wallet_schema_migrations (name, checksum) VALUES ($1, $2)", [migration.name, migration.checksum]);
      applied.push(migration.name);
    }
    return applied;
  });
}
