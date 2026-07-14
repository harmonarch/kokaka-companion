/// <reference types="expo/types" />

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string
    EXPO_PUBLIC_WS_URL?: string
    EXPO_PUBLIC_SENTRY_DSN?: string
    EXPO_PUBLIC_SENTRY_ENVIRONMENT?: string
    EXPO_PUBLIC_SENTRY_RELEASE?: string
    EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE?: string
  }
}
