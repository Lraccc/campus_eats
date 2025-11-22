# Agora Livestream Security Implementation

## Overview
Implemented secure token-based authentication for Agora RTC livestreaming between shops and customers.

## What Was Changed

### Backend (Java Spring Boot)

1. **Added Agora Dependency** (`pom.xml`):
   - Added `io.agora:authentication:2.0.0` for token generation

2. **Created AgoraService** (`Service/AgoraService.java`):
   - `generateBroadcasterToken()` - Creates tokens for shops starting livestreams
   - `generateViewerToken()` - Creates tokens for customers watching streams
   - Tokens expire after 24 hours
   - Uses RtcTokenBuilder2 with proper roles (PUBLISHER/SUBSCRIBER)

3. **Created AgoraController** (`Controller/AgoraController.java`):
   - `POST /api/agora/token/broadcaster` - Get token for broadcasting
   - `POST /api/agora/token/viewer` - Get token for viewing
   - `POST /api/agora/token` - Simplified endpoint (auto-detects role)

4. **Updated Configuration** (`application.properties`):
   ```properties
   agora.app.id=${env.AGORA_APP_ID}
   agora.app.certificate=${env.AGORA_APP_CERTIFICATE}
   ```

### Mobile App (React Native)

1. **Updated LiveStreamBroadcaster.tsx**:
   - Now fetches Agora token from backend before joining channel
   - Added error handling for token fetch failures
   - Uses secure server-generated token instead of null

2. **Updated LiveStreamViewer.tsx**:
   - Now fetches viewer token from backend
   - Added authentication check before requesting token
   - Improved error messages

3. **Updated config.ts**:
   - Added AGORA_APP_CERTIFICATE (commented - backend only)
   - Updated comments to reflect secure token usage

## Setup Instructions

### 1. Backend Environment Variables

Add to your `.env` file or Render environment variables:

```env
AGORA_APP_ID=8577fb1c76804e25a69047331f7c526c
AGORA_APP_CERTIFICATE=6a854a4f51394275b518bf24dcab92ef
```

### 2. Agora Console Settings

Your Agora project "CampusEats" should have:
- ✅ RTC Free Package activated (valid until 2025-11-30)
- ✅ Primary Certificate ENABLED
- ✅ Secured Mode active

### 3. Deploy Backend

```bash
cd backend/campuseats
mvn clean install
# Deploy to Render or your server
```

### 4. Rebuild Mobile App

The mobile app will now:
1. Request token from backend when starting/joining livestream
2. Use that token to authenticate with Agora
3. Fail gracefully if backend is unavailable

## API Endpoints

### Get Broadcaster Token
```http
POST /api/agora/token/broadcaster
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "channelName": "shop_515fb615-37c6-4b21-8037-a91daa8a6a03",
  "uid": 0
}

Response:
{
  "token": "007eJxT...",
  "channelName": "shop_515fb615-37c6-4b21-8037-a91daa8a6a03",
  "uid": 0,
  "expiresIn": 86400
}
```

### Get Viewer Token
```http
POST /api/agora/token/viewer
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "channelName": "shop_515fb615-37c6-4b21-8037-a91daa8a6a03",
  "uid": 0
}

Response:
{
  "token": "007eJxT...",
  "channelName": "shop_515fb615-37c6-4b21-8037-a91daa8a6a03",
  "uid": 0,
  "expiresIn": 86400
}
```

## Security Benefits

✅ **Secure**: App Certificate never exposed to client
✅ **Controlled**: Only authenticated users can get tokens
✅ **Role-based**: Broadcasters can publish, viewers can only subscribe
✅ **Time-limited**: Tokens expire after 24 hours
✅ **Protected**: Prevents unauthorized usage of your Agora quota

## Testing

1. Start backend server
2. Install new APK on device
3. Login as shop owner
4. Start livestream - should request token from backend
5. Login as customer on another device
6. Watch livestream - should request viewer token

Check logs for:
- `📡 Requesting Agora token from backend...`
- `✅ Received Agora token from backend`
- `🎯 Joining channel with secure token...`

## Troubleshooting

**Error: "Failed to get streaming token"**
- Check backend is running
- Verify environment variables are set
- Check backend logs for errors

**Error 110 (Invalid APP ID)**
- Verify AGORA_APP_ID in backend env matches Agora Console
- Ensure Primary Certificate is enabled in Agora Console

**Error 17 (Join Channel Rejected)**
- Token might be expired (shouldn't happen for 24 hours)
- Channel name mismatch between token and join request
- Token generated for wrong role (broadcaster vs viewer)

## Next Steps

- [ ] Test with multiple concurrent streams
- [ ] Add token refresh mechanism for streams longer than 24 hours
- [ ] Implement stream analytics/monitoring
- [ ] Add backend endpoints for stream status tracking
