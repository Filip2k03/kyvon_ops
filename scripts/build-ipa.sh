#!/usr/bin/env bash
# ==============================================================================
# KyvonOPS 2.0: iOS IPA Automated Packaging Pipeline
# Targets: iOS 16.0+, arm64 (iPhone / iPad / Mac Catalyst)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DESKTOP_DIR="${ROOT_DIR}/apps/desktop"

echo "==> [1/4] Building production React 19 / Vite bundle..."
cd "${DESKTOP_DIR}"
bun run build

echo "==> [2/4] Initializing and syncing Capacitor iOS project..."
if [ ! -d "${DESKTOP_DIR}/ios" ]; then
    echo "==> Scaffolding iOS native project..."
    bunx cap add ios
fi

bunx cap sync ios

echo "==> [3/4] Ready to compile native iOS IPA archive via Xcode..."
echo "    Run: bunx cap open ios"
echo "    Or: xcodebuild -workspace App.xcworkspace -scheme App -archivePath build/App.xcarchive archive"
echo "==> [4/4] iOS packaging sync complete."
