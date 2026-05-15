# 🍔 Campus Eats

**A Multi-Vendor Campus Food Delivery Platform**

Campus Eats is a comprehensive food delivery ecosystem designed specifically for university campuses, featuring a mobile app for customers and dashers, a web dashboard for shop owners and administrators, and a robust backend infrastructure. The platform enables students to order food from multiple campus vendors, track deliveries in real-time, and even watch live cooking streams from their favorite shops.

---

## 📱 Project Overviews

Campus Eats consists of three main components:

- **Mobile App** (React Native/Expo) - iOS & Android app for customers and delivery dashers
- **Frontend Web** (React) - Web dashboard for shop owners and administrators
- **Backend API** (Spring Boot) - RESTful API with MongoDB database

---

## ✨ Key Features

### 🎯 For Customers
- **Multi-Vendor Ordering** - Browse and order from multiple campus food vendors
- **Real-Time Location Tracking** - Track your dasher's location in real-time
- **Live Streaming** - Watch shops prepare food through live video streams
- **Campus Geofencing** - Location-based access control for campus safety
- **Digital Wallet** - Secure in-app payment system
- **Order History** - Track past orders and reorder favorites
- **Profile Management** - Customize your account with profile pictures and preferences
- **Real-Time Chat** - Communicate with dashers and shops during livestreams

### 🚗 For Dashers
- **Delivery Management** - Accept and manage delivery requests
- **Route Optimization** - Navigate to pickup and delivery locations
- **Earnings Tracking** - Monitor delivery earnings and history
- **Real-Time Updates** - Receive instant order notifications via WebSocket
- **Location Sharing** - Share live location with customers

### 🏪 For Shop Owners
- **Shop Management Dashboard** - Manage menu items, prices, and availability
- **Live Streaming** - Broadcast your food preparation to attract customers
- **Order Management** - Process orders in real-time with audio notifications
- **Analytics & Reports** - Track sales, popular items, and business metrics
- **No-Show Reporting** - Report and track customer no-shows
- **Shop Application System** - Apply to become a verified campus vendor

### 👨‍💼 For Administrators
- **Platform Management** - Oversee all shops, users, and dashers
- **Shop Approval Workflow** - Review and approve new vendor applications
- **User Management** - Manage customer and dasher accounts
- **System Analytics** - Monitor platform-wide metrics and performance
- **Restriction Management** - Handle user restrictions and violations

---

## 🚀 Mobile App (Primary Focus)

### Technology Stack
- **Framework**: React Native 0.76.9 with Expo ~52.0
- **Navigation**: Expo Router ~4.0 (file-based routing)
- **Styling**: NativeWind (TailwindCSS for React Native)
- **State Management**: React Context API + AsyncStorage
- **Authentication**: OAuth 2.0 with Azure AD & Google Sign-In
- **Real-Time Communication**: 
  - WebSocket (STOMP.js) for order updates
  - Agora SDK for live video streaming
- **Location Services**: Expo Location with geofencing
- **Maps**: React Native Maps
- **Camera/Video**: Expo Camera & AV for livestreaming
- **HTTP Client**: Axios with interceptors

### Project Structure
```
mobile/
├── app/                    # Expo Router pages (file-based routing)
│   ├── (auth)/            # Authentication flow screens
│   ├── dasher/            # Dasher-specific screens
│   ├── shop/              # Shop owner screens
│   ├── payment/           # Payment flow screens
│   ├── index.tsx          # App entry point
│   ├── home.tsx           # Customer home screen
│   ├── cart.tsx           # Shopping cart
│   ├── checkout.tsx       # Checkout process
│   ├── profile.tsx        # User profile
│   └── ...                # Other app screens
├── components/            # Reusable UI components
│   ├── AlertModal.tsx
│   ├── BottomNavigation.tsx
│   ├── LiveStreamBroadcaster.tsx
│   ├── LiveStreamViewer.tsx
│   ├── LocationGuard.tsx
│   └── Map/               # Map components
├── services/              # API and external service integrations
│   ├── authService.ts     # Authentication logic
│   ├── axiosConfig.ts     # HTTP client setup
│   ├── LocationService.ts # Location tracking
│   ├── walletService.ts   # Wallet operations
│   └── webSocketService.ts # Real-time updates
├── hooks/                 # Custom React hooks
│   └── useNavigationSecurity.ts
├── utils/                 # Utility functions
│   ├── geofence.ts        # Campus boundary checking
│   ├── locationConfig.ts  # Location settings
│   ├── badWordFilter.ts   # Chat moderation
│   ├── crashReporter.ts   # Error tracking
│   └── logger.ts          # Logging utility
├── android/               # Android-specific native code
├── assets/                # Images, fonts, and static files
├── app.config.js          # Expo configuration
├── config.ts              # App configuration (API URLs, keys)
└── package.json
```

### Setup Instructions

#### Prerequisites
- Node.js 18+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- Android Studio (for Android) or Xcode (for iOS/macOS only)
- Physical device or emulator

#### Installation
```bash
cd mobile
npm install
```

#### Environment Configuration
1. Update `config.ts` with your backend API URL:
```typescript
export const API_URL = 'http://YOUR_BACKEND_IP:8080';
export const redirectUri = 'exp://YOUR_LOCAL_IP:8081';
```

2. Configure Agora for live streaming (if needed):
```typescript
export const AGORA_APP_ID = 'your_agora_app_id';
```

#### Running the App

**Development Mode:**
```bash
# Start Expo dev server
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios

# Run on web
npm run web
```

**Production Build:**
```bash
# Android APK
npm run build:android

# Android Debug APK
npm run build:android:debug
```

### Key Mobile Features Implementation

#### 1. **Geofencing & Location Services**
- Campus boundary validation using polygon geofencing
- Real-time location tracking with smoothing algorithms
- Background location updates for dashers
- Location-based access control

#### 2. **Live Streaming**
- **Broadcaster Mode** (Shop Owners): Stream food preparation using Agora Video SDK
- **Viewer Mode** (Customers): Watch live streams with real-time chat
- Multi-camera support with flip functionality
- Chat moderation with bad word filtering

#### 3. **Real-Time Order Updates**
- WebSocket connection using STOMP over SockJS
- Instant order status notifications
- Live dasher location updates
- Audio alerts for new orders (shop owners)

#### 4. **Authentication Flow**
- OAuth 2.0 integration with Azure AD
- Google Sign-In support
- OTP verification for phone numbers
- Secure token storage using AsyncStorage
- Auto-refresh tokens with axios interceptors

#### 5. **Payment Integration**
- Digital wallet system
- Secure payment processing
- Deep linking for payment callbacks
- Transaction history

#### 6. **Role-Based Access Control**
- Customer, Dasher, Shop Owner, and Admin roles
- Dynamic navigation based on user role
- Protected routes with navigation guards
- Role-specific UI components

---

## 🌐 Frontend Web Dashboard

### Technology Stack
- **Framework**: React 18.3.1
- **Styling**: Material-UI (MUI) + Tailwind CSS
- **Authentication**: Azure MSAL (Microsoft Authentication Library)
- **Maps**: React Leaflet with routing
- **Charts**: Recharts & MUI X-Charts
- **HTTP Client**: Axios
- **Routing**: React Router DOM 6

### Features
- Shop owner dashboard with sales analytics
- Admin panel for platform management
- Order management with real-time updates
- Menu item CRUD operations
- User and shop approval workflows
- Interactive maps for delivery tracking
- Revenue and performance charts

### Setup Instructions
```bash
cd frontend
npm install
npm start
```

Access at `http://localhost:3000`

### Project Structure
```
frontend/
├── src/
│   ├── components/        # Reusable UI components
│   ├── context/           # React context providers
│   ├── utils/             # Utility functions
│   ├── App.js             # Main app component
│   ├── AppMsalProvider.js # MSAL authentication wrapper
│   └── msalConfig.js      # Azure AD configuration
├── public/
│   └── Assets/            # Static assets
└── package.json
```

---

## ⚙️ Backend API

### Technology Stack
- **Framework**: Spring Boot 3.2.6
- **Language**: Java 17
- **Database**: MongoDB
- **Authentication**: OAuth 2.0 Resource Server
- **Security**: Spring Security with JWT
- **WebSocket**: STOMP over SockJS
- **Build Tool**: Maven

### Features
- RESTful API for all platform operations
- JWT-based authentication with Azure AD integration
- WebSocket for real-time order updates
- MongoDB for flexible data storage
- Role-based access control (RBAC)
- Agora token generation for secure livestreaming
- File upload handling for profile pictures and menu items
- Geolocation services for dasher tracking

### Setup Instructions

#### Prerequisites
- Java 17 JDK
- Maven 3.8+
- MongoDB (local or cloud instance)

#### Installation
```bash
cd backend/campuseats
./mvnw clean install
```

#### Configuration
Update `application.properties` or `application.yml`:
```properties
spring.data.mongodb.uri=mongodb://localhost:27017/campuseats
server.port=8080
```

#### Running the Server
```bash
./mvnw spring-boot:run
```

Access API at `http://localhost:8080`

### Project Structure
```
backend/campuseats/
├── src/
│   ├── main/
│   │   ├── java/com/capstone/campuseats/
│   │   │   ├── controller/    # REST endpoints
│   │   │   ├── service/       # Business logic
│   │   │   ├── repository/    # MongoDB repositories
│   │   │   ├── model/         # Data models
│   │   │   ├── config/        # Security & WebSocket config
│   │   │   └── dto/           # Data transfer objects
│   │   └── resources/
│   │       └── application.properties
│   └── test/                  # Unit tests
├── pom.xml                    # Maven dependencies
└── Dockerfile                 # Container configuration
```

### API Endpoints (Sample)
- `POST /api/auth/login` - User authentication
- `GET /api/shops` - List all shops
- `POST /api/orders` - Create new order
- `GET /api/orders/{id}` - Get order details
- `PUT /api/orders/{id}/status` - Update order status
- `GET /api/users/profile` - Get user profile
- `POST /api/wallet/topup` - Add funds to wallet
- `WS /ws` - WebSocket connection endpoint

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Campus Eats Ecosystem                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Mobile App │    │  Web Dashboard│    │   Backend    │  │
│  │              │    │              │    │   API        │  │
│  │ - Customers  │◄───┼──────────────┼───►│              │  │
│  │ - Dashers    │    │ - Shop Owners│    │ Spring Boot  │  │
│  │ - Shop Mgmt  │    │ - Admins     │    │   + JWT      │  │
│  │              │    │              │    │   + OAuth2   │  │
│  └──────┬───────┘    └──────────────┘    └──────┬───────┘  │
│         │                                         │          │
│         │    ┌─────────────────────────┐         │          │
│         └───►│   External Services     │◄────────┘          │
│              │                         │                    │
│              │ - MongoDB (Database)    │                    │
│              │ - Agora (Live Streaming)│                    │
│              │ - Azure AD (Auth)       │                    │
│              │ - Google OAuth          │                    │
│              │ - WebSocket (Real-Time) │                    │
│              └─────────────────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Features

- **OAuth 2.0 Authentication** - Secure login with Azure AD and Google
- **JWT Token Management** - Stateless authentication with auto-refresh
- **Role-Based Access Control** - Granular permissions for different user types
- **Geofencing** - Campus boundary enforcement for security
- **Secure WebSocket** - Authenticated real-time connections
- **Data Encryption** - Sensitive data protection
- **Input Validation** - Protection against injection attacks
- **CORS Configuration** - Controlled cross-origin requests

---

## 📊 Data Models

### User
```typescript
{
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'DASHER' | 'SHOP_OWNER' | 'ADMIN';
  phoneNumber: string;
  profilePictureUrl: string;
  campusId: string;
  walletBalance: number;
  isRestricted: boolean;
}
```

### Shop
```typescript
{
  id: string;
  name: string;
  ownerId: string;
  description: string;
  location: { latitude: number; longitude: number };
  menuItems: MenuItem[];
  isActive: boolean;
  rating: number;
  totalOrders: number;
}
```

### Order
```typescript
{
  id: string;
  customerId: string;
  shopId: string;
  dasherId?: string;
  items: OrderItem[];
  status: 'PENDING' | 'PREPARING' | 'READY' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  deliveryLocation: { latitude: number; longitude: number };
  createdAt: Date;
}
```

---

## 🎨 UI/UX Highlights

- **Native Look & Feel** - Platform-specific UI components
- **Dark Mode Support** - Automatic theme switching
- **Smooth Animations** - 60 FPS transitions with Reanimated
- **Haptic Feedback** - Tactile responses for user actions
- **Accessible Design** - WCAG compliance for inclusive experience
- **Responsive Layouts** - Adaptive design for all screen sizes
- **Toast Notifications** - Non-intrusive user feedback
- **Loading States** - Skeleton screens and progress indicators

---

## 🧪 Testing

### Mobile
```bash
cd mobile
npm test
```

### Frontend
```bash
cd frontend
npm test
```

### Backend
```bash
cd backend/campuseats
./mvnw test
```

---

## 📦 Deployment

### Mobile App
- **Android**: Build APK/AAB and deploy to Google Play Store
- **iOS**: Build IPA and deploy to Apple App Store
- Uses GitHub Actions for CI/CD with automatic builds

### Frontend Web
- Deploy to Netlify, Vercel, or Firebase Hosting
- Build production bundle: `npm run build`

### Backend
- Dockerized deployment with included Dockerfile
- Deploy to AWS, Azure, Google Cloud, or any container platform
- MongoDB Atlas for cloud database

---

## 🛠️ Development Tools & Best Practices

- **Version Control**: Git with feature branch workflow
- **Code Quality**: ESLint for linting, Prettier for formatting
- **Type Safety**: TypeScript for mobile app
- **API Documentation**: Swagger/OpenAPI for backend
- **Error Tracking**: Crash reporter utility for production debugging
- **Logging**: Structured logging with Winston/custom logger
- **Environment Management**: Separate configs for dev/staging/production

---

## 📱 Mobile App Screenshots

(Add screenshots of key screens: Home, Order Flow, Live Streaming, Dasher Tracking, etc.)

---

## 🤝 Contributing

This was a capstone project developed over 10 months by Team 15. The project is now complete and serves as a reference implementation for campus food delivery systems.

---

## 📄 License

This project was developed as an academic capstone project. All rights reserved.

---

## 👥 Team

**Capstone Team 15**  
Project Duration: March 2024 - December 2025

---

## 🙏 Acknowledgments

- **Expo** - For the amazing React Native framework
- **Agora** - For real-time video streaming capabilities
- **Spring Boot** - For the robust backend framework
- **MongoDB** - For flexible data storage
- **Azure & Google** - For authentication services
- Our instructors and mentors who guided us throughout this journey

---

## 📞 Support

For questions or issues related to this project, please refer to the codebase documentation or contact the development team.

---

**Built with ❤️ by Capstone Team 15**

*This README represents the culmination of 10 months of development, learning, and collaboration.*
