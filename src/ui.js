const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  trophy:
    '<path d="M8 3h8v5a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v6m-5 3h10m-8-3h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1zm0 0v15"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  down: '<path d="m5 9 7 7 7-7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 3v17h17M9 15v-4m5 4V7m5 8v-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  paste: '<path d="M8 5H5v16h14V5h-3M9 3h6v4H9zM8 12h8m-8 4h5"/>',
  flag: '<path d="M5 22V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  settings:
    '<path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3v.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  shield: '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6zM8 12l3 3 5-6"/>',
  spark:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-3m-6 7 6 3"/>',
  refresh:
    '<path d="M20 7V3l-4 1M4 17v4l4-1M20 7a8 8 0 0 0-14-1M4 17a8 8 0 0 0 14 1"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  leaf: '<path d="M20 3c-1 8-1 14-8 14a6 6 0 0 1-6-6c0-7 8-6 14-8zM4 21l12-12"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  logout: '<path d="M9 3H4v18h5m-1-9h13m-5-5 5 5-5 5"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h2m4 0h2m-8 3h2"/>',
  comment:
    '<path d="M21 12a8 8 0 0 1-8 8H6l-3 2 1-4a8 8 0 1 1 17-6z"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
};
export const icon = (name, extra = "") =>
  `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.book}</svg>`;
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const pad = (value) => String(value).padStart(2, "0");
export const score = (cents) =>
  (cents / 100)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
export const pct = (value) =>
  `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
export const date = (value, full = false) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    ...(full
      ? { year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
  }).format(new Date(value));
export const routeLink = (path, text, className = "", attrs = "") =>
  `<a href="#/${path}" class="${className}" ${attrs}>${text}</a>`;
export const button = (action, text, className = "button", attrs = "") =>
  `<button type="button" data-action="${action}" class="${className}" ${attrs}>${text}</button>`;
export const progress = (value, className = "") =>
  `<div class="progress ${className}"><i style="width:${Math.min(100, Math.max(0, value * 100))}%"></i></div>`;
export const empty = (title, description, action = "", symbol = "book") =>
  `<div class="empty-state"><span class="empty-art">${icon(symbol)}</span><h3>${title}</h3><p>${description}</p>${action}</div>`;
export const sectionHead = (title, action = "", eyebrow = "") =>
  `<div class="section-head"><div>${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}<h2>${title}</h2></div>${action}</div>`;
export const versionPath = (version) => encodeURIComponent(version.id);

export function studyArt() {
  return `<svg class="study-art" viewBox="0 0 360 260" fill="none" aria-hidden="true"><defs><linearGradient id="cover" x1="110" y1="100" x2="295" y2="210" gradientUnits="userSpaceOnUse"><stop stop-color="#ad91bf"/><stop offset="1" stop-color="#85629f"/></linearGradient><linearGradient id="pages" x1="145" y1="86" x2="220" y2="182" gradientUnits="userSpaceOnUse"><stop stop-color="#fffdfd"/><stop offset="1" stop-color="#efe4f3"/></linearGradient><linearGradient id="cup" x1="260" y1="70" x2="310" y2="145"><stop stop-color="#fffdfd"/><stop offset="1" stop-color="#e4d3e9"/></linearGradient></defs><ellipse cx="203" cy="214" rx="131" ry="17" fill="#ac82b2" opacity=".12"/><circle cx="198" cy="129" r="105" fill="#fff" opacity=".24"/><path d="m90 182 113-46 107 42-113 49z" fill="#a982a9"/><path d="M90 175v7l107 45v-8z" fill="#bba2c4"/><path d="m90 175 114-48 106 44-113 48z" fill="#decce5"/><path d="m85 164 113-49 110 44-113 51z" fill="url(#cover)"/><path d="m85 158 110-48 111 44-111 49z" fill="#baa2cb"/><path d="m96 151 99-43 98 41-98 44z" fill="#f9f4fa"/><path d="m97 148 98-43v84z" fill="#f0e6f3"/><path d="m195 105 97 40-97 44z" fill="#fffbfe"/><path d="m100 143 93-44v84c-23-21-49-31-93-40z" fill="url(#pages)"/><path d="m193 99 95 23v59c-30-7-59-2-95 2z" fill="#fffafd"/><path d="m207 117 64 14m-64-2 64 14m-64-2 45 9" stroke="#e3d5eb" stroke-width="3" stroke-linecap="round"/><path d="m122 139 48 22m-37-29 37 16m-25-23 25 11" stroke="#d5c2df" stroke-width="3" stroke-linecap="round"/><path d="m187 189 10 4 44-20-10-5z" fill="#dba6bd"/><path d="m231 168 10 5v28l-5-5-5 1z" fill="#dba6bd"/><path d="m275 83 41 1-6 48c-1 11-30 11-31 0z" fill="url(#cup)"/><ellipse cx="295" cy="84" rx="21" ry="8" fill="#e7d9ec"/><ellipse cx="295" cy="84" rx="16" ry="5" fill="#ac8493"/><path d="M314 94h7c16 0 12 26-10 25" stroke="#e5d5e9" stroke-width="7"/><path d="M287 65c-8-10 6-11 0-23m14 25c-8-10 6-12 0-23" stroke="#bda0c5" stroke-width="2.5" stroke-linecap="round" opacity=".5"/><path d="m57 103 11 3 8 52-21 1z" fill="#e5c8d4"/><ellipse cx="64" cy="103" rx="11" ry="4" fill="#efdce5"/><path d="M64 103V65m0 18c-20-2-23-17-15-19 11-2 15 19 15 19zm0-9c17-2 23-17 14-18-10-1-14 18-14 18zm0 22c15 0 26-12 17-16-10-3-17 16-17 16z" stroke="#a2ad91" stroke-width="2" fill="#bdc4ac"/><path d="m281 190 28 13m-25-19 28 13" stroke="#c6a17b" stroke-width="5" stroke-linecap="round"/><path d="m281 190-5-5 8-1" fill="#e7caa9"/><path d="m117 56 3-8 3 8 8 3-8 3-3 8-3-8-8-3z" fill="#cfb8dc"/><circle cx="247" cy="45" r="3" fill="#d6bdd5"/><path d="m318 153 2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill="#c4a6cd"/></svg>`;
}

export function shell(
  content,
  { state, active = "home", focused = false, adminLocked = false, adminAuthorized = false } = {},
) {
  if (active === "admin") {
    const adminNav = [
      ["discussions", "评论管理", "comment"],
      ["corrections", "答案纠错", "flag"],
      ["catalog", "套卷与版本", "book"],
      ["import", "导入新套卷", "upload"],
      ["positions", "岗位目录", "compass"],
      ["audit", "操作记录", "clock"],
    ];
    const adminNavHtml = adminNav
      .map(
        ([target, label, sym]) =>
          `<button type="button" class="admin-nav-item" data-action="admin-jump" data-target="${target}">${icon(sym)}<span>${label}</span></button>`,
      )
      .join("");
    return `<div class="app-shell admin-console">
      <aside class="admin-sidebar">
        <a href="#/admin" class="admin-brand">
          <img src="/ios-v3/assets/brand/rollierank-logo-transparent.png" width="32" height="32" alt=""/>
          <span><b>卷卷小榜</b><small>运营后台</small></span>
        </a>
        <div class="admin-nav-group">工作台</div>
        <nav class="admin-nav" aria-label="后台导航">${adminNavHtml}</nav>
        <div class="admin-sidebar-footer">
          ${adminAuthorized
            ? button("admin-logout", `${icon("lock")}<span>退出维护者凭证</span>`, "admin-nav-item")
            : adminLocked
              ? button("admin-unlock", `${icon("lock")}<span>输入维护者凭证</span>`, "admin-nav-item is-primary")
              : `<div class="admin-mode-pill"><i></i>本机免密模式</div>`}
          ${routeLink("home", `${icon("home")}<span>返回前台页面</span>`, "admin-nav-item")}
        </div>
      </aside>
      <div class="app-main admin-main">
        <header class="topbar admin-topbar">
          <div class="breadcrumb"><span>卷卷小榜</span>${icon("right")}<b>运营管理后台</b></div>
          <div class="topbar-tools">
            <span class="admin-env-badge"><i></i>服务端已连接</span>
            ${adminAuthorized
              ? button("admin-logout", "退出凭证", "button outline compact")
              : adminLocked
                ? button("admin-unlock", `${icon("lock")}解锁后台`, "button primary compact")
                : ""}
            ${routeLink("home", "打开前台", "button outline compact")}
          </div>
        </header>
        <main id="main" class="main-content admin-content">${content}</main>
      </div>
    </div>`;
  }
  const nav = [
    ["home", "home", "选卷练习"],
    ["rank", "trophy", "同卷练习榜"],
    ["me", "user", "我的记录"],
  ];
  const navItems = nav
    .map(([path, symbol, title]) =>
      routeLink(
        path,
        `${icon(symbol)}<span>${title}</span>${active === path ? '<i class="nav-dot"></i>' : ""}`,
        `nav-item ${active === path ? "active" : ""}`,
      ),
    )
    .join("");
  return `<div class="app-shell ${focused ? "focused" : ""}"><aside class="sidebar"><a href="#/home" class="brand"><img src="/ios-v3/assets/brand/rollierank-logo-transparent.png" width="42" height="42" alt=""/><span><b>卷卷小榜<span class="brand-petal">✦</span></b><small>ROLLIERANK</small></span></a><div class="sidebar-label">我的学习空间</div><nav aria-label="主导航">${navItems}</nav><div class="sidebar-note"><span class="note-spark">${icon("leaf")}</span><p>每一分努力，<br/>都离上岸更近一点。</p><span>把练习记下来。</span><svg viewBox="0 0 140 65" fill="none" aria-hidden="true"><path d="M5 62C42 62 36 38 67 38s32-26 64-26" stroke="#c5adc9" stroke-width="2" stroke-dasharray="4 5"/><path d="m122 9 13-5-4 15-3-7z" fill="#b899bf"/></svg></div><div class="sidebar-bottom">${button("help", `${icon("help")}<span>使用帮助</span>`, "nav-item")}${routeLink("admin", `${icon("settings")}<span>运营后台</span><span class="tiny-label">管理</span>`, `nav-item ${active === "admin" ? "active" : ""}`)}<div class="sidebar-user">${button(state.profile ? "settings" : "login", `<span class="avatar small">${state.profile ? esc(state.profile.name[0]) : icon("user")}</span><span><b>${state.profile ? esc(state.profile.name) : "本机练习者"}</b><small>${state.profile ? "体验身份" : "你的练习会自动保存"}</small></span>${icon("right")}`, "profile-trigger")}</div></div></aside><div class="app-main"><header class="topbar"><div class="breadcrumb"><span>学习空间</span>${icon("right")}<b>${{ home: "选卷练习", rank: "同卷练习榜", me: "我的记录", admin: "运营后台" }[active] ?? "练习报告"}</b></div><a href="#/home" class="mobile-brand"><img src="/ios-v3/assets/brand/rollierank-logo-transparent.png" width="31" height="31" alt=""/>卷卷小榜</a><div class="topbar-tools"><span class="local-status"><i></i>本机自动保存</span>${button("help", icon("help"), "icon-button", 'aria-label="使用帮助"')}${button(state.profile ? "settings" : "login", `<span class="avatar tiny">${state.profile ? esc(state.profile.name[0]) : icon("user")}</span>`, "icon-button", 'aria-label="账户设置"')}</div></header><main id="main" class="main-content">${content}</main><footer class="app-footer"><span>卷卷小榜 <i>·</i> 把每一次进步记下来</span><span>练习估分仅供参考</span></footer></div>${focused ? "" : `<nav class="mobile-nav" aria-label="移动端主导航">${navItems}</nav>`}</div>`;
}
