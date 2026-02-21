/**
 * CircleLayer component (React Native version)
 *
 * Renders vessel markers as a circle layer using @rnmapbox/maps.
 * This component handles platform-specific rendering for native platforms (iOS/Android).
 * Circle sizes are dynamically scaled based on the map's zoom level.
 * Includes a drop shadow layer rendered beneath each circle.
 */

import MapboxRN, { type ShapeSource } from "@rnmapbox/maps";
import { useZoomScale } from "@/shared/hooks";
// import { CIRCLE_SHADOW } from "../config";
import type { CircleLayerProps } from "./types";

/** Extract the OnPress event type from ShapeSource props */
type OnPressEvent = Parameters<
  NonNullable<React.ComponentProps<typeof ShapeSource>["onPress"]>
>[0];

/**
 * CircleLayer component for React Native
 *
 * Renders a GeoJSON FeatureCollection of vessels as circle markers
 * using Mapbox's ShapeSource and CircleLayer.
 *
 * @param data - GeoJSON FeatureCollection of vessel points
 * @param sourceId - Unique source ID
 * @param layerId - Unique layer ID
 * @param style - Circle styling configuration
 * @param onFeaturePress - Callback when a feature is pressed
 *
 * @returns A Mapbox ShapeSource with CircleLayer
 */
export const CircleLayer = ({
  data,
  sourceId,
  layerId,
  style,
  onFeaturePress,
}: CircleLayerProps) => {
  const zoomScale = useZoomScale();

  // Handle press events on the shape source
  const handlePress = (event: OnPressEvent) => {
    if (!onFeaturePress) return;

    const feature = event.features?.[0];
    if (feature?.properties?.VesselID) {
      onFeaturePress(feature.properties.VesselID as number);
    }
  };

  const scaledRadius = style.circleRadius * zoomScale;

  return (
    <MapboxRN.ShapeSource
      id={sourceId}
      shape={data}
      onPress={onFeaturePress ? handlePress : undefined}
    >
      {/* Shadow layer (rendered first, underneath) */}
      {/* <MapboxRN.CircleLayer
        id={`${layerId}-shadow`}
        sourceID={sourceId}
        slot="middle"
        style={{
          circleRadius: scaledRadius,
          circleColor: "transparent",
          circleStrokeWidth: CIRCLE_SHADOW.strokeWidth * zoomScale,
          circleStrokeColor: CIRCLE_SHADOW.strokeColor,
          circleStrokeOpacity: CIRCLE_SHADOW.strokeOpacity,
          circleTranslate: CIRCLE_SHADOW.translate,
        }}
      /> */}
      {/* Outer stroke circle layer */}
      <MapboxRN.CircleLayer
        id={`${layerId}-stroke`}
        sourceID={sourceId}
        slot="middle"
        style={{
          circleRadius: scaledRadius,
          circleColor: "transparent",
          circleStrokeWidth: style.circleBorderWidth * zoomScale,
          circleStrokeColor: style.circleColor,
          circlePitchAlignment: "map",
        }}
      />
      {/* Main circle layer */}
      <MapboxRN.CircleLayer
        id={layerId}
        sourceID={sourceId}
        slot="middle"
        style={{
          circleRadius: scaledRadius,
          circleColor: style.circleColor,
          circleOpacity: style.circleOpacity,
          circleStrokeWidth: style.circleStrokeWidth * zoomScale,
          circleStrokeColor: style.circleStrokeColor,
          circlePitchAlignment: "map",
        }}
      />
    </MapboxRN.ShapeSource>
  );
};
