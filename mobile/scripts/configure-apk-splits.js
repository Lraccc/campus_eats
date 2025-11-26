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
if (buildGradle.includes('splits {') && buildGradle.includes('universalApk false')) {
  console.log('✅ APK splits configuration already present');
  process.exit(0);
}

// Find the android { } block and add/update splits configuration
const androidBlockRegex = /android\s*\{/;
const match = buildGradle.match(androidBlockRegex);

if (!match) {
  console.error('❌ Could not find android { } block in build.gradle');
  process.exit(1);
}

// Remove any existing splits configuration first
buildGradle = buildGradle.replace(/splits\s*\{[^}]*\}/gs, '');

// Define the splits configuration to inject
const splitsConfig = `
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a", "armeabi-v7a"
            universalApk false  // Critical: Don't generate universal APK
        }
        density {
            enable false  // Keep all screen densities in each APK
        }
    }
`;

// Find where to inject (after buildTypes or before it)
const buildTypesIndex = buildGradle.indexOf('buildTypes {');

if (buildTypesIndex !== -1) {
  // Insert before buildTypes
  buildGradle = buildGradle.slice(0, buildTypesIndex) + splitsConfig + '\n    ' + buildGradle.slice(buildTypesIndex);
} else {
  // If no buildTypes, insert after defaultConfig
  const defaultConfigEndIndex = buildGradle.indexOf('}', buildGradle.indexOf('defaultConfig {'));
  if (defaultConfigEndIndex !== -1) {
    buildGradle = buildGradle.slice(0, defaultConfigEndIndex + 1) + '\n' + splitsConfig + buildGradle.slice(defaultConfigEndIndex + 1);
  } else {
    console.error('❌ Could not find suitable injection point in build.gradle');
    process.exit(1);
  }
}

// Also ensure ProGuard is enabled for release builds
if (!buildGradle.includes('minifyEnabled true')) {
  console.log('⚠️  Adding minifyEnabled configuration...');
  buildGradle = buildGradle.replace(
    /(release\s*\{[^}]*)/s,
    '$1\n            minifyEnabled true\n            shrinkResources true\n'
  );
}

// Write the updated build.gradle
fs.writeFileSync(BUILD_GRADLE_PATH, buildGradle, 'utf8');

console.log('✅ APK splits configuration applied successfully');
console.log('📦 Expected output: arm64-v8a and armeabi-v7a APKs (~80-120MB each)');
console.log('🚫 Universal APK will NOT be generated (would be ~385MB)');
