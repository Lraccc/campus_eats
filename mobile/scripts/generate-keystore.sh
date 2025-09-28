#!/bin/bash

# Script to generate Android release keystore
# Run this locally to create your release keystore

echo "🔑 Generating Android Release Keystore"
echo "=====================================\n"

# Create keystore directory if it doesn't exist
mkdir -p android/app/release_keystore

# Prompt for keystore details
read -p "Enter keystore password: " STORE_PASS
read -p "Enter key alias (e.g., campuseats-release): " KEY_ALIAS
read -p "Enter key password: " KEY_PASS
read -p "Enter your name (CN): " CN_NAME
read -p "Enter your organization (O): " ORG_NAME
read -p "Enter your city (L): " CITY
read -p "Enter your state/province (ST): " STATE
read -p "Enter your country code (C, e.g., US): " COUNTRY

# Generate keystore
keytool -genkeypair \
  -v \
  -keystore android/app/release_keystore/release.keystore \
  -storepass "$STORE_PASS" \
  -alias "$KEY_ALIAS" \
  -keypass "$KEY_PASS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=$CN_NAME, O=$ORG_NAME, L=$CITY, ST=$STATE, C=$COUNTRY"

echo "\n✅ Keystore generated successfully!"
echo "📍 Location: android/app/release_keystore/release.keystore"

echo "\n🔐 Now set up GitHub Secrets:"
echo "1. ANDROID_KEYSTORE_BASE64: $(base64 -w 0 android/app/release_keystore/release.keystore)"
echo "2. ANDROID_KEY_ALIAS: $KEY_ALIAS"
echo "3. ANDROID_STORE_PASSWORD: $STORE_PASS"
echo "4. ANDROID_KEY_PASSWORD: $KEY_PASS"

echo "\n⚠️  IMPORTANT: Keep these credentials secure and never commit the keystore file to version control!"