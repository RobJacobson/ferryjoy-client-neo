// ============================================================================
// PREDICTION TYPES
// ============================================================================

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Prediction result
 */
export type PredictionResult = {
  predictedTime?: number;
  mae?: number;
};

/**
 * Context for predictions when a new trip starts
 */
export type NewTripContext = {
  completedTrip: ConvexVesselTrip;
  newTrip: ConvexVesselTrip;
};

/**
 * Context for ETA prediction when vessel leaves dock
 */
export type DepartureContext = {
  currentTrip: ConvexVesselTrip;
  currentLocation: ConvexVesselLocation;
};
