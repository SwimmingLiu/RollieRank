import { useState } from "react";
import { Avatar, type AvatarProps } from "./primitives";
import { mountRoot } from "./root-registry";

export type DiscussionAvatarProps = Pick<AvatarProps, "name" | "src">;
type ImageState = { kind: "idle" } | { kind: "loaded" | "failed"; source: string };

function avatarSource(value: string | undefined) {
  if (!value || /[\u0000-\u0020\u007f]/u.test(value)) return undefined;
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

// 独立交流页直接组合同一头像，避免为每条评论再创建嵌套 React root。
export function DiscussionAvatar({ name, src }: DiscussionAvatarProps) {
  const source = avatarSource(src);
  const [image, setImage] = useState<ImageState>({ kind: "idle" });
  const pending = Boolean(source && (image.kind === "idle" || image.source !== source));
  return <span className="ios-discussions-avatar-island" role="img" aria-label={`${name}的头像`} data-image-pending={pending || undefined}
    onLoadCapture={(event) => { if (source && event.target instanceof HTMLImageElement) setImage({ kind: "loaded", source }); }}
    onErrorCapture={(event) => { if (source && event.target instanceof HTMLImageElement) setImage({ kind: "failed", source }); }}>
    {pending ? <span className="ios-discussions-avatar-pending" aria-hidden="true">{name.trim().slice(0, 2) || "考生"}</span> : null}
    <Avatar name={name || "考生"} src={source} size="md" className="ios-discussions-avatar" data-slot="discussion-avatar" aria-hidden="true" />
  </span>;
}

export function mountDiscussionAvatar(container: HTMLElement, props: DiscussionAvatarProps) {
  return mountRoot(container, <DiscussionAvatar {...props} />);
}
