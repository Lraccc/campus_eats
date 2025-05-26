@echo off
echo ===== Campus Eats Mobile App Build Script =====
echo.
echo This script will help you build your app for physical devices without Expo Go.
echo.
echo 1. Install EAS CLI globally
echo 2. Login to your Expo account
echo 3. Build a preview APK for Android
echo.
echo ===== Step 1: Installing EAS CLI =====
call npm install -g eas-cli
echo.
echo ===== Step 2: Login to Expo =====
echo You'll need to login to your Expo account. If you don't have one, create one at https://expo.dev/signup
echo.
call eas login
echo.
echo ===== Step 3: Building APK for Android =====
echo This will build an APK that you can install directly on your Android device.
echo.
call eas build --platform android --profile preview
echo.
echo ===== Build Process Initiated =====
echo.
echo Once the build is complete, you'll receive a download link for your APK.
echo You can install this APK directly on your Android device without using Expo Go.
echo.
pause
