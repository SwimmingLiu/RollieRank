import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
import { createPositionsService } from "../server/positions.mjs";

export const guestId = "guest-ios-positions-1234";
export const otherGuest = "guest-ios-positions-other";
export async function createFixture(t, fallback) {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-ios-positions-"));
  const dataDirectory = pathToFileURL(directory + "/");
  let api = await createApi({ dataDirectory, featureFactories: [createPositionsService] });
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (await api(request, response, pathname)) return;
    if (fallback) { await fallback(request, response, pathname); return; }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, data) => {
    const response = await fetch(`${origin}/api/${path}`, data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {});
    const body = await response.json();
    if (!response.ok) throw Object.assign(new Error(body.error), { statusCode: response.status });
    return body;
  };
  const imported = await request("admin/import", { title: "iOS 岗位两题验收卷", institution: "四海", project: "2027 行测", period: "一期", variant: "通用",
    csv: "题号,题型,答案,分值\n1,自定义判断,A,1\n2,资料分析,B,1" });
  await request("admin/status", { versionId: imported.id, status: "published" });
  const version = (await request("catalog")).versions.find((v) => v.id === imported.id);
  const positions = (await request("positions/catalog?pageSize=2")).items;
  return { directory, origin, request, version, positions,
    restart: async () => { api = await createApi({ dataDirectory, featureFactories: [createPositionsService] }); },
    async receipt(id = guestId, attemptId = "attempt-ios-positions-111", answers = ["A", "B"]) {
      return request("submit", { guestId: id, versionId: version.id, attemptId, answers, name: id === guestId ? "验收甲" : "卷友" });
    },
  };
}
