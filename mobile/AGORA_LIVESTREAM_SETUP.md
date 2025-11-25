# Agora Live Streaming Setup Guide

## Overview
This guide covers the setup and implementation of Agora RTC SDK for live streaming in the Campus Eats mobile app. The live streaming feature allows shop owners to broadcast products to customers in real-time.

---

## Table of Contents
1. [Requirements](#requirements)
2. [Agora Account Setup](#agora-account-setup)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Components](#components)
6. [Building the App](#building-the-app)
7. [Usage](#usage)
8. [Troubleshooting](#troubleshooting)

---

## Requirements

### Software Requirements
- **Expo SDK**: 52.0.0 or higher
- **React Native**: 0.76.9
- **Node.js**: 16.x or higher
- **npm** or **yarn**

### Dependencies
- `react-native-agora`: Agora RTC SDK for React Native
- `expo-camera`: ~14.2.4 (Camera permissions and access)
- `expo-av`: ~15.0.3 (Audio permissions and access)

### Build Requirements
⚠️ **Important**: Agora SDK requires native modules, which means:
- **Cannot run in Expo Go**
- Requires **Development Build** or **GitHub Actions workflow build**
- Uses `expo prebuild` to generate native Android/iOS projects

---

## Agora Account Setup

### 1. Create Agora Account
1. Go to [Agora.io](https://www.agora.io/)
2. Sign up for a free account
3. Navigate to the Console

### 2. Create a Project
1. In Agora Console, click **"Project Management"**
2. Click **"Create"**
3. Enter project name: `campus-eats-live` (or your preferred name)
4. Choose **"Secured mode: APP ID + Token"** for production
   - For development/testing, you can use **"Testing mode: APP ID only"**
5. Click **"Submit"**

### 3. Get Your Credentials
After creating the project, you'll receive:
- **App ID**: `8577fb1c76804e25a69047331f7c526c` (already configured)
- **Primary Certificate**: `6a854a4f51394275b518bf24dcab92ef` (already configured)

> **Note**: These credentials are already configured in `config.ts`. For production, consider storing them in environment variables.

---

## Installation

### 1. Install Dependencies
Already completed! The following packages have been installed:

```bash
npm install react-native-agora expo-camera@~14.2.4 expo-av@~15.0.3
```

### 2. Generate Native Code
Run prebuild to update the Android project with Agora native modules:

```bash
npx expo prebuild --platform android
```

This command:
- Updates the `android/` directory with native code
- Configures Agora SDK in the Android build
- Adds camera and microphone permissions

---

## Configuration

### Agora Configuration (`config.ts`)
The Agora credentials are centralized in `/mobile/config.ts`:

```typescript
export const AGORA_APP_ID = '8577fb1c76804e25a69047331f7c526c';
export const AGORA_APP_CERTIFICATE = '6a854a4f51394275b518bf24dcab92ef';
export const AGORA_TOKEN = null; // Set to null for testing
```

**For Production**:
- Generate tokens server-side using the App Certificate
- Replace `null` with server-generated tokens in the components
- Tokens provide better security and control over channel access

### Permissions (`app.config.js`)
The following permissions are configured:

**Android**:
```javascript
permissions: [
  "CAMERA",
  "RECORD_AUDIO",
  "ACCESS_FINE_LOCATION",
  "ACCESS_COARSE_LOCATION"
]
```

**Expo Plugins**:
```javascript
plugins: [
  ["expo-camera", {
    cameraPermission: "Allow Campus Eats to access your camera for live streaming products."
  }],
  ["expo-av", {
    microphonePermission: "Allow Campus Eats to access your microphone for live streaming products."
  }]
]
```

---

## Components

### 1. LiveStreamBroadcaster.tsx
**Purpose**: Allows shop owners to stream their phone camera to customers.

**Key Features**:
- ✅ Camera access (front/back toggle)
- ✅ Microphone access (mute/unmute)
- ✅ Real-time video broadcasting
- ✅ Viewer count display
- ✅ Connection state management
- ✅ Automatic cleanup on unmount

**Usage**:
```tsx
import LiveStreamBroadcaster from '@/components/LiveStreamBroadcaster';

<LiveStreamBroadcaster 
  shopId="shop123"
  shopName="Best Burgers"
  onEndStream={() => console.log('Stream ended')}
/>
```

**Channel Naming**: `shop_${shopId}` (e.g., `shop_123`)

### 2. LiveStreamViewer.tsx
**Purpose**: Allows customers to watch shop livestreams.

**Key Features**:
- ✅ Join livestream as audience
- ✅ Display remote video stream
- ✅ Audio controls (mute/unmute)
- ✅ Connection state indicators
- ✅ Offline/error state handling
- ✅ Automatic cleanup on unmount

**Usage**:
```tsx
import LiveStreamViewer from '@/components/LiveStreamViewer';

<LiveStreamViewer 
  shopId="shop123"
  shopName="Best Burgers"
  onClose={() => console.log('Viewer closed')}
/>
```

---

## Building the App

### Using GitHub Actions Workflow
Since you're using GitHub Actions for builds:

1. **Commit Changes**:
```bash
git add .
git commit -m "Add Agora live streaming integration"
git push origin agora
```

2. **GitHub Workflow**:
Your workflow likely runs:
```bash
npm install
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

3. **Download APK**:
- Check GitHub Actions tab
- Download the generated APK artifact
- Install on Android device

### Local Build (Optional)
If building locally:

```bash
# Development build
npm run build:android:debug

# Production build
npm run build:android
```

---

## Usage

### For Shop Owners (Broadcaster)

1. **Start Stream**:
   - Open the shop dashboard
   - Navigate to live streaming section
   - Grant camera and microphone permissions (first time only)
   - Tap "Start Livestream"

2. **During Stream**:
   - Toggle between front/back camera
   - Mute/unmute microphone
   - View current viewer count
   - Show products to camera

3. **End Stream**:
   - Tap "End Livestream"
   - Confirm to stop broadcasting

### For Customers (Viewers)

1. **Join Stream**:
   - Navigate to shop page
   - Tap "Watch Live" (when stream is active)
   - Stream loads automatically

2. **During Viewing**:
   - Mute/unmute audio
   - Stream shows "LIVE" indicator
   - Automatic reconnection on network issues

3. **Exit Stream**:
   - Tap "Close" button
   - Returns to shop page

---

## Troubleshooting

### Common Issues

#### 1. **App Crashes on Launch**
**Cause**: Native modules not properly built  
**Solution**:
```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew clean
```

#### 2. **Camera/Microphone Not Working**
**Cause**: Permissions not granted  
**Solution**:
- Check app permissions in Android Settings
- Uninstall and reinstall app
- Grant permissions when prompted

#### 3. **Stream Not Connecting**
**Cause**: Network issues or incorrect channel name  
**Solution**:
- Check internet connection
- Verify `shopId` matches between broadcaster and viewer
- Check Agora Console for active channels

#### 4. **"Failed to Initialize" Error**
**Cause**: Invalid App ID or SDK not properly installed  
**Solution**:
- Verify `AGORA_APP_ID` in `config.ts`
- Run `npx expo prebuild --platform android` again
- Check Agora Console for project status

#### 5. **Video Freezing/Lag**
**Cause**: Poor network connection  
**Solution**:
- Use Wi-Fi instead of mobile data
- Reduce video quality in Agora settings
- Check network bandwidth

#### 6. **Build Errors with Agora**
**Cause**: Version conflicts or missing dependencies  
**Solution**:
```bash
# Clear cache
rm -rf node_modules
npm install

# Clean and rebuild
cd android
./gradlew clean
cd ..
npx expo prebuild --platform android
```

---

## API Integration

### Backend Endpoints Used

#### 1. Start Stream
```
POST /api/streams/start
Body: { shopId: string, channelName: string }
Headers: { Authorization: token }
```

#### 2. End Stream
```
POST /api/streams/{streamId}/end
Headers: { Authorization: token }
```

#### 3. Update Streaming Status
```
POST /api/shops/{shopId}/streaming-status
Body: { isStreaming: boolean }
Headers: { Authorization: token }
```

#### 4. Check Streaming Status
```
GET /api/shops/{shopId}/streaming-status
Headers: { Authorization: token }
```

---

## Advanced Configuration

### Token-Based Authentication (Production)

For production, generate tokens server-side:

1. **Server-Side Token Generation**:
```javascript
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

function generateToken(channelName, uid) {
  const appId = '8577fb1c76804e25a69047331f7c526c';
  const appCertificate = '6a854a4f51394275b518bf24dcab92ef';
  const expirationTimeInSeconds = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER, // or RtcRole.SUBSCRIBER for viewers
    privilegeExpiredTs
  );
}
```

2. **Update Components**:
Replace `null` token with server-generated token in:
- `LiveStreamBroadcaster.tsx` line 192
- `LiveStreamViewer.tsx` line 191

---

## Performance Optimization

### Best Practices
1. **Always cleanup**: Components already handle cleanup on unmount
2. **Network monitoring**: Check connection before starting stream
3. **Error boundaries**: Wrap components in error boundaries
4. **Loading states**: Already implemented for better UX
5. **Memory management**: Engine is destroyed when components unmount

### Recommended Settings
- **Video Profile**: 640x360 (default)
- **Frame Rate**: 15-24 fps
- **Bitrate**: Auto-adjust based on network

---

## Security Considerations

1. **Token Expiration**: Implement server-side token generation with expiration
2. **Channel Access**: Validate shopId on backend before allowing stream access
3. **User Authentication**: Ensure only shop owners can broadcast
4. **Rate Limiting**: Implement limits on stream creation
5. **Content Moderation**: Monitor streams for inappropriate content

---

## Support & Resources

### Official Documentation
- [Agora RTC SDK Docs](https://docs.agora.io/en/)
- [React Native Agora](https://github.com/AgoraIO-Community/react-native-agora)
- [Expo SDK 52 Docs](https://docs.expo.dev/)

### Agora Console
- [Console Dashboard](https://console.agora.io/)
- [Project Usage](https://console.agora.io/usage)
- [Analytics](https://console.agora.io/analytics)

### Free Tier Limits
- **10,000 minutes/month** free
- After that: $0.99 per 1,000 minutes

---

## Next Steps

1. ✅ Components refactored for Agora SDK
2. ✅ Permissions configured
3. ✅ Dependencies installed
4. ⏳ Build APK using GitHub workflow
5. ⏳ Test on physical Android device
6. ⏳ Implement token-based authentication (production)
7. ⏳ Add chat functionality to streams
8. ⏳ Implement pinned products feature

---

## Changelog

### Version 1.0.0 (Current)
- ✅ Migrated from IP camera/RTSP to Agora SDK
- ✅ Implemented LiveStreamBroadcaster component
- ✅ Implemented LiveStreamViewer component
- ✅ Added camera toggle (front/back)
- ✅ Added audio mute controls
- ✅ Configured permissions
- ✅ Added connection state management
- ✅ Implemented proper cleanup

---

**Last Updated**: November 21, 2025  
**Branch**: agora  
**Expo SDK**: 52.0.0
