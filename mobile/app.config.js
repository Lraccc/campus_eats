export default ({ config }) => ({
  ...config,
  name: "Campus Eats",
  slug: "campus-eats",
  version: "1.0.0",
  orientation: "portrait",
  // icon: "./assets/images/app-logo.png", // Comment this out for now
  userInterfaceStyle: "light",
  scheme: "campus-eats",
  splash: {
    image: "./assets/images/welcome_screen.png",
    resizeMode: "cover",
    backgroundColor: "#e6d9c9"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.campuseats.app",
    splash: {
      image: "./assets/images/welcome_screen.png",
      resizeMode: "cover",
      backgroundColor: "#e6d9c9"
    },
    associatedDomains: ["applinks:campus-eats.app"]
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/app-logo.png", // Use logo, not full splash
      backgroundColor: "#8B4513"
    },
    splash: {
      image: "./assets/images/welcome_screen.png",
      resizeMode: "cover",
      backgroundColor: "#e6d9c9"
    },
    package: "com.campuseats.app",
    permissions: [
      "CAMERA",
      "RECORD_AUDIO",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION"
    ],
    intentFilters: [
      {
        action: "VIEW",
        category: ["BROWSABLE", "DEFAULT"],
        data: [
          {
            scheme: "campus-eats"
          },
          {
            scheme: "campus-eats",
            host: "payment",
            pathPrefix: "/success"
          },
          {
            scheme: "campus-eats",
            host: "payment",
            pathPrefix: "/failed"
          }
        ]
      }
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
  newArchEnabled: true,
  extra: {
    production: process.env.NODE_ENV === 'production',
    // These values are injected from GitHub Secrets during CI/CD builds
    // For local development, values will be undefined and config.ts will use its defaults
    apiUrl: process.env.API_URL_PRODUCTION,
    redirectUri: process.env.REDIRECT_URI_PRODUCTION || 'campuseats://auth',
    eas: {
      projectId: process.env.EAS_PROJECT_ID || ''
    }
  }
});