// 手机访问时引导进入微信小程序。
//
// 个人主体小程序拿不到短链接（wxaurl.cn）和 URL Link 权限，
// 唯一可用的自动入口是「小程序码」：展示图片，长按识别即可进入。
//
// 三种情况：
// 1. 微信内置浏览器：直接弹出小程序码，长按识别进小程序
// 2. 其他移动浏览器：同样展示小程序码，并提示保存后在微信里扫
// 3. 桌面浏览器：不做任何打扰
(function () {
  var MOBILE = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|OpenHarmony/i;
  var WECHAT = /MicroMessenger/i;
  var STORAGE_KEY = "rollierank:miniapp-skip";
  var API = "/api/miniapp";

  var ua = navigator.userAgent || "";
  if (!MOBILE.test(ua) || sessionStorage.getItem(STORAGE_KEY)) return;

  var inWeChat = WECHAT.test(ua);

  function loadEntry() {
    return fetch(API + "/entry", { credentials: "omit" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.enabled) throw new Error("disabled");
        return data;
      });
  }

  function overlay(entry) {
    var holder = document.createElement("div");
    holder.className = "mini-entry";
    holder.setAttribute("role", "dialog");
    holder.setAttribute("aria-modal", "true");
    holder.setAttribute("aria-label", "打开小程序");

    var card = document.createElement("div");
    card.className = "mini-entry__card";

    var title = document.createElement("strong");
    title.textContent = "卷卷小榜小程序";
    card.appendChild(title);

    if (entry.kind === "qrcode" && entry.image) {
      var figure = document.createElement("div");
      figure.className = "mini-entry__code";
      var img = document.createElement("img");
      img.src = "data:" + (entry.mime || "image/jpeg") + ";base64," + entry.image;
      img.alt = "卷卷小榜小程序码";
      img.width = 200;
      img.height = 200;
      figure.appendChild(img);
      card.appendChild(figure);

      var hint = document.createElement("p");
      hint.className = "mini-entry__hint";
      hint.textContent = inWeChat
        ? "长按上方小程序码，选择「前往图中包含的小程序」。"
        : "长按或截屏保存小程序码，在微信里扫一扫即可打开。";
      card.appendChild(hint);
    } else {
      var body = document.createElement("p");
      body.textContent = "在微信里搜索「卷卷小榜」即可打开小程序。";
      card.appendChild(body);
    }

    var dismiss = document.createElement("button");
    dismiss.className = "mini-entry__close";
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "继续浏览网页");
    dismiss.textContent = "继续看网页";
    dismiss.addEventListener("click", function () {
      sessionStorage.setItem(STORAGE_KEY, "1");
      holder.remove();
    });
    card.appendChild(dismiss);

    holder.appendChild(card);
    document.body.appendChild(holder);
    return holder;
  }

  loadEntry()
    .then(function (entry) {
      if (entry.kind === "shortlink" && entry.link && inWeChat) {
        window.location.replace(entry.link);
        return;
      }
      overlay(entry);
    })
    .catch(function () {
      overlay({ kind: "fallback" });
    });
})();
