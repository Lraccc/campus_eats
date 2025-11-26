#!/usr/bin/env node

/**
 * Post-prebuild script to ensure APK splits configuration is applied
 * This prevents Expo prebuild from overwriting our size optimization settings
 */

const fs = require('fs');
const path = require('path');

const BUILD_GRADLE_PATH = path.join(__dirname, '../android/app/build.gradle');

console.log('🔧 Configuring APK splits for size optimization...');

if (!fs.existsSync(BUILD_GRADLE_PATH)) {
  console.error('❌ build.gradle not found at:', BUILD_GRADLE_PATH);
  process.exit(1);
}

let buildGradle = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');

// Check if splits configuration already exists
if (buildGradle.includes('universalApk false')) {
  console.log('✅ APK splits configuration already present');
  process.exit(0);
}

// Define the splits configuration to inject
const splitsConfig = `
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a", "armeabi-v7a"
            universalApk false
        }
    }
`;

// Find the signingConfigs block and insert splits after it
const signingConfigsEnd = buildGradle.indexOf('}', buildGradle.indexOf('signingConfigs {'));

if (signingConfigsEnd === -1) {
  console.error('❌ Could not find signingConfigs block in build.gradle');
  process.exit(1);
}

// Insert splits configuration after signingConfigs
const insertPosition = signingConfigsEnd + 1;
buildGradle = buildGradle.slice(0, insertPosition) + splitsConfig + buildGradle.slice(insertPosition);

// Ensure minifyEnabled is set for release builds
if (!buildGradle.match(/release\s*\{[^}]*minifyEnabled\s+true/s)) {
  console.log('⚠️  Adding minifyEnabled configuration...');
  buildGradle = buildGradle.replace(
    /(release\s*\{)/,
    '$1\n            minifyEnabled true\n            shrinkResources true'
  );
}

// Write the updated build.gradle
fs.writeFileSync(BUILD_GRADLE_PATH, buildGradle, 'utf8');

console.log('✅ APK splits configuration applied successfully');
console.log('📦 Expected: arm64-v8a and armeabi-v7a APKs');
console.log('🚫 Universal APK will NOT be generated');
