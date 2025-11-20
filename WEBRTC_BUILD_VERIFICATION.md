# WebRTC Build Verification Checklist

Use this checklist to verify the WebRTC live streaming build is working correctly.

## ✅ Configuration Files Verification

### app.config.js
- [x] `@config-plugins/react-native-webrtc` plugin is included in plugins array
- [x] expo-camera plugin configured with camera and microphone permissions
- [x] Android permissions include CAMERA, RECORD_AUDIO, INTERNET, MODIFY_AUDIO_SETTINGS
- [x] iOS Info.plist includes NSCameraUsageDescription and NSMicrophoneUsageDescription
- [x] Environment variables (API_URL_PRODUCTION, REDIRECT_URI_PRODUCTION) configured in extra

### package.json
- [x] `react-native-webrtc` ^124.0.7 in dependencies
- [x] `@config-plugins/react-native-webrtc` ^10.0.0 in devDependencies
- [x] `expo-camera` included
- [x] Build scripts use `expo prebuild` for native builds

### GitHub Workflow (.github/workflows/build-android-apk.yml)
- [x] WebRTC dependency verification step added
- [x] Prebuild step uses `--clean` flag
- [x] WebRTC native module verification step added
- [x] Checks for CAMERA and RECORD_AUDIO permissions in AndroidManifest.xml
- [x] Build summary mentions WebRTC features
- [x] PR comments highlight WebRTC support

### Other Configurations
- [x] metro.config.js - No changes needed (standard config works)
- [x] babel.config.js - No changes needed (babel-preset-expo handles it)
- [x] eas.json - Build profiles configured for development and production

## 🧪 Local Build Testing

### Before Running Workflow
```bash
# 1. Verify dependencies are installed
cd mobile
npm install

# 2. Check that WebRTC packages are present
npm list react-native-webrtc
npm list @config-plugins/react-native-webrtc

# 3. Test prebuild locally
npx expo prebuild --platform android --clean

# 4. Verify AndroidManifest.xml was generated correctly
cat android/app/src/main/AndroidManifest.xml | grep -E "CAMERA|RECORD_AUDIO"

# 5. Build debug APK locally (optional)
cd android
./gradlew assembleDebug
```

### Expected Output
```
✅ react-native-webrtc@124.0.7
✅ @config-plugins/react-native-webrtc@10.0.0
✅ <uses-permission android:name="android.permission.CAMERA" />
✅ <uses-permission android:name="android.permission.RECORD_AUDIO" />
```

## 🚀 GitHub Actions Workflow Testing

### Workflow Triggers
The workflow runs on:
- [x] Push to branches: main, master, deployment, carl-changes
- [x] Pull requests to: main, master, deployment
- [x] Manual trigger via workflow_dispatch
- [x] Tags matching 'v*'

### Workflow Steps to Monitor
1. **Install dependencies** - Should install all npm packages
2. **Verify WebRTC dependencies** - Should confirm packages present
3. **Clean and Pre-build Android** - Should generate android folder with WebRTC
4. **Verify WebRTC native modules** - Should show ✅ for permissions and modules
5. **Build Android APK** - Should complete without WebRTC errors
6. **Upload APK** - Should upload artifact with WebRTC support

### Expected Success Indicators
```
✅ WebRTC packages found
✅ Camera permission found
✅ Microphone permission found
✅ WebRTC native modules configured
✅ Build successful
✅ APK uploaded
```

## 📱 APK Installation and Runtime Testing

### After Downloading APK from GitHub Actions

#### Installation
1. Download APK from workflow artifacts
2. Transfer to Android device
3. Enable "Install from unknown sources"
4. Install APK

#### Runtime Verification - Shop Owner Side
1. Open app and log in as shop owner
2. Navigate to "Incoming Orders" or shop management screen
3. Tap "Go Live" button
4. **Expected**: Camera/Microphone permission dialog appears
5. Grant permissions
6. **Expected**: Camera preview shows
7. Start streaming
8. **Expected**: Stream indicator shows "Live"

#### Runtime Verification - Customer Side
1. Open app on different device/account
2. Navigate to shop that's live streaming
3. **Expected**: "Live" badge visible on shop card
4. Tap to view live stream
5. **Expected**: Video stream appears after 2-5 seconds (WebRTC connection time)
6. **Expected**: Can see shop owner's camera feed

### Common Issues and Solutions

#### ❌ "WebRTC module not found"
**Cause**: Running in Expo Go instead of production build
**Solution**: Use APK built from GitHub Actions workflow

#### ❌ Camera permission dialog doesn't appear
**Cause**: Permissions not in AndroidManifest.xml
**Solution**: Verify prebuild step ran successfully, check manifest file

#### ❌ Stream doesn't appear for viewers
**Possible Causes**:
- Backend WebRTC signaling not accessible
- Network blocks WebRTC traffic
- STUN server unreachable
**Solution**: Check backend logs, test network connectivity, verify STUN servers

#### ❌ Build fails in GitHub Actions
**Possible Causes**:
- Config plugin not applied
- Dependencies not installed
- Gradle configuration issue
**Solution**: Check workflow logs, verify dependencies in package.json, clear cache and rebuild

## 🔍 Debug Information

### Workflow Build Logs to Check
```
# Search for these in GitHub Actions logs:
- "Checking for WebRTC dependencies..."
- "✅ Camera permission found"
- "✅ Microphone permission found"
- "✅ WebRTC native modules configured"
```

### AndroidManifest.xml Expected Content
After prebuild, should contain:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### Component-Level WebRTC Detection
The components handle WebRTC availability gracefully:
```typescript
// LiveStreamBroadcaster.tsx and LiveStreamViewer.tsx
try {
  const webrtc = require('react-native-webrtc');
  isWebRTCAvailable = true;
  console.log('✅ WebRTC available (Production Build)');
} catch (e) {
  console.log('⚠️ WebRTC not available (Expo Go)');
}
```

## 📋 Pre-Deployment Checklist

Before merging to deployment/main branch:

- [ ] Tested build locally with `npx expo prebuild --platform android --clean`
- [ ] Verified AndroidManifest.xml has all required permissions
- [ ] GitHub Secrets are configured:
  - [ ] API_URL_PRODUCTION
  - [ ] REDIRECT_URI_PRODUCTION
  - [ ] ANDROID_KEYSTORE_BASE64
  - [ ] ANDROID_KEY_ALIAS
  - [ ] ANDROID_STORE_PASSWORD
  - [ ] ANDROID_KEY_PASSWORD
- [ ] Backend WebRTC endpoints are deployed and accessible
- [ ] Workflow runs successfully on feature branch
- [ ] APK downloaded and tested on real device
- [ ] Camera/microphone permissions work in APK
- [ ] Live streaming works broadcaster → viewer
- [ ] WebRTC connection establishes successfully

## 📚 Reference Documentation

- `mobile/WEBRTC_DEPLOYMENT.md` - Detailed WebRTC deployment guide
- `WEBRTC_BUILD_CHANGES.md` - Summary of workflow changes
- `mobile/app.config.js` - Expo configuration with WebRTC plugin
- `.github/workflows/build-android-apk.yml` - CI/CD workflow

## 🎯 Success Criteria

Build is successful when:
1. ✅ GitHub Actions workflow completes without errors
2. ✅ APK artifact is uploaded
3. ✅ Workflow logs show WebRTC modules verified
4. ✅ APK installs on Android device
5. ✅ Camera/microphone permissions are requested at runtime
6. ✅ Shop owner can start live stream with camera
7. ✅ Customers can view live stream
8. ✅ WebRTC connection establishes (video appears)
9. ✅ No "WebRTC module not found" errors in production APK
10. ✅ All features work on real device (not emulator)

---

**Last Updated**: 2025-01-20
**WebRTC Version**: react-native-webrtc@124.0.7
**Config Plugin Version**: @config-plugins/react-native-webrtc@10.0.0
**Expo SDK**: ~52.0.47
