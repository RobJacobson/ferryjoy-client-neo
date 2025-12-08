/**
 * GeoJSON utilities for VesselCircleMarkers
 *
 * Provides functions to convert vessel data to GeoJSON FeatureCollections
 * for use with Mapbox circle layers.
 */

import type { Feature, FeatureCollection, Point } from "geojson";
import type { VesselLocation } from "@/domain";

/**
 * Properties stored in each vessel point feature
 */
export interface VesselFeatureProperties {
  VesselID: number;
}

/**
 * Type for a vessel point feature
 */
export type VesselPointFeature = Feature<Point, VesselFeatureProperties>;

/**
 * Creates a GeoJSON FeatureCollection from an array of VesselLocations
 *
 * @param vessels - Array of vessel location data
 * @returns A GeoJSON FeatureCollection containing all vessel points
 */
export const createVesselFeatureCollection = (
  vessels: VesselLocation[]
): FeatureCollection<Point, VesselFeatureProperties> => ({
  type: "FeatureCollection",
  features: vessels.map((vessel) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [vessel.Longitude, vessel.Latitude],
    },
    properties: {
      VesselID: vessel.VesselID,
    },
  })),
});
