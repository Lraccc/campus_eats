# Post-Migration Checklist

## Immediate Actions

### 1. Verify Changes
- [x] `config.ts` contains Agora credentials
- [x] `app.config.js` has camera/microphone plugins
- [x] `LiveStreamBroadcaster.tsx` uses Agora SDK
- [x] `LiveStreamViewer.tsx` uses Agora SDK
- [x] `package.json` includes Agora dependencies
- [x] No TypeScript/linting errors

### 2. Commit Changes
```bash
git status
git add .
git commit -m "feat: Migrate to Agora SDK for live streaming

- Replace IP camera/WebView with Agora RTC SDK
- Add LiveStreamBroadcaster with phone camera support
- Add LiveStreamViewer with real-time streaming
- Configure camera and microphone permissions
- Add comprehensive documentation

Resolves live streaming requirements for Expo SDK 52"
```

### 3. Push to GitHub
```bash
git push origin agora
```

---

## Build & Test

### 1. GitHub Actions Build
- [ ] Push triggers GitHub Actions workflow
- [ ] Workflow runs `expo prebuild --platform android`
- [ ] Workflow builds APK successfully
- [ ] Download APK from GitHub Actions artifacts

### 2. Install on Device
- [ ] Transfer APK to Android device
- [ ] Install APK (enable "Install from unknown sources")
- [ ] Open app successfully

### 3. Test Permissions
- [ ] App requests camera permission
- [ ] App requests microphone permission
- [ ] Permissions can be granted
- [ ] App works after granting permissions

---

## Broadcaster Testing

### Shop Owner Flow
- [ ] Navigate to shop management/livestream section
- [ ] Camera preview appears
- [ ] Tap "Start Livestream"
- [ ] Stream starts successfully
- [ ] "LIVE" indicator shows
- [ ] Viewer count shows (0 initially)
- [ ] Can toggle front/back camera
- [ ] Can mute/unmute microphone
- [ ] Tap "End Livestream"
- [ ] Confirmation dialog appears
- [ ] Stream ends successfully

### Error Scenarios
- [ ] Deny camera permission - shows permission request UI
- [ ] Deny microphone permission - shows permission request UI
- [ ] No internet - shows connection error
- [ ] Rapid start/stop - handles gracefully

---

## Viewer Testing

### Customer Flow
- [ ] Navigate to shop with active stream
- [ ] Tap "Watch Live" button
- [ ] Stream loads and plays
- [ ] Video displays correctly
- [ ] Audio plays correctly
- [ ] "LIVE" indicator shows
- [ ] Can mute/unmute audio
- [ ] Tap "Close" button
- [ ] Returns to shop page

### Error Scenarios
- [ ] No active stream - shows offline message
- [ ] Broadcaster ends stream - shows disconnect message
- [ ] No internet - shows connection error
- [ ] Can retry connection

---

## Multi-User Testing

### Concurrent Streaming
- [ ] Broadcaster starts stream
- [ ] Viewer 1 joins successfully
- [ ] Viewer count shows 1
- [ ] Viewer 2 joins successfully
- [ ] Viewer count shows 2
- [ ] Both viewers see the stream
- [ ] Viewer 1 leaves
- [ ] Viewer count shows 1
- [ ] Broadcaster ends stream
- [ ] All viewers see disconnect

---

## Performance Testing

### Network Conditions
- [ ] Test on Wi-Fi - smooth streaming
- [ ] Test on 4G/LTE - acceptable quality
- [ ] Test on 3G - handles degradation
- [ ] Test switching networks - reconnects

### Device Testing
- [ ] Test on low-end device - acceptable performance
- [ ] Test on mid-range device - good performance
- [ ] Test on high-end device - excellent performance

---

## Integration Testing

### Backend Integration
- [ ] Stream start creates session in backend
- [ ] Stream end updates session in backend
- [ ] Streaming status updates correctly
- [ ] Channel name format matches (`shop_${shopId}`)

### Frontend Integration
- [ ] Component integrates with shop pages
- [ ] Modal/navigation works correctly
- [ ] State management works
- [ ] No memory leaks

---

## Production Readiness

### Security
- [ ] Review Agora credentials location
- [ ] Plan server-side token generation
- [ ] Implement token expiration
- [ ] Validate shopId on backend

### Monitoring
- [ ] Check Agora Console usage
- [ ] Monitor free tier limits (10,000 min/month)
- [ ] Set up usage alerts
- [ ] Plan for scaling costs

### Documentation
- [ ] `AGORA_LIVESTREAM_SETUP.md` reviewed
- [ ] `MIGRATION_SUMMARY.md` reviewed
- [ ] Team briefed on new system
- [ ] Support documentation updated

---

## Known Limitations

### Current Implementation
- Token authentication disabled (using null token)
- No chat functionality yet
- No product pinning during stream
- No stream recording
- No beauty filters/effects

### Future Enhancements
- [ ] Implement server-side token generation
- [ ] Add chat during livestream
- [ ] Add product pinning overlay
- [ ] Add stream recording
- [ ] Add viewer analytics
- [ ] Add beauty filters
- [ ] Add screen sharing option

---

## Troubleshooting

If you encounter issues, refer to:
1. `AGORA_LIVESTREAM_SETUP.md` - Section: Troubleshooting
2. Agora Console - Check logs and analytics
3. Android Logcat - Check native errors
4. Network Inspector - Check API calls

---

## Sign-Off

### Developer Checklist
- [x] Code refactored
- [x] No errors/warnings
- [x] Documentation complete
- [x] Ready for testing

### QA Checklist (To be completed)
- [ ] All tests passed
- [ ] No critical bugs
- [ ] Performance acceptable
- [ ] Ready for production

### Deployment Checklist (To be completed)
- [ ] APK built successfully
- [ ] Tested on multiple devices
- [ ] Backend ready
- [ ] Team trained
- [ ] Monitoring configured

---

**Status**: ✅ Development Complete - Ready for Build & Test  
**Next Step**: Push to GitHub and trigger workflow build  
**Date**: November 21, 2025
