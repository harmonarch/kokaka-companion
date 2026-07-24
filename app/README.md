# Kokaka Companion Native

`app` 是 `apps/mobile` 的 React Native 原生版本，支持 Android 和 iOS。页面、聊天、语音、个人资料、群聊、记忆管理、登录与注册功能保持一致。

## 环境配置

在仓库根目录运行：

```sh
pnpm install
pnpm setup:env
```

然后按需修改 `app/.env`：

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787
EXPO_PUBLIC_WS_URL=ws://localhost:8787/ws/chat
```

Android 模拟器访问电脑上的本地服务时，执行：

```sh
adb reverse tcp:8787 tcp:8787
```

## 本地运行

```sh
pnpm dev:app
pnpm --filter @ai-companion/app android
pnpm --filter @ai-companion/app ios
```

## 检查

```sh
pnpm --filter @ai-companion/app typecheck
pnpm --filter @ai-companion/app test
```

## 生成安装包

```sh
pnpm --filter @ai-companion/app build:android
pnpm --filter @ai-companion/app build:ios:device:unsigned
pnpm --filter @ai-companion/app build:ios:simulator
```

生成文件：

- `builds/kokaka-companion-android.apk`
- `builds/kokaka-companion-ios-device-unsigned.xcarchive.zip`
- `builds/kokaka-companion-ios-simulator.zip`

设备归档不能直接安装到 iPhone，只用于后续签名。iPhone 安装包需要 Apple Developer 签名；配置 Apple Developer 账号后，可使用 `eas build --platform ios --profile production` 生成。
