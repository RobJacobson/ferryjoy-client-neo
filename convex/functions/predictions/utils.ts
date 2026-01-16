// ============================================================================
// PREDICTION RECORD EXTRACTION UTILITIES
// Helper functions to extract prediction records from VesselTrips
// ============================================================================

import type {
  ConvexPredictionRecord,
  PredictionType,
} from "functions/predictions/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

type PredictionField =
  | "AtDockDepartCurr"
  | "AtDockArriveNext"
  | "AtDockDepartNext"
  | "AtSeaArriveNext"
  | "AtSeaDepartNext";

/**
 * Maps prediction field names to PascalCase prediction types (for predictions table)
 * The field names already match the PascalCase format we want in the table
 */
const PREDICTION_FIELD_TO_TYPE: Record<PredictionField, PredictionType> = {
  AtDockDepartCurr: "AtDockDepartCurr",
  AtDockArriveNext: "AtDockArriveNext",
  AtDockDepartNext: "AtDockDepartNext",
  AtSeaArriveNext: "AtSeaArriveNext",
  AtSeaDepartNext: "AtSeaDepartNext",
};

/**
 * Extracts a prediction record from a VesselTrip for insertion into the predictions table.
 *
 * @param trip - The vessel trip containing the prediction
 * @param field - The prediction field name (e.g., "AtDockDepartCurr")
 * @returns A prediction record ready for insertion, or null if the prediction is not complete
 */
export const extractPredictionRecord = (
  trip: ConvexVesselTrip,
  field: PredictionField
): ConvexPredictionRecord | null => {
  const prediction = trip[field];
  if (!prediction) {
    return null;
  }

  // Only extract if Actual is set (prediction is completed)
  if (prediction.Actual === undefined) {
    return null;
  }

  // Validate required fields are present
  if (!trip.Key) {
    return null;
  }

  if (!trip.DepartingTerminalAbbrev || !trip.ArrivingTerminalAbbrev) {
    return null;
  }

  // Map field to prediction type
  const predictionType = PREDICTION_FIELD_TO_TYPE[field];

  // Round times to seconds (they should already be rounded, but ensure consistency)
  /**
   * Round timestamp to nearest second boundary for consistent storage.
   * Ensures prediction records use consistent precision across all timestamp fields.
   * @param ms - Timestamp in milliseconds to round, or undefined if not available
   * @returns Timestamp rounded down to nearest second boundary, or undefined if input is undefined
   */
  const roundToSeconds = (ms: number | undefined): number | undefined =>
    ms !== undefined ? Math.floor(ms / 1000) * 1000 : undefined;

  return {
    Key: trip.Key,
    VesselAbbreviation: trip.VesselAbbrev,
    DepartingTerminalAbbrev: trip.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
    PredictionType: predictionType,
    TripStart: roundToSeconds(trip.TripStart),
    ScheduledDeparture: roundToSeconds(trip.ScheduledDeparture),
    LeftDock: roundToSeconds(trip.LeftDock),
    TripEnd: roundToSeconds(trip.TripEnd),
    MinTime: roundToSeconds(prediction.MinTime) ?? 0,
    PredTime: roundToSeconds(prediction.PredTime) ?? 0,
    MaxTime: roundToSeconds(prediction.MaxTime) ?? 0,
    MAE: prediction.MAE,
    StdDev: prediction.StdDev,
    Actual: roundToSeconds(prediction.Actual) ?? 0,
    DeltaTotal: prediction.DeltaTotal ?? 0,
    DeltaRange: prediction.DeltaRange ?? 0,
  };
};
