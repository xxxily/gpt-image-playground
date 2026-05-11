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

## Release Automation

Every `v*` tag triggers the release workflow, which now includes an Android APK job. The APK assets are uploaded to the GitHub Release with this pattern:

```text
GPT.Image.Playground_<version>_android_<gradle-apk-name>.apk
```

To add an APK to an existing release tag without rebuilding desktop bundles, run `.github/workflows/build-release.yml` manually with:

- `tag`: the existing release tag, for example `v2.7.6`
- `android_only`: `true`

## CI / Configuration Reference

- The GitHub Actions release job installs the Android toolchain itself with `android-actions/setup-android@v3`, so CI does not depend on a preinstalled Android Studio image.
- Current workflow pins are `ANDROID_API_LEVEL=35`, `ANDROID_BUILD_TOOLS_VERSION=35.0.0`, and `ANDROID_NDK_VERSION=27.2.12479018`.
- For a release-signed APK, configure all three GitHub Secrets together:
  - `ANDROID_KEY_BASE64`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- If any of those secrets is missing, CI falls back to a debug-signed APK and still uploads the asset to the release.
- The workflow uploads every APK generated under `src-tauri/gen/android/app/build/outputs/apk/`, so the release assets always mirror the Gradle output tree.

## Signing

For production release signing, keep the same three secrets configured together and in sync:

- `ANDROID_KEY_BASE64`: base64 encoded `.jks` keystore
- `ANDROID_KEY_ALIAS`: keystore alias
- `ANDROID_KEY_PASSWORD`: key and store password

If any signing secret is missing, CI uploads a debug-signed APK instead. That artifact is fine for validation, but it is not a stable production signing identity for long-term Android updates.

## Notes

- `src-tauri/tauri.android.conf.json` overrides the bundle identifier with `site.anzz.gptimageplayground` because Android package names cannot contain hyphens.
- The Tauri build still uses `npm run build:desktop`, which exports the Next.js app into `out/` before native packaging.
- Official Tauri mobile prerequisites: https://v2.tauri.app/start/prerequisites/#configure-for-mobile-targets
- Official Tauri Android CLI reference: https://v2.tauri.app/reference/cli/#android-build
