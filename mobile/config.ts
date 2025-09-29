// API Configuration
import Constants from 'expo-constants';

export const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://campus-eats-backend.onrender.com';
export const IS_PRODUCTION = Constants.expoConfig?.extra?.production || false;

// Authentication configuration
export const AUTH_TOKEN_KEY = 'auth_token';
export const redirectUri = 'campuseats://auth';

// Microsoft Azure AD configuration
export const AZURE_CLIENT_ID = 'your-azure-client-id'; // Replace with your actual client ID
export const AZURE_TENANT_ID = 'your-tenant-id'; // Replace with your tenant ID

// Environment configuration
export const NODE_ENV = IS_PRODUCTION ? 'production' : 'development';

// Other app configuration
export const APP_NAME = 'Campus Eats';
export const APP_VERSION = '1.0.0';

// Debug settings - Enable for production debugging
export const DEBUG = true; // Temporarily enable for debugging production issues
export const ENABLE_LOGGING = true;
export const ENABLE_ERROR_REPORTING = true;

// Console override for production debugging
if (ENABLE_LOGGING) {
  // Ensure console methods work in production
  const originalConsole = console;
  global.console = {
    ...originalConsole,
    log: (...args) => {
      originalConsole.log('[CampusEats]', ...args);
    },
    error: (...args) => {
      originalConsole.error('[CampusEats ERROR]', ...args);
    },
    warn: (...args) => {
      originalConsole.warn('[CampusEats WARN]', ...args);
    },
    info: (...args) => {
      originalConsole.info('[CampusEats INFO]', ...args);
    }
  };
}