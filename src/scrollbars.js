// 缩短原生轨道的可见部分，仍由浏览器处理滚轮、键盘、触屏和滑块拖动。
export function installCompactScrollbars(doc = document) {
  const win = doc.defaultView;
  if (!win?.ResizeObserver) return () => {};
  const scrollers = new Set();
  let frame = 0;
  const measure = element => {
    const height = element === doc.documentElement ? win.innerHeight : element.clientHeight;
    const width = element === doc.documentElement ? win.innerWidth : element.clientWidth;
    element.style.setProperty("--rr-scroll-y-inset", `${Math.max(0, height - 56) / 2}px`);
    element.style.setProperty("--rr-scroll-x-inset", `${Math.max(0, width - 56) / 2}px`);
  };
  const resize = new win.ResizeObserver(entries => entries.forEach(({ target }) => measure(target)));
  const refresh = () => {
    frame = 0;
    for (const element of scrollers) if (!element.isConnected) { resize.unobserve(element); scrollers.delete(element); }
    const candidates = [doc.documentElement, ...doc.querySelectorAll("body *")];
    for (const element of candidates) {
      const style = win.getComputedStyle(element);
      if (element !== doc.documentElement && ![style.overflowX, style.overflowY].some(value => value === "auto" || value === "scroll")) continue;
      measure(element);
      if (!scrollers.has(element)) { scrollers.add(element); resize.observe(element); }
    }
  };
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(refresh); };
  const mutation = new win.MutationObserver(schedule);
  mutation.observe(doc.documentElement, { childList: true, subtree: true });
  win.addEventListener("resize", schedule, { passive: true });
  win.addEventListener("load", schedule, { once: true });
  schedule();
  return () => { if (frame) win.cancelAnimationFrame(frame); mutation.disconnect(); resize.disconnect(); win.removeEventListener("resize", schedule); win.removeEventListener("load", schedule); };
}

if (typeof document !== "undefined") installCompactScrollbars(document);
