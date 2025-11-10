import { Stack } from "expo-router"
import { View } from "react-native"
import { MapComponent } from "@/features/MapComponent"
import { MapVesselMarkers } from "@/features/MapVesselMarkers"
import { MapStateProvider } from "@/shared/contexts"
import { MapControllerProvider } from "@/shared/contexts/MapController"

const MapPage = () => (
  <MapStateProvider>
    <MapControllerProvider>
      <View className="flex-1">
        <Stack.Screen options={{ title: "Map" }} />
        <MapComponent>
          {/* <MapVesselMarkers
            onVesselPress={vessel => {
              console.log("Vessel pressed:", vessel.VesselID)
            }}
          /> */}
        </MapComponent>
      </View>
    </MapControllerProvider>
  </MapStateProvider>
)

export default MapPage
