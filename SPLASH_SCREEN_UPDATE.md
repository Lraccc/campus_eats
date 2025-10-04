# Splash Screen Update Guide

## What Changed

I've updated your splash screen configuration to match the landing page design:

### 1. **System Splash Screen Configuration**
- **Background Color**: Changed from `#ffffff` to `#f0e6d2` (warm cream)
- **Logo**: Now uses `./assets/images/logo.png` instead of `splash-icon.png`
- **Size**: Reduced to 120px width for better proportions

### 2. **Files Modified**
- `app.json` - Main Expo configuration
- `app.config.js` - Development configuration  
- `app.config.production.js` - Production configuration
- `android/app/src/main/res/values/colors.xml` - Android splash colors

### 3. **New Components Created**
- `components/SplashScreen.tsx` - Reusable animated splash screen component
- Updated `app/_layout.tsx` to show splash during initialization
- Updated `screens/User/LandingPage.tsx` to use the new component

## Current Splash Screen Flow

```
App Launch → System Splash (cream bg + logo) → App Initialization Splash → Landing Page or Home
```

### System Splash (Native)
- **Background**: Warm cream (`#f0e6d2`)
- **Logo**: Static logo image
- **Duration**: ~2-3 seconds (system controlled)

### App Initialization Splash (React Native)
- **Background**: Warm cream (`#f0e6d2`) 
- **Animation**: Spinning logo with circular loading ring
- **Message**: "Initializing your location..."
- **Duration**: Until location permissions are resolved

### Landing Page Splash (if not authenticated)
- **Same design** as initialization splash
- **Message**: "Taking you to login..." or "Loading please wait"
- **Duration**: 2 seconds during transitions

## Next Steps

1. **Rebuild the app** to see the new splash screen
2. **Test the flow**:
   - System splash → Initialization splash → Landing page
   - System splash → Initialization splash → Home (if authenticated)

## Android Native Assets

The Android splash screen will automatically use:
- **Background**: `#f0e6d2` (defined in colors.xml)
- **Icon**: The drawable generated from your logo.png

## Customization Options

You can adjust these values in the configuration files:

### In `app.json`:
```json
{
  "image": "./assets/images/logo.png",
  "imageWidth": 120,
  "backgroundColor": "#f0e6d2"
}
```

### Colors in `android/app/src/main/res/values/colors.xml`:
```xml
<color name="splashscreen_background">#f0e6d2</color>
<color name="colorPrimary">#BC4A4D</color>
```

## Brand Colors Used
- **Primary Red**: `#BC4A4D` 
- **Brown**: `#8B4513`
- **Gold**: `#DAA520`
- **Cream Background**: `#f0e6d2`

The splash screen now provides a consistent, branded experience that matches your app's warm, welcoming design aesthetic!