import { 
  signInWithCredential, 
  OAuthProvider, 
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  UserCredential
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { auth } from '../firebaseConfig';
import { API_URL, AUTH_TOKEN_KEY } from '../config';
import { clearCachedAccountType } from '../utils/accountCache';

// Custom error class for banned users
export class UserBannedError extends Error {
  constructor(message: string = 'Your account has been banned. Please contact the administrator for more information.') {
    super(message);
    this.name = 'UserBannedError';
  }
}

// Google Sign-In configuration - will be initialized lazily
let isGoogleSignInConfigured = false;
let GoogleSignin: any = null;

const configureGoogleSignIn = () => {
  if (isGoogleSignInConfigured) return;
  
  try {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
    GoogleSignin.configure({
      webClientId: '206970923878-9tp848lia7n64sv8qieitcehd13sno9k.apps.googleusercontent.com',
      offlineAccess: true,
    });
    isGoogleSignInConfigured = true;
  } catch (error) {
    console.error('Failed to configure Google Sign-In:', error);
    throw new Error('Google Sign-In is not available. Please rebuild the app with: npx expo run:android');
  }
};

// --- Interfaces ---
interface AuthState {
  user: FirebaseUser | null;
  idToken: string | null;
  loading: boolean;
}

interface FirebaseAuthContextValue {
  authState: AuthState;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isLoggedIn: boolean;
  authError: Error | null;
  clearAuthError: () => void;
}

// --- Firebase Authentication Hook ---
export function useFirebaseAuthentication(): FirebaseAuthContextValue {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    idToken: null,
    loading: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);

  // Monitor Firebase auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log('🔐 Firebase auth state changed:', user ? 'User logged in' : 'User logged out');
      
      if (user) {
        try {
          // Get Firebase ID token
          const idToken = await user.getIdToken();
          console.log('✅ Firebase ID token obtained');
          
          setAuthState({
            user,
            idToken,
            loading: false,
          });
          
          // Sync with backend
          await syncWithBackend(idToken);
        } catch (error) {
          console.error('❌ Error getting Firebase ID token:', error);
          setAuthError(error as Error);
          setAuthState({
            user: null,
            idToken: null,
            loading: false,
          });
        }
      } else {
        setAuthState({
          user: null,
          idToken: null,
          loading: false,
        });
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync Firebase user with backend
  const syncWithBackend = async (firebaseIdToken: string) => {
    try {
      console.log('🔄 Syncing Firebase user with backend...');
      
      const response = await axios.post(
        `${API_URL}/api/users/firebase-authenticate`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${firebaseIdToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      if (response.status === 200 && response.data.token) {
        console.log('✅ Backend sync successful');
        
        // Store backend JWT token for API calls
        const jwtToken = response.data.token;
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, jwtToken);
        
        // Store user data
        if (response.data.user) {
          const userData = response.data.user;
          
          // Check if user is banned
          if (userData.banned || userData.isBanned || (userData.offenses && userData.offenses >= 3)) {
            console.log('🚫 User is banned');
            await clearStoredAuthState();
            throw new UserBannedError();
          }
          
          // Store user info
          if (userData.id) {
            await AsyncStorage.setItem('userId', userData.id);
          }
          
          if (userData.accountType) {
            await AsyncStorage.setItem('accountType', userData.accountType);
            console.log('✅ Stored accountType:', userData.accountType);
            
            // Navigate based on account type
            switch (userData.accountType.toLowerCase()) {
              case 'shop':
                router.replace('/shop' as any);
                break;
              case 'dasher':
                router.replace('/dasher/orders' as any);
                break;
              case 'admin':
                router.replace('/admin/dashboard' as any);
                break;
              default:
                router.replace('/home');
            }
          } else {
            router.replace('/home');
          }
        }
      } else {
        throw new Error('Backend sync failed - no token received');
      }
    } catch (error: any) {
      console.error('❌ Backend sync error:', error);
      
      // Check for banned user error
      if (error instanceof UserBannedError) {
        throw error;
      }
      
      // Check response for banned status
      if (error.response?.data?.error?.includes('banned')) {
        throw new UserBannedError();
      }
      
      throw new Error('Failed to sync with backend. Please try again.');
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    setAuthError(null);
    setIsLoading(true);

    try {
      console.log('🔴 Starting Google sign-in flow');
      
      // Configure Google Sign-In (lazy initialization)
      configureGoogleSignIn();
      
      // Check if device supports Google Play Services
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // Sign in with Google
      const signInResponse = await GoogleSignin.signIn();
      console.log('✅ Google sign-in successful');
      
      // Get ID token from the response
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken;
      
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      // Create Google credential for Firebase
      const googleCredential = GoogleAuthProvider.credential(idToken);

      // Sign in to Firebase with Google credential
      await signInWithCredential(auth, googleCredential);
      console.log('✅ Signed in to Firebase with Google credential');
      
      // Firebase auth state listener will handle the rest
    } catch (error: any) {
      console.error('❌ Google sign-in error:', error);
      
      if (error.code === 'SIGN_IN_CANCELLED') {
        console.log('⚠️ Google sign-in cancelled by user');
      } else if (error.code === 'IN_PROGRESS') {
        console.log('⚠️ Google sign-in already in progress');
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        setAuthError(new Error('Google Play Services not available on this device.'));
      } else {
        setAuthError(new Error('Google sign-in failed. Please try again.'));
      }
      
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    setIsLoading(true);
    
    try {
      console.log('🚪 Starting sign out process...');
      
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      // Sign out from Google if needed
      try {
        if (isGoogleSignInConfigured && GoogleSignin) {
          await GoogleSignin.signOut();
          console.log('✅ Signed out from Google');
        }
      } catch (error) {
        console.warn('⚠️ Error signing out from Google (may not have been signed in):', error);
      }
      
      // Clear stored auth state
      await clearStoredAuthState();
      
      // Clear cached account type
      clearCachedAccountType();
      
      // Reset auth state
      setAuthState({
        user: null,
        idToken: null,
        loading: false,
      });
      
      // Navigate to login
      router.dismissAll();
      router.replace('/');
      
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      
      // Force navigation to login even if sign out failed
      router.replace('/');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear auth error
  const clearAuthError = () => {
    setAuthError(null);
  };

  return {
    authState,
    isLoading,
    signInWithGoogle,
    signOut,
    isLoggedIn: !!authState.user,
    authError,
    clearAuthError,
  };
}

// --- Helper Functions ---
export const clearStoredAuthState = async (): Promise<void> => {
  try {
    console.log('🗑️ Clearing stored auth state...');
    
    // Clear cached account type
    clearCachedAccountType();
    
    // Clear auth token
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    
    // Clear user data
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('accountType');
    await AsyncStorage.removeItem('@CampusEats:UserData');
    
    console.log('✅ Auth state cleared');
  } catch (error) {
    console.error('❌ Error clearing auth state:', error);
  }
};

// Get Firebase ID token (for API calls if needed)
export const getFirebaseIdToken = async (): Promise<string | null> => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('⚠️ No Firebase user logged in');
      return null;
    }
    
    // Get fresh token (force refresh if needed)
    const idToken = await currentUser.getIdToken(true);
    return idToken;
  } catch (error) {
    console.error('❌ Error getting Firebase ID token:', error);
    return null;
  }
};

// Get backend JWT token (for API calls)
export const getBackendAuthToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('❌ Error getting backend auth token:', error);
    return null;
  }
};
