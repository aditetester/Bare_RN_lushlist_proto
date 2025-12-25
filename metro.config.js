// const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig, getDefaultConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

module.exports = mergeConfig(config, {});
