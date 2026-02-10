import "../../global.css";
import "@/shared/polyfills/object-group-by";

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

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    Puffberry: require("../../assets/fonts/puffberry/Puffberry.ttf"),
    "FiraSansCondensed-ExtraLight": require("../../assets/fonts/fira-sans-condensed/FiraSansCondensed-ExtraLight.ttf"),
    "FiraSansCondensed-ExtraLightItalic": require("../../assets/fonts/fira-sans-condensed/FiraSansCondensed-ExtraLightItalic.ttf"),
    "FiraSansCondensed-Regular": require("../../assets/fonts/fira-sans-condensed/FiraSansCondensed-Regular.ttf"),
    "FiraSansCondensed-Italic": require("../../assets/fonts/fira-sans-condensed/FiraSansCondensed-Italic.ttf"),
    "PlaypenSans-Thin": require("../../assets/fonts/playpen-sans/PlaypenSans-Thin.ttf"),
    "PlaypenSans-ExtraLight": require("../../assets/fonts/playpen-sans/PlaypenSans-ExtraLight.ttf"),
    "PlaypenSans-Light": require("../../assets/fonts/playpen-sans/PlaypenSans-Light.ttf"),
    "PlaypenSans-Regular": require("../../assets/fonts/playpen-sans/PlaypenSans-Regular.ttf"),
    "PlaypenSans-Medium": require("../../assets/fonts/playpen-sans/PlaypenSans-Medium.ttf"),
    "PlaypenSans-SemiBold": require("../../assets/fonts/playpen-sans/PlaypenSans-SemiBold.ttf"),
    "PlaypenSans-Bold": require("../../assets/fonts/playpen-sans/PlaypenSans-Bold.ttf"),
    "PlaypenSans-ExtraBold": require("../../assets/fonts/playpen-sans/PlaypenSans-ExtraBold.ttf"),
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
