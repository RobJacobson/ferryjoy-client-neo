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
 * Parameters required for delay prediction
 */
export type DelayPredictionParams = {
  scheduledDeparture: number;
  departingTerminal: string;
  arrivingTerminal: string;
  tripStart: number;
  previousDelay: number;
  previousAtSeaDuration: number;
  vesselAbbrev: string;
};

/**
 * Context for predictions when a new trip starts
 */
export type NewTripContext = {
  departingTerminal: string;
  arrivingTerminal: string;
  completedTrip: ConvexVesselTrip;
  newTrip: ConvexVesselTrip;
};

/**
 * Context for ETA prediction when vessel leaves dock
 */
export type DepartureContext = {
  departingTerminal: string;
  arrivingTerminal: string;
  currentTrip: ConvexVesselTrip;
  currentLocation: ConvexVesselLocation;
};
