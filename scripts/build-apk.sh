#!/usr/bin/env bash
# ==============================================================================
# KyvonOPS 2.0: Android APK Automated Packaging Pipeline
# Targets: Android 8.0+ (API Level 26+), arm64-v8a, armeabi-v7a, x86_64
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DESKTOP_DIR="${ROOT_DIR}/apps/desktop"

echo "==> [1/4] Building production React 19 / Vite bundle..."
cd "${DESKTOP_DIR}"
bun run build

echo "==> [2/4] Initializing and syncing Capacitor Android project..."
if [ ! -d "${DESKTOP_DIR}/android" ]; then
    echo "==> Scaffolding Android native project..."
    bunx cap add android
fi

bunx cap sync android

echo "==> [3/4] Compiling native Android APK via Gradle..."
cd "${DESKTOP_DIR}/android"
if [ -f "./gradlew" ]; then
    chmod +x ./gradlew
    ./gradlew assembleRelease
    echo "==> [4/4] APK successfully built!"
    echo "    Output: ${DESKTOP_DIR}/android/app/build/outputs/apk/release/app-release-unsigned.apk"
else
    echo "==> Android project synced. Open in Android Studio or run with: bunx cap open android"
fi
