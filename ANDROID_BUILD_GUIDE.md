# Complete Guide: Building Signed Android APKs with GitHub Actions for React Native + NativeWind

This guide provides a complete, copy-paste ready solution for building signed Android APKs using GitHub Actions with React Native, Expo, and NativeWind.

## Table of Contents
1. [Android Signing Setup](#android-signing-setup)
2. [GitHub Secrets Configuration](#github-secrets-configuration)
3. [NativeWind Build Configuration](#nativewind-build-configuration)
4. [GitHub Actions Workflows](#github-actions-workflows)
5. [Project Configuration](#project-configuration)
6. [Troubleshooting](#troubleshooting)

## Android Signing Setup

### Step 1: Generate Android Signing Keys

First, generate a new keystore file for signing your APK:

```bash
# Navigate to your project root
cd mobile

# Generate keystore (replace values with your information)
keytool -genkeypair -v -storetype PKCS12 -keystore release-key.keystore -alias campus-eats-key -keyalg RSA -keysize 2048 -validity 10000 -storepass YOUR_KEYSTORE_PASSWORD -keypass YOUR_KEY_PASSWORD -dname "CN=Campus Eats, OU=Development, O=Your Organization, L=Your City, ST=Your State, C=US"
```

### Step 2: Convert Keystore to Base64

```bash
# On Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release-key.keystore")) | Out-File -Encoding ASCII keystore-base64.txt

# On macOS/Linux
base64 -i release-key.keystore -o keystore-base64.txt
```

## GitHub Secrets Configuration

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `ANDROID_KEYSTORE` | Base64 encoded keystore file | Content of keystore-base64.txt |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Your keystore password |
| `ANDROID_KEY_ALIAS` | Key alias name | campus-eats-key |
| `ANDROID_KEY_PASSWORD` | Key password | Your key password |
| `ANDROID_PACKAGE_NAME` | App package name | com.campuseats.mobile |

## NativeWind Build Configuration

Your current NativeWind configuration looks good, but let's ensure it's optimized for production builds.

### babel.config.js (Already Configured ✅)
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ["nativewind/babel"],
  };
};
```

### tailwind.config.js (Already Configured ✅)
Your current config is properly set up. For production builds, ensure you have:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./App.{js,jsx,ts,tsx}", 
    "./app/**/*.{js,jsx,ts,tsx}", 
    "./components/**/*.{js,jsx,ts,tsx}", 
    "./screens/**/*.{js,jsx,ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      // Your existing theme configuration
    },
  },
  plugins: [],
}
```

### Metro Configuration (Create if missing)
Create `metro.config.js` in your mobile folder:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

## GitHub Actions Workflows

### Option 1: Expo-Managed Build (Recommended for your project)

Create `.github/workflows/build-android.yml`:

```yaml
name: Build Android APK

on:
  push:
    branches: [ main, deployment ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    name: Build Android APK
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: mobile/package-lock.json

    - name: Setup Java JDK
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '17'

    - name: Setup Android SDK
      uses: android-actions/setup-android@v3

    - name: Install dependencies
      working-directory: mobile
      run: npm ci

    - name: Setup Expo CLI
      run: npm install -g @expo/cli

    - name: Decode Android keystore
      run: |
        echo "${{ secrets.ANDROID_KEYSTORE }}" | base64 --decode > mobile/android/app/release-key.keystore

    - name: Create gradle.properties
      working-directory: mobile
      run: |
        echo "MYAPP_UPLOAD_STORE_FILE=release-key.keystore" >> android/gradle.properties
        echo "MYAPP_UPLOAD_KEY_ALIAS=${{ secrets.ANDROID_KEY_ALIAS }}" >> android/gradle.properties
        echo "MYAPP_UPLOAD_STORE_PASSWORD=${{ secrets.ANDROID_KEYSTORE_PASSWORD }}" >> android/gradle.properties
        echo "MYAPP_UPLOAD_KEY_PASSWORD=${{ secrets.ANDROID_KEY_PASSWORD }}" >> android/gradle.properties

    - name: Generate CSS for NativeWind
      working-directory: mobile
      run: npx tailwindcss -i ./global.css -o ./node_modules/.cache/nativewind/global.css

    - name: Prebuild Expo project
      working-directory: mobile
      run: |
        npx expo prebuild --platform android --clear
        
    - name: Cache Gradle dependencies
      uses: actions/cache@v3
      with:
        path: |
          mobile/android/.gradle
          ~/.gradle/caches
          ~/.gradle/wrapper
        key: gradle-${{ runner.os }}-${{ hashFiles('mobile/android/**/*.gradle*', 'mobile/android/**/gradle-wrapper.properties') }}
        restore-keys: |
          gradle-${{ runner.os }}-

    - name: Make gradlew executable
      working-directory: mobile/android
      run: chmod +x ./gradlew

    - name: Build release APK
      working-directory: mobile/android
      run: ./gradlew assembleRelease

    - name: Verify APK exists
      run: |
        ls -la mobile/android/app/build/outputs/apk/release/
        test -f mobile/android/app/build/outputs/apk/release/app-release.apk

    - name: Upload APK artifact
      uses: actions/upload-artifact@v4
      with:
        name: android-apk-${{ github.sha }}
        path: mobile/android/app/build/outputs/apk/release/app-release.apk
        retention-days: 30

    - name: Create GitHub Release (on tag)
      if: startsWith(github.ref, 'refs/tags/')
      uses: softprops/action-gh-release@v1
      with:
        files: mobile/android/app/build/outputs/apk/release/app-release.apk
        generate_release_notes: true
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Option 2: Bare React Native Build (Alternative)

If you want to use a bare React Native approach, create `.github/workflows/build-android-bare.yml`:

```yaml
name: Build Android APK (Bare RN)

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]
  workflow_dispatch:

jobs:
  build:
    name: Build Android APK
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: mobile/package-lock.json

    - name: Setup Java JDK
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '17'

    - name: Setup Android SDK
      uses: android-actions/setup-android@v3

    - name: Install dependencies
      working-directory: mobile
      run: npm ci

    - name: Decode Android keystore
      run: |
        echo "${{ secrets.ANDROID_KEYSTORE }}" | base64 --decode > mobile/android/app/release-key.keystore

    - name: Build release APK
      working-directory: mobile/android
      run: |
        chmod +x ./gradlew
        ./gradlew assembleRelease \
          -PMYAPP_UPLOAD_STORE_FILE=release-key.keystore \
          -PMYAPP_UPLOAD_KEY_ALIAS=${{ secrets.ANDROID_KEY_ALIAS }} \
          -PMYAPP_UPLOAD_STORE_PASSWORD=${{ secrets.ANDROID_KEYSTORE_PASSWORD }} \
          -PMYAPP_UPLOAD_KEY_PASSWORD=${{ secrets.ANDROID_KEY_PASSWORD }}

    - name: Upload APK artifact
      uses: actions/upload-artifact@v4
      with:
        name: android-apk-bare-${{ github.sha }}
        path: mobile/android/app/build/outputs/apk/release/app-release.apk
```

## Project Configuration

### Update android/app/build.gradle

Add signing configuration to your `android/app/build.gradle` file:

```groovy
android {
    // ... existing configuration

    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
            
            // Important for NativeWind: Prevent CSS class stripping
            buildConfigField "boolean", "IS_NEW_ARCHITECTURE_ENABLED", isNewArchitectureEnabled().toString()
        }
    }

    // ... rest of configuration
}
```

### Create/Update gradle.properties

Add these properties to `mobile/android/gradle.properties`:

```properties
# Existing properties...

# Signing properties (will be overridden by CI)
MYAPP_UPLOAD_STORE_FILE=debug.keystore
MYAPP_UPLOAD_KEY_ALIAS=androiddebugkey
MYAPP_UPLOAD_STORE_PASSWORD=android
MYAPP_UPLOAD_KEY_PASSWORD=android

# NativeWind and Performance
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
org.gradle.parallel=true
org.gradle.configureondemand=true
android.useAndroidX=true
android.enableJetifier=true

# React Native New Architecture
newArchEnabled=true
```

### Create global.css (if missing)

Create `mobile/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Update package.json scripts

Add these build scripts to your `mobile/package.json`:

```json
{
  "scripts": {
    "android": "expo run:android",
    "android:build": "expo run:android --variant release",
    "android:clean": "cd android && ./gradlew clean",
    "prebuild": "expo prebuild --clear",
    "prebuild:android": "expo prebuild --platform android --clear"
  }
}
```

## Verification Steps

### 1. Verify NativeWind Styles in APK

After building, you can verify that NativeWind styles are preserved:

```bash
# Extract APK and check for CSS classes
unzip -q app-release.apk -d extracted_apk/
grep -r "class.*=" extracted_apk/ || echo "No class attributes found"

# Check bundle for Tailwind classes
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android-bundle.js
grep -o "className.*=" android-bundle.js | head -10
```

### 2. Test Build Locally

Before pushing to CI, test the build locally:

```bash
cd mobile

# Clean previous builds
rm -rf android/app/build
npx expo prebuild --platform android --clear

# Generate NativeWind CSS
npx tailwindcss -i ./global.css -o ./node_modules/.cache/nativewind/global.css

# Build APK
cd android
./gradlew assembleRelease
```

### 3. Common NativeWind Issues & Solutions

**Issue: Styles not appearing in production**
```javascript
// Add to metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Ensure CSS is processed
config.transformer.minifierConfig = {
  keep_classnames: true,
  keep_fnames: true,
};

module.exports = withNativeWind(config, { input: './global.css' });
```

**Issue: Build fails with NativeWind**
Add to `babel.config.js`:
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      "nativewind/babel",
      // Add this for production builds
      ["transform-remove-console", { "exclude": ["error", "warn"] }]
    ],
  };
};
```

## Troubleshooting

### Common CI Issues

1. **Gradle Build Fails**
   - Ensure Java 17 is used
   - Check Android SDK versions match
   - Clear Gradle cache: `./gradlew clean`

2. **Keystore Issues**
   - Verify base64 encoding is correct
   - Check secret names match exactly
   - Ensure keystore file permissions

3. **NativeWind Styles Missing**
   - Verify global.css exists
   - Check metro.config.js configuration
   - Ensure tailwind.config.js content paths are correct

4. **Memory Issues**
   - Increase Gradle heap size in gradle.properties
   - Use `--max-old-space-size=4096` for Node.js

### Performance Optimizations

1. **Caching Strategy**
   ```yaml
   - name: Cache Node modules
     uses: actions/cache@v3
     with:
       path: mobile/node_modules
       key: node-${{ runner.os }}-${{ hashFiles('mobile/package-lock.json') }}

   - name: Cache Gradle
     uses: actions/cache@v3
     with:
       path: |
         mobile/android/.gradle
         ~/.gradle/caches
       key: gradle-${{ runner.os }}-${{ hashFiles('**/*.gradle*') }}
   ```

2. **Parallel Builds**
   Add to `gradle.properties`:
   ```properties
   org.gradle.parallel=true
   org.gradle.daemon=true
   org.gradle.configureondemand=true
   ```

This guide provides a complete solution for building signed Android APKs with GitHub Actions while maintaining NativeWind compatibility. The Expo-managed approach (Option 1) is recommended for your current project setup.