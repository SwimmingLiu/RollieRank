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
DOMAIN = "https://rollie-rank-oss.swimmingliu.cn"
PREFIX = "static/rollierank/"
BUCKET = "swimmingliu"
# Qiniu upload zone for the bucket that already serves oss.swimmingliu.cn (East China).
UP_HOST = "https://up-z0.qiniup.com"

SKIP = {"manifest.json", "sources.json"}
TYPES = {".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".jpg": "image/jpeg"}

SOURCES = [
    MINI / "assets",
    MINI / "images",
]


def upload_key(path: Path) -> str:
    rel = path.relative_to(MINI).as_posix()
    return PREFIX + rel


def local_manifest() -> list[dict]:
    items = []
    for root in SOURCES:
        for path in sorted(p for p in root.rglob("*") if p.is_file()):
            if path.name in SKIP:
                continue
            data = path.read_bytes()
            items.append(
                {
                    "path": path.relative_to(MINI).as_posix(),
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
        ret, info = qiniu.put_file(token, item["key"], str(MINI / item["path"]),
                                  mime_type=TYPES.get(Path(item["path"]).suffix, "application/octet-stream"),
                                  regions=[region])
        ok = ret is not None and ret.get("key") == item["key"]
        print(("ok   " if ok else "FAIL ") + item["key"] + ("" if ok else f"  {info}"))
        if not ok:
            failures.append(item["key"])
    manifest = ROOT / "mini-program" / "assets-manifest.json"
    manifest.write_text(json.dumps({"domain": DOMAIN, "prefix": PREFIX, "files": items},
                                   ensure_ascii=False, indent=2) + "\n")
    print(f"manifest -> {manifest.relative_to(ROOT)}; {len(failures)} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
