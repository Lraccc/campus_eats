# 🚀 Quick Start Guide - Firebase OAuth

## 5-Minute Setup Checklist

### Step 1: Firebase Console (5 min)
- [ ] Go to [Firebase Console](https://console.firebase.google.com/)
- [ ] Create project → Enable Authentication → Enable Facebook & Google
- [ ] Download service account JSON
- [ ] Get Web app config values

### Step 2: Mobile App Config (3 min)
```typescript
// mobile/firebaseConfig.ts - Line 14
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

```typescript
// mobile/services/firebaseAuthService.ts - Line 41
GoogleSignin.configure({
  webClientId: 'PASTE_WEB_CLIENT_ID_HERE',
  offlineAccess: true,
});
```

### Step 3: Add google-services.json (1 min)
```
mobile/android/app/google-services.json  ← Download from Firebase
```

### Step 4: Backend Config (2 min)
```properties
# backend/campuseats/src/main/resources/application.properties
firebase.service-account.path=/path/to/firebase-service-account.json
```

### Step 5: Install & Run (5 min)
```bash
# Mobile
cd mobile
npm install
expo prebuild --clean
expo run:android

# Backend  
cd backend/campuseats
./mvnw clean install
./mvnw spring-boot:run
```

---

## ⚡ What You Get

✅ **Facebook Sign-In** (via Firebase)  
✅ **Google Sign-In** (via Firebase)  
✅ **Traditional Login** (username/password)  
✅ **Auto-create users** from OAuth  
✅ **Banned user detection**  
✅ **Secure token validation**  

---

## 🔑 Key Configuration Values

### Find in Firebase Console

| Value | Location |
|-------|----------|
| API Key | Project Settings → General → Web app config |
| Project ID | Project Settings → General |
| Web Client ID | Authentication → Google → Web Client ID |
| Service Account | Project Settings → Service Accounts → Generate Key |

---

## 🧪 Quick Test

```bash
# 1. Start backend
cd backend/campuseats && ./mvnw spring-boot:run

# 2. Start mobile app
cd mobile && expo start

# 3. Test each sign-in method:
#    - Facebook button → Should open Facebook login
#    - Google button → Should open Google account picker
#    - Traditional → Username/password still works
```

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Firebase not initialized" | Check `firebaseConfig.ts` values |
| "Google Sign-In failed" | Add `google-services.json` to `android/app/` |
| "Backend sync failed" | Check backend is running on correct port |
| "Invalid Firebase token" | Verify service account path is correct |

---

## 📚 Full Documentation

- **Complete Guide:** `FIREBASE_MIGRATION_GUIDE.md`
- **Setup Instructions:** `FIREBASE_SETUP_INSTRUCTIONS.md`
- **Implementation Summary:** `FIREBASE_IMPLEMENTATION_SUMMARY.md`

---

## 📂 Files to Update

### Mobile (3 files):
1. `mobile/firebaseConfig.ts` - Firebase config
2. `mobile/services/firebaseAuthService.ts` - Web Client ID
3. `mobile/android/app/google-services.json` - Download from Firebase

### Backend (1 file):
1. `backend/campuseats/src/main/resources/application.properties` - Service account path

---

## 🎯 Success Indicators

✅ Backend logs: `✅ Firebase Admin SDK initialized successfully`  
✅ Mobile app: Facebook/Google buttons visible  
✅ Click button → Opens OAuth flow → Returns to app logged in  
✅ MongoDB: New user created with `firebaseUid` field  

---

**Need Help?** Check the full guides or contact support: campuseatsv2@gmail.com
