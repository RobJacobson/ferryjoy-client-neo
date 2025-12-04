export default {
  expo: {
    name: "ferryjoy-client-neo",
    slug: "ferryjoy-client-neo",
    version: "1.0.0",
    scheme: "ferryjoy-client-neo",
    platforms: ["ios", "android", "web"],
    jsEngine: "hermes",
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Show current location on map.",
        },
      ],
      "@rnmapbox/maps",
    ],
    experiments: {
      typedRoutes: true,
      tsconfigPaths: true,
    },
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.robthecoder.ferryjoyclientneo",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
      ],
      package: "com.robthecoder.ferryjoyclientneo",
    },
    extra: {
      router: {},
      eas: {
        projectId: "2f2aa818-d92e-44b5-b774-735b916f23d9",
      },
    },
  },
};
