import { createHash } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright";

// Still screenshots used to refresh while the gallery's animation retained the old logo and UI.
// Record actual interactions and bind the shipped GIF to the code/brand bytes that produced it.
const root = resolve(import.meta.dirname, "..");
const ui = join(root, "docs/ui-exploration/ios-v3");
const output = resolve(root, process.argv[2] || "test-results/preview-motion");
const execute = promisify(execFile);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const sources = [
  "scripts/record-ios-preview.mjs",
  "docs/ui-exploration/ios-v3/app.js",
  "docs/ui-exploration/ios-v3/app.html",
  "docs/ui-exploration/ios-v3/vendor/beui.js",
  "docs/ui-exploration/ios-v3/features/base.css",
  "docs/ui-exploration/ios-v3/features/practice-session.css",
  "docs/ui-exploration/ios-v3/features/timer-configuration.css",
  "docs/ui-exploration/ios-v3/features/single-answer.css",
  "docs/ui-exploration/ios-v3/assets/brand/rollierank-logo-transparent.png",
];
await mkdir(output, { recursive: true });
const data = await mkdtemp(join(tmpdir(), "rollierank-motion-"));
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise(done => reservation.close(done));
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  cwd: root, env: { ...process.env, PORT: String(port), ROLLIERANK_DATA_DIR: data },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "", browser, context, page, video;
const actions = [], errors = [];
server.stdout.on("data", bytes => { logs += bytes; });
server.stderr.on("data", bytes => { logs += bytes; });
try {
  const sourcesBefore = {};
  for (const file of sources) sourcesBefore[file] = digest(await readFile(join(root, file)));
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("The isolated preview did not start")), 15000);
    server.stdout.on("data", () => { if (logs.includes("RollieRank is ready")) { clearTimeout(timer); done(); } });
    server.once("error", reject);
  });
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: output, size: { width: 390, height: 844 } } });
  const started = Date.now();
  page = await context.newPage();
  video = page.video();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/ios-v3/app.html?page=home&design=paper-cards-1114-v3&session=current-motion`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "开始做题计时", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const leadSeconds = (Date.now() - started) / 1000 + 0.1;
  const show = async name => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(output, `${name}.png`) });
    actions.push(name);
  };
  await show("home-first-use");
  await page.getByRole("button", { name: "花生，选择套卷", exact: true }).click();
  await page.locator('.rr3-paper-cover.new .rr-card-hit').first().click();
  for (let question = 1; question <= 6; question++) {
    await page.getByRole("button", { name: `第 ${question} 题，选 A`, exact: true }).click();
    await page.waitForTimeout(90);
  }
  await show("list-entry");
  await page.getByRole("button", { name: "切换单题模式", exact: true }).click();
  await page.getByRole("button", { name: /^(?:存疑|取消存疑)第 \d+ 题$/ }).click();
  await show("single-question");
  await page.locator("#top").getByRole("button", { name: "返回", exact: true }).click();
  await show("papers-draft");
  await page.locator('.tabbar [data-root="home"]').click();
  await show("home-real-draft");
  await page.getByRole("button", { name: "开始做题计时", exact: true }).click();
  await show("timer-publishers");
  await page.getByRole("tab", { name: "自定义", exact: true }).click();
  // Latest mobile design uses a plain duration field and steppers, without preset chips.
  await page.getByRole("spinbutton", { name: "自定义总分钟", exact: true }).fill("30");
  await show("timer-custom");
  await page.getByRole("button", { name: "开始做题", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await show("timer-paused");
  if (errors.length) throw new Error(errors.join("\n"));
  await context.close(); context = undefined;
  const raw = await video.path();
  const gif = join(ui, "motion/interaction-current.gif");
  const temporaryGif = join(output, "interaction-current.gif");
  const conversion = await execute("ffmpeg", ["-y", "-ss", leadSeconds.toFixed(3), "-i", raw, "-vf", "fps=7,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5", "-loop", "0", temporaryGif], { maxBuffer: 4 * 1024 * 1024 });
  await writeFile(join(output, "ffmpeg.log"), conversion.stderr);
  const capturedSources = {};
  for (const file of sources) {
    capturedSources[file] = digest(await readFile(join(root, file)));
    if (capturedSources[file] !== sourcesBefore[file]) throw new Error(`Source changed during recording: ${file}; retain this attempt and record again from the stable build`);
  }
  await writeFile(gif, await readFile(temporaryGif));
  const manifest = { schema: 1, viewport: [390, 844], actions, errors, gif: "motion/interaction-current.gif", gifSha256: digest(await readFile(gif)), sources: capturedSources, evidence: output };
  await writeFile(join(ui, "motion/interaction-current.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(join(output, "results.json"), JSON.stringify({ passed: true, ...manifest }, null, 2) + "\n");
  const old = join(ui, "motion/interaction-b94c64753f8c.gif");
  try {
    const archive = join(root, ".local", "preview-motion-before-feedback");
    await mkdir(archive, { recursive: true });
    await rename(old, join(archive, "interaction-b94c64753f8c.gif"));
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  process.stdout.write(JSON.stringify({ passed: true, actions, gif, manifest: join(ui, "motion/interaction-current.json") }) + "\n");
} catch (error) {
  await writeFile(join(output, `failure-${Date.now()}.json`), JSON.stringify({ error: String(error), actions, errors }, null, 2));
  await page?.screenshot({ path: join(output, `failure-${Date.now()}.png`), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context?.close(); await browser?.close();
  server.kill("SIGTERM");
  if (server.exitCode === null) await once(server, "exit");
  await rm(data, { recursive: true, force: true });
  await writeFile(join(output, "server.log"), logs);
}
