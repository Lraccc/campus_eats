import Constants from 'expo-constants';

// Configuration for different environments
const isProduction = Constants.executionEnvironment === 'standalone';

// Get config from app.config.js extra field (injected at build time from GitHub Secrets)
const extra = Constants.expoConfig?.extra || {};

// Backend URL
// Production: Injected via GitHub Secrets during CI/CD
// Development: Local development server (update this to your local IP)
// Default: localhost for builds without configuration
export const API_URL = extra.apiUrl || (isProduction ? 'https://your-production-api.com' : 'http://192.168.1.8:8080');

// Production environment flag
export const IS_PRODUCTION = isProduction;

// Auth token storage key
export const AUTH_TOKEN_KEY = 'auth_token';

// Redirect URI for OAuth/Deep linking
export const redirectUri = extra.redirectUri || (isProduction 
  ? "campuseats://auth"
  : "exp://192.168.1.8:8081");