# Production Microsoft Authentication Troubleshooting

## Issue: Users Getting Stuck on Microsoft Consent Screen

### Problem Description
Users see the Microsoft consent screen asking "Are you trying to sign in to CampusEats2.0?" but get stuck there after clicking "Continue" or "Cancel". The browser doesn't redirect back to the app.

### Root Cause
This is a **deep link handling issue**. After the user consents (or cancels), Microsoft tries to redirect to `campuseats://auth`, but the app is not properly handling this deep link redirect.

### Solution Implemented

#### 1. Added Deep Link Handling
**File**: `app/_layout.tsx`
- Added `expo-linking` import and deep link event listeners
- Added logging to track when deep links are received
- Handles both app launch and runtime deep link scenarios

```typescript
// Handle deep links for authentication
useEffect(() => {
  const handleDeepLink = (url: string) => {
    console.log('🔗 Deep link received:', url);
    
    if (url.startsWith('campuseats://auth')) {
      console.log('🔐 Authentication deep link detected');
    }
  };

  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url);
  });

  Linking.getInitialURL().then((url) => {
    if (url) {
      handleDeepLink(url);
    }
  });

  return () => {
    subscription.remove();
  };
}, []);
```

#### 2. Enhanced Authentication Service
**File**: `services/authService.ts`
- Improved WebBrowser session completion
- Added better error handling and user feedback
- Enhanced logging for debugging redirect issues

#### 3. Added Debug Tools
**File**: `screens/DebugPanel.tsx`
- Added deep link testing functionality
- Can test if `campuseats://auth` scheme works
- Provides debugging information for authentication flow

### Testing the Fix

#### 1. Test Deep Link Handling
1. Open the app and go to **Debug Panel** (from the app menu)
2. Tap **"🔗 Test Deep Link"**
3. Tap **"Test"** to check if `campuseats://auth` works
4. Verify the app can handle its own deep link scheme

#### 2. Test Microsoft Authentication
1. Try Microsoft login in production
2. Check logs for these messages:
   ```
   🔗 Deep link received: campuseats://auth...
   🔐 Authentication deep link detected
   📱 Launching authentication browser...
   ✅ Authentication completed successfully
   ```

#### 3. Monitor Console Logs
Look for these success indicators:
- `Using redirect URI for auth: campuseats://auth`
- `OAuth prompt completed with result type: success`
- `📥 Exchanging authorization code for token`

### Common Issues & Solutions

#### Issue: Deep link test fails
**Solution**: 
- Verify `app.json` has correct intent filters
- Check if app scheme `campuseats` is properly registered
- Rebuild the app with latest configuration

#### Issue: Browser doesn't redirect back to app
**Solution**:
- Ensure Azure AD has exactly `campuseats://auth` as redirect URI
- Check Android intent filters in `app.json`
- Verify app is properly installed (not just development build)

#### Issue: User still gets stuck on consent screen
**Solution**:
- Clear browser cache and app data
- Test with a different Microsoft account
- Check Azure AD app permissions and consent settings

#### Issue: Authentication works but user data not saved
**Solution**:
- Check backend `/api/users/azure-authenticate` endpoint
- Verify token exchange is working
- Check AsyncStorage for saved tokens

### Current Configuration

**App Configuration**:
- **App Name**: Campus Eats
- **Scheme**: `campuseats`
- **Package**: `com.campuseats.mobile`
- **Redirect URI**: `campuseats://auth`

**Azure AD Configuration**:
- **Client ID**: `6533df52-b33b-4953-be58-6ae5caa69797`
- **Tenant ID**: `823cde44-4433-456d-b801-bdf0ab3d41fc`
- **Required Redirect URI**: `campuseats://auth`

**Backend Environment Variables** (on Render.com):
- `MOBILE_REDIRECT_URI=campuseats://auth`

### Verification Steps

1. **Azure AD Setup**:
   - ✅ Redirect URI `campuseats://auth` is configured
   - ✅ App name matches "Campus Eats" (not "CampusEats2.0")
   - ✅ "Allow public client flows" is enabled

2. **App Configuration**:
   - ✅ Deep link handling is implemented
   - ✅ Intent filters are configured for Android
   - ✅ WebBrowser session completion is properly handled

3. **Backend Configuration**:
   - ✅ Environment variable `MOBILE_REDIRECT_URI` is set
   - ✅ Authentication endpoint handles Microsoft tokens

### If Issues Persist

1. **Check Azure AD Logs**: Go to Azure AD → Sign-in logs to see detailed error information
2. **Test with Different Account**: Try authentication with a different Microsoft account
3. **Rebuild App**: Sometimes configuration changes require a complete rebuild
4. **Contact Microsoft Support**: For Azure AD specific configuration issues

### Emergency Fallback

If Microsoft authentication continues to fail:
1. Use email/password authentication instead
2. Consider Google Sign-In (already configured in the app)
3. Temporarily disable Microsoft authentication requirement