import * as React from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
  makeRedirectUri,
  useAuthRequest,
  exchangeCodeAsync,
  AuthSessionRedirectUriOptions,
  AuthRequestPromptOptions
} from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

// Ensure the web browser closes correctly
WebBrowser.maybeCompleteAuthSession();

// Constants
const AUTH_STORAGE_KEY = '@CampusEats:Auth';
export const AUTH_TOKEN_KEY = '@CampusEats:AuthToken';

// --- OAuth Configuration ---
const tenantId = '823cde44-4433-456d-b801-bdf0ab3d41fc';
const clientId = '6533df52-b33b-4953-be58-6ae5caa69797';
const scopes = [
  'openid',
  'profile',
  'email',
  'api://6533df52-b33b-4953-be58-6ae5caa69797/access_as_user'
];

// Endpoint configuration for Azure AD v2.0
const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
};

// --- Interfaces ---
interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
}

interface AuthState {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
  issuedAt?: number;
}

interface AuthContextValue {
  authState: AuthState | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  isLoggedIn: boolean;
}

// --- Utility Functions ---
const isTokenExpired = (token: string): boolean => {
  try {
    // JWT tokens are base64 encoded with 3 parts: header.payload.signature
    const payload = token.split('.')[1];
    const decodedPayload = JSON.parse(atob(payload));
    const expirationTime = decodedPayload.exp * 1000; // Convert to milliseconds
    return Date.now() >= expirationTime;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // Assume expired on error
  }
};

// Check if a token has valid JWT format (has 3 parts separated by dots)
const isValidTokenFormat = (token: string | null): boolean => {
  if (!token) return false;

  // Valid JWT token should have 3 parts separated by dots
  const parts = token.split('.');
  return parts.length === 3;
};

// Setup auth headers for axios or fetch
const setupAuthHeaders = (token: string): void => {
  // Never add "Bearer " prefix - based on logs, the raw token works better with this backend
  console.log('Auth token set for future requests (using raw token format)');
};

// --- Traditional Auth Service ---
export const authService = {
  async login(credentials: LoginCredentials) {
    console.log(`Attempting login for: ${credentials.email}`);

    try {
      const response = await fetch(`${API_URL}/api/users/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usernameOrEmail: credentials.email,
          password: credentials.password,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        try {
          const error = JSON.parse(responseText);
          throw new Error(error.message || error.error || `Login failed with status ${response.status}`);
        } catch (parseError) {
          throw new Error(responseText || `Login failed with status ${response.status}`);
        }
      }

      const data = await response.json();

      // Store the token for future API calls - remove 'Bearer ' prefix if it exists
      if (data.token) {
        const cleanToken = data.token.startsWith('Bearer ') ? data.token.substring(7) : data.token;
        console.log(`Storing clean token (first 10 chars): ${cleanToken.substring(0, 10)}...`);
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, cleanToken);
        setupAuthHeaders(cleanToken);

        // Extract and store the userId from the JWT token
        try {
          // Parse the JWT token payload (second part of the token)
          const tokenParts = cleanToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));

            // Extract the user ID from the payload
            // JWT tokens can use different fields for the user ID
            const userId = payload.sub || payload.userId || payload.id || payload.oid;

            if (userId) {
              console.log(`Extracted userId from token: ${userId}`);
              await AsyncStorage.setItem('userId', userId);
            } else if (data.userId) {
              // Fallback: If the response contains a userId directly
              console.log(`Using userId from response: ${data.userId}`);
              await AsyncStorage.setItem('userId', data.userId);
            }
          }
        } catch (error) {
          console.error('Error extracting userId from token:', error);

          // Even if token parsing fails, try to use userId from the response if available
          if (data.userId) {
            console.log(`Using userId from response data: ${data.userId}`);
            await AsyncStorage.setItem('userId', data.userId);
          }
        }
      }

      console.log('Login successful, received token');
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  async signup(userData: SignupData) {
    try {
      const response = await fetch(`${API_URL}/api/users/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Signup failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  async refreshToken(refreshToken: string) {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      if (data.token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
        setupAuthHeaders(data.token);
      }

      return data;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }
};

// --- OAuth Authentication Hook ---
export function useAuthentication(): AuthContextValue {
  const [authState, setAuthState] = React.useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Use a single, consistent redirect URI for development
  // This should be registered in Azure AD app registration
  const redirectUri = "exp://192.168.1.22:8081";

  // Set up auth request
  const [request, response, promptAsync] = useAuthRequest(
      {
        clientId: clientId,
        scopes: scopes,
        redirectUri: redirectUri,
        usePKCE: true,
        responseType: 'code',
      },
      discovery
  );

  // Load stored auth state on initial mount
  React.useEffect(() => {
    const loadAuthState = async () => {
      setIsLoading(true);
      try {
        // Check traditional token first
        const traditionalToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (traditionalToken && !isValidTokenFormat(traditionalToken)) {
          console.warn("Found invalid traditional token format, clearing...");
          await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
        }

        // Check OAuth token
        const storedAuth = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (storedAuth) {
          console.log("Found stored OAuth state, attempting to parse");
          const parsedAuth = JSON.parse(storedAuth);

          // Validate token format first
          if (!parsedAuth.accessToken || !isValidTokenFormat(parsedAuth.accessToken)) {
            console.warn("Found invalid OAuth token format, clearing stored auth...");
            await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
            setAuthState(null);
            setIsLoading(false);
            return;
          }

          // Check if token is expired and needs refresh
          if (parsedAuth.accessToken && isTokenExpired(parsedAuth.accessToken) && parsedAuth.refreshToken) {
            try {
              console.log("OAuth token expired, attempting refresh");
              const refreshResult = await authService.refreshToken(parsedAuth.refreshToken);
              if (refreshResult.token) {
                console.log("OAuth token refresh successful");
                const refreshedState = {
                  ...parsedAuth,
                  accessToken: refreshResult.token
                };
                await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshedState));
                setAuthState(refreshedState);
              } else {
                // Token refresh failed, clear state
                console.warn("OAuth token refresh failed, clearing state");
                await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
                setAuthState(null);
              }
            } catch (refreshError) {
              console.error("Failed to refresh token:", refreshError);
              await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
              setAuthState(null);
            }
          } else {
            // Token is still valid
            console.log("OAuth token is valid, setting auth state");
            setAuthState(parsedAuth);
          }
        } else {
          console.log("No stored OAuth state found");
        }
      } catch (error) {
        console.error("Failed to load auth state from storage:", error);
        // On error, clear all auth tokens to be safe
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
        setAuthState(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadAuthState();
  }, []);

  // Handle auth response
  React.useEffect(() => {
    const handleAuthResponse = async () => {
      if (response) {
        setIsLoading(true);

        if (response.type === 'success' && request?.codeVerifier) {
          const { code } = response.params;
          try {
            console.log("📥 Exchanging authorization code for token");

            const tokenResponse = await exchangeCodeAsync(
                {
                  clientId: clientId,
                  code: code,
                  redirectUri: redirectUri,
                  extraParams: {
                    code_verifier: request.codeVerifier,
                  },
                },
                discovery
            );

            // Store tokens - ensure we're storing without 'Bearer ' prefix
            const cleanToken = tokenResponse.accessToken.startsWith('Bearer ')
                ? tokenResponse.accessToken.substring(7)
                : tokenResponse.accessToken;

            console.log(`Storing OAuth token (first 10 chars): ${cleanToken.substring(0, 10)}...`);

            await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
              ...tokenResponse,
              accessToken: cleanToken
            }));

            setAuthState({
              ...tokenResponse,
              accessToken: cleanToken
            });

            // Also store the access token for the traditional auth flow
            await AsyncStorage.setItem(AUTH_TOKEN_KEY, cleanToken);
            setupAuthHeaders(cleanToken);

            // Extract and store userId from the token
            try {
              console.log("Extracting userId from OAuth token");
              const parts = cleanToken.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                console.log("OAuth token payload keys:", Object.keys(payload));

                // Extract userId from token - different OAuth providers use different fields
                const userId = payload.sub || payload.oid || payload.id || payload.userId;

                if (userId) {
                  console.log(`Extracted userId from OAuth token: ${userId}`);
                  await AsyncStorage.setItem('userId', userId);
                } else {
                  console.warn("No userId found in OAuth token");
                }
              }
            } catch (error) {
              console.error("Error extracting userId from OAuth token:", error);
            }

            // Sync with backend
            try {
              console.log(`Syncing OAuth token with backend (first 10 chars): ${cleanToken.substring(0, 10)}...`);

              // Detailed token info
              console.log(`Token length: ${cleanToken.length}`);

              // Log some basic token info
              const parts = cleanToken.split('.');
              if (parts.length === 3) {
                try {
                  // Don't actually import jwt-decode, just decode manually for debugging
                  const header = JSON.parse(atob(parts[0]));
                  console.log("Token header:", header);

                  // Log token payload keys for debugging (without values for security)
                  const payload = JSON.parse(atob(parts[1]));
                  console.log("Token has these claims:", Object.keys(payload));
                } catch (e) {
                  console.error("Error parsing token parts:", e);
                }
              }

              const syncResponse = await fetch(`${API_URL}/api/users/azure-authenticate`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${cleanToken}`,
                  'Content-Type': 'application/json'
                },
              });

              // More detailed response handling
              console.log(`Backend response status: ${syncResponse.status}`);

              if (!syncResponse.ok) {
                const errorBody = await syncResponse.text();
                console.error(`Azure Auth Failed: Status ${syncResponse.status}, Body: ${errorBody}`);

                // On 400/401, we'll try again but with extra debugging
                if (syncResponse.status === 400 || syncResponse.status === 401) {
                  console.warn("Authentication issue - will retry with additional logging");

                  // Try again with the /me endpoint which should be more lenient
                  try {
                    console.log("Trying /me endpoint as fallback...");
                    const meResponse = await fetch(`${API_URL}/api/users/me`, {
                      headers: {
                        'Authorization': `Bearer ${cleanToken}`
                      }
                    });

                    if (meResponse.ok) {
                      const userData = await meResponse.json();
                      console.log("Successfully retrieved user data via /me endpoint");
                      await AsyncStorage.setItem('@CampusEats:UserData', JSON.stringify(userData));

                      // Store userId from the user data if available
                      if (userData && userData.id) {
                        console.log(`Storing userId from /me endpoint: ${userData.id}`);
                        await AsyncStorage.setItem('userId', userData.id);
                      }

                      // We still set the token for future requests
                      await AsyncStorage.setItem(AUTH_TOKEN_KEY, cleanToken);
                      setupAuthHeaders(cleanToken);
                      return; // Success path
                    } else {
                      console.error(`/me endpoint also failed: ${await meResponse.text()}`);
                    }
                  } catch (meError) {
                    console.error("Error with /me fallback:", meError);
                  }
                }

                // Token validation failed
                console.warn("Authentication failed - user will need to sign in again");
                setAuthState(null);
              } else {
                const userData = await syncResponse.json();
                console.log("Azure Authentication Successful. User data:", userData);
                // Store user data for future reference
                if (userData && userData.user) {
                  await AsyncStorage.setItem('@CampusEats:UserData', JSON.stringify(userData.user));

                  // Store userId from the user data if available
                  if (userData.user.id) {
                    console.log(`Storing userId from Azure Auth response: ${userData.user.id}`);
                    await AsyncStorage.setItem('userId', userData.user.id);
                  }
                }
              }
            } catch (syncError) {
              console.error("Error during Azure Auth call:", syncError);
              setAuthState(null);
            }
          } catch (error) {
            console.error("TOKEN EXCHANGE FAILED:", error);
            setAuthState(null);
          } finally {
            setIsLoading(false);
          }
        } else if (response.type === 'error') {
          console.error("AUTH RESPONSE ERROR:", response.error);
          setAuthState(null);
          setIsLoading(false);
        } else {
          console.log("Auth flow canceled or dismissed");
          setIsLoading(false);
        }
      }
    };

    handleAuthResponse();
  }, [response, request]);

  // Sign in function
  const signIn = async () => {
    if (!request) {
      console.error("Auth request not loaded yet. Please try again in a moment.");
      return;
    }

    try {
      console.log("Starting OAuth sign-in process with Azure AD");
      // Clear any existing tokens before starting a new auth flow
      // This prevents potential conflicts between old and new tokens
      await clearStoredAuthState();

      const authResult = await promptAsync();
      console.log("OAuth prompt completed with result type:", authResult.type);

      if (authResult.type !== 'success') {
        console.warn(`OAuth sign-in was not successful: ${authResult.type}`);
      }
    } catch (error) {
      console.error("Error during OAuth sign-in:", error);
    }
  };

  // Sign out function
  const signOut = async () => {
    setIsLoading(true);
    try {
      // Use the more aggressive clearing function
      await clearStoredAuthState();

      // Set state to null after storage is cleared
      setAuthState(null);
      console.log("Signed out successfully");
    } catch (error) {
      console.error("Failed to clear auth state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get access token with auto-refresh
  const getAccessToken = async () => {
    const currentAuthState = authState || JSON.parse(await AsyncStorage.getItem(AUTH_STORAGE_KEY) || 'null');

    if (!currentAuthState) return null;

    // Check if token needs refresh
    if (currentAuthState.accessToken && isTokenExpired(currentAuthState.accessToken) && currentAuthState.refreshToken) {
      try {
        const refreshResult = await authService.refreshToken(currentAuthState.refreshToken);
        if (refreshResult.token) {
          const refreshedState = {
            ...currentAuthState,
            accessToken: refreshResult.token
          };
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshedState));
          setAuthState(refreshedState);
          return refreshResult.token;
        }
      } catch (error) {
        console.error("Token refresh failed during getAccessToken:", error);
        return null;
      }
    }

    return currentAuthState.accessToken;
  };

  return {
    authState,
    isLoading,
    signIn: async () => await signIn(),
    signOut: async () => await signOut(),
    getAccessToken,
    isLoggedIn: !!authState?.accessToken,
  };
}

// --- Standalone Functions ---
export const getStoredAuthState = async (): Promise<AuthState | null> => {
  try {
    const storedAuth = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    return storedAuth ? JSON.parse(storedAuth) : null;
  } catch (error) {
    console.error('Error retrieving stored auth state:', error);
    return null;
  }
};

export const clearStoredAuthState = async (): Promise<void> => {
  try {
    console.log("🔴 CLEARING ALL AUTH STORAGE - START");

    // First clear specific auth keys
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    console.log("✓ Cleared AUTH_STORAGE_KEY");

    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    console.log("✓ Cleared AUTH_TOKEN_KEY");

    // Get all keys to check for any other auth-related data
    const allKeys = await AsyncStorage.getAllKeys();
    console.log("Current AsyncStorage keys:", allKeys);

    // Clear any other auth related keys that might be lingering
    const authRelatedKeys = allKeys.filter(key =>
        key.includes('Auth') ||
        key.includes('auth') ||
        key.includes('token') ||
        key.includes('Token') ||
        key.includes('CampusEats')
    );

    if (authRelatedKeys.length > 0) {
      console.log("Found additional auth-related keys:", authRelatedKeys);
      await AsyncStorage.multiRemove(authRelatedKeys);
      console.log("✓ Cleared additional auth-related keys");
    }

    // DEVELOPMENT MODE: If still having issues, uncomment to clear ALL storage
    // console.log("⚠️ DEVELOPMENT MODE: Clearing ALL AsyncStorage");
    // await AsyncStorage.clear();
    // console.log("✓ Cleared ALL AsyncStorage");

    console.log("🔴 CLEARING ALL AUTH STORAGE - COMPLETE");
  } catch (error) {
    console.error("Failed to clear auth state:", error);
  }
};

// Get token from storage (helper function for non-hook environments)
export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
}; 