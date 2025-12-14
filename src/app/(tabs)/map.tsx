import type BottomSheet from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { useCallback, useRef } from "react";
import { View } from "react-native";
import {
  SmoothedVesselLocationsProvider,
  useMapState,
  useSelectedVessel,
} from "@/data/contexts";
import type { VesselLocation } from "@/domain";
import { MapComponent } from "@/features/MapComponent";
import { VesselBottomSheet } from "@/features/VesselBottomSheet";
import { VesselCircleMarkers } from "@/features/VesselCircleMarkers";
import { VesselLines } from "@/features/VesselLines";

// Inner component that uses context to get initial state
const MapPageContent = () => {
  const { cameraState } = useMapState();
  const { selectedVessel, selectVessel } = useSelectedVessel();

  // ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  const handleVesselSelect = useCallback(
    (vessel: VesselLocation) => {
      selectVessel(vessel);
      bottomSheetRef.current?.expand();
    },
    [selectVessel]
  );

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Map" }} />
      <MapComponent initialCameraState={cameraState}>
        <SmoothedVesselLocationsProvider>
          <VesselLines />
          <VesselCircleMarkers onVesselSelect={handleVesselSelect} />
        </SmoothedVesselLocationsProvider>
      </MapComponent>
      <VesselBottomSheet ref={bottomSheetRef} selectedVessel={selectedVessel} />
    </View>
  );
};

const MapPage = () => <MapPageContent />;

export default MapPage;
