import "../../global.css"

import Mapbox from "@rnmapbox/maps"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import { WsDottieProvider } from "@/shared/contexts"

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "")

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
