// 极简 Redis 客户端：只用 GET / SETEX，避免为两个命令引入整个 npm redis 包。
// 通过 Unix socket 或 TCP 连接；未配置或连接失败时优雅降级为内存缓存。
import { createConnection } from "node:net";

const RESP = {
  simple: "+",
  error: "-",
  integer: ":",
  bulk: "$",
  array: "*",
};

function encode(args) {
  const parts = [`*${args.length}\r\n`];
  for (const arg of args) {
    const text = String(arg);
    parts.push(`$${Buffer.byteLength(text)}\r\n${text}\r\n`);
  }
  return parts.join("");
}

function parse(buffer, offset = 0) {
  const type = String.fromCharCode(buffer[offset]);
  const eol = buffer.indexOf("\r\n", offset);
  if (eol < 0) return null;
  const line = buffer.toString("utf8", offset + 1, eol);
  const next = eol + 2;
  if (type === RESP.simple) return { value: line, next };
  if (type === RESP.error) return { error: new Error(line), next };
  if (type === RESP.integer) return { value: Number(line), next };
  if (type === RESP.bulk) {
    const length = Number(line);
    if (length < 0) return { value: null, next };
    if (buffer.length < next + length + 2) return null;
    return { value: buffer.toString("utf8", next, next + length), next: next + length + 2 };
  }
  if (type === RESP.array) {
    const count = Number(line);
    const items = [];
    let cursor = next;
    for (let i = 0; i < count; i += 1) {
      const item = parse(buffer, cursor);
      if (!item) return null;
      if (item.error) return item;
      items.push(item.value);
      cursor = item.next;
    }
    return { value: items, next: cursor };
  }
  return { error: new Error("无法解析的 Redis 响应"), next: eol + 2 };
}

class Connection {
  constructor(socket) {
    this.socket = socket;
    this.pending = [];
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      for (;;) {
        const result = parse(this.buffer);
        if (!result) break;
        this.buffer = this.buffer.subarray(result.next);
        const job = this.pending.shift();
        if (!job) continue;
        if (result.error) job.reject(result.error);
        else job.resolve(result.value);
      }
    });
    socket.on("error", (error) => this.fail(error));
    socket.on("close", () => this.fail(new Error("Redis 连接已关闭")));
  }

  fail(error) {
    if (this.closed) return;
    this.closed = true;
    for (const job of this.pending.splice(0)) job.reject(error);
  }

  command(args) {
    if (this.closed) return Promise.reject(new Error("Redis 连接已关闭"));
    const socket = this.socket;
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      socket.write(encode(args));
    });
  }

  close() {
    this.closed = true;
    this.socket.destroy();
  }
}

/**
 * 建立可选 Redis 缓存。返回 { get, set, delete, close, mode }。
 * 未配置 REDIS_URL 或连接失败时自动降级到进程内 Map，接口保持一致。
 */
export async function createRedisCache({ url = process.env.ROLLIERANK_REDIS_URL, logger = console } = {}) {
  const memory = new Map();
  const memoryCache = {
    mode: "memory",
    async get(key) {
      const hit = memory.get(key);
      if (!hit) return null;
      if (hit.expiresAt <= Date.now()) {
        memory.delete(key);
        return null;
      }
      return hit.value;
    },
    async set(key, value, ttlSeconds) {
      memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async delete(key) {
      memory.delete(key);
    },
    async close() {},
  };

  if (!url) return memoryCache;

  let connection;
  try {
    const target = new URL(url);
    if (target.protocol !== "redis:") throw new Error("只支持 redis:// 连接串");
    const socket = createConnection({
      host: target.hostname || "127.0.0.1",
      port: Number(target.port || 6379),
      connectTimeout: 3000,
    });
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
      socket.once("timeout", () => reject(new Error("Redis 连接超时")));
    });
    connection = new Connection(socket);
    if (target.password) {
      await connection.command(["AUTH", decodeURIComponent(target.password)]);
    }
    await connection.command(["PING"]);
  } catch (error) {
    logger.warn?.(`Redis 不可用，切换到内存缓存：${error.message}`);
    connection?.close();
    return memoryCache;
  }

  return {
    mode: "redis",
    async get(key) {
      try {
        return await connection.command(["GET", key]);
      } catch {
        return memoryCache.get(key);
      }
    },
    async set(key, value, ttlSeconds) {
      try {
        await connection.command(["SETEX", key, Math.max(1, Math.floor(ttlSeconds)), value]);
      } catch {
        await memoryCache.set(key, value, ttlSeconds);
      }
    },
    async delete(key) {
      try {
        await connection.command(["DEL", key]);
      } catch {
        await memoryCache.delete(key);
      }
    },
    async close() {
      connection.close();
    },
  };
}
