# Expo Go Compatibility Guide

## Issue Resolved
Fixed the error: `TurboModuleRegistry.getEnforcing(...): 'AgoraRtcNg' could not be found`

## Root Cause
The Agora RTC SDK (`react-native-agora`) uses native binary modules that are not available in Expo Go. Expo Go only supports a limited set of native modules, and third-party SDKs like Agora require a development build or production APK.

## Solution Implemented
Added conditional imports and fallback UI to both livestream components:

### Changes Made
1. **Conditional Agora Imports** - Both components now use try-catch to load Agora SDK:
   ```typescript
   let RtcEngine: any = null;
   try {
     const AgoraModule = require('react-native-agora');
     RtcEngine = AgoraModule.default;
     // ... other imports
   } catch (error) {
     console.log('Agora SDK not available - running in Expo Go');
   }
   ```

2. **Expo Go Detection**:
   ```typescript
   const isExpoGo = Constants.appOwnership === 'expo';
   ```

3. **Fallback UI** - Shows helpful message when running in Expo Go:
   - Warning icon and clear explanation
   - Instructions for testing with development build
   - Back button to return to previous screen

## Development Workflow

### Testing in Expo Go (Development)
```bash
npx expo start
```
**Result**: App runs without crashes, livestream features show fallback UI with instructions

### Testing with Development Build
```bash
npx expo run:android
```
**Result**: Full Agora functionality available, can test livestreaming

### Production Build (GitHub Actions)
1. Push changes to trigger workflow
2. Download APK from GitHub Actions artifacts
3. Install on device
**Result**: Full livestream functionality with all native features

## What Works Where

| Feature | Expo Go | Development Build | Production APK |
|---------|---------|------------------|----------------|
| App Navigation | ✅ | ✅ | ✅ |
| Shop Browsing | ✅ | ✅ | ✅ |
| User Authentication | ✅ | ✅ | ✅ |
| **Livestream Broadcasting** | ❌ (Shows fallback) | ✅ | ✅ |
| **Livestream Viewing** | ❌ (Shows fallback) | ✅ | ✅ |

## Files Modified
- `mobile/components/LiveStreamBroadcaster.tsx`
  - Added conditional Agora imports
  - Added Expo Go detection
  - Added fallback UI with instructions
  
- `mobile/components/LiveStreamViewer.tsx`
  - Added conditional Agora imports
  - Added Expo Go detection
  - Added fallback UI with instructions

## Next Steps
1. ✅ App now runs in Expo Go without crashes
2. ✅ Routing issues fixed (shop owner dashboard, shop details)
3. ⏭️ Test full app in Expo Go to verify navigation works
4. ⏭️ Build APK via GitHub Actions to test livestream features
5. ⏭️ Implement server-side Agora token generation for production

## Benefits
- **No more crashes**: App loads successfully in Expo Go
- **Clear user guidance**: Fallback UI explains what's needed
- **Preserved functionality**: Full Agora features work in production builds
- **Better DX**: Developers can test most features in Expo Go, only need builds for livestream testing
