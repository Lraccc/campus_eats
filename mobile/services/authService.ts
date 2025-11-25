import * as React from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
  makeRedirectUri,
  useAuthRequest,
  exchangeCodeAsync,
  AuthSessionRedirectUriOptions,
  AuthRequestPromptOptions,
  AuthSessionResult
} from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, redirectUri } from '../config';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { clearCachedAccountType } from '../utils/accountCache';

// Ensure the web browser closes correctly and auth session completes
// This is crucial for proper deep link handling in production
WebBrowser.maybeCompleteAuthSession();

// Configure WebBrowser for better production behavior
WebBrowser.coolDownAsync();

// Constants
const AUTH_STORAGE_KEY = '@CampusEats:Auth';
export const AUTH_TOKEN_KEY = '@CampusEats:AuthToken';

// Custom error class for banned users
export class UserBannedError extends Error {
  constructor(message: string = 'Your account has been banned. Please contact the administrator for more information.') {
    super(message);
    this.name = 'UserBannedError';
  }
}

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
  getUserData: () => Promise<any | null>;
  isLoggedIn: boolean;
  authError: Error | null;
  clearAuthError: () => void;
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
    console.log(`Using API URL: ${API_URL}/api/users/authenticate`);

    // Retry logic for stale connections
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`Retry attempt ${attempt} after connection failure...`);
          // Small delay before retry to let connection reset
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Add timeout to prevent infinite waiting
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for slower connections/Render cold starts

        console.log('Sending login request to backend...');
        const response = await fetch(`${API_URL}/api/users/authenticate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'close', // Force new connection to avoid stale connections
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({
            usernameOrEmail: credentials.email,
            password: credentials.password,
          }),
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });

        console.log(`Received response with status: ${response.status}`);

      if (!response.ok) {
        const responseText = await response.text();
        console.log(`Error response body: ${responseText}`);
        try {
          const error = JSON.parse(responseText);
          const errorMessage = error.message || error.error || '';

          // Provide more specific error messages based on status code and response content
          if (response.status === 401) {
            if (errorMessage.toLowerCase().includes('password')) {
              throw new Error('Incorrect password');
            } else {
              throw new Error('Invalid login credentials');
            }
          } else if (response.status === 404 || errorMessage.toLowerCase().includes('not found')) {
            throw new Error('User does not exist');
          } else if (response.status === 429) {
            throw new Error('Too many login attempts. Please try again later');
          } else if (response.status >= 500) {
            throw new Error('Server error. Please try again later');
          } else if (errorMessage.toLowerCase().includes('banned')) {
            throw new Error('Your account has been banned. Please contact the administrator for more information.');
          } else {
            throw new Error(errorMessage || `Login failed with status ${response.status}`);
          }
        } catch (parseError) {
          // Handle non-JSON responses
          if (response.status === 401) {
            throw new Error('Invalid login credentials');
          } else if (response.status === 404) {
            throw new Error('User does not exist');
          } else if (responseText && responseText.toLowerCase().includes('banned')) {
            throw new Error('Your account has been banned. Please contact the administrator for more information.');
          } else {
            throw new Error(responseText || `Login failed with status ${response.status}`);
          }
        }
      }

      console.log('Parsing successful response...');
      const data = await response.json();
      console.log('Login response received, token present:', !!data.token);

      // Store the token for future API calls - remove 'Bearer ' prefix if it exists
      if (data.token) {
        const cleanToken = data.token.startsWith('Bearer ') ? data.token.substring(7) : data.token;
        console.log(`Storing clean token (first 10 chars): ${cleanToken.substring(0, 10)}...`);
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, cleanToken);
        setupAuthHeaders(cleanToken);

        // Store the token in AuthState format for refresh capability
        const authState: AuthState = {
          accessToken: cleanToken,
          refreshToken: data.refreshToken || null,
          issuedAt: Date.now(),
          expiresIn: 3600 // Default to 1 hour if not specified
        };

        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
        console.log('Stored complete auth state with token and refresh token');

        // Store credentials securely for re-authentication if needed
        // This is used as a fallback when token refresh fails
        await AsyncStorage.setItem('@CampusEats:UserEmail', credentials.email);
        await AsyncStorage.setItem('@CampusEats:UserPassword', credentials.password);
        console.log('Stored credentials for potential re-authentication');

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
    } catch (error: any) {
      // Check if this is a network/timeout error that should trigger retry
      if ((error.name === 'AbortError' || 
           error.message?.includes('Network request failed') || 
           error.message?.includes('Failed to fetch') ||
           error.code === 'NETWORK_ERROR') && 
          attempt < 2) {
        console.log(`Network error on attempt ${attempt}, will retry...`);
        lastError = error;
        continue; // Retry
      }

      // Enhanced error handling with network-specific messages
      if (error.name === 'AbortError') {
        console.error('Login request timed out');
        throw new Error('Network timeout. Please check your connection and try again.');
      } else if (error.message?.includes('Network request failed') || 
                 error.message?.includes('Failed to fetch') ||
                 error.code === 'NETWORK_ERROR') {
        console.error('Network error during login:', error);
        throw new Error('Network error. Please check your connection and ensure the backend is running.');
      } else if (error instanceof TypeError) {
        console.error('Network/TypeError during login:', error);
        throw new Error('Unable to connect to server. Please check your network connection.');
      } else {
        // Re-throw the error as-is if it's already been formatted
        console.error('Login error:', error);
        throw error;
      }
    }
    }

    // If we exhausted retries, throw the last error
    console.error('All login attempts failed');
    throw lastError || new Error('Login failed after multiple attempts');
  },

  async signup(userData: SignupData) {
    // Retry logic for stale connections
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`Signup retry attempt ${attempt} after connection failure...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Format the data to match backend expectations
        const formattedData = {
          ...userData,
          firstname: userData.firstName,  // Convert to match backend field name
          lastname: userData.lastName,    // Convert to match backend field name
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${API_URL}/api/users/signup?isMobile=true`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'close', // Force new connection to avoid stale connections
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify(formattedData),
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          let error;
          try {
            error = JSON.parse(errorText);
          } catch {
            error = { message: errorText };
          }
          throw new Error(error.message || error.error || 'Signup failed');
        }

        const data = await response.json();
        return data;
      } catch (error: any) {
        // Retry on network errors
        if ((error.name === 'AbortError' || 
             error.message?.includes('Network request failed') || 
             error.message?.includes('Failed to fetch')) && 
            attempt < 2) {
          console.log(`Network error on signup attempt ${attempt}, will retry...`);
          lastError = error;
          continue;
        }

        if (error.name === 'AbortError') {
          throw new Error('Network timeout. Please try again.');
        }
        throw error;
      }
    }
    
    throw lastError || new Error('Signup failed after multiple attempts');
  },



  async refreshToken(refreshToken: string) {
    try {
      console.log('Attempting to refresh token...');
      
      // Try the standard refresh endpoint first
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Token refresh successful via /api/auth/refresh');

          if (data.token) {
            const cleanToken = data.token.startsWith('Bearer ') ? data.token.substring(7) : data.token;
            await AsyncStorage.setItem(AUTH_TOKEN_KEY, cleanToken);
            setupAuthHeaders(cleanToken);
          }

          return data;
        }
      } catch (refreshError) {
        console.log('Standard refresh endpoint failed, trying alternative approach...');
      }
      
      // If standard refresh fails, try to re-authenticate using stored credentials
      // This is a fallback approach when the backend doesn't support token refresh
      try {
        // Try to get stored credentials if available
        const storedEmail = await AsyncStorage.getItem('@CampusEats:UserEmail');
        const storedPassword = await AsyncStorage.getItem('@CampusEats:UserPassword');
        
        if (storedEmail && storedPassword) {
          console.log('Found stored credentials, attempting re-authentication');
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const loginResponse = await fetch(`${API_URL}/api/users/authenticate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              usernameOrEmail: storedEmail,
              password: storedPassword,
            }),
            signal: controller.signal,
          }).finally(() => {
            clearTimeout(timeoutId);
          });
          
          if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log('Re-authentication successful');
            
            if (loginData.token) {
              const cleanToken = loginData.token.startsWith('Bearer ') ? loginData.token.substring(7) : loginData.token;
              await AsyncStorage.setItem(AUTH_TOKEN_KEY, cleanToken);
              setupAuthHeaders(cleanToken);
              
              // Return in the same format as a refresh would
              return { token: cleanToken, refreshToken: loginData.refreshToken || null };
            }
          }
        }
      } catch (reAuthError) {
        console.error('Re-authentication approach failed:', reAuthError);
      }
      
      // If all approaches fail, throw an error
      throw new Error('All token refresh approaches failed');
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
  const [authError, setAuthError] = React.useState<Error | null>(null);

  // Use the configured redirect URI directly (no makeRedirectUri to avoid --/auth path)
  // But ensure it's properly formatted for production
  const redirectUriToUse = redirectUri;

  // Note: Logging removed to prevent spam on every render
  // Only log during initialization (in useEffect below)

  // Memoize the auth request config to prevent unnecessary re-renders
  const authRequestConfig = React.useMemo(() => ({
    clientId: clientId,
    scopes: scopes,
    redirectUri: redirectUriToUse,
    usePKCE: true,
    responseType: 'code' as const
  }), [redirectUriToUse]);

  const [request, response, promptAsync] = useAuthRequest(
      authRequestConfig,
      discovery
  );

  // Load stored auth state on initial mount
  React.useEffect(() => {
    const loadAuthState = async () => {
      setIsLoading(true);
      // Log auth config once on initialization
      console.log('🔐 Auth initialized with redirect URI:', redirectUriToUse);
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
        console.log("Processing auth response:", response.type);

        // Add timeout to prevent infinite loading (30 seconds)
        const timeout = setTimeout(() => {
          console.error("⏱️ Authentication response handling timed out");
          setAuthError(new Error('Authentication timed out. Please try again.'));
          setIsLoading(false);
          setAuthState(null);
        }, 30000);

        try {
          if (response.type === 'success' && request?.codeVerifier) {
            const { code } = response.params;
            try {
              console.log("📥 Exchanging authorization code for token");
              console.log("Using redirect URI for token exchange:", redirectUriToUse);

              const tokenResponse = await exchangeCodeAsync(
                  {
                    clientId: clientId,
                    code: code,
                    redirectUri: redirectUriToUse,
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

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000);

              const syncResponse = await fetch(`${API_URL}/api/users/azure-authenticate`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${cleanToken}`,
                  'Content-Type': 'application/json'
                },
                signal: controller.signal,
              }).finally(() => {
                clearTimeout(timeoutId);
              });

              // More detailed response handling
              console.log(`Backend response status: ${syncResponse.status}`);

              if (!syncResponse.ok) {
                const errorBody = await syncResponse.text();
                // Log instead of error to avoid NOBRIDGE error display
                console.log(`Azure Auth Failed: Status ${syncResponse.status}, Body: ${errorBody}`);
                
                // Check if the error is due to a banned account
                try {
                  const errorJson = JSON.parse(errorBody);
                  if (errorJson.error && errorJson.error.includes("banned")) {
                    // Set error state for banned user instead of showing alert
                    console.log('🚨 Backend detected banned user, setting error state');
                    const banError = new UserBannedError();
                    console.log('🚨 Created UserBannedError:', banError.name, banError.message);
                    await clearStoredAuthState();
                    setAuthState(null);
                    setAuthError(banError);
                    console.log('🚨 Set authError state to:', banError);
                    setIsLoading(false);
                    return;
                  }
                } catch (parseError) {
                  console.error("Error parsing error response:", parseError);
                }

                // On 400/401, we'll try again but with extra debugging
                if (syncResponse.status === 400 || syncResponse.status === 401) {
                  console.warn("Authentication issue - will retry with additional logging");

                  // Try again with the /me endpoint which should be more lenient
                  try {
                    console.log("Trying /me endpoint as fallback...");
                    
                    const meController = new AbortController();
                    const meTimeoutId = setTimeout(() => meController.abort(), 30000);

                    const meResponse = await fetch(`${API_URL}/api/users/me`, {
                      headers: {
                        'Authorization': `Bearer ${cleanToken}`
                      },
                      signal: meController.signal,
                    }).finally(() => {
                      clearTimeout(meTimeoutId);
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
                      
                      // Store accountType if available
                      if (userData && userData.accountType) {
                        console.log(`Storing accountType from /me endpoint: ${userData.accountType}`);
                        await AsyncStorage.setItem('accountType', userData.accountType);
                      }
                      
                      // Clear loading state and let LoginForm handle navigation
                      setIsLoading(false);
                      return; // Success path
                    } else {
                      console.error(`/me endpoint also failed: ${await meResponse.text()}`);
                      // Clear auth state and show error
                      await clearStoredAuthState();
                      setAuthState(null);
                      setAuthError(new Error('Authentication failed. Please try again.'));
                      setIsLoading(false);
                      return;
                    }
                  } catch (meError) {
                    console.error("Error with /me fallback:", meError);
                    // Clear auth state and show error
                    await clearStoredAuthState();
                    setAuthState(null);
                    setAuthError(new Error('Authentication failed. Please try again.'));
                    setIsLoading(false);
                    return;
                  }
                } else {
                  // Other non-401/400 errors
                  console.error("Backend authentication failed with unexpected status");
                  await clearStoredAuthState();
                  setAuthState(null);
                  setAuthError(new Error('Authentication failed. Please try again.'));
                  setIsLoading(false);
                  return;
                }
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
                  
                  // Store accountType from the user data if available
                  if (userData.user.accountType) {
                    console.log(`Storing accountType from Azure Auth response: ${userData.user.accountType}`);
                    await AsyncStorage.setItem('accountType', userData.user.accountType);
                  }
                }
                
                // Clear loading state and let LoginForm handle navigation
                setIsLoading(false);
              }
            } catch (syncError) {
              console.error("Error during Azure Auth call:", syncError);
              await clearStoredAuthState();
              setAuthState(null);
              setAuthError(new Error('Authentication failed. Please try again.'));
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error("TOKEN EXCHANGE FAILED:", error);
            await clearStoredAuthState();
            setAuthState(null);
            setAuthError(new Error('Token exchange failed. Please try again.'));
            setIsLoading(false);
            return;
          }
        } else if (response.type === 'error') {
          console.error("AUTH RESPONSE ERROR:", response.error);
          
          // Handle specific error cases
          if (response.error?.code === 'access_denied') {
            console.log("User denied access or cancelled authentication");
            Alert.alert(
              "Authentication Cancelled", 
              "You cancelled the Microsoft login. Please try again if you want to sign in.",
              [{ text: "OK" }]
            );
          } else {
            console.error("Authentication error:", response.error);
            Alert.alert(
              "Authentication Error", 
              "There was a problem with Microsoft login. Please try again.",
              [{ text: "OK" }]
            );
          }
          
          setAuthState(null);
          setIsLoading(false);
        } else if (response.type === 'cancel') {
          console.log("Auth flow was cancelled by user");
          setIsLoading(false);
        } else {
          console.log("Auth flow result:", response.type);
          setIsLoading(false);
        }
        } finally {
          // Clear the timeout
          clearTimeout(timeout);
        }
      }
    };

    handleAuthResponse();
  }, [response, request]);

  // Sign in function
  const signIn = async () => {
    if (!request) {
      console.error("Auth request not loaded yet. Please try again in a moment.");
      Alert.alert("Please wait", "Authentication is still loading. Please try again in a moment.");
      return;
    }

    try {
      console.log("Starting OAuth sign-in process with Azure AD");
      console.log("Redirect URI being used:", redirectUriToUse);
      console.log("Request details:", {
        clientId: request.clientId,
        redirectUri: request.redirectUri,
        scopes: request.scopes
      });
      
      // Clear any existing tokens before starting a new auth flow
      // This prevents potential conflicts between old and new tokens
      await clearStoredAuthState();

      // For production, we need to ensure the browser session is handled properly
      console.log("📱 Launching authentication browser...");
      const authResult = await promptAsync();
      
      console.log("OAuth prompt completed with result type:", authResult.type);
      console.log("OAuth result details:", authResult);

      if (authResult.type === 'success') {
        console.log("✅ Authentication completed successfully");
      } else if (authResult.type === 'error') {
        console.error('❌ OAuth error details:', authResult.error);
        Alert.alert(
          "Authentication Error", 
          `Authentication failed: ${authResult.error?.description || authResult.error?.code || 'Unknown error'}`,
          [{ text: "OK" }]
        );
      } else if (authResult.type === 'cancel') {
        console.log("🚫 User cancelled authentication");
      } else {
        console.warn(`⚠️ OAuth sign-in was not successful: ${authResult.type}`);
      }
    } catch (error) {
      console.error("💥 Error during OAuth sign-in:", error);
      Alert.alert(
        "Authentication Error", 
        "An unexpected error occurred during authentication. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  // Sign out function
  const signOut = async () => {
    setIsLoading(true);
    try {
      console.log("🚪 Starting secure sign out process...");
      
      // Use the more aggressive clearing function
      await clearStoredAuthState();

      // Clear the cached account type to prevent stale navigation
      clearCachedAccountType();

      // Set state to null after storage is cleared
      setAuthState(null);
      
      // SECURITY: Force complete navigation reset
      // This prevents users from navigating back to authenticated screens
      router.dismissAll(); // Dismiss any modals
      
      // Use a single navigation call with a slight delay to ensure cleanup is complete
      setTimeout(() => {
        router.replace('/');
        console.log("✅ Signed out successfully and navigation secured");
      }, 50);
    } catch (error) {
      console.error("❌ Failed to clear auth state:", error);
      // Even if there's an error, force navigation to login for security
      router.replace('/');
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

  // Get user data from backend
  const getUserData = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('No auth token available for getUserData');
        return null;
      }

      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: token }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  };

  // Clear auth error function
  const clearAuthError = () => {
    setAuthError(null);
  };

  return {
    authState,
    isLoading,
    signIn: async () => await signIn(),
    signOut: async () => await signOut(),
    getAccessToken,
    getUserData,
    isLoggedIn: !!authState?.accessToken,
    authError,
    clearAuthError,
  };
}

// --- Standalone Functions ---
// Keys to preserve during logout (for Remember me functionality)
const PRESERVE_KEYS = [
  '@remember_me',
  '@CampusEats:UserEmail',
  '@CampusEats:UserPassword'
];

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

    // Clear the cached account type first
    clearCachedAccountType();
    console.log("✓ Cleared cached account type");

    // First, save the values of keys we want to preserve
    const preservedValues: Record<string, string | null> = {};
    for (const key of PRESERVE_KEYS) {
      preservedValues[key] = await AsyncStorage.getItem(key);
    }

    // Clear specific auth keys
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    console.log("✓ Cleared AUTH_STORAGE_KEY");

    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    console.log("✓ Cleared AUTH_TOKEN_KEY");

    // Get all keys to check for any other auth-related data
    const allKeys = await AsyncStorage.getAllKeys();
    console.log("Current AsyncStorage keys:", allKeys);

    // Clear any other auth related keys that might be lingering, except preserved keys
    const authRelatedKeys = allKeys.filter(key =>
      (key.includes('Auth') ||
      key.includes('auth') ||
      key.includes('token') ||
      key.includes('Token') ||
      key.includes('CampusEats') ||
      key === 'userId' ||
      key === 'accountType') &&
      !PRESERVE_KEYS.includes(key)
    );

    if (authRelatedKeys.length > 0) {
      console.log("Found additional auth-related keys to clear:", authRelatedKeys);
      await AsyncStorage.multiRemove(authRelatedKeys);
      console.log("✓ Cleared additional auth-related keys");
    }

    // Restore preserved values if they existed
    const restorePromises = Object.entries(preservedValues)
      .filter(([_, value]) => value !== null)
      .map(([key, value]) => AsyncStorage.setItem(key, value as string));

    if (restorePromises.length > 0) {
      await Promise.all(restorePromises);
      console.log("✓ Restored Remember me credentials");
    }

    console.log("🔴 CLEARING ALL AUTH STORAGE - COMPLETE");
  } catch (error) {
    console.error("Failed to clear auth state:", error);
  }
};

// Get token from storage (helper function for non-hook environments)
export const getAuthToken = async (): Promise<string | null> => {
  try {
    // First try to get the token directly
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    
    // If no token exists, return null
    if (!token) {
      console.log('No token found in storage');
      return null;
    }
    
    // Check if token is expired
    if (isValidTokenFormat(token) && isTokenExpired(token)) {
      console.log('Token is expired, attempting to refresh...');
      
      try {
        // Get refresh token if available
        const authState = await getStoredAuthState();
        if (authState?.refreshToken) {
          console.log('Found refresh token, attempting to use it');
          // Try to refresh the token
          try {
            const refreshResult = await authService.refreshToken(authState.refreshToken);
            if (refreshResult?.token) {
              console.log('Token refreshed successfully');
              
              // Store the new token
              const newToken = refreshResult.token.startsWith('Bearer ') 
                ? refreshResult.token.substring(7) 
                : refreshResult.token;
                
              await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
              
              // Update auth state with new token
              const newAuthState: AuthState = {
                ...authState,
                accessToken: newToken,
                refreshToken: refreshResult.refreshToken || authState.refreshToken,
                issuedAt: Date.now(),
                expiresIn: 3600 // Default to 1 hour if not specified
              };
              
              await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
              console.log('Updated auth state with refreshed token');
              
              return newToken;
            }
          } catch (refreshError) {
            console.error('Error during token refresh:', refreshError);
          }
        } else {
          console.log('No refresh token available for token refresh');
        }
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
      }
    } else {
    }
    
    return token;
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
};