/**
 * MapVesselMarkers component
 * Renders vessel markers on map using smoothed animated vessel locations
 */

import { useSmoothedVesselLocations } from "@/data/contexts";
import type { VesselLocation } from "@/domain";
import { type MapMarkerData, MapMarkers } from "@/features/MapMarkers";
import { MapVesselMarker } from "./MapVesselMarker";

/**
 * Extends VesselLocation to conform to MapMarkerData interface
 */
type VesselMarkerData = VesselLocation & MapMarkerData;

/**
 * Configuration constants for vessel markers
 */
const VESSEL_MARKER_CONFIG = {
  ZOOM_THRESHOLD: 8,
  OUT_OF_SERVICE_Z_INDEX: 0,
  IN_SERVICE_AT_DOCK_Z_INDEX: 100,
  IN_SERVICE_AT_SEA_Z_INDEX: 200,
} as const;

/**
 * MapVesselMarkers component
 *
 * Fetches smoothed vessel location data from SmoothedVesselLocations context and renders markers on the map using the generic MapMarkers component.
 * The smoothed locations provide fluid animation between GPS updates using exponential smoothing.
 * Filters out vessels that are "lost at sea" (departed dock more than 4 hours ago without recent location updates).
 * Each vessel is rendered as a MapVesselMarker with a z-index calculated from the vessel ID plus a status-based offset:
 * - Out of service: VesselID + 0
 * - In service at dock: VesselID + 100
 * - In service at sea: VesselID + 200
 * This ensures unique z-index values while maintaining proper stacking order by service status and location.
 *
 * @param onVesselSelect - Optional callback function invoked when a vessel marker is pressed
 * @returns React elements representing vessel markers or null if vessels should not be displayed
 *
 * @example
 * ```tsx
 * // Basic usage
 * <MapVesselMarkers />
 *
 * // With vessel selection handler
 * <MapVesselMarkers onVesselSelect={(vessel) => console.log(vessel.VesselName)} />
 * ```
 */
export const MapVesselMarkers = ({
  onVesselSelect,
}: {
  onVesselSelect?: (vessel: VesselLocation) => void;
}) => {
  const { smoothedVessels } = useSmoothedVesselLocations();

  // Filter out vessels lost at sea and transform vessel data to conform to MapMarkerData
  const vesselMarkerData: VesselMarkerData[] = smoothedVessels
    .filter((vessel) => !isLostAtSea(vessel))
    .map(toVesselMarkerData);

  return (
    <MapMarkers
      data={vesselMarkerData}
      renderMarker={(vessel) => (
        <MapVesselMarker
          key={vessel.VesselID}
          vessel={vessel}
          zIndex={
            vessel.VesselID +
            (!vessel.InService
              ? VESSEL_MARKER_CONFIG.OUT_OF_SERVICE_Z_INDEX
              : vessel.AtDock
                ? VESSEL_MARKER_CONFIG.IN_SERVICE_AT_DOCK_Z_INDEX
                : VESSEL_MARKER_CONFIG.IN_SERVICE_AT_SEA_Z_INDEX)
          }
          onPress={() => onVesselSelect?.(vessel)}
        />
      )}
    />
  );
};

/**
 * Transforms a VesselLocation to VesselMarkerData by adding required MapMarkerData fields
 */
const toVesselMarkerData = (vessel: VesselLocation): VesselMarkerData => {
  return {
    ...vessel,
    id: vessel.VesselID.toString(),
    longitude: vessel.Longitude,
    latitude: vessel.Latitude,
  };
};

/**
 * Determines if a vessel is "lost at sea" (not in service and departed dock more than 4 hours ago)
 * Such vessels are filtered out as they likely have stale location data
 */
const isLostAtSea = (vessel: VesselLocation): boolean =>
  !vessel.InService &&
  !!vessel.LeftDock &&
  vessel.LeftDock < new Date(Date.now() - 4 * 60 * 60 * 1000);
