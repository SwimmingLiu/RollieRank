"""Upload the SEO/GEO landing-site images to the same Qiniu bucket as the mini program.

Usage: uv run --with qiniu python scripts/upload-site-oss.py [--dry-run]

Reads QINIU_AK / QINIU_SK from the environment. Keys are never written to disk.
Bucket and prefix match scripts/upload-oss.py so one domain serves both.
"""
import hashlib
import json
import os
import re
import sys
from pathlib import Path

import qiniu

ROOT = Path(__file__).resolve().parent.parent
SITE_ASSETS = ROOT / "site" / "assets"
# 本机已有的一套七牛密钥（另一个项目的上传脚本），密码管理器类工具可优先用环境变量覆盖。
LOCAL_KEY_FILE = Path("/Users/swimmingliu/data/PycharmProject/others/md_image2url/qiniuyun_upload.py")
# 与小程序共用同一个桶和加速域名，前缀区分站点资源。
LIVE_DOMAIN = "https://rollie-rank-oss.swimmingliu.cn"
DOMAIN = LIVE_DOMAIN
PREFIX = "static/rollierank-site/"
BUCKET = "rollie-rank"
# Qiniu upload zone for the bucket that already serves oss.swimmingliu.cn (East China).
UP_HOST = "https://up-z0.qiniup.com"

TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp"}


def credentials() -> tuple[str, str]:
    """环境变量优先；本机存在的那份密钥文件作为后备，避免每次手动 export。"""
    ak, sk = os.environ.get("QINIU_AK"), os.environ.get("QINIU_SK")
    if ak and sk:
        return ak, sk
    if LOCAL_KEY_FILE.is_file():
        text = LOCAL_KEY_FILE.read_text(encoding="utf-8")
        found_ak = re.search(r"QINIU_AK\s*=\s*['\"]([^'\"]+)['\"]", text)
        found_sk = re.search(r"QINIU_SK\s*=\s*['\"]([^'\"]+)['\"]", text)
        if found_ak and found_sk:
            return found_ak.group(1), found_sk.group(1)
    return "", ""


def upload_key(path: Path) -> str:
    rel = path.relative_to(SITE_ASSETS).as_posix()
    return PREFIX + rel


def local_manifest() -> list[dict]:
    items = []
    for path in sorted(p for p in SITE_ASSETS.rglob("*") if p.is_file()):
        if path.suffix not in TYPES:
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
    print(f"{len(items)} files, {sum(i['bytes'] for i in items) / 1024:.0f} KiB")
    if dry:
        for item in items:
            print(f"  {item['key']}  {item['bytes']}")
        return 0
    ak, sk = credentials()
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
    manifest = ROOT / "site" / "assets-manifest.json"
    manifest.write_text(json.dumps({"domain": LIVE_DOMAIN, "prefix": PREFIX, "files": items},
                                   ensure_ascii=False, indent=2) + "\n")
    print(f"manifest -> {manifest.relative_to(ROOT)}; {len(failures)} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
