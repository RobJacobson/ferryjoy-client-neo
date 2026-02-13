#!/usr/bin/env bash
# Workaround for EAS Build "yallist_1.Yallist is not a constructor" during
# project compression. Temporarily hide node_modules so EAS CLI uses its own
# tar/yallist from the npx cache instead of the project's.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RESTORE=
if [ -d "node_modules" ]; then
  mv node_modules node_modules.easbak
  RESTORE=1
fi
restore() {
  if [ -n "$RESTORE" ] && [ -d "node_modules.easbak" ]; then
    mv node_modules.easbak node_modules
  fi
}
trap restore EXIT
npm exec eas-cli -- build "$@"
