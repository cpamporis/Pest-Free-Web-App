const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 🚫 Disable Expo Router / SSR detection
config.server = {
  ...config.server,
  unstable_serverRoot: null,
};

module.exports = config;