# Campus Eats Mobile App Deployment Guide

This guide provides instructions for deploying your Campus Eats mobile app to physical devices without using Expo Go.

## Option 1: Build a Standalone APK (Production)

Use this option when you want to create a production-ready APK that can be installed on any Android device.

1. Run the `build-app.bat` script:
   ```
   ./build-app.bat
   ```

2. Follow the prompts to:
   - Create an Expo account if you don't have one
   - Log in to your account
   - Start the build process

3. Once the build is complete (this may take several minutes), you'll receive a download link for your APK.
   - Download the APK
   - Transfer it to your Android device
   - Install it directly (you may need to enable "Install from Unknown Sources" in your device settings)

## Option 2: Create a Development Build

Use this option during development when you want to test on a physical device but still need development features like hot reloading.

1. Run the `create-dev-build.bat` script:
   ```
   ./create-dev-build.bat
   ```

2. Follow the same login process as Option 1.

3. Install the resulting APK on your device.

4. The development build will connect to your development server, allowing you to:
   - Load your app directly from your development server
   - Test changes without rebuilding the entire app
   - Use development features like hot reloading

## Option 3: Set Up Over-the-Air Updates

After you've deployed your app using Option 1 or 2, you can set up over-the-air updates to push changes without requiring users to download a new version.

1. Run the `setup-expo-updates.bat` script:
   ```
   ./setup-expo-updates.bat
   ```

2. After making changes to your app, publish an update:
   ```
   npx expo publish
   ```

3. Users with the installed app will automatically receive the update the next time they open the app.

## Manual Configuration

If you prefer to manually configure your deployment, here are the key steps:

### 1. Configure EAS Build

Create or modify `eas.json` with the following configurations:

```json
{
  "cli": {
    "version": ">= 5.9.1"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 2. Update app.json

Ensure your `app.json` includes the necessary configurations:

```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "enabled": true,
      "fallbackToCacheTimeout": 0
    },
    "android": {
      "package": "com.campuseats.app"
    }
  }
}
```

### 3. Build Commands

- For development builds: `eas build --platform android --profile development`
- For preview builds: `eas build --platform android --profile preview`
- For production builds: `eas build --platform android --profile production`

## Troubleshooting

### Common Issues

1. **Build fails with SDK location not found**
   - This is usually due to missing Android SDK configuration
   - Solution: Use EAS Build which handles this for you

2. **PowerShell execution policy issues**
   - If you encounter "running scripts is disabled on this system"
   - Solution: Run PowerShell as administrator and execute:
     ```
     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
     ```

3. **APK installation fails**
   - Ensure "Install from Unknown Sources" is enabled on your device
   - Check that the APK is compatible with your device architecture

### Getting Help

If you encounter issues not covered in this guide:

1. Check the Expo documentation: https://docs.expo.dev/
2. Visit the Expo forums: https://forums.expo.dev/
3. Search for solutions on Stack Overflow with the tags `react-native` and `expo`
