import { createWalletDatabase, migrateWalletDatabase } from "../server/tool-credits-postgres.mjs";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--test-environment")) {
  console.error("用法：npm run db:migrate:wallet -- [--test-environment]");
  process.exit(2);
}

let database;
try {
  const testEnvironment = args.includes("--test-environment");
  database = createWalletDatabase({ testEnvironment, migration: true });
  if (!database) throw new Error(testEnvironment ? "请配置 TEST_DATABASE_URL。" : "请配置 DATABASE_URL。");
  const applied = await migrateWalletDatabase(database);
  console.log(JSON.stringify({ schema: database.schema, applied }));
} catch (error) {
  // 数据库驱动的诊断有时含连接详情，只输出 SQLSTATE 或应用配置错误。
  console.error(error.code ? `卷豆 PostgreSQL 迁移失败（${error.code}）。` : error.message);
  process.exitCode = 1;
} finally {
  await database?.close();
}
