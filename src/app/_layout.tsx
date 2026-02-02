import "../../global.css";

import Mapbox from "@rnmapbox/maps";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { Providers } from "@/data/Providers";

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

const PUFFBERRY_FONT = require("../../assets/fonts/puffberry.ttf");

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    Puffberry: PUFFBERRY_FONT,
  });

  if (!fontsLoaded && !fontError) {
    return null;
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
