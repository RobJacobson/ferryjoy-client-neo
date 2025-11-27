import BottomSheet from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import {
  ConvexProvider,
  MapStateProvider,
  SmoothedVesselPositionsProvider,
  useMapState,
} from "@/data/contexts";
import type { VesselLocation } from "@/domain";
import { MapComponent } from "@/features/MapComponent";
import { MapVesselMarkers } from "@/features/MapVesselMarkers";
import { VesselBottomSheet } from "@/features/VesselBottomSheet";
import { VesselLines } from "@/features/VesselLines";

// Inner component that uses context to get initial state
const MapPageContent = () => {
  const { cameraState } = useMapState();
  const [selectedVessel, setSelectedVessel] = useState<VesselLocation | null>(
    null
  );

  // ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  const handleVesselSelect = useCallback((vessel: VesselLocation) => {
    setSelectedVessel(vessel);
    bottomSheetRef.current?.expand();
  }, []);

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Map" }} />
      <MapComponent initialCameraState={cameraState}>
        <SmoothedVesselPositionsProvider>
          <MapVesselMarkers onVesselSelect={handleVesselSelect} />
          <VesselLines />
        </SmoothedVesselPositionsProvider>
      </MapComponent>
      <VesselBottomSheet ref={bottomSheetRef} selectedVessel={selectedVessel} />
    </View>
  );
};

const MapPage = () => (
  <MapStateProvider>
    <ConvexProvider>
      <MapPageContent />
    </ConvexProvider>
  </MapStateProvider>
);

export default MapPage;
