# Campus Eats Deployment Guide

## Prerequisites
1. GitHub repository with your code
2. Render.com account
3. Environment variables ready (MongoDB, Azure, Email, PayMongo credentials)

## Backend Deployment (Spring Boot on Render.com)

### Step 1: Prepare Backend
1. Navigate to your backend directory:
   ```cmd
   cd backend\campuseats
   ```

2. Test local build:
   ```cmd
   mvnw.cmd clean package -DskipTests
   ```

### Step 2: Deploy on Render
1. Go to [Render.com](https://render.com) and sign in
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `campuseats-backend`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `backend/campuseats`
   - **Runtime**: `Docker` or `Java`
   - **Build Command**: `./mvnw clean package -DskipTests`
   - **Start Command**: `java -jar target/*.jar`

5. Add Environment Variables:
   - `MONGO_DATABASE`: Your MongoDB database name
   - `MONGO_USER`: Your MongoDB username
   - `MONGO_PASSWORD`: Your MongoDB password
   - `MONGO_CLUSTER`: Your MongoDB cluster URL
   - `AZURE_CONNECTION_STRING`: Your Azure Blob Storage connection string
   - `EMAIL_ID`: Your email for notifications
   - `EMAIL_PASSWORD`: Your email app password
   - `PAYMONGO_SECRET_KEY`: Your PayMongo secret key
   - `FRONTEND_URL`: Will be set after frontend deployment

6. Click "Create Web Service"

### Step 3: Note Backend URL
After deployment, note your backend URL: `https://campuseats-backend.onrender.com`

## Frontend Deployment (React on Render.com)

### Step 1: Update Frontend Configuration
1. Navigate to frontend directory:
   ```cmd
   cd frontend
   ```

2. Update your API endpoints to use environment variables
3. Test local build:
   ```cmd
   npm install
   npm run build
   ```

### Step 2: Deploy on Render
1. In Render dashboard, click "New" → "Static Site"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `campuseats-frontend`
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`

4. Add Environment Variables:
   - `REACT_APP_API_URL`: Your backend URL from Step 3 above
   - `REACT_APP_ENVIRONMENT`: `production`

5. Click "Create Static Site"

### Step 3: Update Backend CORS
1. Go back to your backend service on Render
2. Update the `FRONTEND_URL` environment variable with your frontend URL
3. Redeploy the backend service

## Mobile App Deployment Options

### Option 1: Expo Application Services (EAS) - Recommended

#### Setup EAS:
```cmd
cd mobile
npm install -g @expo/eas-cli
eas login
eas build:configure
```

#### Build APK for testing:
```cmd
eas build --platform android --profile development
```

#### Build for production:
```cmd
eas build --platform android --profile production
eas build --platform ios --profile production
```

#### Submit to stores:
```cmd
eas submit --platform android
eas submit --platform ios
```

### Option 2: Web Version (Alternative)
```cmd
cd mobile
expo build:web
```
Deploy the web build to Netlify or Vercel for web access.

### Option 3: Expo Go (Development Testing)
```cmd
cd mobile
expo publish
```
Share the QR code with testers who have Expo Go installed.

## Environment Variables Setup

### Backend Required Variables:
- `MONGO_DATABASE`
- `MONGO_USER` 
- `MONGO_PASSWORD`
- `MONGO_CLUSTER`
- `AZURE_CONNECTION_STRING`
- `EMAIL_ID`
- `EMAIL_PASSWORD`
- `PAYMONGO_SECRET_KEY`
- `FRONTEND_URL`

### Frontend Environment Variables:
- `REACT_APP_API_URL`
- `REACT_APP_ENVIRONMENT`

## Post-Deployment Checklist

1. ✅ Backend health check: `https://your-backend.onrender.com/actuator/health`
2. ✅ Frontend loads correctly
3. ✅ API calls work between frontend and backend
4. ✅ Database connectivity verified
5. ✅ File uploads work (Azure Blob Storage)
6. ✅ Email notifications work
7. ✅ Payment integration works (PayMongo)
8. ✅ Mobile app connects to production API

## Monitoring and Maintenance

### Render.com Features:
- Auto-deploy on git push
- Built-in SSL certificates
- Log monitoring
- Health checks
- Scaling options

### Recommended Monitoring:
- Set up health check endpoints
- Monitor database connections
- Track API response times
- Monitor error rates

## Troubleshooting

### Common Issues:
1. **Build failures**: Check logs in Render dashboard
2. **Environment variables**: Ensure all required vars are set
3. **CORS errors**: Verify FRONTEND_URL is correctly set
4. **Database connection**: Check MongoDB Atlas IP whitelist
5. **File upload issues**: Verify Azure Blob Storage credentials

### Useful Commands:
```cmd
# Test backend locally
cd backend\campuseats
mvnw.cmd spring-boot:run

# Test frontend locally  
cd frontend
npm start

# Test mobile locally
cd mobile
npm start
```

## Costs Estimation

### Render.com:
- **Starter Plan**: $7/month per service (Backend + Frontend = $14/month)
- **Free tier**: Available but with limitations (services sleep after 15 min)

### Mobile Deployment:
- **EAS Build**: Free tier available (limited builds)
- **App Store fees**: $99/year (iOS) + $25 one-time (Android)

### Total Monthly Cost: ~$14-20/month for basic production deployment