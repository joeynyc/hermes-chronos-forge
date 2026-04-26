#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"

mkdir -p "$HERMES_HOME/dashboard-themes"
mkdir -p "$HERMES_HOME/plugins/hermes-command-center"

cp "$ROOT_DIR/themes/chronos-forge.yaml" "$HERMES_HOME/dashboard-themes/chronos-forge.yaml"
rm -rf "$HERMES_HOME/plugins/hermes-command-center/dashboard"
cp -R "$ROOT_DIR/plugins/hermes-command-center/dashboard" "$HERMES_HOME/plugins/hermes-command-center/dashboard"

echo "Installed Chronos Forge theme to $HERMES_HOME/dashboard-themes/chronos-forge.yaml"
echo "Installed Hermes Command Center plugin to $HERMES_HOME/plugins/hermes-command-center/dashboard"
echo "Run: hermes dashboard --no-open"
echo "Then rescan plugins if needed: curl http://127.0.0.1:9119/api/dashboard/plugins/rescan"
