#!/bin/sh
set -eu
rollierank_scripts=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# Some macOS package-manager installations have broken shared libraries; prefer a working bundled runtime.
for rollierank_node in "${ROLLIERANK_NODE:-}" "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" "$(command -v node || true)"; do
  if [ -n "$rollierank_node" ] && [ -x "$rollierank_node" ] && "$rollierank_node" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' >/dev/null 2>&1; then
    exec "$rollierank_node" "$rollierank_scripts/serve.mjs"
  fi
done
printf '%s\n' 'Node.js 20 or newer is required. Set ROLLIERANK_NODE to a working Node executable.' >&2
exit 1
