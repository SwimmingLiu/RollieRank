const storage = require("../../utils/storage.js");
const profile = require("../../services/profile.js");
const { createPageSheetDrag } = require("../../utils/sheet-gesture.js");

Component({
  data: {
    previewAvatar: "",
    pickedAvatar: "",
    draftName: "",
    saving: false,
    error: "",
    sheetDragY: 0,
    sheetDragging: false,
    sheetClosing: false,
    sheetShadeOpacity: 1,
  },

  lifetimes: {
    attached() {
      this.sheetDrag = createPageSheetDrag(this, {
        onDismiss: () => this.triggerEvent("dismiss"),
      });
      this.setData({
        previewAvatar: profile.displayAvatar(),
        pickedAvatar: "",
        draftName: storage.hasCustomName() ? storage.name() : "",
        error: "",
      });
    },
    detached() {
      this.sheetDrag?.reset();
    },
  },

  methods: {
    noop() {},
    startDrag(event) { this.sheetDrag?.start(event); },
    moveDrag(event) { this.sheetDrag?.move(event); },
    endDrag(event) { this.sheetDrag?.end(event); },
    cancelDrag() { this.sheetDrag?.cancel(); },

    dismiss() {
      if (this.data.saving) return;
      this.sheetDrag?.reset();
      this.triggerEvent("dismiss");
    },

    onChooseAvatar(event) {
      const path = event?.detail?.avatarUrl;
      if (!path) return;
      this.setData({ previewAvatar: path, pickedAvatar: path, error: "" });
    },

    onNameInput(event) {
      this.setData({ draftName: event?.detail?.value || "", error: "" });
    },

    async submit(event) {
      if (this.data.saving) return;
      const submittedName = String(event?.detail?.value?.name ?? this.data.draftName ?? "").trim();
      const avatarFilePath = this.data.pickedAvatar;
      if (!avatarFilePath && !submittedName) {
        this.setData({ error: "请先点头像选用微信头像，或填入微信昵称" });
        return;
      }
      this.setData({ saving: true, error: "" });
      try {
        const saved = await profile.saveProfile({
          name: submittedName || undefined,
          avatarFilePath: avatarFilePath || undefined,
        });
        wx.showToast({ title: "已同步", icon: "success" });
        this.triggerEvent("saved", { profile: saved });
      } catch (error) {
        this.setData({ error: error?.message || "保存失败，请重试" });
      } finally {
        this.setData({ saving: false });
      }
    },
  },
});
