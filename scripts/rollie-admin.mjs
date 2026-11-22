#!/usr/bin/env node
/**
 * RollieRank 运营管理 CLI（供维护者与 AI Agent 调用）。
 * 默认直连本地数据目录（.local/），传入 --url 可操作远程线上服务。
 */
import { createServer } from "node:http";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
import { resolveAdminBasePath } from "../server/admin-console.mjs";

const USAGE = `RollieRank 运营管理 CLI

用法:
  npm run admin -- <模块> <动作> [参数] [全局选项]

全局选项:
  --json                 输出原始 JSON（推荐给 AI 解析）
  --data-dir <dir>       本地数据目录（默认 .local/ 或 ROLLIERANK_DATA_DIR）
  --url <baseUrl>        连接远程服务（如 https://rollie-rank.swimmingliu.cn）
  --token <token>        远程登录令牌（也可用环境变量 ROLLIERANK_CONSOLE_TOKEN）

模块与命令:
  auth status
  auth setup --username <name> --password <pass>
  auth reset-password --password <pass> [--username <name>]    (仅本地模式)
  auth login --url <baseUrl> --username <name> --password <pass>

  overview

  comments list [--status queue|all|approved|rejected] [--q <kw>]
  comments approve <id...> [--reason <text>] [--reward <n>]
  comments reject <id...> [--reason <text>] [--mute]
  comments delete <id...> [--reason <text>]
  comments settings [--mode auto|manual] [--keywords <k1,k2>]

  users list [--status all|active|muted|with-points] [--q <kw>]
  users show <userId>
  users mute <userId> [--reason <text>]
  users unmute <userId>

  points list [--type all|reward|activity|correction|comment|deduct|manual] [--q <kw>]
  points grant --users <id1,id2|all> --delta <n> --reason <text> [--type reward|activity|correction|comment|deduct|manual]
  points rules [--submit <n>] [--correction <n>] [--comment <n>]

  corrections list
  corrections review <feedbackId> --questions <1,2> --decision <approve|reject> --reason <text> [--reward <n>]

  feedback list [--status all|pending|processing|replied|closed] [--q <kw>]
  feedback reply <feedbackId> --text <reply> [--status replied|processing|closed]
  feedback status <feedbackId> --status <pending|processing|replied|closed>
  feedback notify-status
  feedback notify-config [--enabled true|false] [--template-id <id>] [--state formal|trial|developer]

  audit list [--q <kw>]
`;

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq > 0) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (["json", "mute", "help"].includes(key) || next === undefined || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { positionals, flags };
}

function fail(msg) {
  console.error(`错误: ${msg}`);
  process.exit(1);
}

function resolveDataDir(flags) {
  const raw = flags["data-dir"] || process.env.ROLLIERANK_DATA_DIR || ".local";
  return path.resolve(process.cwd(), String(raw));
}

async function localResetPassword(dir, username, password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    fail("密码长度须为 8–128 位。");
  }
  const file = path.join(dir, "catalog.json");
  let saved = { versions: [], audit: [], receipts: {}, features: {} };
  try {
    saved = JSON.parse(await readFile(file, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const finalUser = (username || saved.features?.adminAuth?.username || "admin").trim();
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const now = Date.now();
  saved.features ??= {};
  saved.features.adminAuth = {
    username: finalUser,
    passwordHash: hash,
    salt,
    createdAt: saved.features.adminAuth?.createdAt ?? now,
    updatedAt: now,
  };
  saved.audit ??= [];
  saved.audit.unshift({
    id: randomBytes(16).toString("hex"),
    action: "CLI 重置管理员密码",
    target: `账号 ${finalUser}`,
    operator: "cli",
    createdAt: now,
  });
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, "catalog.tmp");
  await writeFile(tmp, JSON.stringify(saved), { mode: 0o600 });
  await rename(tmp, file);
  return { ok: true, username: finalUser, dataDir: dir };
}

async function createClient(flags) {
  const remoteUrl = flags.url ? String(flags.url).replace(/\/+$/, "") : "";
  if (remoteUrl) {
    const token = String(flags.token || process.env.ROLLIERANK_CONSOLE_TOKEN || "").trim();
    const parsedUrl = new URL(remoteUrl);
    const hasCustomPath = parsedUrl.pathname && parsedUrl.pathname !== "/";
    const apiBase = hasCustomPath ? `${remoteUrl}/api` : `${remoteUrl}/api/console`;
    return {
      mode: "remote",
      async call(sub, body) {
        const res = await fetch(`${apiBase}/${sub}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
      },
      async close() {},
    };
  }

  // 本地直连模式：进程内启动仅本次命令存续的 loopback API 实例（不触碰已存密码哈希），100% 复用服务端逻辑与事务。
  const dir = resolveDataDir(flags);
  const dataDirectory = pathToFileURL(dir + path.sep);
  const api = await createApi({ dataDirectory, localCliBypass: true });
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (await api(req, res, pathname)) return;
    res.writeHead(404).end(JSON.stringify({ error: "Not found" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminBasePath = resolveAdminBasePath();

  return {
    mode: "local",
    dir,
    async call(sub, body) {
      const res = await fetch(`${baseUrl}${adminBasePath}/api/${sub}`, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function output(data, asJson, formatter) {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (formatter) formatter(data);
  else console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  if (flags.help || !positionals.length) {
    console.log(USAGE);
    process.exit(0);
  }
  const [group, sub, ...rest] = positionals;
  const asJson = Boolean(flags.json);

  // auth reset-password 仅支持本地直连
  if (group === "auth" && sub === "reset-password") {
    if (flags.url) fail("reset-password 仅支持本地数据目录模式。");
    const result = await localResetPassword(resolveDataDir(flags), flags.username, flags.password);
    output(result, asJson, (r) => console.log(`已重置管理员 ${r.username} 的密码（${r.dataDir}）。`));
    return;
  }

  const client = await createClient(flags);
  try {
    if (group === "auth") {
      if (sub === "status") {
        const res = await client.call("session", undefined, { skipAuth: true });
        output(res, asJson, (r) => console.log(`已初始化: ${!r.needsSetup} | 微信安全: ${r.wechatSecEnabled ? "已开启" : "未配置"}`));
      } else if (sub === "setup") {
        if (!flags.username || !flags.password) fail("需要 --username 与 --password。");
        const res = await client.call("setup", { username: flags.username, password: flags.password, confirmPassword: flags.password }, { skipAuth: true });
        output(res, asJson, (r) => console.log(`管理员 ${r.user.username} 初始化完成。`));
      } else if (sub === "login") {
        if (!flags.username || !flags.password) fail("需要 --username 与 --password。");
        const res = await client.call("login", { username: flags.username, password: flags.password }, { skipAuth: true });
        output(res, asJson, (r) => console.log(`登录成功，Token:\n${r.token}`));
      } else {
        fail(`未知 auth 命令: ${sub}`);
      }
      return;
    }

    if (group === "overview") {
      const res = await client.call("overview");
      output(res, asJson, (r) => {
        const m = r.metrics;
        console.log(`用户 ${m.totalUsers}（禁言 ${m.mutedUsers}） | 交卷 ${m.totalAttempts}（今日 ${m.todayAttempts}） | 待审评论 ${m.pendingComments}/${m.totalComments} | 流通积分 ${m.totalPointsBalance} | 待审纠错 ${m.pendingCorrections}`);
      });
      return;
    }

    if (group === "comments") {
      if (sub === "list") {
        const qs = new URLSearchParams({
          status: String(flags.status || "queue"),
          q: String(flags.q || ""),
          pageSize: String(flags.limit || "50"),
        });
        const res = await client.call(`comments?${qs}`);
        output(res, asJson, (r) => {
          console.log(`共 ${r.total} 条（待复核 ${r.summary.queue} / 已公开 ${r.summary.approved} / 已屏蔽 ${r.summary.rejected}）`);
          for (const c of r.comments) {
            console.log(`- [${c.moderation.status}] ${c.id} | ${c.author.name} (${c.paperTitle}): ${(c.text || "(仅附件)").replace(/\n/g, " ").slice(0, 60)}`);
          }
        });
      } else if (["approve", "reject", "delete"].includes(sub)) {
        if (!rest.length) fail(`请提供至少一个评论 ID: comments ${sub} <id...>`);
        const body = {
          commentIds: rest,
          action: sub,
          ...(flags.reason ? { reason: String(flags.reason) } : {}),
          ...(flags.reward ? { rewardPoints: Number(flags.reward) } : {}),
          ...(flags.mute ? { muteAuthor: true } : {}),
        };
        const res = await client.call("comments/review", body);
        output(res, asJson, (r) => console.log(`已处理 ${r.processed} 条评论（${sub}）。`));
      } else if (sub === "settings") {
        const body = {
          ...(flags.mode ? { mode: String(flags.mode) } : {}),
          ...(flags.keywords !== undefined ? { blockedKeywords: String(flags.keywords) } : {}),
        };
        const res = await client.call("comments/settings", body);
        output(res, asJson, (r) => console.log(`模式: ${r.settings.mode} | 敏感词数: ${r.settings.blockedKeywords.length}`));
      } else {
        fail(`未知 comments 命令: ${sub}`);
      }
      return;
    }

    if (group === "users") {
      if (sub === "list") {
        const qs = new URLSearchParams({
          status: String(flags.status || "all"),
          q: String(flags.q || ""),
          pageSize: String(flags.limit || "50"),
        });
        const res = await client.call(`users?${qs}`);
        output(res, asJson, (r) => {
          console.log(`共 ${r.total} 位用户（禁言 ${r.summary.muted}，总积分 ${r.summary.totalPoints}）`);
          for (const u of r.users) {
            console.log(`- ${u.userId} | ${u.nickname} | 交卷 ${u.attemptCount} | 积分 ${u.pointsBalance} | ${u.muted ? "已禁言" : "正常"}`);
          }
        });
      } else if (sub === "show") {
        const uid = rest[0];
        if (!uid) fail("请提供 userId: users show <userId>");
        const res = await client.call(`users/detail?userId=${encodeURIComponent(uid)}`);
        output(res, asJson, (r) => {
          console.log(`${r.user.nickname} (${r.user.userId}) | 积分 ${r.user.pointsBalance} | 交卷 ${r.user.attemptCount} | ${r.user.muted ? "已禁言" : "正常"}`);
        });
      } else if (sub === "mute" || sub === "unmute") {
        const uid = rest[0];
        if (!uid) fail(`请提供 userId: users ${sub} <userId>`);
        const res = await client.call("users/mute", {
          userId: uid,
          muted: sub === "mute",
          reason: String(flags.reason || ""),
        });
        output(res, asJson, () => console.log(sub === "mute" ? `已禁言 ${uid}` : `已解除 ${uid} 的禁言`));
      } else {
        fail(`未知 users 命令: ${sub}`);
      }
      return;
    }

    if (group === "points") {
      if (sub === "list") {
        const qs = new URLSearchParams({
          type: String(flags.type || "all"),
          q: String(flags.q || ""),
          pageSize: String(flags.limit || "50"),
        });
        const res = await client.call(`points?${qs}`);
        output(res, asJson, (r) => {
          console.log(`总余额 ${r.summary.totalBalance} | 累计发放 +${r.summary.totalIssued} | 累计扣减 -${r.summary.totalDeducted}`);
          for (const l of r.ledger) {
            console.log(`- ${l.nickname} (${l.userId}): ${l.delta >= 0 ? "+" : ""}${l.delta} -> 余额 ${l.balanceAfter} | ${l.reason}`);
          }
        });
      } else if (sub === "grant") {
        if (!flags.users || !flags.delta || !flags.reason) {
          fail("需要 --users <id1,id2|all> --delta <整数> --reason <原因>");
        }
        let userIds = [];
        if (String(flags.users).toLowerCase() === "all") {
          const all = await client.call("users?page=1&pageSize=200");
          userIds = all.users.map((u) => u.userId);
        } else {
          userIds = String(flags.users).split(",").map((s) => s.trim()).filter(Boolean);
        }
        if (!userIds.length) fail("未匹配到任何目标用户。");
        const delta = Number(flags.delta);
        const res = await client.call("points/grant", {
          userIds,
          delta,
          type: String(flags.type || (delta > 0 ? "reward" : "deduct")),
          reason: String(flags.reason),
        });
        output(res, asJson, (r) => console.log(`已为 ${r.count} 位用户${delta > 0 ? `发放 +${delta}` : `扣减 ${delta}`} 积分。`));
      } else if (sub === "rules") {
        const current = await client.call("points?page=1&pageSize=1");
        const body = {
          submitAttempt: flags.submit !== undefined ? Number(flags.submit) : current.rules.submitAttempt,
          approvedCorrection: flags.correction !== undefined ? Number(flags.correction) : current.rules.approvedCorrection,
          featuredComment: flags.comment !== undefined ? Number(flags.comment) : current.rules.featuredComment,
        };
        const res = await client.call("points/rules", body);
        output(res, asJson, (r) => console.log(`规则已更新：交卷 +${r.rules.submitAttempt} / 纠错 +${r.rules.approvedCorrection} / 评论 +${r.rules.featuredComment}`));
      } else {
        fail(`未知 points 命令: ${sub}`);
      }
      return;
    }

    if (group === "corrections") {
      if (sub === "list") {
        const res = await client.call("corrections");
        output(res, asJson, (r) => {
          console.log(`共 ${r.feedbacks.length} 件反馈（待审核 ${r.pendingCount} 件）`);
          for (const fb of r.feedbacks) {
            console.log(`- [${fb.status}] ${fb.id} | ${fb.paperTitle} | 影响 ${fb.affectedAttempts} 份`);
          }
        });
      } else if (sub === "review") {
        const feedbackId = rest[0];
        if (!feedbackId || !flags.questions || !flags.decision || !flags.reason) {
          fail("用法: corrections review <feedbackId> --questions <1,2> --decision <approve|reject> --reason <理由> [--reward <积分>]");
        }
        const questionNumbers = String(flags.questions).split(",").map((n) => Number(n.trim()));
        const res = await client.call("corrections/review", {
          feedbackId,
          questionNumbers,
          decision: String(flags.decision),
          reason: String(flags.reason),
          rewardPoints: flags.reward ? Number(flags.reward) : 0,
        });
        output(res, asJson, (r) => console.log(`处理完成（重算 ${r.recalculated} 份答卷，当前修订 ${r.toRevision}）。`));
      } else {
        fail(`未知 corrections 命令: ${sub}`);
      }
      return;
    }

    if (group === "feedback") {
      if (sub === "list") {
        const qs = new URLSearchParams({
          status: String(flags.status || "all"),
          q: String(flags.q || ""),
        });
        const res = await client.call(`feedback?${qs}`);
        output(res, asJson, (r) => {
          console.log(`共 ${r.summary.total} 条用户反馈（待处理 ${r.summary.pending} / 处理中 ${r.summary.processing} / 已回复 ${r.summary.replied}）`);
          for (const item of r.items) {
            console.log(`- [${item.statusLabel}] ${item.id} | ${item.categoryLabel} | ${item.nickname}: ${item.content.slice(0, 60)}`);
          }
        });
      } else if (sub === "reply") {
        const feedbackId = rest[0];
        if (!feedbackId || !flags.text) fail("用法: feedback reply <feedbackId> --text <回复内容> [--status replied|processing|closed]");
        const res = await client.call("feedback/update", {
          feedbackId,
          replyText: String(flags.text),
          ...(flags.status ? { status: String(flags.status) } : {}),
        });
        output(res, asJson, (r) => console.log(`已回复反馈 ${r.feedback.id}（状态：${r.feedback.statusLabel}）`));
      } else if (sub === "status") {
        const feedbackId = rest[0];
        if (!feedbackId || !flags.status) fail("用法: feedback status <feedbackId> --status <pending|processing|replied|closed>");
        const res = await client.call("feedback/update", { feedbackId, status: String(flags.status) });
        output(res, asJson, (r) => console.log(`已更新状态：${r.feedback.id} -> ${r.feedback.statusLabel}`));
      } else if (sub === "notify-status") {
        const res = await client.call("feedback?page=1&pageSize=1");
        output(res.notify, asJson, (n) => {
          console.log(`微信提醒：${n.enabled ? "已开启" : "已关闭"} | 模板：${n.templateId || "未配置"} | 微信密钥：${n.wechatReady ? "已就绪" : "未配置"}`);
          console.log(`管理员订阅：${n.subscriberCount} 人，合计剩余 ${n.totalQuota} 次`);
          for (const s of n.subscribers) {
            console.log(`- ${s.label} (${s.openidMask}) | 剩余 ${s.quota} 次 | 累计已发 ${s.totalSent} 次${s.lastError ? ` | 最近错误: ${s.lastError}` : ""}`);
          }
        });
      } else if (sub === "notify-config") {
        const body = {};
        if (flags.enabled !== undefined) body.enabled = String(flags.enabled) !== "false" && String(flags.enabled) !== "0";
        if (flags["template-id"] !== undefined) body.templateId = String(flags["template-id"]);
        if (flags.state !== undefined) body.miniprogramState = String(flags.state);
        if (!Object.keys(body).length) fail("请至少传入 --enabled、--template-id 或 --state 之一");
        const res = await client.call("feedback/notify-settings", body);
        output(res, asJson, (r) => console.log(`提醒设置已保存：${r.notify.enabled ? "开启" : "关闭"} · 模板 ${r.notify.templateId || "未配置"}`));
      } else {
        fail(`未知 feedback 命令: ${sub}`);
      }
      return;
    }

    if (group === "audit") {
      const qs = new URLSearchParams({ q: String(flags.q || "") });
      const res = await client.call(`audit?${qs}`);
      output(res, asJson, (r) => {
        for (const item of r.items.slice(0, Number(flags.limit || 30))) {
          console.log(`- [${new Date(item.createdAt).toLocaleString("zh-CN")}] ${item.action} | ${item.target} (${item.operator || "系统"})`);
        }
      });
      return;
    }

    fail(`未知模块: ${group}。使用 --help 查看完整用法。`);
  } finally {
    await client.close();
  }
}

main().catch((err) => fail(err.message));
