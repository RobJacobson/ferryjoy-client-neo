/**
 * VesselLine component (Web version)
 *
 * Renders a smoothed vessel track line on map using TurfJS bezierSpline.
 * This component takes vessel ping data, converts it to GeoJSON LineString format,
 * applies bezierSpline smoothing, and renders path on the web map.
 */

import { Layer, Source } from "react-map-gl/mapbox";
import { LINE_CAP, LINE_GRADIENT, LINE_JOIN, LINE_WIDTH } from "./styles";
import type { VesselLineProps } from "./types";
import { getLayerId, getSourceId } from "./utils";

/**
 * VesselLine component (Web version)
 *
 * Renders a smoothed vessel track line on map using TurfJS bezierSpline.
 * The component converts vessel ping coordinates to GeoJSON LineString format,
 * applies bezierSpline smoothing, and renders path using react-map-gl Source and Layer.
 *
 * @param pings - Array of vessel pings sorted by timestamp (newest first) from ConvexContext
 * @param id - Unique identifier for the line source
 *
 * @returns A react-map-gl Source with Layer for the smoothed vessel track
 *
 * @example
 * ```tsx
 * <VesselLine
 *   pings={vesselPings}
 *   inService={true}
 *   id={`vessel-line-${vesselId}`}
 * />
 * ```
 */
export const VesselLine = ({ line, id }: VesselLineProps) => {
  const sourceId = getSourceId(id);
  const layerId = getLayerId(id);

  return (
    <Source
      id={sourceId}
      type="geojson"
      data={line}
      lineMetrics={true} // Enable line metrics for gradient support
    >
      <Layer
        id={layerId}
        type="line"
        source={sourceId}
        layout={{
          "line-cap": LINE_CAP,
          "line-join": LINE_JOIN,
        }}
        paint={{
          "line-gradient": LINE_GRADIENT,
          "line-width": LINE_WIDTH,
        }}
      />
    </Source>
  );
};
