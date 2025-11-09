import { Stack } from "expo-router"
import { View } from "react-native"
import { MapComponent } from "@/features/MapComponent"
import { MapStateProvider, useWsDottie } from "@/shared/contexts"

export default function MapPage() {
  return (
    <MapStateProvider>
      <View className="flex-1">
        <Stack.Screen options={{ title: "Map" }} />
        <MapComponent />
      </View>
    </MapStateProvider>
  )
}
