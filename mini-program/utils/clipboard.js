// 统一剪贴板写入与纸卡主题中文提示，屏蔽微信原生英文/灰底弹窗。

function showPageToast(page, message, tone) {
  const toast = page && typeof page.selectComponent === "function"
    ? page.selectComponent("#rr-toast")
    : null;
  if (toast && typeof toast.show === "function") {
    toast.show(message, { tone: tone || "ok" });
    return true;
  }
  wx.showToast({ title: message, icon: "none" });
  return false;
}

function copyText(page, data, message) {
  const text = String(data == null ? "" : data);
  if (!text) return;
  const label = String(message || "已复制").trim() || "已复制";
  wx.setClipboardData({
    data: text,
    success() {
      // 立即隐藏微信自带系统提示（防止英文设备显示深灰 "Content copied"），改用主题纸卡提示。
      if (typeof wx.hideToast === "function") {
        wx.hideToast({ fail() {} });
      }
      showPageToast(page, label, "ok");
    },
    fail() {
      showPageToast(page, "复制失败，请重试", "warn");
    },
  });
}

module.exports = {
  copyText,
  showPageToast,
};
