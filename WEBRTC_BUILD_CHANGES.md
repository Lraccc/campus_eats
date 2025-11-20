# WebRTC Build Configuration Changes

## Summary
Updated GitHub Actions workflow to properly support WebRTC live streaming feature by ensuring the `@config-plugins/react-native-webrtc` plugin from `app.config.js` is correctly applied during the build process.

## Changes Made

### 1. `.github/workflows/build-android-apk.yml`

#### Added WebRTC Dependency Verification
- **New Step**: "Verify WebRTC dependencies" 
- Checks that `react-native-webrtc` and `@config-plugins/react-native-webrtc` packages are installed
- Runs after dependency installation

#### Enhanced Prebuild Step
- **Updated**: "Clean and Pre-build Android" step description
- Added `--clean` flag to ensure fresh build with WebRTC config plugin
- Now explicitly mentions "generates native code including WebRTC modules"

#### Added WebRTC Module Verification
- **New Step**: "Verify WebRTC native modules"
- Checks AndroidManifest.xml for required permissions (CAMERA, RECORD_AUDIO)
- Verifies WebRTC native modules are present in build files
- Provides visual feedback (✅/⚠️) for build status

#### Enhanced PR Comments
- Updated PR comment to include WebRTC feature information
- Now shows:
  - WebRTC Live Streaming Support ✅
  - Native Camera & Microphone Access ✅
  - Production-ready Build ✅

#### Enhanced Build Summary
- Added section highlighting WebRTC features:
  - WebRTC Live Streaming Support
  - Camera & Microphone Permissions
  - Native Module Support

## How It Works

### Build Flow with WebRTC
1. **Dependencies Install**: `npm ci` installs all packages including `react-native-webrtc`
2. **Dependency Verification**: Confirms WebRTC packages are present
3. **Expo Prebuild**: `npx expo prebuild --platform android --clean`
   - Reads `app.config.js` configuration
   - Applies `@config-plugins/react-native-webrtc` plugin
   - Generates native Android code with WebRTC support
   - Adds camera/microphone permissions to AndroidManifest.xml
4. **Module Verification**: Confirms WebRTC modules were properly configured
5. **Gradle Build**: Builds the APK with all native modules included

### Key Configuration Files

#### `app.config.js` (Already Configured ✅)
```javascript
plugins: [
  "expo-router",
  ["expo-location", { ... }],
  ["expo-camera", {
    cameraPermission: "Allow Campus Eats to access your camera for live streaming.",
    microphonePermission: "Allow Campus Eats to access your microphone for live streaming.",
    recordAudioAndroid: true
  }],
  "@config-plugins/react-native-webrtc"  // ← Critical for WebRTC
]
```

#### `package.json` (Already Configured ✅)
```json
{
  "dependencies": {
    "react-native-webrtc": "^124.0.7",
    // ... other deps
  },
  "devDependencies": {
    "@config-plugins/react-native-webrtc": "^10.0.0",
    // ... other dev deps
  }
}
```

## What This Fixes

### Before Changes
- Workflow would run prebuild without explicitly verifying WebRTC setup
- No confirmation that WebRTC modules were properly integrated
- Unclear if permissions were correctly added to manifest

### After Changes
- ✅ Explicit WebRTC dependency verification
- ✅ Native module configuration confirmation
- ✅ Permission verification in generated AndroidManifest.xml
- ✅ Clear build output showing WebRTC status
- ✅ PR comments highlight WebRTC support

## Testing the Build

### Local Testing
```bash
cd mobile
npm install
npx expo prebuild --platform android --clean
cd android
./gradlew assembleDebug  # or assembleRelease
```

### Verifying WebRTC in APK
After installing the built APK:
1. Open the app and navigate to Shop Owner screens
2. Tap "Go Live" - camera/microphone permissions should be requested
3. Grant permissions and start streaming
4. On viewer side, the stream should appear (WebRTC connection)

### Expected Permissions in AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

## Files Changed
- `.github/workflows/build-android-apk.yml` - Enhanced with WebRTC verification steps

## Files Already Configured (No Changes Needed)
- `mobile/app.config.js` - WebRTC plugin configured ✅
- `mobile/package.json` - WebRTC dependencies installed ✅
- `mobile/eas.json` - Build profiles configured ✅
- `mobile/metro.config.js` - Asset handling configured ✅
- `mobile/babel.config.js` - NativeWind configured ✅
- `mobile/components/LiveStreamBroadcaster.tsx` - WebRTC implementation ✅
- `mobile/components/LiveStreamViewer.tsx` - WebRTC viewer implementation ✅
- `mobile/WEBRTC_DEPLOYMENT.md` - Comprehensive deployment guide ✅

## Important Notes

### Why These Changes Matter
1. **Config Plugin Application**: The `@config-plugins/react-native-webrtc` plugin MUST be applied during prebuild to properly configure native Android modules
2. **Permission Configuration**: Camera and microphone permissions must be in AndroidManifest.xml for runtime permission requests to work
3. **Native Module Linking**: WebRTC requires native code that's only available after `expo prebuild` runs with the config plugin

### Expo Go Limitation
- WebRTC does **NOT** work in Expo Go
- A production build (APK/IPA) is **REQUIRED**
- This is why the workflow is critical - it creates the production build with native modules

### Future Enhancements
Consider adding:
- WebRTC connection success metrics
- TURN server configuration for better NAT traversal
- Bandwidth optimization for mobile networks
- Stream quality monitoring

## Troubleshooting

### Build fails with "WebRTC module not found"
- Ensure `@config-plugins/react-native-webrtc` is in `devDependencies`
- Run `npm install` before building
- Clear cache: `npx expo prebuild --clean`

### Permissions not appearing in app
- Check AndroidManifest.xml after prebuild
- Verify `app.config.js` has expo-camera plugin configured
- Ensure prebuild step ran successfully

### Stream not working in built APK
- Verify backend WebRTC signaling endpoints are accessible
- Check network allows WebRTC traffic (UDP ports)
- Test on real device (not emulator) for best results
