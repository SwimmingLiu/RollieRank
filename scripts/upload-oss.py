"""Upload RollieRank mini-program image assets to the Qiniu bucket.

Usage: uv run --with qiniu python scripts/upload-oss.py [--dry-run]

Reads QINIU_AK / QINIU_SK from the environment. Keys are never written to disk.
"""
import hashlib
import json
import os
import sys
from pathlib import Path

import qiniu

ROOT = Path(__file__).resolve().parent.parent
MINI = ROOT / "mini-program"
# 域名绑定在 rollie-rank 桶上，文件名前缀与小程序 config.js 的 ASSET_BASE 对应。
LIVE_DOMAIN = "https://rollie-rank-oss.swimmingliu.cn"
DOMAIN = LIVE_DOMAIN
PREFIX = "static/rollierank/"
BUCKET = "rollie-rank"
# Qiniu upload zone for the bucket that already serves oss.swimmingliu.cn (East China).
UP_HOST = "https://up-z0.qiniup.com"

# 只发布小程序运行时真正引用的资源，原始大图和提示词不进入 OSS。
SKIP = {"sources.json", "plan.md", "beui-prompts.json"}
INCLUDE = {
    "assets/avatars/rank-",
    "assets/brand/rollierank-logo-v4-256.png",
    "assets/publishers/",
    "assets/illustrations/score-keepsake-v1-640.png",
    # 包内字体已删除并改由 OSS 提供，只上传三个 woff2。
    "assets/fonts/FangYuanVariable.woff2",
    "assets/fonts/NunitoVariable.woff2",
    "assets/fonts/FrauncesVariable.woff2",
}
TYPES = {".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".jpg": "image/jpeg"}

# 只上传包里没有、运行时按需下载的资源；包内的图标和标识不重复上传。
SOURCES = [
    ROOT / "docs/ui-exploration/ios-v3/assets",
]


def upload_key(path: Path) -> str:
    # 与小程序 config.js 的 ASSET_BASE 对应：static/rollierank/<原资源目录>
    rel = path.relative_to(ROOT / "docs/ui-exploration/ios-v3").as_posix()
    return PREFIX + rel


def local_manifest() -> list[dict]:
    items = []
    for root in SOURCES:
        for path in sorted(p for p in root.rglob("*") if p.is_file()):
            rel = path.relative_to(ROOT / "docs/ui-exploration/ios-v3").as_posix()
            if path.name in SKIP or not any(rel.startswith(prefix) for prefix in INCLUDE):
                continue
            data = path.read_bytes()
            items.append(
                {
                    "path": path.relative_to(ROOT).as_posix(),
                    "key": upload_key(path),
                    "url": DOMAIN + "/" + upload_key(path),
                    "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                }
            )
    return items


def main() -> int:
    dry = "--dry-run" in sys.argv
    items = local_manifest()
    print(f"{len(items)} files, {sum(i['bytes'] for i in items)/1024:.0f} KiB")
    if dry:
        for item in items:
            print(f"  {item['key']}  {item['bytes']}")
        return 0
    ak, sk = os.environ.get("QINIU_AK"), os.environ.get("QINIU_SK")
    if not ak or not sk:
        print("QINIU_AK / QINIU_SK missing", file=sys.stderr)
        return 2
    auth = qiniu.Auth(ak, sk)
    # Bucket lives in zone 0; pin the host so the SDK never guesses another region.
    region = qiniu.zone.Zone(
        up_host=UP_HOST,
        up_host_backup="https://upload-z0.qiniup.com",
        io_host="https://iovip-z0.qiniuio.com",
        rs_host="https://rs-z0.qiniuapi.com",
    )
    failures = []
    for item in items:
        token = auth.upload_token(BUCKET, item["key"], 3600)
        ret, info = qiniu.put_file(token, item["key"], str(ROOT / item["path"]),
                                  mime_type=TYPES.get(Path(item["path"]).suffix, "application/octet-stream"),
                                  regions=[region])
        ok = ret is not None and ret.get("key") == item["key"]
        print(("ok   " if ok else "FAIL ") + item["key"] + ("" if ok else f"  {info}"))
        if not ok:
            failures.append(item["key"])
    manifest = ROOT / "mini-program" / "assets-manifest.json"
    # 以实际可访问的域名写入清单；新域名未生效时不要发布 404 链接。
    manifest.write_text(json.dumps({"domain": LIVE_DOMAIN, "prefix": PREFIX, "files": items},
                                   ensure_ascii=False, indent=2) + "\n")
    print(f"manifest -> {manifest.relative_to(ROOT)}; {len(failures)} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
