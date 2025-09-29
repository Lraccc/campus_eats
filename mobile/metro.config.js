const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for additional asset extensions
config.resolver.assetExts.push(
  // Fonts
  'otf',
  'ttf',
  // Images
  'svg',
  'webp',
  // Videos
  'mp4',
  'webm',
  // Audio
  'mp3',
  'wav'
);

// Ensure proper handling of JavaScript files
config.resolver.sourceExts.push(
  'jsx',
  'js',
  'ts',
  'tsx',
  'json',
  'mjs'
);

// Fix for production builds
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// Ensure consistent module resolution
config.resolver.platforms = ['native', 'android', 'ios'];

// Fix potential circular dependency issues
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;