# WebRTC Live Streaming - Deployment Guide

## Prerequisites

The live streaming feature uses `react-native-webrtc`, which requires **native modules**. This means:
- ❌ **Does NOT work in Expo Go**
- ✅ **Requires a Development Build or Production Build**

## Building for Production

### Option 1: EAS Build (Recommended for GitHub Workflows)

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Configure your project** (first time only):
   ```bash
   cd mobile
   eas build:configure
   ```

4. **Build for Android**:
   ```bash
   # Development build (for testing)
   eas build --profile development --platform android

   # Production build
   eas build --profile production --platform android
   ```

5. **Build for iOS**:
   ```bash
   # Development build (for testing)
   eas build --profile development --platform ios

   # Production build
   eas build --profile production --platform ios
   ```

### Option 2: GitHub Actions Workflow

Your existing GitHub workflow should be updated to include the prebuild step:

```yaml
- name: Install dependencies
  run: |
    cd mobile
    npm install

- name: Prebuild native modules
  run: |
    cd mobile
    npx expo prebuild --clean

- name: Build Android
  run: |
    cd mobile
    eas build --profile production --platform android --non-interactive
  env:
    EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

## Local Development Build

To test WebRTC locally without Expo Go:

1. **Prebuild the app**:
   ```bash
   cd mobile
   npx expo prebuild
   ```

2. **Run on Android**:
   ```bash
   npx expo run:android
   ```

3. **Run on iOS** (Mac only):
   ```bash
   npx expo run:ios
   ```

## Configuration Files

### app.config.js
- ✅ WebRTC plugin configured: `@config-plugins/react-native-webrtc`
- ✅ Camera & Microphone permissions added for both iOS and Android
- ✅ Required Android permissions: CAMERA, RECORD_AUDIO, INTERNET, MODIFY_AUDIO_SETTINGS

### eas.json
- ✅ Development profile for testing with APK
- ✅ Production profile for release builds
- ✅ Preview profile for internal distribution

## Required Permissions

### Android (AndroidManifest.xml - auto-configured)
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### iOS (Info.plist - auto-configured)
```xml
<key>NSCameraUsageDescription</key>
<string>Allow Campus Eats to access your camera for live streaming.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Allow Campus Eats to access your microphone for live streaming.</string>
```

## Testing the Build

1. **Install the development build** on your device
2. **Shop Owner Side**:
   - Go to Incoming Orders screen
   - Tap "Go Live" button
   - Grant camera/microphone permissions
   - Start streaming

3. **Customer Side**:
   - View the shop page
   - If shop is live, you'll see the stream indicator
   - Tap to view the live stream
   - Video should appear after WebRTC connection establishes

## Troubleshooting

### "WebRTC native module not found"
- You're running in Expo Go. Build a development build instead.
- Run: `npx expo prebuild` then `npx expo run:android` or `npx expo run:ios`

### Build fails
- Ensure `@config-plugins/react-native-webrtc` is in devDependencies
- Run `npm install` to ensure all dependencies are installed
- Clear cache: `npx expo prebuild --clean`

### Camera permission denied
- Check that permissions are requested at runtime
- Verify Info.plist (iOS) and AndroidManifest.xml (Android) have permission descriptions

### No video appears for viewers
- Check backend is running and accessible
- Verify WebRTC signaling endpoints are working
- Check network allows WebRTC traffic (UDP ports)
- Check browser console for WebRTC errors

## Backend Requirements

Ensure your backend is deployed and accessible:
- WebRTC signaling endpoints must be publicly accessible
- CORS configured to allow mobile app domain
- WebSocket connections supported

## GitHub Secrets Required

For automated builds via GitHub Actions:
```
EXPO_TOKEN - Your Expo access token
EAS_PROJECT_ID - Your EAS project ID (from app.config.js)
```

## Next Steps After Deployment

1. Test on real devices (not simulators) for best WebRTC performance
2. Monitor WebRTC connection success rates
3. Consider adding TURN server for better NAT traversal
4. Implement bandwidth optimization for mobile networks
5. Add analytics to track stream viewer counts
