// Configuration for different environments
const isProduction = process.env.NODE_ENV === 'production';

// Backend URL
export const API_URL = isProduction 
  ? 'https://campus-eats-backend.onrender.com'
  : 'http://192.168.1.23:8080';

// Add other configuration constants here if needed
export const AUTH_TOKEN_KEY = 'auth_token';

// Redirect URI - keep the simple format that was working before
export const redirectUri = isProduction 
  ? "campuseats://auth"
  : "exp://192.168.1.23:8081";