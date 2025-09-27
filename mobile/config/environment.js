// Environment configuration for mobile app
const config = {
  development: {
    apiUrl: 'http://localhost:8080',
    environment: 'development',
  },
  staging: {
    apiUrl: 'https://your-backend-staging.onrender.com',
    environment: 'staging',
  },
  production: {
    apiUrl: 'https://your-backend-url.onrender.com',
    environment: 'production',
  },
};

const getEnvironment = () => {
  if (__DEV__) {
    return config.development;
  }
  
  // You can add logic here to determine staging vs production
  return config.production;
};

export default getEnvironment();