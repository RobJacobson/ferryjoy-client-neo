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
 * Enriches trip copies with minimal prediction fields from preloaded predicted
 * rows while preserving canonical trip timestamps. WSF ETA remains on `trip.Eta`
 * only.
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
