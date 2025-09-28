# Android APK Build with GitHub Actions

This document explains how to build standalone Android APK files using GitHub Actions for the Campus Eats mobile application.

## 🚀 Quick Start

1. **Generate Release Keystore** (First time only)
2. **Set up GitHub Secrets**
3. **Push to repository** (APK will build automatically)

## 📱 Building APKs

### Automatic Builds
APKs are built automatically when you:
- Push to `main`, `master`, or `deployment` branches
- Create a pull request targeting these branches
- Manually trigger the workflow from GitHub Actions tab

### Manual Local Build
```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Build debug APK
npm run build:android:debug

# Build release APK (requires keystore setup)
npm run build:android
```

## 🔐 Setting Up Android Signing

### Step 1: Generate Release Keystore

**On Windows:**
```cmd
cd mobile
scripts\generate-keystore.bat
```

**On Linux/Mac:**
```bash
cd mobile
chmod +x scripts/generate-keystore.sh
./scripts/generate-keystore.sh
```

### Step 2: Set Up GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `ANDROID_KEYSTORE_BASE64` | Base64 encoded keystore file | `MIIKXwIBAzCCCh...` |
| `ANDROID_KEY_ALIAS` | Key alias from keystore | `campuseats-release` |
| `ANDROID_STORE_PASSWORD` | Keystore password | `your-store-password` |
| `ANDROID_KEY_PASSWORD` | Key password | `your-key-password` |

**To get the base64 encoded keystore:**

**Windows:**
```cmd
certutil -encode android\app\release_keystore\release.keystore temp.base64
# Copy content between -----BEGIN CERTIFICATE----- and -----END CERTIFICATE-----
```

**Linux/Mac:**
```bash
base64 -w 0 android/app/release_keystore/release.keystore
```

## 🎨 TailwindCSS in Standalone Builds

The project uses **NativeWind** for TailwindCSS support. The build process automatically:

1. ✅ Compiles Tailwind styles using the `global.css` file
2. ✅ Processes styles through NativeWind babel plugin
3. ✅ Includes compiled styles in the final APK

### Tailwind Configuration
- **Config file:** `tailwind.config.js`
- **Global styles:** `global.css`
- **Babel plugin:** `nativewind/babel` (configured in `babel.config.js`)

## 📦 Build Outputs

### Debug Builds
- **Trigger:** Push to non-production branches
- **File:** `app-debug.apk`
- **Signing:** Debug keystore (auto-generated)
- **Retention:** 30 days

### Release Builds
- **Trigger:** Push to `main`, `master`, or `deployment` branches
- **File:** `app-release.apk`
- **Signing:** Release keystore (from GitHub secrets)
- **Retention:** 90 days

## 🛠️ Workflow Features

- ✅ **Automatic dependency caching** for faster builds
- ✅ **Multi-branch support** (debug + release builds)
- ✅ **TailwindCSS compilation** with NativeWind
- ✅ **Artifact uploads** with automatic retention
- ✅ **Release creation** for production builds
- ✅ **Manual trigger** support via GitHub UI

## 📋 Build Process

1. **Checkout code** from repository
2. **Setup Node.js** (v18) with npm caching
3. **Setup Java JDK** (v17) for Android builds
4. **Setup Android SDK** with required tools
5. **Install dependencies** via npm
6. **Create keystores** (debug auto, release from secrets)
7. **Prebuild Expo** project for standalone Android
8. **Compile TailwindCSS** styles
9. **Build APK** using Gradle
10. **Upload artifacts** to GitHub

## 🔧 Troubleshooting

### Build Fails with "Keystore not found"
- Ensure all GitHub secrets are set correctly
- Verify keystore was generated properly
- Check that the base64 encoding is complete

### TailwindCSS styles not working
- Verify `babel.config.js` includes `nativewind/babel` plugin
- Check `tailwind.config.js` content paths include your components
- Ensure `global.css` exists with Tailwind directives

### Gradle build fails
- Check Android SDK versions in workflow
- Verify Java version compatibility (using JDK 17)
- Review Gradle configuration in `android/app/build.gradle`

### APK not installable
- Ensure proper signing configuration
- Check Android permissions in `app.json`
- Verify package name is unique and valid

## 📱 Installing the APK

1. **Download** the APK from GitHub Actions artifacts
2. **Enable** "Install from Unknown Sources" on your Android device
3. **Transfer** APK to your device
4. **Install** by tapping the APK file

## 🔄 Updating the Build

To modify the build process:

1. **Edit** `.github/workflows/build-android-apk.yml`
2. **Update** Android configuration in `android/app/build.gradle`
3. **Modify** app settings in `app.json`
4. **Test** locally before pushing changes

## 📞 Support

If you encounter issues:
1. Check the GitHub Actions logs for detailed error messages
2. Verify all secrets are set correctly
3. Test the build process locally first
4. Review this documentation for common solutions