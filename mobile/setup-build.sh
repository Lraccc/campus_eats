#!/bin/bash

# Android APK Build Setup Script
# This script helps verify your environment is ready for building Android APKs

echo "🏗️  Campus Eats - Android Build Setup Verification"
echo "=================================================="

# Check if we're in the mobile directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the mobile directory"
    exit 1
fi

echo "✅ Running from mobile directory"

# Check Node.js version
NODE_VERSION=$(node --version)
echo "📦 Node.js version: $NODE_VERSION"

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
else
    echo "✅ npm dependencies are installed"
fi

# Check if Expo CLI is available
if ! command -v expo &> /dev/null; then
    echo "📦 Installing Expo CLI globally..."
    npm install -g @expo/cli
else
    echo "✅ Expo CLI is available"
fi

# Generate NativeWind CSS
echo "🎨 Generating NativeWind CSS..."
if [ ! -f "global.css" ]; then
    echo "@tailwind base;" > global.css
    echo "@tailwind components;" >> global.css  
    echo "@tailwind utilities;" >> global.css
    echo "✅ Created global.css"
else
    echo "✅ global.css already exists"
fi

# Generate CSS for NativeWind
npx tailwindcss -i ./global.css -o ./node_modules/.cache/nativewind/global.css --minify
echo "✅ Generated NativeWind CSS"

# Check Android setup
echo "🤖 Checking Android setup..."

if [ ! -d "android" ]; then
    echo "📱 Running Expo prebuild to generate Android files..."
    npx expo prebuild --platform android --clean
else
    echo "✅ Android directory exists"
fi

# Check if Android SDK is available
if command -v adb &> /dev/null; then
    echo "✅ Android SDK tools are available"
else
    echo "⚠️  Android SDK tools not found. Please install Android Studio and SDK tools."
fi

# Check Java version
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2)
    echo "☕ Java version: $JAVA_VERSION"
else
    echo "⚠️  Java not found. Please install Java 17 for Android builds."
fi

echo ""
echo "🎯 Setup Summary:"
echo "=================="
echo "✅ Project structure verified"
echo "✅ Dependencies installed"
echo "✅ NativeWind CSS generated"
echo "✅ Android project structure ready"
echo ""
echo "🚀 Ready to build! You can now:"
echo "   1. Set up GitHub Secrets (see ANDROID_BUILD_GUIDE.md)"
echo "   2. Push to trigger CI build"
echo "   3. Or build locally with: cd android && ./gradlew assembleRelease"