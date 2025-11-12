import { Stack } from "expo-router";
import { View } from "react-native";
import { MapComponent } from "@/features/MapComponent";
import { MapVesselMarkers } from "@/features/MapVesselMarkers";
import { VesselLines } from "@/features/VesselLines";
import {
  ConvexProvider,
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
          <VesselLines />
        </SmoothedVesselPositionsProvider>
      </MapComponent>
    </View>
  );
};

const MapPage = () => (
  <MapStateProvider>
    <WsDottieProvider>
      <ConvexProvider>
        <MapPageContent />
      </ConvexProvider>
    </WsDottieProvider>
  </MapStateProvider>
);

export default MapPage;
