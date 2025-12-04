import { Layer, Source } from "react-map-gl/mapbox";
import { LINE_CAP, LINE_JOIN } from "../utils/shared";
import type { LineLayerProps } from "./LineLayer.types";

/**
 * VesselLine component (Web version)
 *
 * Renders a vessel track line on the map.
 * The component receives pre-processed props and renders them using react-map-gl Source and Layer.
 *
 * @param line - GeoJSON LineString feature
 * @param sourceId - Source ID for the map
 * @param layerId - Layer ID for the map
 * @param lineGradient - Line gradient for styling
 * @param lineWidth - Line width for styling
 *
 * @returns A react-map-gl Source with Layer for the vessel track
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
    <Source id={sourceId} type="geojson" data={line} lineMetrics={true}>
      <Layer
        id={layerId}
        type="line"
        source={sourceId}
        layout={{
          "line-cap": LINE_CAP,
          "line-join": LINE_JOIN,
        }}
        paint={{
          "line-gradient": lineGradient,
          "line-width": lineWidth,
        }}
      />
    </Source>
  );
};
