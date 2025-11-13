/**
 * VesselLine component (Web version)
 *
 * Renders a smoothed vessel track line on map using TurfJS bezierSpline.
 * This component takes vessel ping data, converts it to GeoJSON LineString format,
 * applies bezierSpline smoothing, and renders path on the web map.
 */

import { Layer, Source } from "react-map-gl/mapbox";
import { useZoomScale } from "@/shared/hooks";
import {
  createLineGradient,
  getLayerId,
  getSourceId,
  LINE_CAP,
  LINE_JOIN,
  LINE_WIDTH,
} from "./shared";
import type { VesselLineProps } from "./types";

/**
 * VesselLine component (Web version)
 *
 * Renders a smoothed vessel track line on map using TurfJS bezierSpline.
 * The component converts vessel ping coordinates to GeoJSON LineString format,
 * applies bezierSpline smoothing, and renders path using react-map-gl Source and Layer.
 *
 * @param line - GeoJSON LineString feature
 * @param id - Unique identifier for the line source
 * @param rgbaColor - RGBA color values for the line [r, g, b, a]
 *
 * @returns A react-map-gl Source with Layer for the smoothed vessel track
 *
 * @example
 * ```tsx
 * <VesselLine
 *   line={lineString}
 *   id={`vessel-line-${vesselId}`}
 *   rgbaColor={[244, 114, 182, 0.75]}
 * />
 * ```
 */
export const VesselLine = ({ line, id, rgbaColor }: VesselLineProps) => {
  const sourceId = getSourceId(id);
  const layerId = getLayerId(id);

  const zoomScale = useZoomScale();

  // Create gradient with the provided RGBA color
  const lineGradient = createLineGradient(
    rgbaColor[0],
    rgbaColor[1],
    rgbaColor[2],
    rgbaColor[3]
  );

  return (
    <Source
      id={sourceId}
      type="geojson"
      data={line}
      lineMetrics={true} // Enable line metrics for gradient support
    >
      {/* Main line layer - rendered second (above) */}
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
          "line-width": LINE_WIDTH * zoomScale,
        }}
      />
    </Source>
  );
};
