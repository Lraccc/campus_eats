# Firebase OAuth Integration - Setup Instructions
## Campus Eats Mobile Application

This document provides step-by-step instructions to complete the Firebase OAuth integration with Facebook and Google sign-in.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Firebase Configuration](#firebase-configuration)
3. [Mobile App Setup](#mobile-app-setup)
4. [Backend Setup](#backend-setup)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- ✅ Firebase project created ([Follow Phase 2 in FIREBASE_MIGRATION_GUIDE.md](./FIREBASE_MIGRATION_GUIDE.md#phase-2-firebase-setup--configuration))
- ✅ Facebook and Google providers configured in Firebase Console
- ✅ Meta (Facebook) Developer account and app created
- ✅ Firebase service account JSON file downloaded
- ✅ Node.js and npm installed
- ✅ Java 17+ and Maven installed
- ✅ Android Studio (for Android development)

---

## Firebase Configuration

### Step 1: Update Firebase Config in Mobile App

1. **Open `mobile/firebaseConfig.ts`**

2. **Replace placeholder values** with your actual Firebase configuration:

   ```typescript
   const firebaseConfig = {
     apiKey: "YOUR_ACTUAL_API_KEY",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID",
   };
   ```

   **Where to find these values:**
   - Firebase Console → Project Settings → General tab
   - Scroll to "Your apps" section
   - Click on your Web app (the one you created)
   - Copy all values from the config object shown

### Step 2: Update Google Sign-In Web Client ID

1. **Get your Firebase Web Client ID:**
   - Firebase Console → Authentication → Sign-in method → Google
   - Or go to Google Cloud Console → APIs & Services → Credentials
   - Find "Web client (auto created by Google Service)" or similar
   - Copy the Client ID

2. **Open `mobile/services/firebaseAuthService.ts`**

3. **Find line 41** and replace:
   ```typescript
   GoogleSignin.configure({
     webClientId: 'YOUR_ACTUAL_FIREBASE_WEB_CLIENT_ID', // Replace this
     offlineAccess: true,
   });
   ```

### Step 3: Add google-services.json (Android)

1. **Download `google-services.json`:**
   - Firebase Console → Project Settings → General
   - Under "Your apps", find your Android app
   - Click "google-services.json" download button

2. **Place the file:**
   ```
   campus_eats/
   └── mobile/
       └── android/
           └── app/
               └── google-services.json  ← Place file here
   ```

3. **Verify path** (important for Expo):
   - If using Expo managed workflow, you may need to run `expo prebuild` first
   - The file should be in `android/app/` directory

---

## Mobile App Setup

### Step 1: Install Dependencies

```bash
cd mobile

# Install npm packages
npm install

# This will install:
# - firebase (for auth)
# - @react-native-google-signin/google-signin (already in package.json)
```

### Step 2: Configure app.config.js for Firebase

**Open `mobile/app.config.js`** and update the `extra` section:

```javascript
extra: {
  production: process.env.NODE_ENV === 'production',
  apiUrl: process.env.API_URL_PRODUCTION,
  redirectUri: process.env.REDIRECT_URI_PRODUCTION || 'campuseats://auth',
  
  // Add Firebase configuration
  firebaseApiKey: process.env.FIREBASE_API_KEY,
  firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  firebaseAppId: process.env.FIREBASE_APP_ID,
  
  eas: {
    projectId: process.env.EAS_PROJECT_ID || ''
  }
}
```

### Step 3: Prebuild Native Modules

```bash
# Clean and rebuild native modules
expo prebuild --clean

# This generates the android and ios folders with native code
```

### Step 4: Switch to Firebase Login Form (Optional - Gradual Migration)

**Option A: Replace existing login (clean cutover)**
1. Rename `mobile/screens/auth/LoginForm.tsx` to `LoginForm.old.tsx`
2. Rename `mobile/screens/auth/LoginFormFirebase.tsx` to `LoginForm.tsx`

**Option B: Keep both (gradual migration)**
1. Update your router to use `LoginFormFirebase` instead
2. Keep old login as fallback
3. Monitor usage for 2-4 weeks before removing old implementation

### Step 5: Run the App

```bash
# Start Expo development server
expo start

# Run on Android
expo run:android

# Run on iOS (if configured)
expo run:ios
```

---

## Backend Setup

### Step 1: Add Service Account Configuration

1. **Place Firebase service account JSON file** in a secure location:
   ```
   # Option 1: Inside project (NOT recommended for production)
   backend/campuseats/firebase-service-account.json

   # Option 2: Outside project (recommended)
   /secure/path/firebase-service-account.json
   ```

2. **Update `backend/campuseats/src/main/resources/application.properties`:**

   ```properties
   # Firebase Configuration
   firebase.service-account.path=/path/to/your/firebase-service-account.json
   ```

   **OR use environment variable (recommended for production):**
   ```bash
   export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/firebase-service-account.json
   ```

### Step 2: Add Firebase to .gitignore

**CRITICAL: Never commit service account file!**

Add to `backend/campuseats/.gitignore`:
```
firebase-service-account.json
firebase-adminsdk*.json
```

### Step 3: Install Maven Dependencies

```bash
cd backend/campuseats

# Clean and install dependencies (this will download Firebase Admin SDK)
./mvnw clean install

# Or on Windows:
.\mvnw.cmd clean install
```

### Step 4: Run the Backend

```bash
# Run Spring Boot application
./mvnw spring-boot:run

# Or on Windows:
.\mvnw.cmd spring-boot:run
```

**Verify Firebase initialization** in console output:
```
🔥 Initializing Firebase Admin SDK...
✅ Firebase Admin SDK initialized successfully
```

If you see warnings about missing service account, check your configuration.

---

## Testing

### Test Checklist

#### Mobile App Tests:

1. **Traditional Login (should still work):**
   - [ ] Login with username/password
   - [ ] Remember me functionality
   - [ ] Forgot password flow
   - [ ] Sign up flow

2. **Microsoft OAuth (Firebase):**
   - [ ] Click Microsoft button
   - [ ] Redirected to Microsoft login
   - [ ] Successfully authenticate
   - [ ] Return to app with user logged in
   - [ ] User data saved in backend
   - [ ] Subsequent launches maintain login state

3. **Google OAuth (Firebase):**
   - [ ] Click Google button
   - [ ] Google account picker appears
   - [ ] Successfully authenticate
   - [ ] Return to app with user logged in
   - [ ] User data saved in backend

4. **Error Cases:**
   - [ ] Network failure during OAuth
   - [ ] User cancels authentication
   - [ ] Banned user attempts login (should show ban message)
   - [ ] Sign out and sign in again

#### Backend Tests:

1. **Firebase Endpoint:**
   ```bash
   # Test with curl (replace TOKEN with actual Firebase ID token)
   curl -X POST http://localhost:8080/api/users/firebase-authenticate \
     -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"
   ```

   Expected response:
   ```json
   {
     "user": { ...user data... },
     "token": "jwt.token.here"
   }
   ```

2. **Database Verification:**
   - Check MongoDB for new users with `firebaseUid` field
   - Verify provider is set to "google" or "microsoft"
   - Confirm users are marked as verified

---

## Troubleshooting

### Mobile App Issues

#### Issue: "Firebase not initialized"
**Solution:**
- Verify `firebaseConfig.ts` has correct values
- Check that Firebase project exists
- Run `expo prebuild --clean`

#### Issue: "Google Sign-In failed"
**Solution:**
- Ensure `google-services.json` is in `android/app/`
- Verify Web Client ID in `firebaseAuthService.ts`
- Check SHA-1 fingerprint is added to Firebase (production builds)

#### Issue: Microsoft login redirects but doesn't complete
**Solution:**
- Verify redirect URI in Azure Portal matches: `campuseats://auth`
- Check app scheme in `app.config.js`
- Clear app data and try again

#### Issue: "Backend sync failed"
**Solution:**
- Verify backend is running
- Check API_URL in `config.ts` points to correct backend
- Check network connectivity
- View backend logs for errors

### Backend Issues

#### Issue: "Firebase Admin SDK not initialized"
**Solution:**
- Verify service account path in `application.properties`
- Check file exists and is readable
- Ensure JSON file is valid (not corrupted)

#### Issue: "Invalid Firebase token"
**Solution:**
- Token may be expired (Firebase tokens expire after 1 hour)
- Ensure you're sending the ID token, not access token
- Check clock sync on server

#### Issue: "User banned" error but user is not banned
**Solution:**
- Check database for user's `offenses` field (3+ offenses = auto-ban)
- Verify `isBanned` field is false
- Check backend logs for ban logic

### Common Errors

**Error:** `NETWORK_REQUEST_FAILED`
- Backend is not running or not accessible
- Check firewall settings
- Verify API URL

**Error:** `INVALID_CREDENTIAL`
- Google Sign-In configuration issue
- Wrong Web Client ID
- Missing google-services.json

**Error:** `TOKEN_EXPIRED`
- Firebase token expired (1 hour lifetime)
- Sign out and sign in again
- Backend should handle refresh automatically

---

## Production Deployment

### Environment Variables for Production

**GitHub Secrets (for CI/CD):**
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef
```

**Backend Environment Variables:**
```bash
FIREBASE_SERVICE_ACCOUNT_PATH=/secure/path/firebase-service-account.json
```

### Security Checklist

- [ ] Service account JSON file is NOT in Git repository
- [ ] Firebase config uses environment variables in production
- [ ] OAuth redirect URIs are restricted to your domain
- [ ] CORS is configured correctly
- [ ] Firebase security rules are configured
- [ ] SSL/TLS enabled on backend

---

## Migration from Azure to Firebase

If you want to completely migrate from direct Azure OAuth to Firebase:

1. **Deploy Firebase auth alongside Azure (both active)**
2. **Monitor for 2-4 weeks** - watch for errors
3. **Gradually deprecate Azure auth:**
   - Remove Azure sign-in button from UI
   - Keep Azure backend endpoint active for existing tokens
4. **After 4 weeks, remove Azure code:**
   - Remove `AzureAuthService.java`
   - Remove `/api/users/azure-authenticate` endpoint
   - Remove Azure dependencies from `pom.xml`

---

## Additional Resources

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK for Java](https://firebase.google.com/docs/admin/setup)
- [Expo Google Sign-In](https://docs.expo.dev/guides/google-authentication/)
- [Microsoft Identity Platform](https://learn.microsoft.com/en-us/azure/active-directory/develop/)

---

## Support

If you encounter issues not covered in this guide:

1. Check Firebase Console → Authentication → Users (verify OAuth logins)
2. Check backend logs for detailed error messages
3. Check mobile app logs in Expo developer tools
4. Review [FIREBASE_MIGRATION_GUIDE.md](./FIREBASE_MIGRATION_GUIDE.md) for additional context

---

**Document Version:** 1.0  
**Last Updated:** December 4, 2024  
**Project:** Campus Eats Mobile - Firebase OAuth Integration
