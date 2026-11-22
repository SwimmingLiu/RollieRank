#!/usr/bin/env bash
# Capture the v78-only screens of 行测小助理 into screenshots/.
#
#   ./tools/capture-v78-screens.sh
#
# The screen must be UNLOCKED: a locked macOS session captures all-black frames
# (CGSSessionScreenIsLocked = true). The script refuses to run in that state
# rather than writing black PNGs into screenshots/.
#
# What it does: opens the mini program at a given route with `open weixin://`,
# waits for the page to settle, and grabs the frontmost window region.
# Each shot is taken interactively — the script pauses so you can navigate to
# the exact state (switch tab, pick a 档位, wait for the share image to render)
# before pressing Enter.

set -euo pipefail

APPID=wxd74bddd3fe422729
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/screenshots"

if ioreg -n Root -d1 -a 2>/dev/null | grep -A1 CGSSessionScreenIsLocked | grep -q "<true/>"; then
  echo "屏幕已锁定：锁屏状态下截图为全黑。请先解锁再运行。" >&2
  exit 1
fi

mkdir -p "$OUT"

shot() { # shot <number> <slug> <human description>
  local n="$1" slug="$2" desc="$3"
  local file
  file="$(printf '%02d-%s.png' "$n" "$slug")"
  echo
  echo "── [$n] $desc"
  echo "   操作到位后按 Enter 截图（Ctrl-C 跳过）..."
  read -r _
  screencapture -x -o "$OUT/$file"
  # Reject an all-black frame instead of silently committing a useless shot.
  if python3 - "$OUT/$file" <<'PY'
import struct, sys, zlib

path = sys.argv[1]
data = open(path, "rb").read()
if data[:8] != b"\x89PNG\r\n\x1a\n":
    sys.exit(1)
# Collect IDAT and decode enough to sample pixels.
pos, idat = 8, b""
w = h = None
while pos < len(data):
    ln = struct.unpack(">I", data[pos:pos+4])[0]
    typ = data[pos+4:pos+8]
    body = data[pos+8:pos+8+ln]
    if typ == b"IHDR":
        w, h = struct.unpack(">II", body[:8])
    elif typ == b"IDAT":
        idat += body
    pos += 12 + ln
raw = zlib.decompress(idat)
# Any non-zero byte in the first rows means the frame is not pure black.
sys.exit(0 if any(raw[: 4096]) else 1)
PY
  then
    echo "   ✗ 全黑帧，已删除 $file"
    rm -f "$OUT/$file"
  else
    echo "   ✓ $file"
  fi
}

echo "准备采集 v78 新增界面。第一步先把小程序打开："
open "weixin://dl/business/?appid=$APPID&path=pages/index/index"
sleep 8

shot 19 home-support-btn        "首页顶部：标题行右侧的「💰 打赏开发者」按钮"
shot 20 support-page            "点进赞赏页：档位列表 + 底部支付按钮"
shot 21 result-ability-radar    "成绩页默认面板：六维雷达 + 分段按钮 + 图例"
shot 22 result-insight-tabs     "成绩页：「能力图 / 英雄榜」Tab 条（切到英雄榜再切回）"
shot 23 result-share-preview    "成绩页 → 保存图片：分享图预览层（等图片生成完再截）"

echo
echo "完成。若第 21 张是空态，说明该套卷答卷不足 10 份，换一套有数据的卷再试。"
