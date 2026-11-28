#!/usr/bin/env bash
# 为「卷卷小榜」安装微信公众号 + 微信搜一搜每日自动运营定时任务。
#
# 用法：
#   bash scripts/wechat-mp/install-cron.sh --print-server-cron   # 打印腾讯云服务器 crontab 配置
#   bash scripts/wechat-mp/install-cron.sh --install-launchd     # 在本机 macOS 安装每天 09:00 自动巡检任务
#   bash scripts/wechat-mp/install-cron.sh --uninstall-launchd   # 卸载本机 macOS 定时任务

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE_BIN="$(command -v node)"
LABEL="cn.swimmingliu.rollierank.mp-autopilot"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${ROOT}/.local/wechat-mp/logs"

case "${1:---print-server-cron}" in
  --print-server-cron)
    cat <<EOF
# 推荐部署在固定 IP 的腾讯云服务器（118.25.65.206，记得将该 IP 加入公众号 IP 白名单）
# 每天早上 09:00 自动执行：拉取最新套卷 -> 生成新 GEO 图文/封面 -> 推送公众号草稿箱 -> 同步小程序搜一搜
0 9 * * * cd /path/to/RollieRank && /usr/bin/env node scripts/wechat-mp/autopilot.mjs --autopilot >> /var/log/rollierank-mp-autopilot.log 2>&1
EOF
    ;;

  --install-launchd)
    mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
    cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${ROOT}/scripts/wechat-mp/autopilot.mjs</string>
    <string>--autopilot</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/autopilot.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/autopilot.err.log</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
EOF
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH"
    echo "已安装并加载 macOS 定时任务：${PLIST_PATH}"
    echo "触发时间：每天 09:00 自动执行 autopilot（日志：${LOG_DIR}）"
    ;;

  --uninstall-launchd)
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "已卸载定时任务：${LABEL}"
    ;;

  *)
    echo "未知参数：$1（可选：--print-server-cron | --install-launchd | --uninstall-launchd）" >&2
    exit 1
    ;;
esac
EOF
