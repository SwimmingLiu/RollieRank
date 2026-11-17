import { type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";

export type Cleanup = () => void;
type MountedRoot = { root: Root; token: symbol; dispose: Cleanup; addedScope: boolean };
const mountedRoots = new Map<HTMLElement, MountedRoot>();

export function mountRoot(container: HTMLElement, content: ReactNode, dispose: Cleanup = () => {}) {
  const previous = mountedRoots.get(container);
  const token = Symbol("mount");
  const addedScope = previous?.addedScope ?? !container.classList.contains("beui-island");
  container.classList.add("beui-island");
  const root = previous?.root ?? createRoot(container);
  mountedRoots.set(container, { root, token, dispose, addedScope });
  // Native renderers inspect their new DOM immediately after mounting each island.
  flushSync(() => root.render(content));
  return () => {
    const current = mountedRoots.get(container);
    if (current?.token !== token) return;
    mountedRoots.delete(container);
    current.root.unmount();
    if (current.addedScope) container.classList.remove("beui-island");
    current.dispose();
  };
}

export function isMounted(container: HTMLElement) {
  return mountedRoots.has(container);
}

// CSS scope also lives on body. Only a registered React ancestor owns controls,
// otherwise the native answer grid would silently skip its component bridge.
export function hasMountedAncestor(element: HTMLElement, boundary: HTMLElement) {
  let parent = element.parentElement;
  while (parent) {
    if (mountedRoots.has(parent)) return true;
    // A sheet may own the container but deliberately inject native business markup inside it.
    if (parent === boundary) break;
    parent = parent.parentElement;
  }
  return false;
}

export function cleanup(container: HTMLElement) {
  // Capture descendants before an outer root can detach them during unmount.
  const affected = [...mountedRoots].filter(([host]) => host === container || container.contains(host));
  for (const [host, mounted] of affected.reverse()) {
    mountedRoots.delete(host);
    mounted.root.unmount();
    if (mounted.addedScope) host.classList.remove("beui-island");
    mounted.dispose();
  }
}
