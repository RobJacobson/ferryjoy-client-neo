/**
 * Pure join of preloaded `eventsPredicted` rows onto stored trip documents for
 * API reads.
 */

import type { Doc } from "_generated/dataModel";
import {
  type ConvexPredictionSource,
  type PredictionType,
  predictedDockCompositeKey,
} from "domain/events/predicted/schemas";
import type {
  ConvexJoinedTripPrediction,
  ConvexVesselTrip,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import {
  buildTripPredictionBoundaryKeys,
  buildVesselSailingDayScopeKey,
} from "shared/keys";

/**
 * Maps one `eventsPredicted` row to the minimal joined trip prediction shape.
 *
 * Copies `EventPredictedTime` to `PredTime` and passes through optional
 * actualization fields only when defined.
 *
 * @param row - Predicted dock row subset
 * @returns `ConvexJoinedTripPrediction` fragment
 */
const rowToJoined = (row: {
  EventPredictedTime: number;
  Actual?: number;
  DeltaTotal?: number;
}): ConvexJoinedTripPrediction => ({
  PredTime: row.EventPredictedTime,
  ...(row.Actual !== undefined ? { Actual: row.Actual } : {}),
  ...(row.DeltaTotal !== undefined ? { DeltaTotal: row.DeltaTotal } : {}),
});

/**
 * Joins preloaded `eventsPredicted` rows onto stored trip documents.
 *
 * Maps each trip through `mergeTripPredictions`; leaves `trip.Eta` as the only
 * WSF ETA surface (ML predictions use joined fields).
 *
 * @param trips - Stored trip documents
 * @param predictedByGroup - Rows keyed by vessel/sailing-day scope, then composite key
 * @returns Trips with optional joined prediction fields
 */
export const mergeTripsWithPredictions = (
  trips: ConvexVesselTrip[],
  predictedByGroup: Map<string, Map<string, Doc<"eventsPredicted">>>
): ConvexVesselTripWithPredictions[] =>
  trips.map((trip) => mergeTripPredictions(trip, predictedByGroup));

/**
 * Joins one trip with optional prediction fields from the preloaded scope map.
 *
 * @param trip - Stored trip document
 * @param predictedByGroup - Predicted rows by sailing-day scope, then composite key
 * @returns Trip copy with joined ML fields when rows exist
 */
const mergeTripPredictions = (
  trip: ConvexVesselTrip,
  predictedByGroup: Map<string, Map<string, Doc<"eventsPredicted">>>
): ConvexVesselTripWithPredictions => {
  if (!trip.SailingDay) {
    return { ...trip } as ConvexVesselTripWithPredictions;
  }

  const g = buildVesselSailingDayScopeKey(trip.VesselAbbrev, trip.SailingDay);
  const predMap = predictedByGroup.get(g);

  const { depDockKey, arvDockKey, nextDepDockKey } =
    buildTripPredictionBoundaryKeys(trip);

  const joined = (
    boundaryKey: string | undefined,
    predictionType: PredictionType,
    source: ConvexPredictionSource
  ): ConvexJoinedTripPrediction | undefined => {
    if (!boundaryKey || !predMap) {
      return undefined;
    }
    const row = predMap.get(
      predictedDockCompositeKey({
        Key: boundaryKey,
        PredictionType: predictionType,
        PredictionSource: source,
      })
    );
    return row ? rowToJoined(row) : undefined;
  };

  const AtDockDepartCurr = joined(depDockKey, "AtDockDepartCurr", "ml");
  const AtDockArriveNext = joined(arvDockKey, "AtDockArriveNext", "ml");
  const AtSeaArriveNext = joined(arvDockKey, "AtSeaArriveNext", "ml");
  const AtSeaDepartNext = joined(nextDepDockKey, "AtSeaDepartNext", "ml");
  const AtDockDepartNext = AtSeaDepartNext
    ? undefined
    : joined(nextDepDockKey, "AtDockDepartNext", "ml");

  return {
    ...trip,
    ...(AtDockDepartCurr !== undefined ? { AtDockDepartCurr } : {}),
    ...(AtDockArriveNext !== undefined ? { AtDockArriveNext } : {}),
    ...(AtDockDepartNext !== undefined ? { AtDockDepartNext } : {}),
    ...(AtSeaArriveNext !== undefined ? { AtSeaArriveNext } : {}),
    ...(AtSeaDepartNext !== undefined ? { AtSeaDepartNext } : {}),
  };
};
