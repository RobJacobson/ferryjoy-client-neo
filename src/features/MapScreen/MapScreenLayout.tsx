import type { ReactNode } from "react";
import { View } from "react-native";
import { SmoothedVesselLocationsProvider, useMapState } from "@/data/contexts";
import type { VesselLocation } from "@/domain";
import { MapComponent } from "@/features/MapComponent";
import { MapDebugOverlay } from "@/features/MapDebugOverlay/MapDebugOverlay";
import { VesselCircleMarkers } from "@/features/VesselCircleMarkers";
import { VesselLines } from "@/features/VesselLines";

export interface MapScreenLayoutProps {
  /** Optional callback when a vessel marker is selected */
  onVesselSelect?: (vessel: VesselLocation) => void;
  /** Optional bottom sheet component to render */
  bottomSheet?: ReactNode;
}

/**
 * MapScreenLayout
 *
 * Shared layout component for map screens that provides:
 * - View wrapper with flex-1
 * - MapComponent with camera state
 * - SmoothedVesselLocationsProvider
 * - VesselLines (always rendered)
 * - VesselCircleMarkers with optional selection handler
 * - MapDebugOverlay
 * - Optional bottom sheet slot
 *
 * This component eliminates duplication between the base map screen
 * and slug-based map screens.
 *
 * Note: Header configuration (title, back button) is handled in the layout files.
 */
export const MapScreenLayout = ({
  onVesselSelect,
  bottomSheet,
}: MapScreenLayoutProps) => {
  const { cameraState } = useMapState();

  return (
    <View className="flex-1">
      <MapComponent initialCameraState={cameraState}>
        <SmoothedVesselLocationsProvider>
          <VesselCircleMarkers onVesselSelect={onVesselSelect} />
          <VesselLines />
        </SmoothedVesselLocationsProvider>
      </MapComponent>
      <MapDebugOverlay />
      {bottomSheet}
    </View>
  );
};
