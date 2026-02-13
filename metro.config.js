// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// Resolve Node built-in "buffer" to the npm buffer package so it gets bundled
// (react-native-svg uses it for base64 data URIs; RN runtime has no Node builtins).
const appNodeModules = path.resolve(__dirname, "node_modules");
config.resolver.extraNodeModules = {
  buffer: path.join(appNodeModules, "buffer"),
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  inlineRem: 16,
});
