import { Stack } from "expo-router"
import { useEffect, useRef } from "react"
import { View } from "react-native"
import { MapComponent, type MapComponentRef } from "@/features/MapComponent"
import { MapStateProvider, useWsDottie } from "@/shared/contexts"
import {
  MapControllerProvider,
  useSetMapController,
} from "@/shared/contexts/MapController"

// Wrapper component to connect MapComponent with controller context
const MapWithController = () => {
  const setController = useSetMapController()
  const mapRef = useRef<MapComponentRef>(null)

  useEffect(() => {
    if (mapRef.current) {
      const controller = mapRef.current.getController()
      setController(controller)
    }
  }, [setController])

  return <MapComponent ref={mapRef} />
}

export default function MapPage() {
  return (
    <MapStateProvider>
      <MapControllerProvider>
        <View className="flex-1">
          <Stack.Screen options={{ title: "Map" }} />
          <MapWithController />
        </View>
      </MapControllerProvider>
    </MapStateProvider>
  )
}
