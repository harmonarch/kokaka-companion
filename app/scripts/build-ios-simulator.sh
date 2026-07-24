#!/bin/sh
set -eu

APP_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$APP_ROOT"

export NODE_ENV=${NODE_ENV:-production}
export SENTRY_DISABLE_AUTO_UPLOAD=${SENTRY_DISABLE_AUTO_UPLOAD:-true}
SIMULATOR_ARCH=$(uname -m)

EXPO_NO_GIT_STATUS=1 pnpm exec expo prebuild --platform ios --clean --no-install
pod install --project-directory=ios
xcodebuild \
  -workspace ios/KokakaCompanion.xcworkspace \
  -scheme KokakaCompanion \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath ios/build \
  CODE_SIGN_IDENTITY=- \
  CODE_SIGNING_REQUIRED=YES \
  ARCHS="$SIMULATOR_ARCH" \
  ONLY_ACTIVE_ARCH=YES \
  build

APP_PATH="$APP_ROOT/ios/build/Build/Products/Release-iphonesimulator/KokakaCompanion.app"
test -d "$APP_PATH"
mkdir -p builds
ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" builds/kokaka-companion-ios-simulator.zip
echo "iOS Simulator package: $APP_ROOT/builds/kokaka-companion-ios-simulator.zip"
