import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConvexProvider as ConvexClientProvider,
  ConvexReactClient,
} from "convex/react";
import type { PropsWithChildren } from "react";
import {
  ConvexProvider,
  MapStateProvider,
  WsDottieProvider,
} from "@/data/contexts";

// Create a client
const queryClient = new QueryClient();

// Create a Convex client
const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL || "http://localhost:3210"
);

export const Providers = ({ children }: PropsWithChildren) => {
  return (
    <ConvexClientProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <MapStateProvider>
          <WsDottieProvider>
            <ConvexProvider>{children}</ConvexProvider>
          </WsDottieProvider>
        </MapStateProvider>
      </QueryClientProvider>
    </ConvexClientProvider>
  );
};
