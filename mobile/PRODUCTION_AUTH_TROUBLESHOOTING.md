# Production Microsoft Authentication Troubleshooting

## Issue: Users Getting Stuck on Microsoft Consent Screen

### Current Problem
Users see the Microsoft consent screen asking "Are you trying to sign in to CampusEats2.0?" but get stuck there after clicking "Continue".

### Root Causes & Solutions

#### 1. App Name Mismatch
**Problem**: Azure AD shows "CampusEats2.0" but your app is named "Campus Eats"
**Solution**: Update Azure AD app registration name to match

**Steps**:
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your app with Client ID: `6533df52-b33b-4953-be58-6ae5caa69797`
4. Click on **Branding & properties**
5. Change the **Name** from "CampusEats2.0" to "Campus Eats"
6. Save changes

#### 2. Redirect URI Configuration
**Ensure these redirect URIs are configured in Azure AD**:

**For Production (Standalone app)**:
```
campuseats://auth
```

**For Development**:
```
exp://192.168.1.9:8081
```

#### 3. App Registration Settings
**Check these settings in Azure AD**:

1. **Authentication** → **Supported account types**:
   - Should be "Accounts in this organizational directory only" if using organizational accounts
   - Or "Accounts in any organizational directory" for broader access

2. **Authentication** → **Advanced settings**:
   - ✅ Enable "Allow public client flows"
   - ✅ Enable "Live SDK support" (if needed)

3. **API permissions**:
   - Ensure these permissions are granted:
     - `openid`
     - `profile` 
     - `email`
     - `User.Read`
     - Your custom API scope: `api://6533df52-b33b-4953-be58-6ae5caa69797/access_as_user`

#### 4. Code Improvements Made

**Enhanced Error Handling**:
- Added better logging for redirect URI usage
- Improved error messages for user feedback
- Added specific handling for cancelled authentication

**Production Compatibility**:
- Ensured proper WebBrowser session completion
- Added logging to track authentication flow
- Better handling of consent screen issues

#### 5. Testing Steps

1. **Clear app data** (force close and clear cache)
2. **Test authentication flow**:
   - Tap Microsoft login button
   - Verify redirect URI in logs
   - Check if consent screen appears
   - Verify successful redirect back to app

3. **Check logs** for these messages:
   ```
   Using redirect URI for auth: campuseats://auth
   OAuth prompt completed with result type: success
   📥 Exchanging authorization code for token
   ```

#### 6. Common Issues & Solutions

**Issue**: User stuck on consent screen
**Solution**: 
- Verify app name matches in Azure AD
- Check redirect URI is exactly `campuseats://auth`
- Ensure "Allow public client flows" is enabled

**Issue**: "Invalid redirect URI" error
**Solution**:
- Double-check redirect URI spelling in Azure AD
- Ensure no extra spaces or characters
- Verify the URI scheme matches your app.json

**Issue**: User gets redirected but authentication fails
**Solution**:
- Check Azure AD API permissions
- Verify tenant ID and client ID are correct
- Review backend authentication endpoint

#### 7. Debug Information

**Current Configuration**:
- **Client ID**: `6533df52-b33b-4953-be58-6ae5caa69797`
- **Tenant ID**: `823cde44-4433-456d-b801-bdf0ab3d41fc`
- **Production Redirect URI**: `campuseats://auth`
- **App Scheme**: `campuseats`

**Log what to look for**:
```
Using redirect URI for auth: campuseats://auth
Environment info: { NODE_ENV: 'production', isProduction: true }
OAuth prompt completed with result type: success
```

#### 8. Emergency Fallback

If Microsoft authentication continues to fail, consider:
1. **Alternative authentication**: Use email/password login
2. **Different OAuth provider**: Google Sign-In (already configured)
3. **Contact Microsoft Support**: For Azure AD specific issues

### Next Steps
1. Update Azure AD app name to "Campus Eats"
2. Verify all redirect URIs are correctly configured
3. Test authentication flow in production
4. Monitor logs for any remaining issues