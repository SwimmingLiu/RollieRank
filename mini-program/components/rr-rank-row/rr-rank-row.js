Component({
  options: { virtualHost: true, styleIsolation: "apply-shared" },
  properties: {
    item: { type: Object, value: null },
    variant: { type: String, value: "row" },
    isLast: { type: Boolean, value: false },
  },
  data: { avatarFailed: false },
  observers: {
    "item.avatar"() {
      if (this.data.avatarFailed) this.setData({ avatarFailed: false });
    },
  },
  methods: {
    onSelect() {
      const id = this.data.item?.publicId;
      if (id) this.triggerEvent("select", { publicId: id });
    },
    onAvatarError() {
      if (!this.data.avatarFailed) this.setData({ avatarFailed: true });
    },
  },
});
