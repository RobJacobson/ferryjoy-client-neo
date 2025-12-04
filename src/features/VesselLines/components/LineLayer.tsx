import MapboxRN from "@rnmapbox/maps";
import { LINE_CAP, LINE_JOIN } from "../utils/shared";
import type { LineLayerProps } from "./LineLayer.types";

/**
 * VesselLine component (React Native version)
 *
 * Renders a vessel track line on the map with a shadow effect.
 * The component receives pre-processed props and renders them using Mapbox ShapeSource and LineLayer.
 *
 * @param line - GeoJSON LineString feature
 * @param sourceId - Source ID for the map
 * @param layerId - Layer ID for the map
 * @param lineGradient - Line gradient for styling
 * @param lineWidth - Line width for styling
 *
 * @returns A Mapbox ShapeSource with LineLayer for the vessel track
 */
export const LineLayer = ({
  line,
  sourceId,
  layerId,
  lineGradient,
  lineWidth,
}: LineLayerProps) => {
  // Skip rendering if no line is provided
  if (!line) return null;

  return (
    <MapboxRN.ShapeSource id={sourceId} shape={line} lineMetrics={true}>
      <MapboxRN.LineLayer
        id={layerId}
        sourceID={sourceId}
        slot="middle"
        style={{
          lineWidth,
          lineCap: LINE_CAP,
          lineJoin: LINE_JOIN,
          lineGradient: lineGradient,
        }}
      />
    </MapboxRN.ShapeSource>
  );
};
