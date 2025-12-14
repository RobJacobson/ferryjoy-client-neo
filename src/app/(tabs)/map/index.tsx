import type BottomSheet from "@gorhom/bottom-sheet";
import { useCallback, useRef } from "react";
import { useSelectedVessel } from "@/data/contexts";
import type { VesselLocation } from "@/domain";
import { MapScreenLayout } from "@/features/MapScreen";
import { VesselBottomSheet } from "@/features/VesselBottomSheet";

// Base map tab screen (no deep-link focus)
const MapIndexPage = () => {
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
    <MapScreenLayout
      title="Map"
      onVesselSelect={handleVesselSelect}
      bottomSheet={
        <VesselBottomSheet
          ref={bottomSheetRef}
          selectedVessel={selectedVessel}
        />
      }
    />
  );
};

export default MapIndexPage;
