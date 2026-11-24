#!/usr/bin/env bash
# Install the test instance from a repository checkout or the same deployable source tree.
set -euo pipefail

if [[ $# != 0 || $EUID != 0 ]]; then
  echo '用法：sudo bash deploy/install-test-api.sh' >&2
  exit 1
fi

source_dir=$(cd "$(dirname "$0")/.." && pwd)
app_dir=/opt/rollierank-test
env_file=/etc/rollierank-test.env
unit_dir=/etc/systemd/system
endpoint=http://127.0.0.1:4175
service=rollierank-test.service
socket=rollierank-test.socket

# 固定测试路径，并拒绝通过已有链接覆盖其他实例的目录或环境文件。
for target in "$app_dir" "$app_dir/releases" "$env_file" "$unit_dir/$service" "$unit_dir/$socket"; do
  if [[ -L "$target" ]]; then
    echo "测试部署路径是符号链接：$target" >&2
    exit 1
  fi
done
if [[ -e "$env_file" && $(stat -c '%u:%a' "$env_file") != 0:600 ]]; then
  echo "$env_file 需要归 root 所有且权限为 0600。" >&2
  exit 1
fi

exec 9>/run/lock/rollierank-test-install.lock
flock 9
install -d -m 0755 "$app_dir/releases"
previous=$(readlink "$app_dir/current" || true)
release=$(mktemp -d "$app_dir/releases/release-XXXXXXXX")
chmod 0755 "$release"

# 数据与密钥在运行目录之外。部署只同步运行所需的代码、页面和内置岗位目录。
rsync -a --safe-links --chown=root:root \
  --exclude 'node_modules' --exclude '__pycache__' --exclude '.env*' --exclude '.local' \
  "$source_dir/server" "$source_dir/src" "$source_dir/scripts" \
  "$source_dir/index.html" "$source_dir/styles.css" "$source_dir/favicon.svg" \
  "$source_dir/package.json" "$source_dir/package-lock.json" "$release/"
# 只装服务运行依赖。
( cd "$release" && npm ci --omit=dev --no-audit --no-fund )
if [[ -d "$source_dir/admin" ]]; then
  rsync -a --safe-links --chown=root:root --exclude 'node_modules' --exclude '.env*' "$source_dir/admin" "$release/"
fi
mkdir -p "$release/docs/ui-exploration" "$release/data"
rsync -a --safe-links --chown=root:root \
  --exclude 'node_modules' --exclude 'screens' --exclude 'motion' --exclude 'archives' --exclude '.env*' \
  "$source_dir/docs/ui-exploration/ios-v3" "$release/docs/ui-exploration/"
rsync -a --safe-links --chown=root:root "$source_dir/data/positions" "$release/data/"
/usr/bin/env node --check "$release/scripts/serve.mjs"
# 模块链接检查在切换前捕获旧发布包缺少的依赖或导出。
( cd "$release" && /usr/bin/env node --input-type=module -e 'await import("./server/api.mjs")' )

if [[ ! -e "$env_file" ]]; then
  review_token=$(openssl rand -hex 32)
  (umask 077; printf 'ROLLIERANK_REVIEW_TOKEN=%s\n' "$review_token" > "$env_file")
fi

# 已配置测试卷豆库时，切换版本前先执行幂等迁移，避免新增列（如 UID）导致接口报 503。
if [[ -e "$env_file" ]] && grep -Eq '^(TEST_DATABASE_URL|TEST_MIGRATION_DATABASE_URL)=.+' "$env_file"; then
  ( cd "$release" && /usr/bin/env node --env-file="$env_file" scripts/migrate-tool-credits.mjs --test-environment )
fi

activate_release() {
  ln -sfn "$1" "$release/.current"
  mv -Tf "$release/.current" "$app_dir/current"
}

systemd-analyze verify "$source_dir/deploy/$service" "$source_dir/deploy/$socket"
install -m 0644 "$source_dir/deploy/$service" "$source_dir/deploy/$socket" "$unit_dir/"
activate_release "releases/${release##*/}"
if systemctl daemon-reload \
  && systemctl enable --now "$socket" \
  && systemctl restart "$service" \
  && curl --silent --show-error --fail --max-time 20 --retry 2 -D - -o /dev/null "$endpoint/api/catalog" \
    | tr -d '\r' | grep -ix 'X-RollieRank-Environment: test' >/dev/null \
  && curl --silent --show-error --fail --max-time 10 "$endpoint/api/positions/hierarchy" >/dev/null \
  && node "$release/scripts/verify-test-wallet.mjs" "$endpoint"; then
  printf 'RollieRank test API is ready at %s\n' "$endpoint"
  exit 0
fi

# 只回退测试服务的代码指针，保留测试数据库与凭证供排查。
if [[ -n "$previous" ]]; then
  activate_release "$previous"
  systemctl restart "$service" || true
else
  systemctl disable --now "$socket" || true
  systemctl stop "$service" || true
fi
echo "测试服务启动失败。请检查 journalctl -u $service。" >&2
exit 1
