# Android APK Build

This project uses Tauri 2 for native desktop/mobile packaging. The Android wrapper is generated on demand and is not committed until `npm run android:init` has been run locally.

## Prerequisites

- Node.js 20+
- Rust toolchain
- Android Studio with Android SDK, NDK, and platform tools configured
- `JAVA_HOME`, `ANDROID_HOME`, and Android SDK command-line tools available in the shell

## Commands

Run once per checkout:

```bash
npm run android:init
```

Run a device/emulator debug build:

```bash
npm run android:dev
```

Build an APK artifact:

```bash
npm run build:android
```

The APK is produced by Gradle under `src-tauri/gen/android/app/build/outputs/apk/`.

## Notes

- `src-tauri/tauri.android.conf.json` overrides the bundle identifier with `site.anzz.gptimageplayground` because Android package names cannot contain hyphens.
- The Tauri build still uses `npm run build:desktop`, which exports the Next.js app into `out/` before native packaging.
- Official Tauri mobile prerequisites: https://v2.tauri.app/start/prerequisites/#configure-for-mobile-targets
- Official Tauri Android CLI reference: https://v2.tauri.app/reference/cli/#android-build
