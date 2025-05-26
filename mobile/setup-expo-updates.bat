@echo off
echo ===== Setting Up Expo Updates for Campus Eats =====
echo.
echo This script will set up Expo Updates to enable over-the-air updates for your app.
echo.

echo ===== Step 1: Installing Expo Updates =====
call npm install expo-updates
echo.

echo ===== Step 2: Configuring app.json =====
echo Adding Expo Updates configuration to app.json...
echo Please make sure to manually check your app.json after this script runs.
echo.

echo ===== Step 3: Creating an Update =====
echo To create and publish an update after making changes to your app:
echo.
echo   npx expo publish
echo.
echo This will make your changes available to users without requiring a new app build.
echo.

echo ===== Setup Complete =====
echo.
echo Remember to:
echo  1. Build a new version of your app with EAS Build after setting up Expo Updates
echo  2. Use 'npx expo publish' whenever you want to push updates to your users
echo.
pause
