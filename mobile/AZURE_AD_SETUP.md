# Azure AD Setup for Microsoft Authentication

## Current Error
You're seeing this error: `AADSTS50011: The redirect URI does not match the redirect URIs configured for the application`

## Solution
You need to add the correct redirect URIs to your Azure AD app registration.

### Step 1: Go to Azure Portal
1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations**
3. Find your app with Client ID: `6533df52-b33b-4953-be58-6ae5caa69797`

### Step 2: Configure Redirect URIs
1. Click on your app registration
2. Go to **Authentication** in the left sidebar
3. Under **Platform configurations**, click **Add a platform**
4. Select **Mobile and desktop applications**
5. Add these redirect URIs:

**For Development (Expo) - Simple Format:**
```
exp://192.168.1.9:8081
```

**For Production (Standalone app):**
```
campuseats://auth
```

**Additional common development patterns (add these for flexibility):**
```
exp://localhost:8081
exp://127.0.0.1:8081
```

### Step 3: Save Configuration
1. Click **Configure** and then **Save**
2. Wait a few minutes for the changes to propagate

### Step 4: Test
1. Restart your Expo development server
2. Try the Microsoft login again

## Current App Configuration
- **Client ID**: `6533df52-b33b-4953-be58-6ae5caa69797`
- **Tenant ID**: `823cde44-4433-456d-b801-bdf0ab3d41fc`
- **App Scheme**: `campuseats`

## Environment Detection
The app automatically detects the environment:
- **Development**: Uses `exp://192.168.1.9:8081` (simple format, no path)
- **Production**: Uses `campuseats://auth`

## Key Changes Made
- Removed the `--/auth` path from development redirect URI to use the simpler format
- Uses configured redirect URI directly instead of `makeRedirectUri()` function
- This matches your existing Azure AD configuration

## Troubleshooting
1. Make sure your IP address (192.168.1.9) matches your development machine
2. If using a different IP, update `config.ts` accordingly
3. Clear app cache and restart if issues persist
4. The redirect URI should be exactly `exp://192.168.1.9:8081` (no additional path)