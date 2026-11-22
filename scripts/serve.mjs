import { createServer } from "node:http";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createApi } from "../server/api.mjs";
import { resolveAdminBasePath } from "../server/admin-console.mjs";

// URL directories end in a slash; normalize before checking containment so valid assets pass.
const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
// 原服务只能提供静态答案文件；原型改由 API 评分，并隔离答案与本机运行数据。
const assetRoot = process.argv.includes("--dist")
  ? path.join(root, "dist")
  : root;
// 用户使用的 iOS 预览原来由纯静态服务提供；同一端口同时承载原界面和真实 API。
const iosRoot = path.join(root, "docs/ui-exploration/ios-v3");
// 只有显式启动的隔离实例才提供联调标识。线上和日常开发仍用原来的启动方式。
const testEnvironment = process.argv.includes("--test-environment");
const testSocket = testEnvironment && process.argv.includes("--systemd-socket");
const port = Number(process.env.PORT || 4173);
let dataPath = testSocket ? process.env.STATE_DIRECTORY : process.env.ROLLIERANK_DATA_DIR;
if (testSocket && (process.env.LISTEN_PID !== String(process.pid) || process.env.LISTEN_FDS !== "1")) {
  throw new Error("测试服务需要 systemd 提供一个监听套接字。");
}
if (testEnvironment) {
  if (!dataPath || (!testSocket && (!Number.isInteger(port) || port < 1 || port > 65535 || port === 4173))) {
    throw new Error("测试服务需要独立的数据目录和端口。");
  }
  // systemd 为 DynamicUser 创建的状态目录可能是指向 /var/lib/private 的链接。
  dataPath = await realpath(dataPath);
  const reserved = [path.join(root, ".local"), "/var/lib/rollierank", "/var/lib/private/rollierank"];
  if (reserved.some(directory => dataPath === directory || dataPath.startsWith(directory + path.sep))) {
    throw new Error("测试服务需要独立的数据目录。");
  }
}
const dataDirectory = dataPath
  ? pathToFileURL(path.resolve(dataPath) + path.sep)
  : new URL("../.local/", import.meta.url);
// Excel 是可选的本机解析能力；优先复用已安装的项目环境，避免 UI 上传时误用缺依赖的系统 Python。
if (!process.env.POSITIONS_PYTHON) {
  const python = path.join(root, ".local/positions-python/bin/python");
  try {
    await access(python, constants.X_OK);
    process.env.POSITIONS_PYTHON = python;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const api = await createApi({ dataDirectory, toolCreditOptions: { testEnvironment } });
const adminBasePath = resolveAdminBasePath();
const adminPrefix = `${adminBasePath}/`;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".woff2": "font/woff2",
  ".woff": "font/woff", ".mjs": "text/javascript; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".license": "text/plain; charset=utf-8",
  ".ttf": "font/ttf", ".otf": "font/otf", ".ico": "image/x-icon",
};
const allowed = new Set(["/index.html", "/styles.css", "/favicon.svg"]);
const allowedAdminAssets = new Set(["/", "/index.html", "/app.js", "/app.css"]);

const server = createServer(async (request, response) => {
  if (testEnvironment) response.setHeader("X-RollieRank-Environment", "test");
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (await api(request, response, pathname)) return;
    // 重复斜线与大小写不能绕过 macOS 上的答案目录隔离。
    if (pathname === adminBasePath) {
      response.writeHead(302, { Location: adminPrefix }).end();
      return;
    }
    const resource = path.posix.normalize(
      pathname === "/" ? "/index.html" : pathname,
    );
    const ios = resource.startsWith("/ios-v3/");
    const adminPortal = resource.startsWith(adminPrefix);
    if (
      (request.method !== "GET" && request.method !== "HEAD") ||
      resource.toLowerCase().startsWith("/src/data/") ||
      (!ios && !adminPortal && !allowed.has(resource) && !resource.startsWith("/src/")) ||
      (ios && (resource.toLowerCase().includes("/node_modules/") || !types[path.extname(resource).toLowerCase()] && !resource.endsWith("/"))) ||
      (adminPortal && !allowedAdminAssets.has(resource.slice(adminBasePath.length))) ||
      resource.split("/").some((part) => part.startsWith("."))
    ) {
      response.writeHead(404).end("Not found");
      return;
    }
    const selectedRoot = ios ? iosRoot : adminPortal ? path.join(assetRoot, "admin") : assetRoot;
    const relative = ios
      ? resource.slice("/ios-v3".length)
      : adminPortal
        ? resource.slice(adminBasePath.length)
        : resource;
    const target = path.resolve(selectedRoot, "." + (relative.endsWith("/") ? relative + "index.html" : relative));
    if (
      !target.startsWith(selectedRoot + path.sep) ||
      !(await stat(target)).isFile()
    ) {
      response.writeHead(404).end("Not found");
      return;
    }
    const body = await readFile(target);
    response.writeHead(200, {
      "Content-Type": types[path.extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(adminPortal ? {
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      } : {}),
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
// 测试进程使用 systemd 从宿主网络传入的监听套接字，自身留在私有网络中。
const listener = testSocket ? { fd: 3 } : { port, host: "127.0.0.1" };
server.listen(listener, () => {
  const address = testSocket ? "systemd test socket" : `http://127.0.0.1:${port}`;
  console.log(`RollieRank is ready: ${address}`);
});
