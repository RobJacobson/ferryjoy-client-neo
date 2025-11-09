import { Stack } from "expo-router"
import { View } from "react-native"
import { MapStateProvider, useWsDottie } from "@/shared/contexts"

export default function MapPage() {
  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Map" }} />
    </View>
  )
}
