import { esc } from "../ui.js";

// Reuses the app's local initial avatar without depending on an avatar service.
export function renderDiscussionsAvatar({ name = "考生", seed = name, image = "" } = {}) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  const initial = Array.from(String(name).trim())[0] || "考";
  let source = "";
  try {
    const url = new URL(image);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password)
      source = url.href;
  } catch { /* Missing or invalid images keep the local initial. */ }
  return `<span class="discussions-avatar discussions-avatar-${(hash >>> 0) % 6}" role="img" aria-label="${esc(name)}的头像"><span aria-hidden="true">${esc(initial)}</span>${source ? `<img data-discussions-avatar src="${esc(source)}" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer"/>` : ""}</span>`;
}

export function bindDiscussionsAvatars(root) {
  for (const image of root.querySelectorAll("[data-discussions-avatar]")) {
    if (image.dataset.discussionsBound) continue;
    image.dataset.discussionsBound = "true";
    const show = () => { image.dataset.discussionsLoaded = image.naturalWidth ? "true" : "false"; };
    image.addEventListener("load", show);
    image.addEventListener("error", () => { image.dataset.discussionsLoaded = "false"; });
    if (image.complete) show();
  }
}
