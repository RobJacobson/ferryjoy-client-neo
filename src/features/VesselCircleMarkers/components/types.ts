/**
 * Shared types for CircleLayer components
 *
 * Defines the interface used by both native and web implementations
 * of the CircleLayer component.
 */

import type { FeatureCollection, Point } from "geojson";
import type { VesselFeatureProperties } from "../geojson";

/**
 * Style configuration for a circle layer
 */
export interface CircleStyleConfig {
  circleColor: string;
  circleRadius: number;
  circleStrokeColor: string;
  circleStrokeWidth: number;
  circleOpacity: number;
  circleBorderWidth: number;
}

/**
 * Props for the CircleLayer component
 *
 * Used by both CircleLayer.tsx (native) and CircleLayer.web.tsx (web)
 */
export interface CircleLayerProps {
  /** GeoJSON FeatureCollection of vessel points */
  data: FeatureCollection<Point, VesselFeatureProperties>;
  /** Unique source ID for this layer */
  sourceId: string;
  /** Unique layer ID for this layer */
  layerId: string;
  /** Style configuration for the circles */
  style: CircleStyleConfig;
  /** Callback when a vessel feature is clicked/pressed */
  onFeaturePress?: (vesselId: number) => void;
}
