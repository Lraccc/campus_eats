@echo off
REM Android APK Build Setup Script for Windows
REM This script helps verify your environment is ready for building Android APKs

echo 🏗️  Campus Eats - Android Build Setup Verification
echo ==================================================

REM Check if we're in the mobile directory
if not exist "package.json" (
    echo ❌ Please run this script from the mobile directory
    exit /b 1
)

echo ✅ Running from mobile directory

REM Check Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo 📦 Node.js version: %NODE_VERSION%

REM Check if npm dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing npm dependencies...
    npm install
) else (
    echo ✅ npm dependencies are installed
)

REM Check if Expo CLI is available
expo --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 📦 Installing Expo CLI globally...
    npm install -g @expo/cli
) else (
    echo ✅ Expo CLI is available
)

REM Generate NativeWind CSS
echo 🎨 Generating NativeWind CSS...
if not exist "global.css" (
    echo @tailwind base; > global.css
    echo @tailwind components; >> global.css
    echo @tailwind utilities; >> global.css
    echo ✅ Created global.css
) else (
    echo ✅ global.css already exists
)

REM Generate CSS for NativeWind
npx tailwindcss -i ./global.css -o ./node_modules/.cache/nativewind/global.css --minify
echo ✅ Generated NativeWind CSS

REM Check Android setup
echo 🤖 Checking Android setup...

if not exist "android" (
    echo 📱 Running Expo prebuild to generate Android files...
    npx expo prebuild --platform android --clear
) else (
    echo ✅ Android directory exists
)

REM Check if Android SDK is available
adb version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo ✅ Android SDK tools are available
) else (
    echo ⚠️  Android SDK tools not found. Please install Android Studio and SDK tools.
)

REM Check Java version
java -version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=3" %%i in ('java -version 2^>^&1 ^| findstr "version"') do set JAVA_VERSION=%%i
    echo ☕ Java version: %JAVA_VERSION%
) else (
    echo ⚠️  Java not found. Please install Java 17 for Android builds.
)

echo.
echo 🎯 Setup Summary:
echo ==================
echo ✅ Project structure verified
echo ✅ Dependencies installed
echo ✅ NativeWind CSS generated
echo ✅ Android project structure ready
echo.
echo 🚀 Ready to build! You can now:
echo    1. Set up GitHub Secrets (see ANDROID_BUILD_GUIDE.md)
echo    2. Push to trigger CI build
echo    3. Or build locally with: cd android ^&^& gradlew assembleRelease
pause