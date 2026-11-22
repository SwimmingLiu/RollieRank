export async function requireTestApi(rawOrigin) {
  const url = URL.canParse(rawOrigin ?? "") ? new URL(rawOrigin) : null;
  const loopback = url && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (!loopback || url.protocol !== "http:" || !url.port || url.href !== `${url.origin}/`) {
    throw new Error("请指定测试接口，例如 http://127.0.0.1:4175。");
  }
  // 回环地址也可能转发到生产或其他服务，先用只读接口确认实例身份。
  const response = await fetch(new URL("/api/catalog", url), {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  await response.body?.cancel();
  if (!response.ok || response.headers.get("X-RollieRank-Environment") !== "test") {
    throw new Error("目标接口未标记为 RollieRank 测试环境，已停止联调。");
  }
  return url.origin;
}
