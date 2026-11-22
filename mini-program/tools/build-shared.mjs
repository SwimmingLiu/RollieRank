import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, basename, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { requireTestApi } from "./test-api.mjs";

const { PRODUCTION_API_BASE } = createRequire(import.meta.url)("../config.js");

const [rawOrigin, output] = process.argv.slice(2);
if (!rawOrigin || !output) throw new Error("用法：npm --prefix mini-program run build:shared -- https://域名 输出目录");
const origin = new URL(rawOrigin);
const local = ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname);
if (!(origin.protocol === "https:" || local && origin.protocol === "http:") || origin.href !== origin.origin + "/") {
  throw new Error("请提供无路径和参数的 HTTPS 域名。本机模拟器可使用本机 HTTP。");
}
if (!local && origin.origin !== PRODUCTION_API_BASE) {
  throw new Error("正式构建只能使用生产域名。开微信开发版或体验版即可连接测试域名。");
}
// 本机验收包只连接标记过的测试实例，且使用独立的本地存储空间。
if (local) await requireTestApi(rawOrigin);

// Publishing a web-view package requires the actual app and bridge on the same origin.
const appURL = new URL("/ios-v3/app.html", origin);
const response = await fetch(appURL, { signal: AbortSignal.timeout(10000), redirect: "error" });
if (!response.ok || !(await response.text()).includes("paper-cards-1114-v3")) {
  throw new Error("这个域名还没有部署卷卷小榜原稿页面。");
}
// 正式构建只读核对连接接口；本机验收可以对无效凭证走完整校验。
const bridge = local
  ? await fetch(new URL("/api/miniprogram-web/redeem", origin), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    signal: AbortSignal.timeout(10000), redirect: "error",
  })
  : await fetch(new URL("/api/miniprogram-web/poster", origin), {
    signal: AbortSignal.timeout(10000), redirect: "error",
  });
const bridgeReady = local ? bridge.status === 410 : bridge.status === 404 && (await bridge.json().catch(() => ({}))).error === "海报已过期，请重新生成。";
if (!bridgeReady) throw new Error("这个域名还没有部署微信小程序连接接口。");

const source = fileURLToPath(new URL("../", import.meta.url));
const target = resolve(process.env.INIT_CWD || process.cwd(), output);
if (target.startsWith(resolve(source) + sep)) throw new Error("输出目录必须在小程序源码目录之外。");
const sourceConfig = join(source, "config.js");
const settings = await readFile(sourceConfig, "utf8");
let configured = settings;
if (local) {
  const originSetting = 'const LOCAL_TEST_ORIGIN = "";';
  const storageSetting = 'const LOCAL_TEST_NAMESPACE = "";';
  if (!settings.includes(originSetting) || !settings.includes(storageSetting)) {
    throw new Error("找不到小程序本机测试配置。");
  }
  configured = settings.replace(originSetting, `const LOCAL_TEST_ORIGIN = ${JSON.stringify(origin.origin)};`)
    .replace(storageSetting, `const LOCAL_TEST_NAMESPACE = "rr-test:${origin.port}:";`);
}
await mkdir(dirname(target), { recursive: true });
await mkdir(target);
// 复制项目时使用生成的配置，避免中途失败留下指向生产的验收包。
await writeFile(join(target, "config.js"), configured);
await cp(source, target, {
  recursive: true,
  filter: path => path !== sourceConfig && !["minitest", "tools", "project.private.config.json", "node_modules", ".claude", ".git"].includes(basename(path)),
});

const project = join(target, "project.config.json");
const projectConfig = JSON.parse(await readFile(project, "utf8"));
projectConfig.projectname = local ? "RollieRank 原稿验收" : projectConfig.projectname;
projectConfig.setting.urlCheck = !local;
delete projectConfig.testRoot;
await writeFile(project, JSON.stringify(projectConfig, null, 2) + "\n");

console.log(target);
