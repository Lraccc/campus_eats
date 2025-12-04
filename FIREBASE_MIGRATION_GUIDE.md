# Firebase Multi-Provider OAuth Migration Guide
## Campus Eats Mobile Application

---

## Table of Contents
1. [Phase 2: Firebase Setup & Configuration](#phase-2-firebase-setup--configuration)
2. [Phase 3: Code Implementation](#phase-3-code-implementation)
3. [Phase 4: Testing & Deployment](#phase-4-testing--deployment)

---

## Phase 2: Firebase Setup & Configuration

### Step 1: Create Firebase Project

1. **Navigate to Firebase Console**
   - Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Sign in with your Google account

2. **Create New Project**
   - Click "Add project"
   - **Project name:** `campus-eats-mobile` (or your preferred name)
   - Click "Continue"
   - **Google Analytics:** Enable (recommended) or disable based on preference
   - Click "Create project"
   - Wait for project creation (~30 seconds)

3. **Add Android App to Firebase**
   - From project overview, click the Android icon
   - **Android package name:** `com.campuseats.app` (must match your `app.config.js`)
   - **App nickname:** Campus Eats Android (optional)
   - **Debug signing certificate SHA-1:** (optional for development, required for production)
   - Click "Register app"
   - Download `google-services.json` (save for later)
   - Click "Next" → "Next" → "Continue to console"

4. **Add iOS App to Firebase** (if supporting iOS)
   - Click "Add app" → iOS icon
   - **iOS bundle ID:** `com.campuseats.app`
   - **App nickname:** Campus Eats iOS (optional)
   - Download `GoogleService-Info.plist` (save for later)
   - Continue through steps

---

### Step 2: Enable Firebase Authentication

1. **Navigate to Authentication**
   - In Firebase Console, click "Authentication" in left sidebar
   - Click "Get started" button

2. **Configure Sign-in Methods**
   - Click "Sign-in method" tab
   - You should see a list of providers

---

### Step 3: Configure Microsoft Provider in Firebase

#### 3.1: Register Firebase in Microsoft Azure

1. **Go to Azure Portal**
   - Navigate to [https://portal.azure.com/](https://portal.azure.com/)
   - Sign in with your Microsoft account
   - Go to "Azure Active Directory" → "App registrations"
   - Find your existing app: `Campus Eats` (Client ID: `6533df52-b33b-4953-be58-6ae5caa69797`)

2. **Add Firebase Redirect URI**
   - Click on your app registration
   - Go to "Authentication" in left sidebar
   - Under "Platform configurations", click "Add a platform" → "Web"
   - **Redirect URIs:** Add the following:
     ```
     https://[YOUR-FIREBASE-PROJECT-ID].firebaseapp.com/__/auth/handler
     ```
     Example: `https://campus-eats-mobile.firebaseapp.com/__/auth/handler`
   
   - **NOTE:** Find your Firebase Project ID in Firebase Console:
     - Go to Project Settings (gear icon) → General tab
     - Copy the "Project ID" value

3. **Get Client Secret**
   - Still in Azure Portal → Your app → "Certificates & secrets"
   - Under "Client secrets", click "New client secret"
   - **Description:** `Firebase Auth Integration`
   - **Expires:** Choose your preference (recommend 24 months for production)
   - Click "Add"
   - **IMPORTANT:** Copy the secret VALUE immediately (it won't be shown again)
   - Save this securely - you'll need it for Firebase configuration

#### 3.2: Configure Microsoft in Firebase Console

1. **Enable Microsoft Provider**
   - In Firebase Console → Authentication → Sign-in method
   - Find "Microsoft" in the list
   - Click on it, then toggle "Enable"

2. **Enter Microsoft Credentials**
   - **Application (client) ID:** `6533df52-b33b-4953-be58-6ae5caa69797`
   - **Application (client) secret:** [Paste the secret you copied from Azure]
   - **Tenant ID (optional):** `823cde44-4433-456d-b801-bdf0ab3d41fc`
     - This restricts to your organization's Azure AD tenant
     - Leave blank for multi-tenant support

3. **Note the OAuth Redirect URI**
   - Firebase will display an OAuth redirect URI like:
     `https://campus-eats-mobile.firebaseapp.com/__/auth/handler`
   - This should match what you added to Azure Portal
   - Click "Save"

---

### Step 4: Configure Google Provider in Firebase

1. **Enable Google Sign-in**
   - In Firebase Console → Authentication → Sign-in method
   - Find "Google" in the list
   - Click on it, then toggle "Enable"

2. **Configure Google Provider**
   - **Project support email:** Enter your support email (e.g., `campuseatsv2@gmail.com`)
   - **NOTE:** Firebase automatically creates OAuth credentials in Google Cloud Console
   - The Client ID and Client Secret are auto-generated and managed by Firebase
   - Click "Save"

3. **Configure OAuth Consent Screen** (First-time setup)
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Select your Firebase project from the dropdown
   - Navigate to "APIs & Services" → "OAuth consent screen"
   - **User Type:** 
     - Choose "Internal" if only for your organization (@youruniversity.edu)
     - Choose "External" if open to all Google accounts
   - Click "Create"

4. **Fill OAuth Consent Screen Details**
   - **App name:** Campus Eats
   - **User support email:** campuseatsv2@gmail.com
   - **App logo:** Upload your app logo (optional)
   - **Application home page:** Your website URL (if any)
   - **Authorized domains:** 
     - Add: `firebaseapp.com`
     - Add your custom domain if you have one
   - **Developer contact information:** campuseatsv2@gmail.com
   - Click "Save and Continue"

5. **Configure Scopes**
   - Click "Add or Remove Scopes"
   - Select:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Click "Update" → "Save and Continue"

6. **Test Users** (if using External + Testing mode)
   - Add test user emails that can sign in during testing
   - Click "Save and Continue"

7. **Publish App** (for production)
   - Once ready for production, go back to OAuth consent screen
   - Click "Publish App" to make it available to all users

---

### Step 5: Configure Authorized Domains

1. **Add Authorized Domains for Firebase Auth**
   - Firebase Console → Authentication → Settings → Authorized domains
   - By default includes:
     - `localhost` (for development)
     - `[project-id].firebaseapp.com`
     - `[project-id].web.app`

2. **Add Your Custom Domain** (if applicable)
   - Click "Add domain"
   - Enter your production domain (e.g., `campuseats.app`)
   - Click "Add"

---

### Step 6: Get Firebase Configuration Files

#### For Android:

1. **Download google-services.json**
   - Firebase Console → Project Settings (gear icon) → General tab
   - Scroll to "Your apps" section
   - Find your Android app
   - Click "google-services.json" download button

2. **File Location**
   - This file will be placed at: `mobile/android/app/google-services.json`
   - We'll do this in Phase 3 implementation

#### For iOS:

1. **Download GoogleService-Info.plist**
   - Same location as above, but click on iOS app
   - Download the `.plist` file
   - Will be placed in iOS project (if supporting iOS)

#### For Web Config (React Native):

1. **Get Firebase Web SDK Config**
   - Firebase Console → Project Settings → General tab
   - Scroll to "Your apps" section
   - Click "Add app" → Web icon (</> symbol)
   - **App nickname:** Campus Eats Web (for RN usage)
   - **Don't** check "Also set up Firebase Hosting"
   - Click "Register app"

2. **Copy Configuration Object**
   - You'll see something like:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
     authDomain: "campus-eats-mobile.firebaseapp.com",
     projectId: "campus-eats-mobile",
     storageBucket: "campus-eats-mobile.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890"
   };
   ```
   - **Save this entire object** - you'll need it in Phase 3

---

### Step 7: Firebase Admin SDK Setup (Backend)

1. **Generate Service Account Key**
   - Firebase Console → Project Settings → Service accounts tab
   - Click "Generate new private key"
   - Click "Generate key" in confirmation dialog
   - A JSON file will download - **KEEP THIS SECURE**
   - Example name: `campus-eats-mobile-firebase-adminsdk-xxxxx.json`

2. **Store Service Account Key Securely**
   - **DO NOT** commit this file to Git
   - For production: Use environment variables or secret management
   - For development: Store outside project directory
   - We'll configure this in backend implementation

---

## Phase 3: Code Implementation

### Step 1: Install Firebase Dependencies

#### Mobile App (React Native):

```bash
cd mobile

# Install Firebase packages
npm install firebase
npm install @react-native-firebase/app
npm install @react-native-firebase/auth

# Install Google Sign-In (already in package.json but verify)
npm install @react-native-google-signin/google-signin

# Rebuild native modules
expo prebuild --clean
```

**Update `package.json`** (verify these versions):
```json
{
  "dependencies": {
    "firebase": "^10.7.1",
    "@react-native-firebase/app": "^18.7.0",
    "@react-native-firebase/auth": "^18.7.0",
    "@react-native-google-signin/google-signin": "^14.0.1"
  }
}
```

---

### Step 2: Configure Firebase in Mobile App

#### Create `mobile/firebaseConfig.ts`:

This file will be created in the implementation phase with your specific Firebase configuration.

---

### Step 3: Create New Firebase Auth Service

We'll create `mobile/services/firebaseAuthService.ts` that:
- Initializes Firebase
- Handles Microsoft sign-in via Firebase
- Handles Google sign-in via Firebase
- Syncs with backend
- Manages tokens

---

### Step 4: Update Login Form

Modify `mobile/screens/auth/LoginForm.tsx`:
- Add Google sign-in button
- Update Microsoft button to use Firebase
- Handle both providers
- Maintain existing UI/UX

---

### Step 5: Backend Integration

#### Install Firebase Admin SDK (Java/Spring Boot):

Add to `backend/campuseats/pom.xml`:
```xml
<dependency>
    <groupId>com.google.firebase</groupId>
    <artifactId>firebase-admin</artifactId>
    <version>9.2.0</version>
</dependency>
```

Create new services:
- `FirebaseAuthService.java` - Validates Firebase ID tokens
- Update `SecurityConfig.java` - Add Firebase token filter
- Update `UserController.java` - Add Firebase authentication endpoint

---

## Migration Strategy

### Option 1: Gradual Migration (Recommended)

**Advantages:**
- Zero downtime
- Easy rollback
- Users can continue using existing auth

**Steps:**
1. Deploy Firebase auth alongside existing Azure auth
2. Both systems active for 2-4 weeks
3. Monitor Firebase auth usage and errors
4. Gradually migrate users by encouraging Firebase sign-in
5. After migration period, deprecate Azure auth

**Implementation:**
- Keep existing `authService.ts` for Azure
- Add new `firebaseAuthService.ts`
- LoginForm supports both
- Backend accepts both Azure and Firebase tokens

### Option 2: Hard Cutover (Faster but riskier)

**Advantages:**
- Clean implementation
- Faster completion

**Disadvantages:**
- All users must re-authenticate
- Potential for issues

**Steps:**
1. Replace Azure auth completely with Firebase
2. Clear all existing tokens
3. Force all users to re-login

---

## Phase 4: Testing & Deployment

### Testing Checklist

#### Firebase Configuration Tests:
- [ ] Firebase project created successfully
- [ ] Microsoft provider enabled and configured
- [ ] Google provider enabled and configured
- [ ] OAuth redirect URIs configured in Azure Portal
- [ ] Authorized domains configured in Firebase
- [ ] Service account key downloaded for backend

#### Mobile App Tests:
- [ ] Firebase SDK initialized without errors
- [ ] Microsoft sign-in opens correct browser flow
- [ ] Microsoft sign-in completes and returns to app
- [ ] Google sign-in opens correct flow
- [ ] Google sign-in completes successfully
- [ ] Firebase ID token received after authentication
- [ ] Token syncs with backend successfully
- [ ] Backend returns valid JWT for API calls
- [ ] User session persists after app restart
- [ ] Sign-out clears all Firebase and app tokens

#### Backend Tests:
- [ ] Firebase Admin SDK initialized
- [ ] Firebase token validation works
- [ ] User auto-creation from Firebase tokens
- [ ] Existing user linking by email
- [ ] Banned user check during OAuth
- [ ] `/me` endpoint works with Firebase tokens
- [ ] All protected endpoints accept Firebase-derived JWTs

#### Edge Cases:
- [ ] Network failure during OAuth flow
- [ ] User cancels authentication
- [ ] User with existing account signs in via OAuth
- [ ] New user signs in via OAuth
- [ ] Banned user attempts OAuth login
- [ ] Expired Firebase token handling
- [ ] Token refresh logic

---

### Deployment Instructions

#### Development Environment:

1. **Mobile App:**
   ```bash
   cd mobile
   npm install
   expo start
   # For Android: expo run:android
   # For iOS: expo run:ios
   ```

2. **Backend:**
   ```bash
   cd backend/campuseats
   # Set environment variable for Firebase service account
   export FIREBASE_SERVICE_ACCOUNT_PATH="/path/to/service-account.json"
   ./mvnw spring-boot:run
   ```

#### Production Build:

1. **Environment Variables:**
   - Store Firebase config in GitHub Secrets
   - Update GitHub Actions workflow
   - Configure service account key securely

2. **Mobile App Build:**
   ```bash
   cd mobile
   
   # Android production build
   npm run build:android
   
   # iOS production build (if applicable)
   eas build --platform ios
   ```

3. **Backend Deployment:**
   - Ensure Firebase service account is configured
   - Deploy to your hosting platform
   - Verify `/api/users/firebase-authenticate` endpoint

---

### Security Best Practices

1. **Never commit sensitive keys:**
   - Firebase service account JSON
   - Client secrets
   - API keys (use environment variables)

2. **Token Security:**
   - Firebase tokens expire automatically
   - Validate tokens on every backend request
   - Use HTTPS for all API calls

3. **User Data:**
   - Continue validating banned users
   - Maintain email verification for non-OAuth users
   - Log all OAuth authentication attempts

4. **CORS Configuration:**
   - Update allowed origins for Firebase domains
   - Restrict to your production domains only

---

### Rollback Plan

If issues arise with Firebase auth:

1. **Immediate Rollback:**
   - Revert mobile app to previous version
   - Disable Firebase endpoints on backend
   - Users automatically fall back to Azure auth

2. **Data Integrity:**
   - User accounts created during Firebase period remain valid
   - They can continue using traditional username/password
   - Or re-authenticate with Azure OAuth

3. **Communication:**
   - Notify users of temporary authentication issues
   - Provide alternative login methods
   - Set timeline for resolution

---

## Next Steps

Once you're ready to proceed with implementation, I will:

1. Create the Firebase configuration file with your credentials
2. Implement the new `firebaseAuthService.ts`
3. Update `LoginForm.tsx` with both provider buttons
4. Create backend Firebase authentication components
5. Update security configuration
6. Provide testing scripts

**Please confirm you want to proceed, and I'll begin Phase 3 implementation.**

---

## Appendix: Useful Commands

### Firebase CLI (Optional but helpful):

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# List your Firebase projects
firebase projects:list

# Deploy Firebase configuration (if using Hosting)
firebase deploy
```

### Debugging:

```bash
# Check Firebase Auth status
firebase auth:export users.json --format=JSON

# View Firebase logs
firebase functions:log
```

---

**Document Version:** 1.0  
**Last Updated:** December 4, 2024  
**Author:** GitHub Copilot  
**Project:** Campus Eats Mobile - Firebase Migration
