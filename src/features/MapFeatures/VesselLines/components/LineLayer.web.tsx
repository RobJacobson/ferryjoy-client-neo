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
  outerLineGradient,
  lineWidth,
  outerLineWidth,
  outerLayerId,
  belowLayerId,
}: LineLayerProps) => {
  // Skip rendering if no line is provided
  if (!line) return null;

  const resolvedOuterLayerId = outerLayerId ?? `${layerId}-outer`;
  const resolvedOuterGradient = outerLineGradient ?? lineGradient;

  return (
    <Source id={sourceId} type="geojson" data={line} lineMetrics={true}>
      {outerLineWidth && (
        <Layer
          id={resolvedOuterLayerId}
          type="line"
          source={sourceId}
          layout={{
            "line-cap": LINE_CAP,
            "line-join": LINE_JOIN,
          }}
          paint={{
            "line-gradient": resolvedOuterGradient,
            "line-width": outerLineWidth,
          }}
          beforeId={belowLayerId}
        />
      )}
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
        beforeId={belowLayerId}
      />
    </Source>
  );
};
