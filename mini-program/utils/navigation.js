function navigationLayout(info, menu) {
  const screenTop = info.screenTop || 0;
  const status = info.statusBarHeight ?? info.safeArea?.top ?? 20;
  const statusBarHeight = Math.max(0, status - screenTop);
  const width = info.windowWidth || info.screenWidth || 375;
  const menuTop = menu?.top - screenTop;
  const hasMenu = menu?.height > 0 && menu.left > 0 && menu.left < width && menuTop >= statusBarHeight;
  if (!hasMenu) return { statusBarHeight, navHeight: 44, menuClearance: 104 };

  // The extra row space mirrors the gap above the capsule and keeps controls at its center.
  const gap = menuTop - statusBarHeight;
  return {
    statusBarHeight,
    navHeight: menu.height + gap * 2,
    menuClearance: width - menu.left + 8,
  };
}

module.exports = { navigationLayout };
