import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createWalletDatabase } from "../server/tool-credits-postgres.mjs";

const PRODUCTION_CATALOG = "/var/lib/rollierank/catalog.json";
const KNOWN_FEATURES = new Set(["positions", "discussions", "wechatProfiles", "corrections", "feedback", "users", "points", "adminAuth", "toolCreditInviteSubmissions"]);

export function firstReleaseWalletCounts(database) {
  return database.transaction(async (client) => {
    const { rows: [counts] } = await client.query(`SELECT
      (SELECT COUNT(*) FROM wallet_accounts) AS "walletAccounts",
      (SELECT COUNT(*) FROM wallet_ledger WHERE account_id IS NOT NULL) AS "walletEntries",
      (SELECT COUNT(*) FROM wallet_tool_operations) AS "walletOperations",
      (SELECT COUNT(*) FROM wallet_wechat_orders) AS "walletPaymentOrders",
      (SELECT COUNT(*) FROM wallet_wechat_refunds) AS "walletPaymentRefunds",
      (SELECT COUNT(*) FROM wallet_invite_visits) AS "walletInvites"`);
    return counts;
  }, { readOnly: true });
}

function countMap(value, label) {
  if (value === undefined) return 0;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} 必须是对象。`);
  return Object.keys(value).length;
}

function countList(value, label) {
  if (value === undefined) return 0;
  if (!Array.isArray(value)) throw new Error(`${label} 必须是数组。`);
  return value.length;
}

export function firstReleaseCounts(catalog) {
  if (!Array.isArray(catalog?.versions) || !catalog.versions.length || !catalog.receipts || !catalog.features) {
    throw new Error("找不到完整的生产套卷与存储结构。");
  }
  const { features } = catalog;
  countMap(features, "features");
  const unknown = Object.keys(features).filter(key => !KNOWN_FEATURES.has(key));
  if (unknown.length) throw new Error(`生产库包含尚未核对的功能数据：${unknown.join("、")}。`);
  return {
    attempts: countMap(catalog.receipts, "receipts"),
    positionMembers: countMap(features.positions?.members, "positions.members"),
    comments: countList(features.discussions?.comments, "discussions.comments"),
    wechatProfiles: countMap(features.wechatProfiles, "wechatProfiles"),
    answerFeedback: countList(features.corrections?.feedbacks, "corrections.feedbacks"),
    answerReviews: countList(features.corrections?.reviews, "corrections.reviews"),
    answerRevisions: countList(features.corrections?.revisions, "corrections.revisions"),
    userFeedback: countList(features.feedback?.items, "feedback.items"),
    memberStates: countMap(features.users, "users"),
    pointBalances: countMap(features.points?.balances, "points.balances"),
    pointEntries: countList(features.points?.ledger, "points.ledger"),
    walletInviteEvents: countMap(features.toolCreditInviteSubmissions, "toolCreditInviteSubmissions"),
  };
}

const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
  let database;
  try {
    database = createWalletDatabase();
    if (!database) throw new Error("缺少生产 PostgreSQL DATABASE_URL。");
    const counts = {
      ...firstReleaseCounts(JSON.parse(readFileSync(PRODUCTION_CATALOG, "utf8"))),
      ...await firstReleaseWalletCounts(database),
    };
    const ready = Object.values(counts).every(count => count === 0);
    console.log(JSON.stringify({ ready, counts }, null, 2));
    process.exitCode = ready ? 0 : 1;
  } catch (error) {
    console.error(error.code ? `首次上线检查失败（${error.code}）。` : error.message);
    process.exitCode = 2;
  } finally {
    await database?.close();
  }
}
