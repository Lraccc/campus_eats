module.exports = function (api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  const plugins = [
    // Always include essential plugins
  ];
  
  // Only add NativeWind in development or if explicitly enabled
  if (!isProduction || process.env.ENABLE_NATIVEWIND === 'true') {
    plugins.push("nativewind/babel");
  }
  
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};