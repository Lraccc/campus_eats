# Fixing Microsoft OAuth Login in Your Deployed App

The error message you're seeing (`AADSTS50011: The redirect URI does not match`) occurs because the redirect URI in your deployed app doesn't match what's configured in your Microsoft Azure portal.

## Step 1: Update Your Azure App Registration

1. Log in to the [Azure Portal](https://portal.azure.com)

2. Navigate to **Azure Active Directory** → **App Registrations**

3. Select your application (ID: `6533df52-b33b-4953-be58-6ae5caa69797`)

4. In the left menu, click on **Authentication**

5. Under **Redirect URIs**, add the following URI:
   - `https://auth.campuseats.app/signin-callback`
   - Keep your existing URIs

6. Click **Save**

## Step 2: Rebuild Your App

After updating the Azure configuration, rebuild your app using the script:

```
.\rebuild-app.bat
```

## Step 3: Test the Login

1. Install the new APK on your device
2. Try logging in with Microsoft again

## Troubleshooting

If you still encounter issues:

1. **Check the exact redirect URI** being used by your app:
   - Add this code to your `useAuthentication` hook before the `useAuthRequest` call:
   ```javascript
   console.log('Using redirect URI:', redirectUri);
   ```

2. **Verify the Azure configuration** matches exactly:
   - URI schemes are case-sensitive
   - Make sure there are no trailing slashes unless specified

3. **Clear app data** on your device:
   - Go to Settings → Apps → Campus Eats → Storage → Clear Data

## Common Pitfalls

1. **Mismatch between app and Azure configuration**:
   - The URI in your app must exactly match what's in Azure

2. **Incorrect scheme format**:
   - Custom schemes should end with `://` (e.g., `campuseats://`)

3. **Missing platform-specific configuration**:
   - Android requires the scheme to be registered in `AndroidManifest.xml`
   - iOS requires URL types in `Info.plist`

Expo handles these platform-specific configurations automatically based on your `app.json` settings.
