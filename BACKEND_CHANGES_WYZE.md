# Backend Changes Required for Wyze Camera Integration

## Overview
This document outlines the backend modifications needed to support Wyze Cam v3 live streaming in Campus Eats.

---

## 🔧 API Endpoint Modifications

### 1. Store Stream URL Endpoint (Already exists - needs update)

**Endpoint:** `POST /api/shops/{shopId}/stream-url`

**Purpose:** Save Wyze camera RTSP URL for a shop

**Request Body:**
```json
{
  "streamUrl": "rtsp://admin:password@192.168.1.100:8554/live",
  "cameraType": "wyze-v3",
  "cameraName": "Food Display Camera",
  "streamType": "rtsp"
}
```

**Database Schema Update:**
```sql
-- Add new columns to Shop table (if they don't exist)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS stream_url VARCHAR(500);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS camera_type VARCHAR(50);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS camera_name VARCHAR(100);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS stream_type VARCHAR(20);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS hls_url VARCHAR(500);
```

**Java Controller Example:**
```java
@PostMapping("/api/shops/{shopId}/stream-url")
public ResponseEntity<?> saveStreamUrl(
    @PathVariable String shopId,
    @RequestBody StreamUrlRequest request,
    @RequestHeader("Authorization") String token
) {
    // Validate shop ownership
    if (!shopService.isShopOwner(shopId, token)) {
        return ResponseEntity.status(403).body("Unauthorized");
    }
    
    // Save stream configuration
    Shop shop = shopService.findById(shopId);
    shop.setStreamUrl(request.getStreamUrl());
    shop.setCameraType(request.getCameraType());
    shop.setCameraName(request.getCameraName());
    shop.setStreamType(request.getStreamType());
    
    shopService.save(shop);
    
    return ResponseEntity.ok().body(Map.of("success", true));
}
```

---

### 2. Get Stream URL Endpoint (Already exists - should work)

**Endpoint:** `GET /api/shops/{shopId}/stream-url`

**Response:**
```json
{
  "streamUrl": "rtsp://admin:password@192.168.1.100:8554/live",
  "hlsUrl": "https://api.campuseats.com/hls/shop-123.m3u8",
  "cameraType": "wyze-v3",
  "streamType": "hls"
}
```

**Note:** `hlsUrl` is optional and only provided if HLS conversion is set up.

---

## 🎥 Optional: RTSP to HLS Conversion (Recommended)

### Why HLS Conversion?

**Problems with RTSP:**
- ❌ Not natively supported in web browsers
- ❌ Often blocked by firewalls/campus networks
- ❌ Requires special players on mobile
- ❌ Higher latency on mobile networks

**Benefits of HLS:**
- ✅ Works in all browsers and mobile apps natively
- ✅ Not blocked by firewalls
- ✅ Better buffering and quality adaptation
- ✅ Lower latency on mobile

### Implementation Option 1: FFmpeg on Backend

**Install FFmpeg:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install ffmpeg

# CentOS/RHEL
sudo yum install epel-release
sudo yum install ffmpeg
```

**Java Service to Convert RTSP to HLS:**

```java
@Service
public class StreamConversionService {
    
    private Map<String, Process> activeConversions = new ConcurrentHashMap<>();
    
    public String convertRTSPToHLS(String shopId, String rtspUrl) {
        try {
            // Create HLS output directory
            String hlsDir = "/var/www/html/hls/" + shopId + "/";
            Files.createDirectories(Paths.get(hlsDir));
            
            String playlistPath = hlsDir + "stream.m3u8";
            
            // FFmpeg command to convert RTSP to HLS
            String[] command = {
                "ffmpeg",
                "-i", rtspUrl,                    // Input RTSP stream
                "-c:v", "copy",                   // Copy video codec (no re-encoding)
                "-c:a", "aac",                    // Audio codec
                "-f", "hls",                      // Output format: HLS
                "-hls_time", "2",                 // Segment duration: 2 seconds
                "-hls_list_size", "3",            // Keep 3 segments in playlist
                "-hls_flags", "delete_segments",  // Delete old segments
                playlistPath                      // Output path
            };
            
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            
            Process process = pb.start();
            activeConversions.put(shopId, process);
            
            // Log output (for debugging)
            new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        System.out.println("[FFmpeg " + shopId + "] " + line);
                    }
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }).start();
            
            // Return HLS URL (accessible via web server)
            return "https://api.campuseats.com/hls/" + shopId + "/stream.m3u8";
            
        } catch (IOException e) {
            throw new RuntimeException("Failed to start HLS conversion", e);
        }
    }
    
    public void stopConversion(String shopId) {
        Process process = activeConversions.get(shopId);
        if (process != null && process.isAlive()) {
            process.destroy();
            activeConversions.remove(shopId);
        }
    }
}
```

**Update Stream Start Endpoint:**

```java
@PostMapping("/api/shops/{shopId}/streaming-status")
public ResponseEntity<?> setStreamingStatus(
    @PathVariable String shopId,
    @RequestBody StreamingStatusRequest request,
    @RequestHeader("Authorization") String token
) {
    Shop shop = shopService.findById(shopId);
    
    if (request.isStreaming()) {
        // Starting stream
        shop.setIsStreaming(true);
        
        // If RTSP stream, convert to HLS
        if ("rtsp".equals(shop.getStreamType()) && shop.getStreamUrl() != null) {
            String hlsUrl = streamConversionService.convertRTSPToHLS(
                shopId, 
                shop.getStreamUrl()
            );
            shop.setHlsUrl(hlsUrl);
        }
    } else {
        // Stopping stream
        shop.setIsStreaming(false);
        streamConversionService.stopConversion(shopId);
    }
    
    shopService.save(shop);
    return ResponseEntity.ok().build();
}
```

**Nginx Configuration (to serve HLS files):**

```nginx
# /etc/nginx/sites-available/campuseats

server {
    listen 80;
    server_name api.campuseats.com;
    
    # HLS streaming
    location /hls/ {
        alias /var/www/html/hls/;
        
        # CORS headers for mobile apps
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, OPTIONS';
        add_header Access-Control-Allow-Headers 'Range, Content-Type';
        
        # HLS specific headers
        add_header Cache-Control 'no-cache';
        
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
    }
}
```

---

### Implementation Option 2: Use Cloud Service (Easier)

Instead of running FFmpeg on your backend, use a cloud service:

**Option A: AWS MediaLive + MediaPackage**
```java
// Send RTSP URL to AWS MediaLive
// AWS converts to HLS automatically
// Return MediaPackage HLS URL to mobile app
```

**Option B: Mux.com**
```java
// Upload RTSP stream to Mux
// Get HLS playback URL
// Simpler but costs money ($$$)
```

---

## 📊 Database Schema

### Complete Shop Table Schema

```sql
CREATE TABLE IF NOT EXISTS shops (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    
    -- Existing fields...
    description TEXT,
    image_url VARCHAR(500),
    
    -- Stream configuration
    stream_url VARCHAR(500),        -- RTSP URL from Wyze
    hls_url VARCHAR(500),           -- Converted HLS URL (if available)
    camera_type VARCHAR(50),        -- 'wyze-v3', 'reolink', etc.
    camera_name VARCHAR(100),       -- Friendly name
    stream_type VARCHAR(20),        -- 'rtsp', 'hls', 'http'
    is_streaming BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 🔐 Security Considerations

### 1. Encrypt RTSP Passwords

RTSP URLs contain passwords in plain text. Consider:

```java
@Entity
public class Shop {
    
    @Column(name = "stream_url")
    @Convert(converter = EncryptedStringConverter.class)
    private String streamUrl;
    
    // Encrypted converter
    @Converter
    public class EncryptedStringConverter implements AttributeConverter<String, String> {
        @Override
        public String convertToDatabaseColumn(String attribute) {
            // Encrypt before storing
            return encrypt(attribute);
        }
        
        @Override
        public String convertToEntityAttribute(String dbData) {
            // Decrypt when reading
            return decrypt(dbData);
        }
    }
}
```

### 2. Validate Shop Ownership

Always verify the user owns the shop before allowing stream configuration changes.

### 3. Rate Limiting

Prevent abuse of stream start/stop endpoints:

```java
@RateLimit(requests = 10, window = "1m")
@PostMapping("/api/shops/{shopId}/streaming-status")
public ResponseEntity<?> setStreamingStatus(...) {
    // ...
}
```

---

## 🧪 Testing

### Test RTSP Connection

```bash
# Test if RTSP stream is accessible
ffprobe rtsp://admin:password@192.168.1.100:8554/live

# Test HLS conversion
curl https://api.campuseats.com/hls/shop-123/stream.m3u8
```

### Test Endpoints

```bash
# Save stream URL
curl -X POST https://api.campuseats.com/api/shops/shop-123/stream-url \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "streamUrl": "rtsp://admin:pass@192.168.1.100:8554/live",
    "cameraType": "wyze-v3",
    "streamType": "rtsp"
  }'

# Get stream URL
curl https://api.campuseats.com/api/shops/shop-123/stream-url \
  -H "Authorization: Bearer TOKEN"

# Start streaming
curl -X POST https://api.campuseats.com/api/shops/shop-123/streaming-status \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isStreaming": true}'
```

---

## 📋 Summary Checklist

### Required:
- [ ] Add stream_url columns to shops table
- [ ] Update POST /api/shops/{shopId}/stream-url endpoint
- [ ] Ensure GET /api/shops/{shopId}/stream-url works
- [ ] Test with RTSP URL storage

### Optional but Recommended (HLS):
- [ ] Install FFmpeg on backend server
- [ ] Implement StreamConversionService
- [ ] Configure Nginx to serve HLS files
- [ ] Update streaming-status endpoint to trigger conversion
- [ ] Add cleanup job for old HLS files
- [ ] Test HLS playback in mobile app

### Security:
- [ ] Encrypt stored RTSP URLs
- [ ] Validate shop ownership
- [ ] Add rate limiting
- [ ] Add logging for debugging

---

**Questions? Contact the backend team for assistance with implementation.**
