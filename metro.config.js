// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// Add watchFolders to include the local ws-dottie package
const projectRoot = __dirname;
const wsDottieRoot = path.resolve(projectRoot, "../ws-dottie");

config.watchFolders = [...(config.watchFolders ?? []), wsDottieRoot];

// Minimal "local package" support + React/React Query dedupe:
// - load ws-dottie from the sibling repo
// - force React + React Query to resolve from this app to avoid duplicate
//   module instances that break hooks/contexts on web.
const appNodeModules = path.resolve(projectRoot, "node_modules");

// Force resolution to app node_modules only. Without this, Metro's hierarchical
// lookup can resolve React/react-query from ../ws-dottie/node_modules when
// bundling ws-dottie code, causing duplicate module instances and broken
// hooks/context on web. Expo doctor expects false here; we keep true by design.
config.resolver.disableHierarchicalLookup = true;

config.resolver.nodeModulesPaths = [appNodeModules];

// Resolve Node built-in "buffer" to the npm buffer package so it gets bundled
// (react-native-svg uses it for base64 data URIs; RN runtime has no Node builtins).
config.resolver.extraNodeModules = {
  "ws-dottie": wsDottieRoot,
  buffer: path.join(appNodeModules, "buffer"),
  react: path.join(appNodeModules, "react"),
  "react-dom": path.join(appNodeModules, "react-dom"),
  "@tanstack/react-query": path.join(
    appNodeModules,
    "@tanstack",
    "react-query"
  ),
  "@tanstack/query-core": path.join(appNodeModules, "@tanstack", "query-core"),
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  inlineRem: 16,
});
