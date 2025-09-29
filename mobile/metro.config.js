const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// NativeWind v2 requires the transformer to be in the bundle
// The CSS generation is handled by the babel plugin, not metro
module.exports = config;