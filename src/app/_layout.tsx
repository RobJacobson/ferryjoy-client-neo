import "../../global.css";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import Mapbox from "@rnmapbox/maps";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

// Set Mapbox access token
const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
if (!accessToken) {
  console.warn(
    "App Layout: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set. Map may not load correctly."
  );
}
Mapbox.setAccessToken(accessToken);

export default function Layout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ConvexProvider client={convex}>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </ThemeProvider>
        </ConvexProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
