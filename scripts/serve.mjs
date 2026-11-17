import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createApi } from "../server/api.mjs";

// URL directories end in a slash; normalize before checking containment so valid assets pass.
const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
// 原服务只能提供静态答案文件；原型改由 API 评分，并隔离答案与本机运行数据。
const assetRoot = process.argv.includes("--dist")
  ? path.join(root, "dist")
  : root;
// 用户使用的 iOS 预览原来由纯静态服务提供；同一端口同时承载原界面和真实 API。
const iosRoot = path.join(root, "docs/ui-exploration/ios-v3");
const dataDirectory = process.env.ROLLIERANK_DATA_DIR
  ? pathToFileURL(path.resolve(process.env.ROLLIERANK_DATA_DIR) + path.sep)
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
const api = await createApi({ dataDirectory });
const port = Number(process.env.PORT || 4173);
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

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (await api(request, response, pathname)) return;
    // 重复斜线与大小写不能绕过 macOS 上的答案目录隔离。
    const resource = path.posix.normalize(
      pathname === "/" ? "/index.html" : pathname,
    );
    const ios = resource.startsWith("/ios-v3/");
    if (
      (request.method !== "GET" && request.method !== "HEAD") ||
      resource.toLowerCase().startsWith("/src/data/") ||
      (!ios && !allowed.has(resource) && !resource.startsWith("/src/")) ||
      (ios && (resource.toLowerCase().includes("/node_modules/") || !types[path.extname(resource).toLowerCase()] && !resource.endsWith("/"))) ||
      resource.split("/").some((part) => part.startsWith("."))
    ) {
      response.writeHead(404).end("Not found");
      return;
    }
    const selectedRoot = ios ? iosRoot : assetRoot;
    const relative = ios ? resource.slice("/ios-v3".length) : resource;
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
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`RollieRank is ready: http://127.0.0.1:${port}`),
);
