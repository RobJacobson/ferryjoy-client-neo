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
import { MapDebugOverlay } from "@/features/MapDebugOverlay/MapDebugOverlay";
import { VesselBottomSheet } from "@/features/VesselBottomSheet";
import { VesselCircleMarkers } from "@/features/VesselCircleMarkers";
import { VesselLines } from "@/features/VesselLines";

// Base map tab screen (no deep-link focus)
const MapIndexPage = () => {
  const { cameraState } = useMapState();
  const { selectedVessel, selectVessel } = useSelectedVessel();

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
          {/* <VesselLines /> */}
          <VesselCircleMarkers onVesselSelect={handleVesselSelect} />
        </SmoothedVesselLocationsProvider>
      </MapComponent>
      <MapDebugOverlay />
      <VesselBottomSheet ref={bottomSheetRef} selectedVessel={selectedVessel} />
    </View>
  );
};

export default MapIndexPage;
