/**
 * Consolidated enrichment for vessel trip updates.
 *
 * This function consolidates the 5-step enrichment pipeline from regular
 * update path into a single cohesive function, reducing complexity and file
 * navigation while maintaining all existing behavior and invariants.
 *
 * The enrichment pipeline:
 * 1. Arrival terminal lookup (I/O-conditioned)
 * 2. Location-derived field construction
 * 3. Schedule enrichment (trip identity derivation)
 * 4. Prediction computation (event-based triggers)
 * 5. Prediction actualization (when didJustLeaveDock)
 * 6. Prediction record extraction
 */
import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import {
  computeTripWithPredictions,
  updatePredictionsWithActuals,
} from "domain/ml/prediction";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import { PREDICTION_FIELDS } from "functions/predictions/utils";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { lookupArrivalTerminalFromSchedule } from "./arrivalTerminalLookup";
import { buildCompleteTrip } from "./buildCompleteTrip";
import { enrichTripStartUpdates } from "./scheduledTripEnrichment";

export type EnrichmentResult = {
  enrichedTrip: ConvexVesselTrip;
  didJustLeaveDock: boolean;
  predictionRecords: ConvexPredictionRecord[];
};

// ============================================================================
// Main exported function
// ============================================================================

/**
 * Build and enrich a vessel trip with all enrichment steps consolidated.
 *
 * This function orchestrates the complete enrichment pipeline:
 * 1. Arrival terminal lookup (I/O-conditioned)
 * 2. Location-derived field construction
 * 3. Schedule enrichment (trip identity derivation)
 * 4. Prediction computation (event-based triggers)
 * 5. Prediction actualization (when didJustLeaveDock)
 * 6. Prediction record extraction
 *
 * Maintains all invariants from README section 2.7:
 * - ArrivingTerminalAbbrev fallback chain for regular updates
 * - Null-overwrite protection for ScheduledDeparture, Eta, LeftDock
 * - LeftDock special case when AtDock flips false
 * - I/O-conditioned lookups to avoid unnecessary DB calls
 *
 * @param ctx - Convex action context for database operations
 * @param existingTrip - Current active trip from database (same trip, prior tick)
 * @param currLocation - Latest vessel location from REST/API
 * @returns Enriched trip, event detection flags, and completed prediction records
 */
export const buildAndEnrichTrip = async (
  ctx: ActionCtx,
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): Promise<EnrichmentResult> => {
  const completedPredictionRecords: ConvexPredictionRecord[] = [];

  // ==========================================================================
  // Step 1: Arrival terminal lookup (I/O-conditioned)
  // ==========================================================================
  // Only lookup when at dock, missing ArrivingTerminal, and has required fields
  const baseTripForLookup: ConvexVesselTrip = {
    ...existingTrip,
    ScheduledDeparture:
      currLocation.ScheduledDeparture ?? existingTrip.ScheduledDeparture,
  };

  const arrivalLookup = await lookupArrivalTerminalFromSchedule(
    ctx,
    baseTripForLookup,
    currLocation
  );

  // ==========================================================================
  // Step 2: Build complete trip from location + enrichment
  // ==========================================================================
  const proposedTrip = buildCompleteTrip(
    existingTrip,
    currLocation,
    arrivalLookup
  );

  // ==========================================================================
  // Step 3: Schedule enrichment (trip identity derivation)
  // ==========================================================================
  const schedulePatch = await enrichTripStartUpdates(
    ctx,
    proposedTrip,
    arrivalLookup?.scheduledTripDoc
  );
  const tripWithScheduled = { ...proposedTrip, ...schedulePatch };

  // ==========================================================================
  // Step 4: Event detection
  // ==========================================================================
  const didJustLeaveDock =
    existingTrip.LeftDock === undefined &&
    tripWithScheduled.LeftDock !== undefined;
  const justArrivedDock = !existingTrip.AtDock && currLocation.AtDock;

  // ==========================================================================
  // Step 5: Prediction computation (event-based triggers)
  // ==========================================================================
  // Arrive-dock predictions (AtDockArriveNext, AtDockDepartNext): Run once when
  // vessel first arrives at dock with destination.
  // Depart-dock predictions (AtDockDepartCurr, AtSeaArriveNext, AtSeaDepartNext):
  // Run once when vessel physically departs dock.
  const tripWithPredictions = await computeTripWithPredictions(
    ctx,
    tripWithScheduled,
    existingTrip
  );

  // ==========================================================================
  // Step 6: Prediction actualization (when didJustLeaveDock)
  // ==========================================================================
  const actualUpdates =
    didJustLeaveDock && existingTrip
      ? updatePredictionsWithActuals(existingTrip, tripWithPredictions)
      : {};
  const tripWithActuals = { ...tripWithPredictions, ...actualUpdates };

  // Extract completed prediction records
  const completedRecords = didJustLeaveDock
    ? extractCompletedRecordsFromTrip(tripWithActuals)
    : [];
  completedPredictionRecords.push(...completedRecords);

  return {
    enrichedTrip: tripWithActuals,
    didJustLeaveDock,
    predictionRecords: completedPredictionRecords,
  };
};

// ============================================================================
// Internal helpers
// ============================================================================

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
    const prediction = trip[field];
    if (!prediction) {
      continue;
    }

    // Only extract if Actual is set (prediction is completed)
    if (prediction.Actual === undefined) {
      continue;
    }

    // Validate required fields are present
    if (!trip.Key) {
      continue;
    }

    if (!trip.DepartingTerminalAbbrev || !trip.ArrivingTerminalAbbrev) {
      continue;
    }

    // Map field to prediction type
    const predictionType = field as "AtDockDepartCurr" | "AtDockArriveNext" |
      "AtDockDepartNext" | "AtSeaArriveNext" | "AtSeaDepartNext";

    // Round times to seconds (they should already be rounded, but ensure consistency)
    const roundToSeconds = (ms: number | undefined): number | undefined =>
      ms !== undefined ? Math.floor(ms / 1000) * 1000 : undefined;

    records.push({
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
    });
  }
  return records;
};
