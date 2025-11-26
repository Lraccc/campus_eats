const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add CSS support for NativeWind
config.resolver.assetExts.push('css');

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

// ========================================
// OPTIMIZE BUNDLE SIZE
// ========================================

// Exclude unnecessary files from bundle
config.resolver.blockList = [
  // Exclude test files
  /.*\/__tests__\/.*/,
  /.*\.test\.(js|ts|tsx)$/,
  /.*\.spec\.(js|ts|tsx)$/,
  // Exclude documentation
  /.*\.md$/,
  // Exclude example/demo files
  /.*\/example\/.*/,
  /.*\/examples\/.*/,
  /.*\/demo\/.*/,
  /.*\/docs\/.*/,
];

// Fix for production builds with aggressive minification
config.transformer.minifierConfig = {
  keep_fnames: false,  // Allow function name mangling for smaller size
  mangle: {
    keep_fnames: false,
  },
  compress: {
    drop_console: true,  // Remove console.log statements in production
    drop_debugger: true,
    passes: 3,  // Multiple compression passes
    pure_getters: true,
    unsafe: true,  // Aggressive optimizations
    unsafe_comps: true,
    unsafe_Function: true,
    unsafe_math: true,
    unsafe_proto: true,
    warnings: false,
  },
  output: {
    comments: false,  // Remove all comments
    ascii_only: true,
  },
};

// Ensure consistent module resolution
config.resolver.platforms = ['native', 'android', 'ios'];

// Fix potential circular dependency issues
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;