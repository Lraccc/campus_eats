# Location Tracking Developer Guide

## Overview
This guide explains how the location tracking system works in Campus Eats and how to test it on Android emulators.

---

## Architecture

### Components
1. **Backend API** - Spring Boot REST endpoints for storing/retrieving locations
2. **Mobile Service** - React Native service for device location tracking
3. **Map Components** - UI components for displaying locations

### Data Flow
```
Device (Android Emulator)
    ↓ expo-location
useCurrentLocation() hook
    ↓ POST
Backend API (/api/orders/{orderId}/location/{userType})
    ↓ save
MongoDB (order_locations collection)
    ↑ GET
Mobile polls every 5 seconds
    ↑
Map Component displays markers
```

---

## Backend API Reference

### Base URL
- Development: `http://localhost:8080/api/orders`
- Production: `https://campus-eats-backend.onrender.com/api/orders`

### Endpoints

#### 1. Store User Location
```http
POST /api/orders/{orderId}/location/user
Content-Type: application/json

{
  "latitude": 10.2944327,
  "longitude": 123.8812167,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response (200 OK):**
```json
{
  "orderId": "order123",
  "userType": "user",
  "latitude": 10.2944327,
  "longitude": 123.8812167,
  "status": "updated"
}
```

**Validation Rules:**
- `latitude`: required, number between -90 and 90
- `longitude`: required, number between -180 and 180

**Error Response (400 Bad Request):**
```json
{
  "error": "Invalid latitude: must be between -90 and 90, got 91.0"
}
```

#### 2. Store Dasher Location
```http
POST /api/orders/{orderId}/location/dasher
Content-Type: application/json

{
  "latitude": 10.3,
  "longitude": 123.9
}
```

#### 3. Get User Location
```http
GET /api/orders/{orderId}/location/user
```

**Response (200 OK):**
```json
{
  "orderId": "order123",
  "userType": "user",
  "latitude": 10.2944327,
  "longitude": 123.8812167
}
```

**Response (404 Not Found):**
```json
{
  "message": "user location not found for orderId=order123"
}
```

#### 4. Get Dasher Location
```http
GET /api/orders/{orderId}/location/dasher
```

---

## Mobile Implementation

### LocationService.ts

#### useCurrentLocation Hook
```typescript
const { location, errorMsg } = useCurrentLocation();

// location = { latitude, longitude, heading, speed }
// errorMsg = null or error string
```

**Features:**
- Requests foreground location permissions
- Gets last known position for fast initial display
- Watches position with 3-second intervals
- Balanced accuracy mode for battery efficiency

#### API Functions

```typescript
// Send location to backend
await updateUserLocationOnServer(orderId, {
  latitude: 10.0,
  longitude: 120.0,
  heading: 0,
  speed: 0
});

await updateDasherLocationOnServer(orderId, locationData);

// Retrieve location from backend
const userLocation = await getUserLocationFromServer(orderId);
const dasherLocation = await getDasherLocationFromServer(orderId);
```

**Features:**
- Automatic retry with exponential backoff (1s, 2s delays)
- Coordinate validation before sending
- 8-second timeout per request
- Graceful error handling (returns null on failure)

---

## Android Emulator Setup

### 1. Configure Network
The mobile app automatically uses the correct network configuration:

```typescript
// For Android emulator
API_HOST = "http://10.0.2.2:8080"

// 10.0.2.2 is a special IP that maps to host machine's localhost
```

### 2. Start Backend
```bash
cd backend/campuseats
mvn spring-boot:run
# Backend runs on port 8080
```

### 3. Start Mobile App
```bash
cd mobile
npm install
npm run android
```

### 4. Set Mock GPS Location

**Option A: Android Studio Emulator**
1. Click "..." (Extended controls) in emulator toolbar
2. Go to "Location"
3. Enter coordinates:
   - Latitude: 10.2944327
   - Longitude: 123.8812167
4. Click "Send"

**Option B: ADB Command**
```bash
adb emu geo fix 123.8812167 10.2944327
# Note: longitude comes first in adb command
```

**Option C: Programmatic (for testing)**
```bash
# Create a GPX file
cat > route.gpx << EOF
<?xml version="1.0"?>
<gpx version="1.0">
  <wpt lat="10.2944327" lon="123.8812167">
    <name>Start</name>
  </wpt>
</gpx>
EOF

# Load in emulator
adb push route.gpx /sdcard/
```

### 5. Grant Location Permissions
When the app starts, allow location access when prompted.

---

## Testing Guide

### Manual Testing on Emulator

#### Test 1: User Sends Location
```bash
# 1. Start app as user
# 2. Navigate to order tracking screen
# 3. Set GPS: lat=10.2944327, lon=123.8812167
# 4. Check backend received data:
curl http://localhost:8080/api/orders/order123/location/user
```

**Expected Output:**
```json
{
  "orderId": "order123",
  "userType": "user",
  "latitude": 10.2944327,
  "longitude": 123.8812167
}
```

#### Test 2: Dasher Sees User Location
```bash
# 1. Run two emulators (or one emulator + one physical device)
# 2. Device 1: Run as user, set GPS to location A
# 3. Device 2: Run as dasher, view delivery map
# 4. Verify dasher sees user's marker at location A
```

#### Test 3: Location Updates
```bash
# 1. Start app and allow location
# 2. Set GPS to: 10.2944327, 123.8812167
# 3. Wait 5 seconds
# 4. Change GPS to: 10.3, 123.9
# 5. Verify map marker moves to new position
```

#### Test 4: Invalid Coordinates
```bash
# Try to send invalid latitude
curl -X POST http://localhost:8080/api/orders/order123/location/user \
  -H "Content-Type: application/json" \
  -d '{"latitude": 91, "longitude": 120}'

# Expected: 400 Bad Request with error message
```

### Automated Testing

#### Backend Tests
```bash
cd backend/campuseats
mvn test
```

Copy `OrderLocationControllerTest.example.java` to test directory for examples.

#### Mobile Tests
```bash
cd mobile
npm test
```

Copy `LocationService.test.example.ts` to `__tests__/services/` directory.

---

## Common Issues & Solutions

### Issue 1: "Location permission denied"
**Solution:** 
- Grant location permission in app settings
- For emulator: Settings > Apps > Campus Eats > Permissions > Location > Allow

### Issue 2: "Network request failed"
**Solution:**
- Check backend is running: `curl http://localhost:8080/actuator/health`
- For emulator, ensure using `10.0.2.2` not `localhost`
- Check firewall isn't blocking port 8080

### Issue 3: Map doesn't show location
**Solution:**
- Check GPS is set in emulator (Extended Controls > Location)
- Verify location permission granted
- Check console logs for errors: `adb logcat | grep LocationService`

### Issue 4: Location not updating
**Solution:**
- Change GPS position significantly (> 10 meters)
- Wait at least 3 seconds between changes
- Check network connectivity

### Issue 5: "Invalid coordinates" error
**Solution:**
- Latitude must be -90 to 90
- Longitude must be -180 to 180
- Check you didn't swap lat/long

---

## Performance Optimization

### Current Behavior
- Location watch interval: 3 seconds
- API polling interval: 5 seconds
- Minimum distance for update: 10 meters

### Optimization Tips

1. **Reduce Battery Drain**
```typescript
// Use balanced accuracy instead of high accuracy
Location.Accuracy.Balanced  // Current
// vs
Location.Accuracy.High      // More battery drain
```

2. **Reduce Network Usage**
```typescript
// Only send location if changed significantly
const hasMovedSignificantly = (oldLoc, newLoc) => {
  const distance = calculateDistance(oldLoc, newLoc);
  return distance > 50; // 50 meters threshold
};
```

3. **Use WebSocket Instead of Polling**
```typescript
// Replace polling with WebSocket for real-time updates
const ws = new WebSocket('ws://10.0.2.2:8080/ws/location');
ws.onmessage = (event) => {
  const location = JSON.parse(event.data);
  updateMap(location);
};
```

---

## Debugging

### Enable Verbose Logging

**Backend:**
```properties
# application.properties
logging.level.com.capstone.campuseats=DEBUG
```

**Mobile:**
```typescript
// LocationService.ts already logs:
console.log('[LocationService] POST user', { orderId });
console.log('[LocationService] GET dasher', { orderId });
```

View logs:
```bash
# Android
adb logcat | grep LocationService

# iOS
react-native log-ios
```

### Check MongoDB Data
```bash
# Connect to MongoDB
mongosh "mongodb://localhost:27017/campuseats"

# Query locations
db.order_locations.find({ orderId: "order123" }).pretty()

# Check indexes
db.order_locations.getIndexes()
```

### Network Debugging
```bash
# Check if backend is accessible from emulator
adb shell
ping -c 4 10.0.2.2
curl http://10.0.2.2:8080/api/orders/order123/location/user
```

---

## Production Deployment

### Environment Variables
```env
# Backend
MONGO_URI=mongodb://production-host:27017/campuseats
SERVER_PORT=8080

# Mobile
EXPO_PUBLIC_API_HOST=https://campus-eats-backend.onrender.com
```

### Security Considerations
1. Add authentication to API endpoints
2. Implement rate limiting
3. Use HTTPS in production
4. Validate user has access to order data
5. Add CORS configuration

### Monitoring
- Track API response times
- Monitor location update frequency
- Alert on validation failures
- Log suspicious coordinate patterns

---

## Additional Resources

- [expo-location Documentation](https://docs.expo.dev/versions/latest/sdk/location/)
- [Spring Boot REST API Guide](https://spring.io/guides/gs/rest-service/)
- [MongoDB Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Android Emulator Networking](https://developer.android.com/studio/run/emulator-networking)

---

## FAQ

**Q: Can I use real GPS on emulator?**
A: No, emulator uses simulated GPS. Use physical device for real GPS testing.

**Q: How accurate is the location?**
A: Emulator provides exact coordinates you set. Real devices vary based on GPS signal.

**Q: What's the maximum distance the API can handle?**
A: API works globally. Coordinates are valid anywhere on Earth (-90 to 90 lat, -180 to 180 lon).

**Q: Can multiple dashers track one order?**
A: Current implementation stores one dasher location per order. For multiple dashers, extend the schema.

**Q: How often should I update location?**
A: Current: every 3 seconds. Adjust based on use case (delivery = frequent, casual = less frequent).
