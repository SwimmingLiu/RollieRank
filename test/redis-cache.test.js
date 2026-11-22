import { test } from "node:test";
import assert from "node:assert/strict";
import { createRedisCache } from "../server/redis-cache.mjs";

test("未配置连接串时降级为内存缓存", async () => {
  const cache = await createRedisCache({ url: "", logger: { warn() {} } });
  assert.equal(cache.mode, "memory");
  await cache.set("k", "v", 60);
  assert.equal(await cache.get("k"), "v");
  await cache.delete("k");
  assert.equal(await cache.get("k"), null);
});

test("连接失败时降级而不是抛错", async () => {
  const cache = await createRedisCache({ url: "redis://127.0.0.1:6390", logger: { warn() {} } });
  assert.equal(cache.mode, "memory");
  await cache.set("k", "v", 60);
  assert.equal(await cache.get("k"), "v");
});

test("内存缓存会按 TTL 过期", async () => {
  const cache = await createRedisCache({ url: "", logger: { warn() {} } });
  await cache.set("short", "v", 1);
  assert.equal(await cache.get("short"), "v");
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(await cache.get("short"), null);
});
