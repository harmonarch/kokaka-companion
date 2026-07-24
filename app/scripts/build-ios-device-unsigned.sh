#!/bin/sh
set -eu

APP_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$APP_ROOT"

export NODE_ENV=${NODE_ENV:-production}
export SENTRY_DISABLE_AUTO_UPLOAD=${SENTRY_DISABLE_AUTO_UPLOAD:-true}

EXPO_NO_GIT_STATUS=1 pnpm exec expo prebuild --platform ios --clean --no-install
pod install --project-directory=ios
xcodebuild \
  archive \
  -workspace ios/KokakaCompanion.xcworkspace \
  -scheme KokakaCompanion \
  -configuration Release \
  -sdk iphoneos \
  -destination "generic/platform=iOS" \
  -archivePath ios/build/KokakaCompanion.xcarchive \
  CODE_SIGNING_ALLOWED=NO \
  ARCHS=arm64

ARCHIVE_PATH="$APP_ROOT/ios/build/KokakaCompanion.xcarchive"
test -d "$ARCHIVE_PATH/Products/Applications/KokakaCompanion.app"
mkdir -p builds
ditto -c -k --sequesterRsrc --keepParent \
  "$ARCHIVE_PATH" \
  builds/kokaka-companion-ios-device-unsigned.xcarchive.zip
echo "Unsigned iOS device archive: $APP_ROOT/builds/kokaka-companion-ios-device-unsigned.xcarchive.zip"
