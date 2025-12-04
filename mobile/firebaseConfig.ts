import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Firebase configuration
// In production, these values should come from environment variables
// injected through app.config.js and GitHub Secrets
const firebaseConfig = {
  // TODO: Replace with your Firebase project configuration
  // Get these values from Firebase Console → Project Settings → General → Your apps → Web app
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || "AIzaSyDC0pn255sgIVhl-kV8rGTtwdaGUIKuOCs",
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || "campuseats-c1e0d.firebaseapp.com",
  projectId: Constants.expoConfig?.extra?.firebaseProjectId || "campuseats-c1e0d",
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || "campuseats-c1e0d.firebasestorage.app",
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || "206970923878",
  appId: Constants.expoConfig?.extra?.firebaseAppId || "1:206970923878:web:aa92af58647e3cd6abf6a7",
};

// Initialize Firebase
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully');
} else {
  app = getApp();
  console.log('✅ Firebase already initialized');
}

// Initialize Firebase Auth with AsyncStorage persistence
// This ensures authentication state persists across app restarts
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  console.log('✅ Firebase Auth initialized with persistence');
} catch (error) {
  // Auth might already be initialized
  auth = getAuth(app);
  console.log('✅ Firebase Auth already initialized');
}

export { app, auth };
export default app;
