const ACTIVE_GUEST = "rollierank:wechat:guest";
const GUEST = /^[\w-]{10,80}$/;
const ACTION_SENDER = "rollierank:wechat:sender";
const ACTIVE_AVATAR = "rollierank:wechat:avatar";

async function request(path, body) {
  const response = await fetch("/api/miniprogram-web/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "微信连接失败，请重试。");
  return result;
}

function boundedPixels(value) {
  const size = Number(value);
  return Number.isInteger(size) && size > 0 && size < 4096 ? size : 0;
}

export async function openWechatWebView() {
  const url = new URL(location.href);
  if (url.searchParams.get("embed") !== "wechat") return null;
  const ticket = new URLSearchParams(url.hash.slice(1)).get("rr");
  let migration = null;
  if (ticket) {
    migration = await request("redeem", { ticket });
    sessionStorage.setItem(ACTIVE_GUEST, migration.guestId);
    sessionStorage.setItem(ACTION_SENDER, migration.sender);
    sessionStorage.setItem(ACTIVE_AVATAR, migration.avatarId || "");
    url.hash = "";
    history.replaceState(history.state, "", url);
  }
  const guestId = sessionStorage.getItem(ACTIVE_GUEST) || "";
  if (!GUEST.test(guestId)) throw new Error("小程序连接已失效，请重新打开。");

  const height = boundedPixels(url.searchParams.get("wxHeight"));
  const bottom = boundedPixels(url.searchParams.get("wxBottom"));
  document.documentElement.dataset.host = "wechat";
  // Some WebViews already shorten their window for the bottom gesture area.
  const updateInset = () => {
    const reserved = height ? Math.max(0, height - window.innerHeight) : 0;
    if (!document.activeElement?.matches("input, textarea, [contenteditable]")) {
      document.documentElement.style.setProperty("--wx-bottom", Math.max(0, bottom - reserved) + "px");
    }
  };
  updateInset();
  window.addEventListener("resize", updateInset);
  const avatarId = sessionStorage.getItem(ACTIVE_AVATAR) || "";
  const avatarSrc = /^[a-f0-9]{48}$/.test(avatarId) ? "/api/miniprogram-profile/avatar?id=" + avatarId : "";
  return { guestId, migration, height, bottom, avatarSrc };
}

function openNativeAction(action) {
  return request("action", { ...action, sender: sessionStorage.getItem(ACTION_SENDER) });
}

let lastTitle;
export function setWechatViewTitle(title) {
  document.title = title;
  if (title === lastTitle) return;
  lastTitle = title;
  const key = "rollierank:wechat:title-revision";
  const revision = (Number(sessionStorage.getItem(key)) || 0) + 1;
  sessionStorage.setItem(key, String(revision));
  void openNativeAction({ kind: "title", title, revision }).catch(() => {
    if (lastTitle === title) lastTitle = undefined;
  });
}

export async function saveWechatPoster(blob) {
  const image = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("无法读取海报。"));
    reader.readAsDataURL(blob);
  });
  const { ticket } = await request("poster", { image });
  await openNativeAction({ kind: "poster", ticket });
}

export function inviteWechatFriend({ institution, period, paper }) {
  return openNativeAction({ kind: "invite", institution, period, paper });
}

export function openWechatProfile() {
  return openNativeAction({ kind: "profile" });
}

export function migrateWechatDrafts({ ui, catalog, attempts, migration, scopeForVersion }) {
  if (!migration) return;
  const done = new Set(attempts.map(attempt => attempt.id));
  for (const draft of migration.drafts) {
    const version = catalog.find(item => item.id === draft.versionId);
    if (!version || !Number(version.number) || done.has(draft.id) || draft.answers.length !== version.questionCount) continue;
    const existing = ui.history.find(record => record.id === draft.id);
    if (existing && (existing.complete || existing.updatedAt >= draft.updatedAt)) continue;
    const record = {
      ...scopeForVersion(version), id: draft.id, answers: draft.answers.map(answer => answer || ""),
      complete: false, updatedAt: draft.updatedAt, marks: draft.marks, current: draft.current,
      entryMode: draft.single ? "single" : "list",
    };
    ui.history = [record, ...ui.history.filter(item => item.id !== record.id)];
    if (Array.isArray(draft.marks)) ui.reviewMarks[record.id] = draft.marks;
  }
  for (const [id, numbers] of migration.marks) if (done.has(id) && !ui.reviewMarks[id]) ui.reviewMarks[id] = numbers;
  ui.history.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
