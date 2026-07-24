#!/bin/sh
set -eu

APP_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$APP_ROOT"

export NODE_ENV=${NODE_ENV:-production}
export SENTRY_DISABLE_AUTO_UPLOAD=${SENTRY_DISABLE_AUTO_UPLOAD:-true}

EXPO_NO_GIT_STATUS=1 pnpm exec expo prebuild --platform android --clean --no-install
cd android
./gradlew assembleRelease
cd "$APP_ROOT"

mkdir -p builds
cp android/app/build/outputs/apk/release/app-release.apk builds/kokaka-companion-android.apk
echo "Android APK: $APP_ROOT/builds/kokaka-companion-android.apk"
