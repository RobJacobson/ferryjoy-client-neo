import { Stack } from "expo-router";
import { View } from "react-native";
import { MapComponent } from "@/features/MapComponent";
import { MapVesselMarkers } from "@/features/MapVesselMarkers";
import { MapStateProvider, useMapState } from "@/shared/contexts";

// Inner component that uses the context to get initial state
const MapPageContent = () => {
  const { cameraState } = useMapState();

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Map" }} />
      <MapComponent initialCameraState={cameraState}>
        <MapVesselMarkers
          onVesselPress={vessel => {
            console.log("Vessel pressed:", vessel.VesselID);
          }}
        />
      </MapComponent>
    </View>
  );
};

const MapPage = () => (
  <MapStateProvider>
    <MapPageContent />
  </MapStateProvider>
);

export default MapPage;
