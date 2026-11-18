const storage = require("../../utils/storage");
const api = require("../../services/api");

Page({
  data: {
    name: "卷友",
    guestId: "",
    count: 0,
    deleting: false,
    uiBase: "/assets/ui",
  },

  onShow() {
    this.setData({
      name: storage.name(),
      guestId: storage.guestId(),
      count: storage.history().length,
    });
  },

  onName(event) {
    this.setData({ name: event.detail.value });
  },

  saveName() {
    const name = storage.setName(this.data.name);
    this.setData({ name });
    wx.showToast({ title: "昵称已保存", icon: "success" });
  },

  copyId() {
    wx.setClipboardData({ data: this.data.guestId, success: () => wx.showToast({ title: "已复制本机身份", icon: "none" }) });
  },

  backup() {
    const data = {
      version: 1,
      exportedAt: Date.now(),
      history: storage.history(),
      position: storage.position(),
      name: storage.name(),
    };
    const text = JSON.stringify(data);
    // 剪贴板比文件更稳妥：小程序无法在系统目录任意写入。
    wx.setClipboardData({
      data: text,
      success: () => wx.showModal({
        title: "备份已复制",
        content: `共 ${data.history.length} 份记录，可粘贴到备忘录保存。`,
        showCancel: false,
      }),
    });
  },

  restore() {
    wx.showModal({
      title: "从剪贴板恢复",
      content: "将读取剪贴板中的备份内容，覆盖当前记录。",
      success: async res => {
        if (!res.confirm) return;
        wx.getClipboardData({
          success: ({ data }) => {
            try {
              const parsed = JSON.parse(data);
              if (!parsed || !Array.isArray(parsed.history)) throw new Error("格式不符");
              storage.saveHistory(parsed.history);
              if (parsed.position) storage.setPosition(parsed.position);
              if (parsed.name) storage.setName(parsed.name);
              this.onShow();
              wx.showToast({ title: `已恢复 ${parsed.history.length} 份记录`, icon: "none" });
            } catch {
              wx.showToast({ title: "备份内容无法识别", icon: "none" });
            }
          },
          fail: () => wx.showToast({ title: "无法读取剪贴板", icon: "none" }),
        });
      },
    });
  },

  async clearAll() {
    const history = storage.history();
    wx.showModal({
      title: "删除全部记录",
      content: `将删除本机 ${history.length} 份记录及服务端对应提交凭证，删除后无法恢复。`,
      confirmText: "删除",
      confirmColor: "#d54e4e",
      success: async res => {
        if (!res.confirm) return;
        this.setData({ deleting: true });
        try {
          if (history.length) await api.remove(history.map(item => item.id));
        } catch {
          // 服务端暂时不可达时仍清除本机记录，避免重复提示。
        }
        storage.saveHistory([]);
        try {
          for (const key of wx.getStorageInfoSync().keys) {
            if (key.startsWith("rr:draft:") || key.startsWith("rr:marks:")) wx.removeStorageSync(key);
          }
        } catch {
          // 存储枚举失败时保留其余键，不影响记录已清空的结果。
        }
        this.setData({ deleting: false });
        this.onShow();
        wx.showToast({ title: "已删除全部记录", icon: "none" });
      },
    });
  },

  about() {
    wx.showModal({
      title: "关于卷卷小榜",
      content: "行测套卷练习与同卷比较。成绩按服务端答案与分值计算；本机只保存草稿、身份和成绩快照。",
      showCancel: false,
    });
  },
});
