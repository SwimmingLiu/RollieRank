#!/usr/bin/env bash
# RollieRank API for a small server. Keeps one process and one JSON data file.
#
#   ./deploy/install-node-api.sh            # install to /opt/rollierank and start
#   ROLLIERANK_REVIEW_TOKEN=xxx ./deploy/install-node-api.sh
#
# Requirements: Node.js 20+ on PATH, systemd, rsync. Run as root or with sudo.
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/rollierank}
DATA_DIR=${DATA_DIR:-/var/lib/rollierank}
SERVICE=${SERVICE:-rollierank}
PORT=${PORT:-4173}
SRC_DIR=$(cd "$(dirname "$0")/.." && pwd)
NODE_BIN=$(command -v node)

[ -n "$NODE_BIN" ] || { echo "node not found; install Node.js 20+ first" >&2; exit 1; }
id -u >/dev/null 2>&1

# 只同步服务端实际需要的文件，原始题库资料与本地数据不进入服务器。
mkdir -p "$APP_DIR" "$DATA_DIR"
rsync -a --delete \
  --exclude '.git' --exclude '.local' --exclude '.raw' --exclude 'dist' \
  --exclude 'node_modules' --exclude 'test-results' --exclude 'docs/ui-exploration/*/node_modules' \
  "$SRC_DIR/server" "$SRC_DIR/src" "$SRC_DIR/scripts" "$SRC_DIR/package.json" "$APP_DIR/"

# 小程序 WebView 复用已经构建的手机页面。移除开发依赖和设计预览素材。
MOBILE_DIR="$APP_DIR/docs/ui-exploration/ios-v3"
mkdir -p "$MOBILE_DIR"
rsync -a --delete \
  --exclude 'node_modules' --exclude 'screens' --exclude 'motion' --exclude 'archives' \
  "$SRC_DIR/docs/ui-exploration/ios-v3/" "$MOBILE_DIR/"

# 岗位目录是公开数据，但要随服务一起部署，否则选岗和岗位榜会为空。
mkdir -p "$APP_DIR/data"
rsync -a --delete "$SRC_DIR/data/positions" "$APP_DIR/data/"

# 答案订正审核页需要单独凭证；未配置时审核关闭，管理接口保持本机无凭证行为。
if [ -n "${ROLLIERANK_REVIEW_TOKEN:-}" ]; then
  (umask 077; printf 'ROLLIERANK_REVIEW_TOKEN=%s\n' "$ROLLIERANK_REVIEW_TOKEN" > /etc/rollierank.env)
fi

if ! id rollierank >/dev/null 2>&1; then
  useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin rollierank
fi
chown -R rollierank:rollierank "$DATA_DIR"

cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=RollieRank API
After=network.target

[Service]
Type=simple
User=rollierank
WorkingDirectory=$APP_DIR
Environment=PORT=$PORT
Environment=ROLLIERANK_DATA_DIR=$DATA_DIR
EnvironmentFile=-/etc/rollierank.env
ExecStart=$NODE_BIN scripts/serve.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now "$SERVICE"
sleep 1
curl -fsS "http://127.0.0.1:$PORT/api/catalog" >/dev/null && echo "API up on 127.0.0.1:$PORT"
