import type { VesselLocation, VesselPing } from "@/domain";
import { CIRCLE_LAYER_IDS } from "@/features/VesselCircleMarkers/constants";
import { useZoomScale } from "@/shared/hooks";
import { LineLayer } from "./components/LineLayer"; // Will be resolved to platform-specific version
import { VESSEL_LINE_CONFIG } from "./config";
import { filterVesselPings } from "./utils/filtering";
import { createLineGradient } from "./utils/shared";
import { createSmoothedLine } from "./utils/smoothing";

export const VesselLine = ({
  vesselId,
  pings,
  currentPosition,
}: {
  vesselId: string;
  pings: VesselPing[];
  currentPosition?: VesselLocation;
}) => {
  const mapScale = useZoomScale();
  // Filter pings first
  const coordinates = filterVesselPings(pings, currentPosition);

  // Determine if vessel is actively in service (not docked or out of service)
  const inService = !!currentPosition?.InService && !currentPosition?.AtDock;

  // Get color based on service status
  const rgbaColor = inService
    ? VESSEL_LINE_CONFIG.styling.colors.inService
    : VESSEL_LINE_CONFIG.styling.colors.atDock;

  // Generate line gradient
  const lineGradient = createLineGradient(rgbaColor);

  // Skip if we don't have enough points or no current position
  if (
    !currentPosition ||
    coordinates.length < VESSEL_LINE_CONFIG.filtering.minPoints
  ) {
    return null;
  }

  // Apply smoothing with selected strategy
  const line = createSmoothedLine(
    coordinates,
    VESSEL_LINE_CONFIG.smoothing.strategy
  );

  // Generate IDs and styling properties
  const sourceId = `vessel-line-source-${vesselId}`;
  const layerId = `vessel-line-layer-${vesselId}`;
  const innerLineWidth = VESSEL_LINE_CONFIG.styling.innerLineWidth * mapScale;
  const outerLineWidth = VESSEL_LINE_CONFIG.styling.outerLineWidth * mapScale;

  // Render platform-specific VesselLine component with all props
  return (
    <LineLayer
      id={`vessel-${vesselId}`}
      line={line || undefined}
      inService={inService}
      rgbaColor={rgbaColor}
      sourceId={sourceId}
      layerId={layerId}
      lineGradient={lineGradient}
      lineWidth={innerLineWidth}
      outerLineWidth={outerLineWidth}
      outerLayerId={`${layerId}-outer`}
      belowLayerId={CIRCLE_LAYER_IDS.outOfService}
    />
  );
};
