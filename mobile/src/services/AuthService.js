import * as React from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, exchangeCodeAsync } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Or your preferred storage

// Ensure the web browser closes correctly
WebBrowser.maybeCompleteAuthSession();

const AUTH_STORAGE_KEY = '@CampusEats:Auth'; // Changed key slightly for clarity

// --- Configuration ---
const tenantId = '823cde44-4433-456d-b801-bdf0ab3d41fc';
const clientId = '6533df52-b33b-4953-be58-6ae5caa69797';
// Add the scope defined in Azure AD -> Expose an API
const scopes = [
    'openid', 
    'profile', 
    'email', 
    // REMOVED: 'User.Read', // This scope is for Microsoft Graph, not the backend API
    'api://6533df52-b33b-4953-be58-6ae5caa69797/access_as_user' // Backend API scope
];

// Endpoint specific configuration for Azure AD v2.0
const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  // revocationEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout`, // Optional logout endpoint
};

// --- Service Functions ---

// Hook to manage the authentication request (use inside a React component)
export function useAuthentication() {
  const [authState, setAuthState] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true); // Start loading to check stored auth

  // Generate the redirect URI. Log it so the user can add it to Azure AD.
  const redirectUri = makeRedirectUri({
    // For native apps, prefer 'native' or specify your custom scheme from app.json
    // For Expo Go: use 'useProxy': true
    // For standalone build: use 'native': '<your-scheme>://redirect' or similar defined in app.json
    useProxy: true, // This is generally recommended for Expo Go compatibility
  });
  console.log("--- IMPORTANT ---");
  console.log("Register this Redirect URI in your Azure AD App Registration:");
  console.log(redirectUri);
  console.log("-----------------");


  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: clientId,
      scopes: scopes,
      redirectUri: redirectUri,
      // Use PKCE (Proof Key for Code Exchange) for enhanced security on native apps
      usePKCE: true,
      responseType: 'code', // Use Authorization Code Flow
    },
    discovery
  );

  // Effect to load stored auth state on initial mount
  React.useEffect(() => {
    const loadAuthState = async () => {
      setIsLoading(true);
      try {
        const storedAuth = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (storedAuth) {
          // TODO: Add token expiry check and potential refresh here
          const parsedAuth = JSON.parse(storedAuth);
          setAuthState(parsedAuth);
        }
      } catch (error) {
        console.error("Failed to load auth state from storage:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAuthState();
  }, []);

  // Effect to handle the authentication response
  React.useEffect(() => {
    const handleAuthResponse = async () => {
      if (response) {
        console.log("Auth Response Received:", JSON.stringify(response, null, 2)); // Log the full response
        setIsLoading(true); // Start loading when handling response

        if (response.type === 'success' && request?.codeVerifier) {
          const { code } = response.params;
          console.log("Auth Success: Received code:", code ? code.substring(0, 10) + '...' : 'undefined'); // Log received code
          try {
            console.log("Attempting token exchange with code verifier:", request.codeVerifier.substring(0, 10) + '...');
            const tokenResponse = await exchangeCodeAsync(
              {
                clientId: clientId,
                code: code,
                redirectUri: redirectUri,
                extraParams: {
                  code_verifier: request.codeVerifier, // Send the PKCE code verifier
                },
              },
              discovery
            );
            console.log("Token Exchange Successful. Full Access Token:", tokenResponse.accessToken);
            // Store the tokens securely
            await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokenResponse));
            setAuthState(tokenResponse); // Update the auth state
          } catch (error) {
            console.error("TOKEN EXCHANGE FAILED:", error);
            // Log details if available (check error structure in JS)
            if (error && error.response) { // Adjusted check for JS
                 console.error("Error Response Data:", error.response.data);
                 console.error("Error Response Status:", error.response.status);
                 console.error("Error Response Headers:", error.response.headers);
            } else if (error instanceof Error) { // Log standard error message
                 console.error("Error Message:", error.message);
            }
            setAuthState(null); // Clear auth state on failure
          } finally {
             console.log("Finished handling success/exchange response.");
             setIsLoading(false);
          }
        } else if (response.type === 'error') {
           console.error("AUTH RESPONSE ERROR:", response.error, response.params);
           setAuthState(null);
           setIsLoading(false);
        } else if (response.type === 'dismiss' || response.type === 'cancel') {
           console.log("Authentication dismissed or cancelled by user.");
           setIsLoading(false); // Stop loading if user cancels
        } else {
          console.log("Unhandled response type:", response.type);
          setIsLoading(false); // Stop loading for other response types
        }
      } else {
          // console.log("No auth response detected yet."); // Can be noisy
      }
    };

    handleAuthResponse();
  }, [response, request]); // Dependencies: response and request

  const signIn = async () => {
    // Ensure request is loaded before prompting
    if (request) {
      await promptAsync({ useProxy: true }); // Use proxy for Expo Go
    } else {
      console.error("Auth request not loaded yet.");
      // Handle error: show message to user?
    }
  };

  const signOut = async () => {
    // TODO: Implement proper Azure AD logout if needed (might involve WebBrowser redirect)
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setAuthState(null);
      console.log("Signed out locally.");
    } catch (error) {
      console.error("Failed to clear auth state:", error);
    } finally {
        setIsLoading(false);
    }
  };

  // You might want to expose a function to get the current access token
  // including refresh logic if you implement it
  const getAccessToken = async () => {
      const currentAuthState = authState ?? JSON.parse(await AsyncStorage.getItem(AUTH_STORAGE_KEY) || 'null');
      // TODO: Implement token refresh logic here if needed
      return currentAuthState?.accessToken;
  }

  return {
    authState,
    isLoading,
    signIn: () => signIn(), // Wrap signIn to ensure correct context if needed
    signOut: () => signOut(),
    getAccessToken, // Expose function to get token
    isLoggedIn: !!authState?.accessToken, // Helper flag
  };
}

// --- Standalone Functions (Less common with hooks, but possible) ---

// Note: Using hooks (like above) is generally preferred in React components.
// These standalone functions might be useful in non-component contexts (e.g., background tasks)
// but require careful state management.

export const getStoredAuthState = async () => {
  try {
    const storedAuth = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    return storedAuth ? JSON.parse(storedAuth) : null;
  } catch (error) {
    console.error('Error retrieving stored auth state:', error);
    return null;
  }
};

export const clearStoredAuthState = async () => {
     try {
       await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
     } catch (error) {
       console.error("Failed to clear auth state:", error);
     }
}

// Standalone signIn/signOut using hooks internally is tricky.
// It's better to manage auth state via the hook within your component tree. 