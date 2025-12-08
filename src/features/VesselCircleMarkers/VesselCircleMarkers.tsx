/**
 * VesselCircleMarkers component
 *
 * Renders vessel markers as Mapbox circle layers. Fetches smoothed vessel
 * position data, filters out "lost at sea" vessels, groups vessels by status,
 * and renders three CircleLayer components (one per status category).
 */

import { useSmoothedVesselPositions } from "@/data/contexts";
import type { VesselLocation } from "@/domain";
import { CircleLayer } from "./components/CircleLayer";
import { CIRCLE_STYLES } from "./config";
import { CIRCLE_LAYER_IDS, CIRCLE_SOURCE_IDS } from "./constants";
import { createVesselFeatureCollection } from "./geojson";

/**
 * VesselCircleMarkers component
 *
 * Fetches smoothed vessel positions and renders them as circle markers
 * using Mapbox circle layers. Vessels are grouped by status:
 * - Out-of-service: Not currently in service (lowest z-order)
 * - At-dock: In service but docked (middle z-order)
 * - At-sea: In service and sailing (highest z-order)
 *
 * Filters out vessels that are "lost at sea" (not in service and departed
 * dock more than 4 hours ago without recent position updates).
 *
 * @param onVesselSelect - Callback invoked when a vessel marker is clicked/tapped
 *
 * @returns Three CircleLayer components for vessel markers
 *
 * @example
 * ```tsx
 * // Basic usage
 * <VesselCircleMarkers />
 *
 * // With vessel selection handler
 * <VesselCircleMarkers onVesselSelect={(vessel) => console.log(vessel.VesselName)} />
 * ```
 */
export const VesselCircleMarkers = ({
  onVesselSelect,
}: {
  onVesselSelect?: (vessel: VesselLocation) => void;
}) => {
  const { smoothedVessels } = useSmoothedVesselPositions();

  // Filter out vessels that are "lost at sea"
  const activeVessels = smoothedVessels.filter(
    (vessel) => !isLostAtSea(vessel)
  );

  // Group vessels by status and convert to GeoJSON
  const outOfServiceData = createVesselFeatureCollection(
    activeVessels.filter((vessel) => !vessel.InService)
  );
  const atDockData = createVesselFeatureCollection(
    activeVessels.filter((vessel) => vessel.InService && vessel.AtDock)
  );
  const atSeaData = createVesselFeatureCollection(
    activeVessels.filter((vessel) => vessel.InService && !vessel.AtDock)
  );

  // Handle vessel selection by ID
  const handleVesselSelect = onVesselSelect
    ? (vesselId: number) => {
        const vessel = smoothedVessels.find((v) => v.VesselID === vesselId);
        if (vessel) {
          onVesselSelect(vessel);
        }
      }
    : undefined;

  return (
    <>
      {/* Out-of-service layer (lowest z-order, rendered first) */}
      <CircleLayer
        data={outOfServiceData}
        sourceId={CIRCLE_SOURCE_IDS.outOfService}
        layerId={CIRCLE_LAYER_IDS.outOfService}
        style={CIRCLE_STYLES.outOfService}
        status="outOfService"
        onFeaturePress={handleVesselSelect}
      />

      {/* At-dock layer (middle z-order) */}
      <CircleLayer
        data={atDockData}
        sourceId={CIRCLE_SOURCE_IDS.atDock}
        layerId={CIRCLE_LAYER_IDS.atDock}
        style={CIRCLE_STYLES.atDock}
        status="atDock"
        onFeaturePress={handleVesselSelect}
      />

      {/* At-sea layer (highest z-order, rendered last) */}
      <CircleLayer
        data={atSeaData}
        sourceId={CIRCLE_SOURCE_IDS.atSea}
        layerId={CIRCLE_LAYER_IDS.atSea}
        style={CIRCLE_STYLES.atSea}
        status="atSea"
        onFeaturePress={handleVesselSelect}
      />
    </>
  );
};

/**
 * Determines if a vessel is "lost at sea"
 *
 * A vessel is considered lost at sea if it is not in service and
 * departed dock more than 4 hours ago. Such vessels likely have
 * stale position data and are filtered out.
 *
 * @param vessel - The vessel to check
 * @returns true if the vessel is lost at sea
 */
const isLostAtSea = (vessel: VesselLocation): boolean =>
  !vessel.InService &&
  !!vessel.LeftDock &&
  vessel.LeftDock < new Date(Date.now() - 4 * 60 * 60 * 1000);
