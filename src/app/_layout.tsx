import "../../global.css"

import Mapbox from "@rnmapbox/maps"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import { WsDottieProvider } from "@/shared/contexts"

// Create a client
const queryClient = new QueryClient()

// Set Mapbox access token
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "")

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <WsDottieProvider>
        <Stack />
      </WsDottieProvider>
    </QueryClientProvider>
  )
}
