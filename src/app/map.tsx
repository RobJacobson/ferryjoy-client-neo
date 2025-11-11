import { Stack } from "expo-router";
import { View } from "react-native";
import { MapComponent } from "@/features/MapComponent";
import { MapVesselMarkers } from "@/features/MapVesselMarkers";
import {
  MapStateProvider,
  SmoothedVesselPositionsProvider,
  useMapState,
  WsDottieProvider,
} from "@/shared/contexts";

// Inner component that uses context to get initial state
const MapPageContent = () => {
  const { cameraState } = useMapState();

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Map" }} />
      <MapComponent initialCameraState={cameraState}>
        <SmoothedVesselPositionsProvider>
          <MapVesselMarkers />
        </SmoothedVesselPositionsProvider>
      </MapComponent>
    </View>
  );
};

const MapPage = () => (
  <MapStateProvider>
    <WsDottieProvider>
      <MapPageContent />
    </WsDottieProvider>
  </MapStateProvider>
);

export default MapPage;
