# Mobile Ban Functionality Test Plan

## Overview
This document outlines how to test the newly implemented ban functionality in the mobile app.

## What was implemented:

### 1. Automatic Ban Check in Order Screen (Order.tsx)
- **Location**: `mobile/screens/User/Order.tsx`
- **Functionality**: Automatically signs out users with 3+ offenses
- **Trigger**: When `offenses` state updates to 3 or more

### 2. Ban Check During Traditional Login (LoginForm.tsx)
- **Location**: `mobile/screens/auth/LoginForm.tsx` 
- **Functionality**: Checks user ban status after successful login, before proceeding
- **Error Message**: "Your account has been banned. Please contact the administrator for more information."

### 3. Enhanced AuthService Ban Handling (authService.ts)
- **Location**: `mobile/services/authService.ts`
- **Added Functions**:
  - `checkUserBanStatus(userId)` - Returns ban status and offense count
  - Enhanced error handling for banned users in login responses
  - OAuth flow already had ban handling (pre-existing)

### 4. Ban Check in HomePage (HomePage.tsx)
- **Location**: `mobile/screens/User/HomePage.tsx`
- **Functionality**: Checks ban status when fetching user info
- **Trigger**: During user data fetch in `fetchUserInfo()`

### 5. Offense Warning Display (Order.tsx)
- **Location**: Display offense count warning in Order screen
- **Condition**: Shows for users with 1-2 offenses (before ban)
- **Message**: "Warning! x{count} offense(s) recorded. 3 cancellations will lead to account ban."

## Test Scenarios:

### Scenario 1: User with 0-2 offenses
✅ **Expected**: User can login and use app normally
✅ **Expected**: Offense warning displays if offenses > 0
✅ **Expected**: No automatic sign-out

### Scenario 2: User with exactly 3 offenses
✅ **Expected**: User is automatically signed out when Order screen loads
✅ **Expected**: User cannot login (gets ban message)
✅ **Expected**: Both traditional and OAuth login show ban message

### Scenario 3: User reaches 3 offenses during app usage
✅ **Expected**: User is immediately signed out when offense count updates
✅ **Expected**: Subsequent login attempts are blocked

### Scenario 4: Banned user tries to login
✅ **Expected**: Traditional login shows: "Your account has been banned. Please contact the administrator for more information."
✅ **Expected**: OAuth login is handled by authService (shows alert and redirects)

## Testing Steps:

1. **Setup Test User**: Create or use existing user account
2. **Add Offenses**: Use admin panel or backend to add offenses to test user
3. **Test Login**: Try logging in with different offense counts
4. **Test Auto Sign-out**: Login successfully, then increase offense count to 3
5. **Test UI**: Verify offense warning displays correctly
6. **Test Navigation**: Verify banned users are blocked from all main screens

## Files Modified:
- `mobile/screens/User/Order.tsx` - Added ban check and offense warning
- `mobile/screens/auth/LoginForm.tsx` - Added ban check during login
- `mobile/services/authService.ts` - Added ban check function and error handling
- `mobile/screens/User/HomePage.tsx` - Added ban check during user info fetch

## API Endpoints Used:
- `GET /api/users/offenses/{userId}` - Get user offense count
- `POST /api/users/authenticate` - Traditional login (handles ban errors)
- `POST /api/users/azure-authenticate` - OAuth login (handles ban errors)

## Security Notes:
- Ban checks are performed server-side and client-side
- Banned users have their authentication tokens cleared
- Navigation is forced to login screen for banned users
- Multiple entry points covered (Order, HomePage, Login)