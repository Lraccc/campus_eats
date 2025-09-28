@echo off
echo 🔑 Generating Android Release Keystore
echo =====================================
echo.

REM Create keystore directory if it doesn't exist
if not exist "android\app\release_keystore" mkdir "android\app\release_keystore"

REM Prompt for keystore details
set /p STORE_PASS="Enter keystore password: "
set /p KEY_ALIAS="Enter key alias (e.g., campuseats-release): "
set /p KEY_PASS="Enter key password: "
set /p CN_NAME="Enter your name (CN): "
set /p ORG_NAME="Enter your organization (O): "
set /p CITY="Enter your city (L): "
set /p STATE="Enter your state/province (ST): "
set /p COUNTRY="Enter your country code (C, e.g., US): "

REM Generate keystore
keytool -genkeypair -v -keystore android\app\release_keystore\release.keystore -storepass "%STORE_PASS%" -alias "%KEY_ALIAS%" -keypass "%KEY_PASS%" -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=%CN_NAME%, O=%ORG_NAME%, L=%CITY%, ST=%STATE%, C=%COUNTRY%"

echo.
echo ✅ Keystore generated successfully!
echo 📍 Location: android\app\release_keystore\release.keystore
echo.
echo 🔐 Now set up GitHub Secrets:
echo 1. ANDROID_KEYSTORE_BASE64: Use the base64 encoded content of the keystore file
echo 2. ANDROID_KEY_ALIAS: %KEY_ALIAS%
echo 3. ANDROID_STORE_PASSWORD: %STORE_PASS%
echo 4. ANDROID_KEY_PASSWORD: %KEY_PASS%
echo.
echo ⚠️  IMPORTANT: Keep these credentials secure and never commit the keystore file to version control!
echo.
echo To get the base64 encoded keystore for GitHub secrets, run:
echo certutil -encode android\app\release_keystore\release.keystore android\app\release_keystore\release.keystore.base64
echo Then copy the content between BEGIN CERTIFICATE and END CERTIFICATE lines.

pause