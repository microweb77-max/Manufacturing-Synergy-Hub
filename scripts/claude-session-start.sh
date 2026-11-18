#!/usr/bin/env bash
# SessionStart hook for Claude Code.
# Only does work in Claude Code on the web (cloud) sessions, where the
# repository is freshly cloned: installs pnpm + workspace dependencies.
# Local desktop sessions are left untouched.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}"

if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm@10 >/dev/null 2>&1 || corepack enable >/dev/null 2>&1 || true
fi

if [ ! -d node_modules ]; then
  pnpm install --frozen-lockfile >/dev/null 2>&1 && echo "[session-start] dependencies installed" || echo "[session-start] pnpm install failed — run it manually"
fi

# Build needs these at build time (Vite configs).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  { echo "export PORT=\${PORT:-3000}"; echo "export BASE_PATH=\${BASE_PATH:-/}"; } >> "$CLAUDE_ENV_FILE"
fi
exit 0
