# Wyze Cam v3 Integration - Quick Start

## 📦 Installation Command

Paste this in your CMD terminal in the mobile directory:

```cmd
cd c:\Users\carlj\Projects\Capstone-Team-15\campus_eats\mobile && npm install expo-av
```

---

## 📁 Files Created

### New Components (Wyze versions):
1. **`components/LiveStreamBroadcasterWyze.tsx`** - Shop owner streaming component with Wyze support
2. **`components/LiveStreamViewerWyze.tsx`** - Customer viewing component with video player

### New Services:
3. **`services/wyzeCameraService.ts`** - Wyze camera integration service

### Documentation:
4. **`WYZE_SETUP_GUIDE.md`** - Complete setup guide for shop owners
5. **`BACKEND_CHANGES_WYZE.md`** - Backend API changes required (in root folder)

---

## 🔄 How to Use the New Components

### For Shop Streaming Screen:

Replace the old `LiveStreamBroadcaster` import:

**Before:**
```tsx
import LiveStreamBroadcaster from '../../components/LiveStreamBroadcaster';
```

**After:**
```tsx
import LiveStreamBroadcasterWyze from '../../components/LiveStreamBroadcasterWyze';
```

**Usage:**
```tsx
<LiveStreamBroadcasterWyze 
  shopId={shopId}
  shopName={shopName}
  onEndStream={handleEndStream}
/>
```

### For Customer Viewing Screen:

Replace the old `LiveStreamViewer` import:

**Before:**
```tsx
import LiveStreamViewer from '../../components/LiveStreamViewer';
```

**After:**
```tsx
import LiveStreamViewerWyze from '../../components/LiveStreamViewerWyze';
```

**Usage:**
```tsx
<LiveStreamViewerWyze 
  shopId={shopId}
  shopName={shopName}
  onClose={handleClose}
/>
```

---

## 🎯 Features Added

### LiveStreamBroadcasterWyze:
- ✅ Wyze Cam v3 configuration UI
- ✅ RTSP URL generation from credentials
- ✅ Video player (supports HLS/RTSP)
- ✅ Live indicator
- ✅ Settings modal for camera setup
- ✅ Error handling and retry logic
- ✅ Connection testing

### LiveStreamViewerWyze:
- ✅ Auto-fetch stream URL from backend
- ✅ Native video player (better than WebView)
- ✅ Loading states
- ✅ Error handling
- ✅ Stream type detection (RTSP/HLS)
- ✅ Live indicator

### WyzeCameraService:
- ✅ RTSP URL generation
- ✅ URL validation (RTSP/HLS)
- ✅ Save/load camera config
- ✅ Backend API integration
- ✅ Parse RTSP credentials

---

## 🔧 Quick Integration Example

### Update Shop Incoming Orders Screen

**File:** `mobile/screens/Shop/IncomingOrders.tsx`

Find this line (around line 1748):
```tsx
<LiveStreamBroadcaster 
  shopId={shopId}
  shopName={shopName}
  onEndStream={() => setShowLiveStream(false)}
/>
```

Replace with:
```tsx
<LiveStreamBroadcasterWyze 
  shopId={shopId}
  shopName={shopName}
  onEndStream={() => setShowLiveStream(false)}
/>
```

And update the import at top:
```tsx
import LiveStreamBroadcasterWyze from '../../components/LiveStreamBroadcasterWyze';
```

### Update Customer Shop Details Screen

**File:** `mobile/screens/User/ShopDetails.tsx`

Find the LiveStreamViewer usage and replace with:
```tsx
<LiveStreamViewerWyze 
  shopId={shopId}
  shopName={shopName}
  onClose={() => setLiveStreamModalVisible(false)}
/>
```

Update import:
```tsx
import LiveStreamViewerWyze from '../../components/LiveStreamViewerWyze';
```

---

## 🏃‍♂️ Testing Steps

### 1. Test Installation
```cmd
cd c:\Users\carlj\Projects\Capstone-Team-15\campus_eats\mobile
npm list expo-av
```

Should show expo-av is installed.

### 2. Test Compilation
```cmd
npm start
```

Check for any TypeScript errors.

### 3. Test on Device

**Shop Owner Flow:**
1. Open app as shop owner
2. Go to shop dashboard
3. Tap "Start Live Stream"
4. Should see settings modal
5. Enter Wyze camera details (see WYZE_SETUP_GUIDE.md)
6. Save - stream should appear

**Customer Flow:**
1. Browse shops
2. Find shop with active stream
3. Tap to view
4. Should see live video feed

---

## 📋 Backend Tasks Needed

Give `BACKEND_CHANGES_WYZE.md` to your backend developer. They need to:

### Required:
1. Add `stream_url`, `camera_type`, `stream_type` columns to shops table
2. Verify `POST /api/shops/{shopId}/stream-url` endpoint works
3. Verify `GET /api/shops/{shopId}/stream-url` endpoint works

### Optional (but recommended):
4. Set up FFmpeg for RTSP→HLS conversion
5. Configure Nginx to serve HLS files
6. Update streaming-status endpoint to trigger conversion

---

## 🛒 Shopping List for Shop Owners

**What to buy:**
- Wyze Cam v3 ($25-35 on Amazon)
- Optional: Camera mount/stand ($10-15)
- Optional: MicroSD card for local recording ($10-20)

**Where to buy:**
- Amazon: https://www.amazon.com/Wyze-Indoor-Outdoor-Camera/dp/B08R59YH7W
- Best Buy
- Walmart

---

## ⚠️ Known Limitations

### RTSP Streaming:
- May not work on all campus networks (firewall blocking port 8554)
- Some mobile carriers block RTSP
- **Solution:** Use HLS conversion (backend task)

### Network Requirements:
- Camera and phone must be on same WiFi initially
- Camera needs stable WiFi connection
- Recommended: 2.4GHz WiFi for better range

---

## 🆘 Troubleshooting

### "expo-av not found" error
```cmd
cd c:\Users\carlj\Projects\Capstone-Team-15\campus_eats\mobile
npx expo install expo-av
```

### TypeScript errors
```cmd
cd c:\Users\carlj\Projects\Capstone-Team-15\campus_eats\mobile
npm install --save-dev @types/react-native
```

### Can't connect to camera
- Check camera is powered on
- Verify camera IP address
- Ensure RTSP is enabled in Wyze app
- Check username/password are correct

---

## 📖 Documentation Links

**For Shop Owners:**
- Read: `mobile/WYZE_SETUP_GUIDE.md`

**For Backend Developers:**
- Read: `BACKEND_CHANGES_WYZE.md`

**Wyze Official Docs:**
- RTSP: https://support.wyze.com/hc/en-us/articles/360026245231

---

## ✅ Final Checklist

- [ ] Run npm install command
- [ ] Update Shop screen imports
- [ ] Update User screen imports
- [ ] Test compilation
- [ ] Coordinate with backend developer
- [ ] Order Wyze Cam v3
- [ ] Test with real camera
- [ ] Share WYZE_SETUP_GUIDE.md with shop owners

---

**Need help? Check the documentation files or contact the development team!** 🚀
