import Constants from 'expo-constants';

// Configuration for different environments
const isProduction = Constants.executionEnvironment === 'standalone';

// Get config from app.config.js extra field (injected at build time from GitHub Secrets)
const extra = Constants.expoConfig?.extra || {};

// Backend URL
// ⚠️ IMPORTANT: In production builds, this file is ONLY used as a fallback.
// Production values come from GitHub Secrets → workflow → app.config.js → Constants.expoConfig.extra
// Development: Update the IP below to match your local backend server
export const API_URL = extra.apiUrl || 'http://192.168.1.8:8080';

// Production environment flag
export const IS_PRODUCTION = isProduction;

// Auth token storage key
export const AUTH_TOKEN_KEY = 'auth_token';

// Redirect URI for OAuth/Deep linking
// Production: Injected via GitHub Secrets (REDIRECT_URI_PRODUCTION)
// Development: Uses expo scheme with your local IP
export const redirectUri = extra.redirectUri || 'exp://192.168.1.8:8081';