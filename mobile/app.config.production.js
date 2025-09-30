// app.config.production.js - Production config without NativeWind issues
export default ({ config }) => ({
  ...config,
  name: "Campus Eats",
  slug: "campus-eats",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/app-logo.png",
  userInterfaceStyle: "light",
  scheme: "campus-eats",
  splash: {
    image: "./assets/images/app-logo.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.campuseats.app"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/app-logo.png",
      backgroundColor: "#ffffff"
    },
    package: "com.campuseats.app",
    permissions: [
      "CAMERA",
      "RECORD_AUDIO",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION"
    ]
  },
  web: {
    favicon: "./assets/images/app-logo.png",
    bundler: "metro"
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Allow Campus Eats to use your location to find nearby restaurants and delivery options."
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    production: process.env.NODE_ENV === 'production',
    apiUrl: process.env.NODE_ENV === 'production' 
      ? 'https://campus-eats-backend.onrender.com'
      : 'http://localhost:8080'
  }
});