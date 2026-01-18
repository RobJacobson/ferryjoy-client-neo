// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("path");
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

// Prevent Metro from resolving a second copy of React (or other deps) from
// inside `../ws-dottie/node_modules`, which breaks hooks/contexts on web.
config.resolver.disableHierarchicalLookup = true;

config.resolver.nodeModulesPaths = [appNodeModules];

config.resolver.extraNodeModules = {
  "ws-dottie": wsDottieRoot,
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
