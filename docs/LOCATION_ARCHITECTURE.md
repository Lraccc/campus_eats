# Location Tracking Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CAMPUS EATS                                  │
│                    LOCATION TRACKING SYSTEM                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   USER DEVICE        │         │   DASHER DEVICE      │
│  (Android Emulator)  │         │  (Android Emulator)  │
└──────────────────────┘         └──────────────────────┘
         │                                   │
         │ 1. Request GPS                    │ 1. Request GPS
         ↓                                   ↓
┌──────────────────────┐         ┌──────────────────────┐
│   expo-location      │         │   expo-location      │
│   - Permissions      │         │   - Permissions      │
│   - Watch Position   │         │   - Watch Position   │
│   - Every 3 seconds  │         │   - Every 3 seconds  │
└──────────────────────┘         └──────────────────────┘
         │                                   │
         │ 2. Location Update                │ 2. Location Update
         ↓                                   ↓
┌──────────────────────┐         ┌──────────────────────┐
│ useCurrentLocation() │         │ useCurrentLocation() │
│   Hook               │         │   Hook               │
└──────────────────────┘         └──────────────────────┘
         │                                   │
         │ 3. Validate & POST                │ 3. Validate & POST
         ↓                                   ↓
    
    POST /api/orders/{orderId}/location/user
                          │
                          ↓
    POST /api/orders/{orderId}/location/dasher
                          │
                          ↓

┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND API SERVER                          │
│                    (Spring Boot on Port 8080)                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │         OrderLocationController                          │  │
│  │                                                           │  │
│  │  POST /{orderId}/location/{userType}                    │  │
│  │    ↓                                                      │  │
│  │    1. Validate required fields                          │  │
│  │    2. Validate latitude (-90 to 90)                     │  │
│  │    3. Validate longitude (-180 to 180)                  │  │
│  │    4. Validate userType (user/dasher)                   │  │
│  │    5. Upsert to MongoDB                                 │  │
│  │    6. Return success/error                              │  │
│  │                                                           │  │
│  │  GET /{orderId}/location/{userType}                     │  │
│  │    ↓                                                      │  │
│  │    1. Query MongoDB                                      │  │
│  │    2. Return location or 404                            │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                        MONGODB                                   │
│                  Collection: order_locations                     │
│                                                                  │
│  Document Structure:                                             │
│  {                                                               │
│    _id: ObjectId,                                               │
│    orderId: "order123",           // Indexed                    │
│    userType: "user",              // Indexed                    │
│    latitude: 10.2944327,                                        │
│    longitude: 123.8812167,                                      │
│    createdAt: ISODate(...),                                     │
│    updatedAt: ISODate(...)                                      │
│  }                                                               │
│                                                                  │
│  Unique Index: orderId + userType                               │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ GET every 5 seconds
                          ↓
┌──────────────────────┐         ┌──────────────────────┐
│   USER MAP           │         │   DASHER MAP         │
│   Component          │         │   Component          │
│                      │         │                      │
│   Polls:             │         │   Polls:             │
│   - Dasher location  │         │   - User location    │
│                      │         │                      │
│   Displays:          │         │   Displays:          │
│   - User marker (U)  │         │   - User marker (U)  │
│   - Dasher marker(D) │         │   - Dasher marker(D) │
└──────────────────────┘         └──────────────────────┘

                    GET /api/orders/{orderId}/location/dasher
                              ↑
                              │
                    GET /api/orders/{orderId}/location/user
```

## Data Flow Details

### 1. Location Capture (Every 3 seconds)
```
Device GPS → expo-location → useCurrentLocation() hook → State update
```

### 2. Location Upload (On each update)
```
State → Validate coords → POST API → Backend validation → MongoDB upsert
```

### 3. Location Retrieval (Every 5 seconds)
```
Timer → GET API → MongoDB query → JSON response → Parse → Update map
```

## Network Configuration

### Android Emulator
```typescript
API_HOST = "http://10.0.2.2:8080"
```
- `10.0.2.2` = Special alias to host machine's localhost
- Backend runs on host at `localhost:8080`
- Emulator maps `10.0.2.2` → Host's `127.0.0.1`

### Production
```typescript
API_HOST = "https://campus-eats-backend.onrender.com"
```

## Validation Pipeline

### Client-Side (Mobile)
```typescript
1. Check latitude is number
2. Check latitude in range [-90, 90]
3. Check longitude is number
4. Check longitude in range [-180, 180]
5. If valid → Send to API
6. If invalid → Log error, return null
```

### Server-Side (Backend)
```java
1. Check latitude field exists
2. Check longitude field exists
3. Parse to Double
4. Check latitude in range [-90.0, 90.0]
5. Check longitude in range [-180.0, 180.0]
6. Check userType in ["user", "dasher"]
7. If valid → Save to MongoDB
8. If invalid → Return 400 with error message
```

## Error Handling

### Mobile Service
```typescript
Try:
  Attempt 1: fetch()
  → If fails, wait 1 second
  
  Attempt 2: fetch()
  → If fails, wait 2 seconds
  
  Attempt 3: fetch()
  → If fails, return null
  
Catch:
  - AbortError (timeout) → return null
  - NetworkError → return null
  - All errors logged to console
```

### Backend API
```java
Try:
  Validate input
  Save to MongoDB
  Return success
  
Catch:
  - NumberFormatException → 400 "Invalid format"
  - Validation error → 400 "Invalid {field}"
  - All errors logged
```

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Location Update Frequency | 3 seconds | Configurable in LocationService |
| API Timeout | 8 seconds | Reduced from 15s for faster feedback |
| Polling Interval | 5 seconds | Can be optimized with WebSocket |
| Max Retries | 2 | Exponential backoff (1s, 2s) |
| Distance Threshold | 10 meters | Minimum movement to trigger update |
| Accuracy Mode | Balanced | Trades accuracy for battery life |

## Security Considerations

### Current State
- ⚠️ No authentication on endpoints
- ⚠️ No rate limiting
- ⚠️ No authorization checks

### Recommended Improvements
```java
@PreAuthorize("hasRole('USER') or hasRole('DASHER')")
@RateLimiter(name = "location-api", fallbackMethod = "rateLimitFallback")
public ResponseEntity<?> upsertLocation(...) {
    // Verify user has access to this order
    if (!orderService.userHasAccess(userId, orderId)) {
        return ResponseEntity.status(403).build();
    }
    // ... existing logic
}
```

## Scalability

### Current Capacity
- Single MongoDB instance
- Synchronous API calls
- Polling-based updates

### Scaling Recommendations

1. **Use WebSocket for Real-Time Updates**
   ```
   Replace polling with push notifications
   Reduces API calls by ~80%
   ```

2. **Add Redis Cache**
   ```
   Cache recent locations (TTL: 30 seconds)
   Reduces MongoDB queries
   ```

3. **Implement Connection Pooling**
   ```
   Reuse HTTP connections
   Reduces network overhead
   ```

4. **Add Load Balancer**
   ```
   Distribute requests across multiple backend instances
   Handle more concurrent users
   ```

## Testing Strategy

### Unit Tests
- ✅ Backend: OrderLocationControllerTest
- ✅ Mobile: LocationService.test

### Integration Tests
- ✅ API endpoints with real database
- ✅ End-to-end location flow

### Manual Tests
- ✅ Android emulator GPS simulation
- ✅ Multiple devices simultaneously
- ✅ Network failure scenarios
- ✅ Boundary value testing

### Automated Tests
- ✅ 17 API tests in test_location_api.sh
- ✅ Validation scenarios
- ✅ Error cases

## Monitoring & Debugging

### Logs to Monitor
```bash
# Mobile
adb logcat | grep -E "LocationService|expo-location"

# Backend
tail -f logs/spring.log | grep -E "OrderLocationController|location"

# MongoDB
db.order_locations.find().sort({updatedAt: -1}).limit(10)
```

### Key Metrics
- Location update success rate
- API response times
- Failed validation count
- Database query performance
- User permission denials

## Quick Reference

### Start System
```bash
# Terminal 1: Backend
cd backend/campuseats
mvn spring-boot:run

# Terminal 2: Mobile
cd mobile
npm run android

# Terminal 3: Set GPS
adb emu geo fix 123.8812167 10.2944327
```

### Test API
```bash
# Store location
curl -X POST http://localhost:8080/api/orders/order123/location/user \
  -H "Content-Type: application/json" \
  -d '{"latitude": 10.2944327, "longitude": 123.8812167}'

# Get location
curl http://localhost:8080/api/orders/order123/location/user
```

### Check Status
```bash
# Backend health
curl http://localhost:8080/actuator/health

# MongoDB connection
mongosh "mongodb://localhost:27017/campuseats"
db.order_locations.countDocuments()

# Mobile device location
adb shell dumpsys location | grep "last known location"
```

## Conclusion

This location tracking system provides a robust, validated, and well-documented solution for tracking user and dasher locations in real-time. The architecture supports Android emulator testing and is ready for production deployment with the recommended security enhancements.
