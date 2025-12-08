/**
 * CircleLayer component (Web version)
 *
 * Renders vessel markers as a circle layer using react-map-gl/mapbox.
 * This component handles platform-specific rendering for web platforms.
 * Circle sizes are dynamically scaled based on the map's zoom level.
 * Includes a drop shadow layer rendered beneath each circle.
 */

import { useEffect } from "react";
import type { MapMouseEvent } from "react-map-gl/mapbox";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import { useZoomScale } from "@/shared/hooks";
import { CIRCLE_SHADOW } from "../config";
import type { CircleLayerProps } from "./types";

/**
 * CircleLayer component for Web
 *
 * Renders a GeoJSON FeatureCollection of vessels as circle markers
 * using react-map-gl's Source and Layer components.
 *
 * @param data - GeoJSON FeatureCollection of vessel points
 * @param sourceId - Unique source ID
 * @param layerId - Unique layer ID
 * @param style - Circle styling configuration
 * @param onFeaturePress - Callback when a feature is clicked
 *
 * @returns A react-map-gl Source with circle Layer
 */
export const CircleLayer = ({
  data,
  sourceId,
  layerId,
  style,
  onFeaturePress,
}: CircleLayerProps) => {
  const { current: map } = useMap();
  const zoomScale = useZoomScale();

  // Handle click events on the layer
  const handleClick = (event: MapMouseEvent) => {
    if (!onFeaturePress) return;

    const feature = event.features?.[0];
    if (feature?.properties?.VesselID) {
      onFeaturePress(feature.properties.VesselID as number);
    }
  };

  // Register click handler for this layer
  useEffect(() => {
    if (!map || !onFeaturePress) return;

    map.on("click", layerId, handleClick);

    // Set cursor to pointer on hover
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      map.off("click", layerId, handleClick);
      map.off("mouseenter", layerId, () => {});
      map.off("mouseleave", layerId, () => {});
    };
  });

  const scaledRadius = style.circleRadius * zoomScale;

  return (
    <Source id={sourceId} type="geojson" data={data}>
      {/* Shadow layer (rendered first, underneath) */}
      <Layer
        id={`${layerId}-shadow`}
        type="circle"
        source={sourceId}
        paint={{
          "circle-radius": scaledRadius,
          "circle-color": "transparent",
          "circle-stroke-width": CIRCLE_SHADOW.strokeWidth * zoomScale,
          "circle-stroke-color": CIRCLE_SHADOW.strokeColor,
          "circle-stroke-opacity": CIRCLE_SHADOW.strokeOpacity,
          "circle-translate": CIRCLE_SHADOW.translate,
          "circle-pitch-alignment": "map",
        }}
      />
      {/* Outer stroke circle layer */}
      <Layer
        id={`${layerId}-stroke`}
        type="circle"
        source={sourceId}
        paint={{
          "circle-radius": scaledRadius,
          "circle-color": "transparent",
          "circle-stroke-width": style.circleBorderWidth * zoomScale,
          "circle-stroke-color": style.circleColor,
          "circle-pitch-alignment": "map",
        }}
      />
      {/* Main circle layer */}
      <Layer
        id={layerId}
        type="circle"
        source={sourceId}
        paint={{
          "circle-radius": scaledRadius,
          "circle-color": style.circleColor,
          "circle-opacity": style.circleOpacity,
          "circle-stroke-width": style.circleStrokeWidth * zoomScale,
          "circle-stroke-color": style.circleStrokeColor,
          "circle-pitch-alignment": "map",
        }}
      />
    </Source>
  );
};
