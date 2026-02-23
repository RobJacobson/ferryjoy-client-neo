import type { ActionCtx } from "_generated/server";
import { computeTripWithPredictions } from "domain/ml/prediction";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  buildCompleteTrip,
  enrichTripStartUpdates,
  lookupArrivalTerminalFromSchedule,
} from "./enrichment";
import { updateAndExtractPredictions } from "./utils";

export type EnrichmentResult = {
  enrichedTrip: ConvexVesselTrip;
  didJustLeaveDock: boolean;
  predictionRecords: ConvexPredictionRecord[];
};

/**
 * Build and enrich a vessel trip with all enrichment steps consolidated.
 *
 * Orchestrates the complete enrichment pipeline:
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
  const { updatedTrip: tripWithActuals, completedRecords } =
    didJustLeaveDock && existingTrip
      ? updateAndExtractPredictions(existingTrip, tripWithPredictions)
      : { updatedTrip: tripWithPredictions, completedRecords: [] };

  completedPredictionRecords.push(...completedRecords);

  return {
    enrichedTrip: tripWithActuals,
    didJustLeaveDock,
    predictionRecords: completedPredictionRecords,
  };
};
