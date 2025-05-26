// Determine environment and set appropriate API URL
const isProduction = process.env.NODE_ENV === 'production';

// Backend URLs
const PRODUCTION_API_URL = 'https://campus-eats-backend.onrender.com';
const DEV_API_URL = 'https://campus-eats-backend.onrender.com'; // Using production URL for both to ensure consistency

// Export the appropriate URL based on environment
export const API_URL = isProduction ? PRODUCTION_API_URL : DEV_API_URL;

// For debugging
console.log(`Using API URL: ${API_URL} (${isProduction ? 'production' : 'development'} mode)`);


// Add other configuration constants here if needed
export const AUTH_TOKEN_KEY = 'auth_token';

// Redirect URIs for authentication
// Multiple redirect URIs to support different environments
const REDIRECT_URIS = {
  // For Expo Go development
  development: "exp://exp.host/@lraccc/campus-eats",
  
  // For standalone app (production) - using HTTPS format for Azure compatibility
  production: "https://auth.campuseats.app/signin-callback",
  
  // For Expo development client
  devClient: "https://auth.campuseats.app/signin-callback"
};

// Export the appropriate redirect URI based on environment and app type
export const redirectUri = REDIRECT_URIS.production; // Using production URI for standalone app

// For local development (commented out)
// export const redirectUri = "exp://192.168.1.15:8081";