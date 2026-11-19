import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, basename, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const [rawOrigin, output] = process.argv.slice(2);
if (!rawOrigin || !output) throw new Error("用法：npm --prefix mini-program run build:shared -- https://域名 输出目录");
const origin = new URL(rawOrigin);
const local = ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname);
if (!(origin.protocol === "https:" || local && origin.protocol === "http:") || origin.href !== origin.origin + "/") {
  throw new Error("请提供无路径和参数的 HTTPS 域名。本机模拟器可使用本机 HTTP。");
}

// Publishing a web-view package requires the actual app and bridge on the same origin.
const appURL = new URL("/ios-v3/app.html", origin);
const response = await fetch(appURL, { signal: AbortSignal.timeout(10000) });
if (!response.ok || !(await response.text()).includes("paper-cards-1114-v3")) {
  throw new Error("这个域名还没有部署卷卷小榜原稿页面。");
}
const bridge = await fetch(new URL("/api/miniprogram-web/redeem", origin), {
  method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  signal: AbortSignal.timeout(10000),
});
if (bridge.status !== 410) throw new Error("这个域名还没有部署微信小程序连接接口。");

const source = fileURLToPath(new URL("../", import.meta.url));
const target = resolve(process.env.INIT_CWD || process.cwd(), output);
if (target.startsWith(resolve(source) + sep)) throw new Error("输出目录必须在小程序源码目录之外。");
await mkdir(dirname(target), { recursive: true });
await mkdir(target);
await cp(source, target, {
  recursive: true,
  filter: path => !["minitest", "tools", "project.private.config.json", "node_modules", ".claude", ".git"].includes(basename(path)),
});
const config = join(target, "config.js");
const settings = await readFile(config, "utf8");
await writeFile(config, settings.replace(/const API_BASE = ".*";/, "const API_BASE = " + JSON.stringify(origin.origin) + ";")
  .replace('const WEB_APP_ORIGIN = "";', "const WEB_APP_ORIGIN = " + JSON.stringify(origin.origin) + ";"));

const project = join(target, "project.config.json");
const projectConfig = JSON.parse(await readFile(project, "utf8"));
projectConfig.projectname = local ? "RollieRank 原稿验收" : projectConfig.projectname;
projectConfig.setting.urlCheck = !local;
delete projectConfig.testRoot;
await writeFile(project, JSON.stringify(projectConfig, null, 2) + "\n");

console.log(target);
