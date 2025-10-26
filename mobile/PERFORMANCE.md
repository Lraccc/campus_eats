# Performance & Debugging Notes

## Logger Utility (`utils/logger.ts`)

To reduce logging overhead in production builds, we use a small dev-only logger wrapper:

```typescript
import logger from '../utils/logger';

// Dev only (no-ops when __DEV__ is false)
logger.log('Debug message');
logger.warn('Warning message');
logger.error('Error message');
```

**Why?** Console logging in React Native is expensive (serialization + bridging). Hundreds of logs per second can block the JS thread and cause UI jank.

**Usage:** Replace `console.log` with `logger.log` in hot code paths (e.g., location updates, render loops, frequent timers).

## Location Check Throttling

In `app/_layout.tsx`, the location check function is throttled to run at most once every **5 seconds** (configurable via `LOCATION_CHECK_MIN_MS`).

- **Reason:** Prevents tight loops from spamming location requests.
- **How it works:** Each call to `checkLocation()` checks the last timestamp and returns early if called too soon.
- **Position logging:** Only logs when the device moves >50 meters to reduce noise.
- **Error logging:** Logs the first error and then every 10th error to avoid spam when location fails repeatedly.

## Debugging the Deployed APK

### USB Debugging with ADB

1. **Enable USB debugging on device:**
   - Settings → About phone → tap Build number 7× to enable Developer options
   - Settings → Developer options → enable "USB debugging"
   - Connect device to PC via USB

2. **Verify connection:**
   ```cmd
   adb devices
   ```
   (Accept the debug prompt on the phone if "unauthorized" appears)

3. **View logs:**
   - All React Native logs:
     ```cmd
     adb logcat *:S ReactNative:V ReactNativeJS:V
     ```
   - Only errors (quieter):
     ```cmd
     adb logcat *:S ReactNative:E ReactNativeJS:E
     ```
   - Save logs to file:
     ```cmd
     adb logcat -v time > C:\temp\device-logs.txt
     ```

4. **Filter by PID (your app only):**
   ```cmd
   for /f "delims=" %i in ('adb shell pidof com.your.package') do adb logcat --pid=%i
   ```
   (Replace `com.your.package` with your actual package name)

### Android Studio Logcat

- Open Android Studio → View → Tool Windows → Logcat
- Select the connected device and your app's process from the dropdown
- Use filters by package name, log level, or tag
- **Note:** Non-debuggable APKs may not show the process automatically, but `adb logcat` will still work.

### On-Device Log Apps

Modern Android restricts access to the global system log, so apps like "aLogcat" or "CatLog" require root or won't show other apps' logs. **Rely on adb or Android Studio instead.**

## Production Crash Reporting

For production builds, add a remote crash/logging service:
- **Sentry** (recommended) — captures stack traces and context
- **Firebase Crashlytics** — free, good integration with Firebase
- **Bugsnag** or similar

These tools capture errors from users without requiring USB debugging.

## Tips

- **Reduce log verbosity:** If logs are still noisy, use `logger.log` for debug info and only keep `logger.error` for actual errors.
- **Profile performance:** Use Flipper, React DevTools, or Hermes profiler to find JS thread bottlenecks.
- **Background location:** For long-running tracking (e.g., dasher tracking), consider a native background location library with built-in throttling (less JS overhead).

## Quick Commands Summary

```cmd
# Check device connection
adb devices

# Stream React Native logs (dev builds)
adb logcat *:S ReactNative:V ReactNativeJS:V

# Stream only errors (production builds)
adb logcat *:S ReactNative:E ReactNativeJS:E

# Save logs to file
adb logcat -v time > C:\temp\logs.txt

# Filter by app PID (Windows cmd)
for /f "delims=" %i in ('adb shell pidof com.your.package') do adb logcat --pid=%i
```

---

**Last updated:** October 26, 2025
