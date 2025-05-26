@echo off
echo ===== Campus Eats Mobile Development Build =====
echo.
echo This script will create a development build that you can install on your device.
echo Unlike the production build, this allows for faster development iterations.
echo.

echo ===== Step 1: Installing EAS CLI =====
call npm install -g eas-cli
echo.

echo ===== Step 2: Login to Expo =====
echo You'll need to login to your Expo account. If you don't have one, create one at https://expo.dev/signup
echo.
call eas login
echo.

echo ===== Step 3: Creating Development Build =====
echo This will create a development build that you can install on your device.
echo.
call eas build --platform android --profile development
echo.

echo ===== Build Process Initiated =====
echo.
echo Once the build is complete, you'll receive a download link for your APK.
echo This development build will allow you to:
echo  - Load your app directly from your development server
echo  - Test changes without rebuilding the entire app
echo  - Use development features like hot reloading
echo.
pause
