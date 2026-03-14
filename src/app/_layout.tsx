// ============================================================================
// Root layout: fonts, splash screen, and wave texture preload.
// Keeps splash visible until fonts and the paper texture (used by waves) are
// ready. Texture is loaded via the same SVG path the waves use so the cache
// is warm when the homepage mounts.
// ============================================================================

import "../../global.css";
import "@/shared/polyfills/object-group-by";

import Mapbox from "@rnmapbox/maps";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { LogBox } from "react-native";
import Svg, { Image as SvgImage } from "react-native-svg";
import { View } from "@/components/ui";
import { Providers } from "@/data/Providers";

/** Same asset as wave components; load here via SVG so splash stays until ready. */
const PAPER_TEXTURE = require("../../assets/textures/paper-texture-4-bw.png");

// Suppress SafeAreaView deprecation warning from React Native's Button component
LogBox.ignoreLogs([
  "SafeAreaView has been deprecated and will be removed in a future release",
]);

// Set Mapbox access token
const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
if (!accessToken) {
  console.warn(
    "App Layout: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set. Map may not load correctly."
  );
}
Mapbox.setAccessToken(accessToken);

export default function Layout() {
  const [textureReady, setTextureReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Puffberry: require("../../assets/fonts/puffberry/Puffberry.ttf"),
    "PlaypenSans-Thin": require("../../assets/fonts/playpen-sans/PlaypenSans-Thin.ttf"),
    "PlaypenSans-ExtraLight": require("../../assets/fonts/playpen-sans/PlaypenSans-ExtraLight.ttf"),
    "PlaypenSans-Light": require("../../assets/fonts/playpen-sans/PlaypenSans-Light.ttf"),
    "PlaypenSans-Regular": require("../../assets/fonts/playpen-sans/PlaypenSans-Regular.ttf"),
    "PlaypenSans-Medium": require("../../assets/fonts/playpen-sans/PlaypenSans-Medium.ttf"),
    "PlaypenSans-SemiBold": require("../../assets/fonts/playpen-sans/PlaypenSans-SemiBold.ttf"),
    "PlaypenSans-Bold": require("../../assets/fonts/playpen-sans/PlaypenSans-Bold.ttf"),
    "PlaypenSans-ExtraBold": require("../../assets/fonts/playpen-sans/PlaypenSans-ExtraBold.ttf"),
    "LobsterTwo-Regular": require("../../assets/fonts/LobsterTwo/LobsterTwo-Regular.ttf"),
    "LobsterTwo-Italic": require("../../assets/fonts/LobsterTwo/LobsterTwo-Italic.ttf"),
    "LobsterTwo-Bold": require("../../assets/fonts/LobsterTwo/LobsterTwo-Bold.ttf"),
    "LobsterTwo-BoldItalic": require("../../assets/fonts/LobsterTwo/LobsterTwo-BoldItalic.ttf"),
    "BitcountPropSingle-100": require("../../assets/fonts/BitcountPropSingle/BitcountPropSingle_Cursive-Thin.ttf"),
    "BitcountPropSingle-200": require("../../assets/fonts/BitcountPropSingle/BitcountPropSingle_Cursive-ExtraLight.ttf"),
    "BitcountPropSingle-300": require("../../assets/fonts/BitcountPropSingle/BitcountPropSingle_Cursive-Light.ttf"),
    "BitcountPropSingle-400": require("../../assets/fonts/BitcountPropSingle/BitcountPropSingle_Cursive-Regular.ttf"),
    "BitcountPropSingle-500": require("../../assets/fonts/BitcountPropSingle/BitcountPropSingle_Cursive-Medium.ttf"),
    "BitcountPropSingle-600": require("../../assets/fonts/BitcountPropSingle/BitcountPropSingle_Cursive-SemiBold.ttf"),
    "BitcountPropSingle-700": require("../../assets/fonts/BitcountPropSingle/BitcountPropSingle_Cursive-Bold.ttf"),
    "BitcountPropSingle-800": require("../../assets/fonts/BitcountPropSingle/BitcountPropSingle_Cursive-ExtraBold.ttf"),
    "BitcountPropSingle-900": require("../../assets/fonts/BitcountPropSingle/BitcountPropSingle_Cursive-Black.ttf"),
  });

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!textureReady) {
    return (
      <View style={{ flex: 1, opacity: 0 }} pointerEvents="none">
        <Svg width={1} height={1}>
          <SvgImage
            href={PAPER_TEXTURE}
            width={1}
            height={1}
            onLoad={() => setTextureReady(true)}
          />
        </Svg>
      </View>
    );
  }

  return (
    <Providers>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </Providers>
  );
}
