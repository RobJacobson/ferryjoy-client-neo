import MapboxRN from "@rnmapbox/maps";
import { useZoomScale } from "@/shared/hooks";
import {
  getLayerId,
  getSourceId,
  LINE_CAP,
  LINE_GRADIENT,
  LINE_JOIN,
  LINE_WIDTH,
} from "./shared";
import type { VesselLineProps } from "./types";

/**
 * VesselLine component
 *
 * Renders a vessel track line on the map with a shadow effect.
 * The component receives a pre-processed GeoJSON LineString and renders it using Mapbox ShapeSource and LineLayer.
 *
 * @param line - GeoJSON LineString feature
 * @param id - Unique identifier for the line source
 *
 * @returns A Mapbox ShapeSource with LineLayer for the vessel track
 *
 * @example
 * ```tsx
 * <VesselLine
 *   line={lineString}
 *   id={`vessel-line-${vesselId}`}
 * />
 * ```
 */
export const VesselLine = ({ line, id }: VesselLineProps) => {
  const sourceId = getSourceId(id);
  const layerId = getLayerId(id);

  const zoomScale = useZoomScale();

  return (
    <MapboxRN.ShapeSource
      id={sourceId}
      shape={line}
      lineMetrics={true} // Enable line metrics for gradient support
    >
      <MapboxRN.LineLayer
        id={layerId}
        sourceID={sourceId}
        slot="middle"
        style={{
          lineWidth: LINE_WIDTH * zoomScale,
          lineCap: LINE_CAP,
          lineJoin: LINE_JOIN,
          lineGradient: LINE_GRADIENT,
        }}
      />
    </MapboxRN.ShapeSource>
  );
};
