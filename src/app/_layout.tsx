import "../../global.css"

import Mapbox from "@rnmapbox/maps"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import { Platform } from "react-native"
import { WsDottieProvider } from "@/shared/contexts"

// Set Mapbox access token for native platforms
if (Platform.OS !== "web") {
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "")
}

// Create a client
const queryClient = new QueryClient()

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <WsDottieProvider>
        <Stack />
      </WsDottieProvider>
    </QueryClientProvider>
  )
}
