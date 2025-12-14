import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConvexProvider as ConvexClientProvider,
  ConvexReactClient,
} from "convex/react";
import type { PropsWithChildren } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  ConvexProvider,
  MapCameraControllerProvider,
  MapStateProvider,
  NavigationHistoryProvider,
  SelectedVesselProvider,
  WsDottieProvider,
} from "@/data/contexts";

// Create a client
const queryClient = new QueryClient();

// Create a Convex client
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || "http://localhost:3210";
console.log("Initializing Convex client with URL:", convexUrl);

// Configure Convex client for React Native WebSocket compatibility
// React Native uses a different WebSocket implementation than browsers
const convex = new ConvexReactClient(convexUrl, {
  webSocketConstructor: WebSocket, // Use React Native's WebSocket
});

export const Providers = ({ children }: PropsWithChildren) => {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ConvexClientProvider client={convex}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <NavigationHistoryProvider>
                <MapStateProvider>
                  <MapCameraControllerProvider>
                    <WsDottieProvider>
                      <SelectedVesselProvider>
                        <ConvexProvider>{children}</ConvexProvider>
                      </SelectedVesselProvider>
                    </WsDottieProvider>
                  </MapCameraControllerProvider>
                </MapStateProvider>
              </NavigationHistoryProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </ConvexClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};
