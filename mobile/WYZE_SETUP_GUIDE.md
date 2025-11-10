# Wyze Cam v3 Integration Guide for Campus Eats

## Overview
This guide explains how to set up Wyze Cam v3 cameras for live streaming food availability in Campus Eats shops.

---

## 📋 What You'll Need

1. **Wyze Cam v3** ($25-35 on Amazon)
2. **WiFi Network** (same network as shop's phone)
3. **Wyze App** (iOS/Android)
4. **Campus Eats Shop Account**

---

## 🔧 Part 1: Wyze Camera Setup

### Step 1: Initial Camera Setup
1. Download the **Wyze app** from App Store or Google Play
2. Create a Wyze account or sign in
3. Plug in your Wyze Cam v3
4. In Wyze app, tap **"+"** → **"Add Device"** → **"Cameras"** → **"Wyze Cam v3"**
5. Follow the on-screen instructions to connect camera to WiFi
6. Position camera to show your food display area

### Step 2: Enable RTSP (Required for Streaming)

**Important: RTSP firmware is needed for Campus Eats integration**

1. In Wyze app, select your camera
2. Tap the **Settings gear icon** (top right)
3. Scroll down to **"Advanced Settings"**
4. Tap **"Firmware Version"**
5. Look for **"RTSP"** option
   - If available, tap **"Install RTSP"** and wait for installation
   - If not available, check Wyze support for RTSP firmware download

### Step 3: Configure RTSP Credentials

1. After RTSP firmware is installed, go back to **Advanced Settings**
2. Find and enable **"RTSP"**
3. Set your **RTSP credentials**:
   - **Username**: `admin` (recommended)
   - **Password**: Choose a strong password (you'll need this later)
4. Take note of:
   - **RTSP URL** (shown in the app)
   - **Username and Password** (you just set)

### Step 4: Get Camera IP Address

**Option A: From Router**
1. Log into your WiFi router admin panel
2. Look for "Connected Devices" or "DHCP Clients"
3. Find your Wyze camera (usually named "WYZECAM" + numbers)
4. Note the IP address (e.g., `192.168.1.100`)

**Option B: From Wyze App**
1. Open Wyze app
2. Select your camera
3. Tap Settings → Device Info
4. Look for "IP Address"
5. Write it down (e.g., `192.168.1.100`)

**Important: Consider setting a Static IP**
- In your router settings, assign a static/reserved IP to the camera
- This prevents the IP from changing and breaking your stream

---

## 📱 Part 2: Campus Eats App Configuration

### Step 1: Open Shop Stream Settings

1. Open **Campus Eats app** as Shop Owner
2. Go to your **Shop Dashboard**
3. Tap **"Start Live Stream"** or **"Live Stream Settings"**
4. Tap the **Settings gear icon**

### Step 2: Enter Wyze Camera Information

Fill in the configuration form:

| Field | Value | Example |
|-------|-------|---------|
| **Camera Name** | Friendly name for your camera | "Food Display Camera" |
| **Camera IP Address** | IP from Step 4 above | `192.168.1.100` |
| **RTSP Username** | Username you set in Wyze app | `admin` |
| **RTSP Password** | Password you set in Wyze app | `your_secure_password` |
| **Port** | Usually 8554 (default) | `8554` |

### Step 3: Save and Test

1. Tap **"Save & Start Streaming"**
2. App will attempt to connect to your camera
3. If successful, you'll see your camera feed
4. Customers can now view your food display!

---

## 🎥 Part 3: Using the Live Stream

### For Shop Owners:

**Starting a Stream:**
1. Position camera to show food display
2. Tap "Start Live Stream" in app
3. Stream goes live automatically
4. "LIVE" indicator shows it's broadcasting

**Ending a Stream:**
1. Tap "End Stream" button
2. Confirm to stop broadcasting
3. Stream stops for all viewers

**Tips:**
- Keep camera plugged in and connected to WiFi
- Position at eye level showing food clearly
- Ensure good lighting for better video quality
- Clean camera lens regularly

### For Customers:

**Viewing a Stream:**
1. Browse shops in Campus Eats
2. Look for shops with camera icon or "Live" badge
3. Tap to view live food display
4. See what's available in real-time!

---

## 🔧 Troubleshooting

### Problem: "Stream Connection Failed"

**Possible Causes & Solutions:**

1. **Wrong IP Address**
   - Check camera IP hasn't changed
   - Go to router and verify IP
   - Consider setting static IP in router

2. **Wrong Credentials**
   - Verify RTSP username/password in Wyze app
   - Re-enter credentials in Campus Eats app

3. **RTSP Not Enabled**
   - Check Wyze app → Settings → Advanced Settings
   - Ensure RTSP toggle is ON

4. **Different WiFi Network**
   - Camera and phone must be on same WiFi
   - Check both devices are connected to same network

5. **Firewall Blocking**
   - Check if campus network blocks RTSP (port 8554)
   - May need to contact network admin

### Problem: "Stream Loads But No Video"

1. **Camera is Off/Disconnected**
   - Check camera has power
   - Verify camera is online in Wyze app

2. **Wrong Port Number**
   - Default is 8554 for Wyze RTSP
   - Verify in Wyze app settings

3. **Bandwidth Issues**
   - Check WiFi signal strength
   - Move camera closer to router if needed

### Problem: "Slow/Laggy Stream"

1. **Weak WiFi Signal**
   - Move camera closer to router
   - Or add WiFi extender

2. **Busy Network**
   - Avoid peak hours if possible
   - Consider dedicated WiFi for camera

3. **Use HLS Instead of RTSP**
   - Contact Campus Eats support
   - Backend can convert RTSP to HLS for better performance

---

## 🌟 Best Practices

### Camera Positioning:
- ✅ Mount at eye level
- ✅ Show food display clearly
- ✅ Stable mounting (avoid shaking)
- ✅ Good lighting
- ❌ Don't point at bright windows (causes glare)
- ❌ Avoid areas with lots of movement

### Network:
- ✅ Use 2.4GHz WiFi (better range)
- ✅ Set static IP for camera
- ✅ Strong WiFi signal
- ❌ Don't use public/guest WiFi
- ❌ Avoid congested networks

### Security:
- ✅ Use strong RTSP password
- ✅ Change default credentials
- ✅ Keep Wyze firmware updated
- ❌ Don't share RTSP credentials publicly

---

## 🔄 Alternative: HLS Streaming (Recommended for Production)

For better mobile compatibility and reliability, ask your Campus Eats administrator to set up **HLS conversion** on the backend.

**Benefits:**
- ✅ Works on all networks (no port blocking issues)
- ✅ Better mobile compatibility
- ✅ Lower latency
- ✅ More reliable

**How it works:**
1. Your Wyze camera streams RTSP to backend server
2. Backend converts RTSP to HLS automatically
3. Mobile apps receive HLS stream (works everywhere)

Contact your Campus Eats tech support for HLS setup.

---

## 📞 Support

### Wyze Support:
- Website: https://support.wyze.com
- RTSP Firmware: https://support.wyze.com/hc/en-us/articles/360026245231

### Campus Eats Support:
- Contact your campus admin
- Or email: support@campuseats.com

---

## 📝 Quick Reference Card

**Print this and keep near your camera:**

```
═══════════════════════════════════════
    WYZE CAM v3 QUICK SETUP
    For Campus Eats Food Display
═══════════════════════════════════════

Camera IP: _____._____._____._____ 

RTSP Username: _________________

RTSP Password: _________________

Port: 8554 (default)

═══════════════════════════════════════
TROUBLESHOOTING:
1. Check camera power
2. Verify WiFi connection  
3. Confirm IP hasn't changed
4. Re-enter credentials if needed
═══════════════════════════════════════
```

---

## ✅ Checklist

Before going live, verify:

- [ ] Wyze Cam v3 purchased and set up
- [ ] RTSP firmware installed
- [ ] RTSP enabled with credentials set
- [ ] Camera IP address noted
- [ ] Static IP configured in router (recommended)
- [ ] Camera positioned correctly
- [ ] Good WiFi signal at camera location
- [ ] Credentials entered in Campus Eats app
- [ ] Test stream successful
- [ ] Camera shows food display clearly

---

**You're all set! Happy streaming! 🎥🍕**
