import "../../global.css";

import Mapbox from "@rnmapbox/maps";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConvexProvider as ConvexClientProvider,
  ConvexReactClient,
} from "convex/react";
import { Stack } from "expo-router";
import type { PropsWithChildren } from "react";
import {
  ConvexCombinedProvider,
  MapStateProvider,
  WsDottieProvider,
} from "@/shared/contexts";

// Create a client
const queryClient = new QueryClient();

// Create a Convex client
const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL || "http://localhost:3210"
);

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
    <Providers>
      <Stack />
    </Providers>
  );
}

const Providers = ({ children }: PropsWithChildren) => {
  return (
    <ConvexClientProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <MapStateProvider>
          <WsDottieProvider>
            <ConvexCombinedProvider>{children}</ConvexCombinedProvider>
          </WsDottieProvider>
        </MapStateProvider>
      </QueryClientProvider>
    </ConvexClientProvider>
  );
};
