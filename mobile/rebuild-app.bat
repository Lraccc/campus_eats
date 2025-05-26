@echo off
echo ===== Campus Eats Mobile App Rebuild Script =====
echo.
echo This script will rebuild your app with network fixes to resolve the "Network Request Failed" error.
echo.

echo ===== Step 1: Installing EAS CLI =====
call npm install -g eas-cli
echo.

echo ===== Step 2: Login to Expo =====
echo You'll need to login to your Expo account.
echo.
call eas login
echo.

echo ===== Step 3: Building Fixed APK for Android =====
echo This will build an APK with network fixes that you can install directly on your Android device.
echo.
call eas build --platform android --profile preview --clear-cache
echo.

echo ===== Build Process Initiated =====
echo.
echo Once the build is complete, you'll receive a download link for your APK.
echo You can install this APK directly on your Android device.
echo.
echo The following fixes have been applied:
echo  1. Added network security configuration to allow cleartext traffic
echo  2. Updated API configuration for better environment handling
echo  3. Enhanced axios configuration with better error handling
echo  4. Increased network timeout for slower connections
echo.
pause
