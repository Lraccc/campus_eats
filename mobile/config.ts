import Constants from 'expo-constants';

// Configuration for different environments
const isProduction = Constants.executionEnvironment === 'standalone';

// Get config from app.config.js extra field (injected at build time from GitHub Secrets)
const extra = Constants.expoConfig?.extra || {};

// Backend URL
// ⚠️ IMPORTANT: In production builds, this file is ONLY used as a fallback.
// Production values come from GitHub Secrets → workflow → app.config.js → Constants.expoConfig.extra
// Development: Update the IP below to match your local backend server
export const API_URL = extra.apiUrl || 'http://192.168.1.15:8080';

// Production environment flag
export const IS_PRODUCTION = isProduction;

// Auth token storage key
export const AUTH_TOKEN_KEY = 'auth_token';

// Redirect URI for OAuth/Deep linking
// Production: Injected via GitHub Secrets (REDIRECT_URI_PRODUCTION)
// Development: Uses expo scheme with your local IP
export const redirectUri = extra.redirectUri || 'exp://192.168.1.15:8081';

// Agora Configuration
// Used for live streaming between shops (broadcasters) and customers (viewers)
export const AGORA_APP_ID = '8577fb1c76804e25a69047331f7c526c';

// App Certificate - Used by backend to generate secure tokens
// NEVER expose this in frontend code - only use in backend
export const AGORA_APP_CERTIFICATE = '6a854a4f51394275b518bf24dcab92ef';

// Agora token - Generated server-side for security
// Client will request tokens from backend before joining channels
export const AGORA_TOKEN = null; // Will be fetched from backend at runtime