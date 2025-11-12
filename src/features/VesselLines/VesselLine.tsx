import MapboxRN from "@rnmapbox/maps";
import { LINE_CAP, LINE_GRADIENT, LINE_JOIN, LINE_WIDTH } from "./styles";
import type { VesselLineProps } from "./types";
import { getLayerId, getSourceId } from "./utils";

/**
 * VesselLine component
 *
 * Renders a vessel track line on the map.
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
          lineWidth: LINE_WIDTH,
          lineCap: LINE_CAP,
          lineJoin: LINE_JOIN,
          lineGradient: LINE_GRADIENT,
        }}
      />
    </MapboxRN.ShapeSource>
  );
};
