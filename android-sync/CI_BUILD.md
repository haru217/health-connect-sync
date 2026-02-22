# Android Sync CI Build

## What This Does
- GitHub Actions builds `android-sync` debug APK.
- Artifact name: `android-sync-debug-apk`.

Workflow file:
- `.github/workflows/android-sync-build.yml`

## How To Run
1. Push current branch to GitHub.
2. Open GitHub repo `Actions` tab.
3. Run `Android Sync APK Build` (or let it run on push/PR).
4. Open the finished run and download `android-sync-debug-apk`.

## Install APK
- APK path inside artifact: `app-debug.apk`
- Install with USB debugging:
  - `adb install -r app-debug.apk`
