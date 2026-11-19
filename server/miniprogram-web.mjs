import { randomBytes } from "node:crypto";

const TICKET = /^[a-f0-9]{48}$/;
const ID = /^[\w-]{10,80}$/;
const MAX_POSTER_SIZE = 6 * 1024 * 1024;
const PNG = Buffer.from("89504e470d0a1a0a", "hex");

function temporaryStore({ ttl, capacity, maxBytes = Infinity }) {
  const items = new Map();
  let bytes = 0;
  function remove(key) {
    const item = items.get(key);
    if (item) {
      clearTimeout(item.timeout);
      bytes -= item.size;
    }
    items.delete(key);
    return item;
  }
  function purge(now) {
    for (const [key, item] of items) if (item.expires <= now) remove(key);
  }
  return {
    put(value, size = 0) {
      const now = Date.now();
      purge(now);
      while (items.size >= capacity || bytes + size > maxBytes) remove(items.keys().next().value);
      const ticket = randomBytes(24).toString("hex");
      const timeout = setTimeout(() => remove(ticket), ttl);
      timeout.unref();
      items.set(ticket, { value, expires: now + ttl, size, timeout });
      bytes += size;
      return ticket;
    },
    get(ticket, once = false) {
      if (typeof ticket !== "string" || !TICKET.test(ticket)) return null;
      purge(Date.now());
      return (once ? remove(ticket) : items.get(ticket))?.value ?? null;
    },
  };
}

function sessionData(input) {
  if (!input || typeof input.guestId !== "string" || !ID.test(input.guestId)) return null;
  const name = typeof input.name === "string" ? input.name.slice(0, 16) : "";
  const drafts = input.drafts;
  const marks = input.marks;
  if (!Array.isArray(drafts) || drafts.length > 300 || !Array.isArray(marks) || marks.length > 300) return null;
  if (!drafts.every(draft => draft && ID.test(draft.id) && typeof draft.versionId === "string" &&
    draft.versionId.length > 0 && draft.versionId.length <= 200 && Array.isArray(draft.answers) &&
    draft.answers.length > 0 && draft.answers.length <= 300 &&
    draft.answers.every(answer => answer === null || ["", "A", "B", "C", "D"].includes(answer)) &&
    Number.isSafeInteger(draft.current) && Number.isSafeInteger(draft.updatedAt))) return null;
  if (!marks.every(pair => Array.isArray(pair) && pair.length === 2 && ID.test(pair[0]) &&
    Array.isArray(pair[1]) && pair[1].length <= 300 && pair[1].every(n => Number.isInteger(n) && n > 0 && n <= 300))) return null;
  return { guestId: input.guestId, name, drafts, marks };
}

const INSTITUTIONS = new Set(["四海", "超格", "粉笔", "上岸村"]);
const integerBetween = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

function nativeAction(input, posters) {
  if (input.kind === "title" && typeof input.title === "string" && input.title.length <= 40 &&
    !/[\u0000-\u001f]/.test(input.title) && integerBetween(input.revision, 1, Number.MAX_SAFE_INTEGER)) {
    return { kind: "title", title: input.title, revision: input.revision };
  }
  if (input.kind === "poster" && posters.get(input.ticket)) return { kind: "poster", ticket: input.ticket };
  if (input.kind === "invite" && INSTITUTIONS.has(input.institution) &&
    integerBetween(input.period, 1, 999) && integerBetween(input.paper, 1, 300)) {
    return { kind: "invite", institution: input.institution, period: input.period, paper: input.paper };
  }
  return null;
}

function waitForAction(channel, response, send) {
  if (channel.action) {
    const action = channel.action;
    channel.action = null;
    send(200, { action });
    return;
  }
  if (channel.title) {
    const title = channel.title;
    channel.title = null;
    send(200, { action: title });
    return;
  }
  // The native page holds one request while visible. It does not poll at a fixed frequency.
  channel.waiter?.(null);
  const finish = action => {
    clearTimeout(timeout);
    response.off("close", cancel);
    if (channel.waiter === finish) channel.waiter = null;
    if (!response.destroyed) send(200, { action });
  };
  const cancel = () => {
    clearTimeout(timeout);
    if (channel.waiter === finish) channel.waiter = null;
  };
  const timeout = setTimeout(() => finish(null), 20000);
  timeout.unref();
  channel.waiter = finish;
  response.once("close", cancel);
}

export function createMiniprogramWebService() {
  const sessions = temporaryStore({ ttl: 120_000, capacity: 256, maxBytes: 16 * 1024 * 1024 });
  const channels = temporaryStore({ ttl: 12 * 60 * 60_000, capacity: 2048 });
  const posters = temporaryStore({ ttl: 120_000, capacity: 32, maxBytes: 24 * 1024 * 1024 });

  return function handle({ pathname, method, input, query, response, send }) {
    if (!pathname.startsWith("/api/miniprogram-web/")) return false;
    response.setHeader("Cache-Control", "no-store");
    if (method === "POST" && pathname === "/api/miniprogram-web/bootstrap") {
      const data = sessionData(input);
      if (!data) send(400, { error: "本机练习资料格式无效。" });
      else {
        const channel = { action: null, title: null, titleRevision: 0, waiter: null };
        const sender = channels.put({ role: "web", channel });
        const receiver = channels.put({ role: "native", channel });
        const payload = { ...data, sender };
        const bytes = Buffer.byteLength(JSON.stringify(payload));
        send(200, { ticket: sessions.put(payload, bytes), receiver });
      }
    } else if (method === "POST" && pathname === "/api/miniprogram-web/redeem") {
      const data = sessions.get(input?.ticket, true);
      if (!data) send(410, { error: "小程序连接已过期，请重新打开。" });
      else send(200, data);
    } else if (method === "POST" && pathname === "/api/miniprogram-web/action") {
      const connection = channels.get(input?.sender);
      const action = nativeAction(input, posters);
      if (connection?.role !== "web") send(410, { error: "微信连接已过期，请重新打开小程序。" });
      else if (!action) send(400, { error: "微信操作无效，请重试。" });
      else if (action.kind === "title") {
        const channel = connection.channel;
        if (action.revision > channel.titleRevision) {
          channel.titleRevision = action.revision;
          if (channel.waiter) channel.waiter(action);
          else channel.title = action;
        }
        send(200, { queued: true });
      } else if (connection.channel.action) send(409, { error: "微信正在处理上一个操作。" });
      else {
        if (connection.channel.waiter) connection.channel.waiter(action);
        else connection.channel.action = action;
        send(200, { queued: true });
      }
    } else if (method === "POST" && pathname === "/api/miniprogram-web/listen") {
      const connection = channels.get(input?.receiver);
      if (connection?.role !== "native") send(410, { error: "微信连接已过期。" });
      else waitForAction(connection.channel, response, send);
    } else if (method === "POST" && pathname === "/api/miniprogram-web/poster") {
      const data = typeof input?.image === "string" && input.image.length <= Math.ceil(MAX_POSTER_SIZE / 3) * 4
        ? Buffer.from(input.image, "base64") : null;
      if (!data || data.length < 24 || data.length > MAX_POSTER_SIZE ||
        !data.subarray(0, 8).equals(PNG) || data.toString("ascii", 12, 16) !== "IHDR") {
        send(400, { error: "未收到有效的 PNG 海报。" });
      } else {
        send(200, { ticket: posters.put(data, data.length) });
      }
    } else if (method === "GET" && pathname === "/api/miniprogram-web/poster") {
      const data = posters.get(query.get("ticket"), true);
      if (!data) send(404, { error: "海报已过期，请重新生成。" });
      else {
        response.writeHead(200, { "Content-Type": "image/png", "Content-Length": data.length, "X-Content-Type-Options": "nosniff" });
        response.end(data);
      }
    } else {
      send(404, { error: "没有找到这个小程序接口。" });
    }
    return true;
  };
}
