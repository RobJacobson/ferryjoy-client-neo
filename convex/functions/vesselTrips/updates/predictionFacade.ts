/**
 * Prediction facade for vessel trip updates.
 *
 * Consolidates ML prediction computation, actualization, and record extraction
 * so processVesselTripTick can delegate prediction concerns to this module.
 */
import type { ActionCtx } from "_generated/server";
import {
  computeTripWithPredictions,
  updatePredictionsWithActuals,
} from "domain/ml/prediction";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import {
  extractPredictionRecord,
  PREDICTION_FIELDS,
} from "functions/predictions/utils";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type ProcessPredictionsOptions = {
  /** When true, actualizes predictions and extracts completed records */
  didJustLeaveDock?: boolean;
};

export type ProcessPredictionsResult = {
  tripWithPredictions: ConvexVesselTrip;
  completedRecords: ConvexPredictionRecord[];
};

/**
 * Compute predictions for a trip, optionally actualize when vessel just left
 * dock, and extract completed prediction records.
 *
 * @param ctx - Convex action context for model loading
 * @param trip - Trip to enrich with predictions (after scheduled identity)
 * @param existingTrip - Previous trip state (for event-based triggers)
 * @param options - Options controlling actualization and extraction
 * @returns Fully patched trip and completed prediction records
 */
export const processPredictionsForTrip = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined,
  options: ProcessPredictionsOptions = {}
): Promise<ProcessPredictionsResult> => {
  const { didJustLeaveDock = false } = options;

  const tripWithPredictions = await computeTripWithPredictions(
    ctx,
    trip,
    existingTrip
  );

  const actualUpdates =
    didJustLeaveDock && existingTrip
      ? updatePredictionsWithActuals(existingTrip, tripWithPredictions)
      : {};
  const tripWithActuals = { ...tripWithPredictions, ...actualUpdates };

  const completedRecords = didJustLeaveDock
    ? extractCompletedRecordsFromTrip(tripWithActuals)
    : [];

  return {
    tripWithPredictions: tripWithActuals,
    completedRecords,
  };
};

export type FinalizeCompletedTripResult = {
  actualUpdates: Partial<ConvexVesselTrip>;
  completedRecords: ConvexPredictionRecord[];
};

/**
 * Actualize predictions on a completed trip and extract records for bulk insert.
 *
 * Used at trip boundary when archiving the completed trip. The completed trip
 * has TripEnd set; predictions with Actual undefined get actualized.
 *
 * @param existingTrip - Trip state before completion (for actualization)
 * @param completedTripBase - Completed trip with TripEnd, durations, etc.
 * @returns Actual updates to merge and completed prediction records
 */
export const finalizeCompletedTripPredictions = (
  existingTrip: ConvexVesselTrip,
  completedTripBase: ConvexVesselTrip
): FinalizeCompletedTripResult => {
  const actualUpdates = updatePredictionsWithActuals(
    existingTrip,
    completedTripBase
  );
  const completedTrip = { ...completedTripBase, ...actualUpdates };
  const completedRecords = extractCompletedRecordsFromTrip(completedTrip);
  return { actualUpdates, completedRecords };
};

/**
 * Extract all completed prediction records from a vessel trip.
 *
 * @param trip - Vessel trip containing actualized predictions
 * @returns Array of prediction records ready for database insertion
 */
const extractCompletedRecordsFromTrip = (
  trip: ConvexVesselTrip
): ConvexPredictionRecord[] => {
  const records: ConvexPredictionRecord[] = [];
  for (const field of PREDICTION_FIELDS) {
    const record = extractPredictionRecord(trip, field);
    if (record) {
      records.push(record);
    }
  }
  return records;
};
