# Mobile App Deployment Guide

## Option 1: Expo Application Services (EAS) - Recommended
EAS Build is Expo's cloud build service that's perfect for React Native apps.

### Setup Steps:
1. Install EAS CLI globally:
   ```bash
   npm install -g @expo/eas-cli
   ```

2. Login to your Expo account:
   ```bash
   eas login
   ```

3. Configure your project:
   ```bash
   eas build:configure
   ```

4. Build for different platforms:
   ```bash
   # For Android APK (development)
   eas build --platform android --profile development
   
   # For Android AAB (production)
   eas build --platform android --profile production
   
   # For iOS (requires Apple Developer account)
   eas build --platform ios --profile production
   ```

5. Submit to app stores:
   ```bash
   # Submit to Google Play Store
   eas submit --platform android
   
   # Submit to Apple App Store
   eas submit --platform ios
   ```

## Option 2: Expo Go (Development/Testing)
For quick testing and sharing with team members:

1. Publish your app:
   ```bash
   expo publish
   ```

2. Users can access via Expo Go app by scanning QR code

## Option 3: Web Version (if supported)
Your mobile app can also run on the web:

1. Start web version locally:
   ```bash
   npm run web
   ```

2. Build for web deployment:
   ```bash
   expo build:web
   ```

## Environment Configuration
Create environment-specific configurations in your mobile app.

## Recommended Approach:
1. Use EAS Build for production builds
2. Deploy web version on Netlify/Vercel for web access
3. Use Expo Go for development testing
4. Submit to app stores for full mobile distribution

## Cost Considerations:
- EAS Build: Free tier available (limited builds per month)
- App Store submission: $99/year (iOS), $25 one-time (Android)
- Expo Go: Free for development testing