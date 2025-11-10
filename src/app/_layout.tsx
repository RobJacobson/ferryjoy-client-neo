import "../../global.css";

import Mapbox from "@rnmapbox/maps";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { MapStateProvider, WsDottieProvider } from "@/shared/contexts";

// Create a client
const queryClient = new QueryClient();

// Set Mapbox access token
const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
if (!accessToken) {
  console.warn(
    "App Layout: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set. Map may not load correctly."
  );
}
Mapbox.setAccessToken(accessToken);

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <MapStateProvider>
        <WsDottieProvider>
          <Stack />
        </WsDottieProvider>
      </MapStateProvider>
    </QueryClientProvider>
  );
}
