# APK Splits Issue and Fix

## Problem
Despite configuring APK splits in `android/app/build.gradle`, the CI/CD build was still generating a 385MB universal APK instead of smaller architecture-specific APKs (~80-120MB each).

## Root Cause
The GitHub Actions workflow runs `expo prebuild --platform android` which **regenerates the entire Android project from scratch**. This command:
1. Deletes the existing `android/` directory
2. Generates fresh Android native code based on `app.config.js`
3. **Overwrites any manual changes** to `build.gradle` files

Our APK split configuration in `build.gradle` was being applied, but then immediately wiped out by `expo prebuild`.

## Solution
Created a post-prebuild script (`scripts/configure-apk-splits.js`) that:
1. Runs **after** `expo prebuild` completes
2. Programmatically injects the APK splits configuration into `build.gradle`
3. Ensures `universalApk false` is set (critical!)
4. Adds ProGuard optimization settings

### Workflow Execution Order
```
1. expo prebuild (generates android/ folder)
   ↓
2. configure-apk-splits.js (injects splits config)
   ↓
3. gradlew assembleRelease (builds APKs)
   ↓
4. Upload split APKs to artifacts
```

## Expected Results

### Before Fix
- **Single APK:** `app-release.apk` (385MB)
- Contains libraries for ALL CPU architectures
- Users download 385MB regardless of device

### After Fix
- **Split APK 1:** `app-arm64-v8a-release.apk` (~80-120MB)
  - For 64-bit ARM devices (most modern phones)
- **Split APK 2:** `app-armeabi-v7a-release.apk` (~75-110MB)
  - For 32-bit ARM devices (older phones)
- **No universal APK** generated
- Users download only the APK for their device architecture

## Size Reduction
- **Universal APK:** 385MB (all architectures)
- **Split APKs:** 80-120MB each (single architecture)
- **Savings:** ~60-70% reduction in download size

## Files Modified

### 1. `mobile/scripts/configure-apk-splits.js` (NEW)
Post-prebuild script that ensures APK splits configuration persists.

### 2. `.github/workflows/build-android-apk.yml`
Added step to run configuration script after prebuild:
```yaml
- name: Configure APK splits (post-prebuild)
  run: node scripts/configure-apk-splits.js
  working-directory: mobile
```

### 3. Enhanced build logging
Added directory listing to verify split APKs are generated:
```bash
ls -lh app/build/outputs/apk/release/
```

## Verification Steps

### 1. Check Build Logs
Look for:
```
📊 Listing all generated APKs:
✅ ARM64-v8a APK: 90 MB (64-bit devices)
✅ ARMv7 APK: 85 MB (32-bit devices)
```

### 2. Download Artifacts
- Should see **both** APK files in the ZIP
- Each APK should be 80-120MB (not 385MB)

### 3. Install on Device
- Install the appropriate APK for your device
- App should be ~80-120MB, not 385MB
- Faster installation and startup

## Distribution Strategy

### Option 1: Manual Distribution (Current)
- Upload both APK files to a file hosting service
- Users choose the correct APK for their device:
  - **arm64-v8a**: Most phones (2018+)
  - **armeabi-v7a**: Older phones (2011-2018)

### Option 2: Google Play Store
- Upload both APK files together
- Play Store automatically serves the correct APK
- Users don't need to choose

### Option 3: Universal APK (Fallback)
If splits cause issues:
- Set `universalApk true` in the script
- Generates single 385MB APK
- Works on all devices but much larger

## Technical Details

### APK Split Configuration
```gradle
splits {
    abi {
        enable true
        reset()
        include "arm64-v8a", "armeabi-v7a"
        universalApk false  // Critical: prevents 385MB APK
    }
}
```

### Why This Works
- **Agora SDK** includes native libraries for multiple architectures
- Each architecture adds ~150-200MB of `.so` files
- Splitting by architecture removes unused libraries
- Reduces APK size by 60-70%

## Troubleshooting

### If Universal APK Still Generates
1. Check script output: `✅ APK splits configuration applied successfully`
2. Verify `universalApk false` in build.gradle
3. Ensure no Gradle caching issues: `./gradlew clean`

### If Split APKs Don't Generate
1. Check for Gradle errors in build logs
2. Verify Agora SDK supports ABIs (it does)
3. Check if ProGuard is interfering (shouldn't be)

### If APK Size Still Large
1. Verify correct APK is being uploaded
2. Check if both split APKs exist
3. Look for `⚠️ Universal APK` warning in logs

## References
- [Gradle APK Splits Documentation](https://developer.android.com/studio/build/configure-apk-splits)
- [Expo Prebuild Guide](https://docs.expo.dev/workflow/prebuild/)
- [APK Size Optimization Guide](./APK_SIZE_OPTIMIZATION.md)

## Next Steps
1. Push changes and trigger build #183
2. Check logs for split APK generation
3. Download and verify APK sizes
4. Test installation on actual devices
5. If successful, update distribution documentation
