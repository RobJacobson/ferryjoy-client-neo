/**
 * Query enrichment: joins `eventsPredicted` onto stored trip documents for API
 * reads.
 *
 * The vessel orchestrator tick uses storage-native trips and skips this join.
 */

import type { DataModel, Doc } from "_generated/dataModel";
import type { GenericQueryCtx } from "convex/server";
import {
  type ConvexPredictionSource,
  predictedBoundaryCompositeKey,
} from "functions/eventsPredicted/schemas";
import type { PredictionType } from "functions/predictions/schemas";
import type {
  ConvexJoinedTripPrediction,
  ConvexVesselTripWithPredictions,
  ConvexVesselTrip,
} from "functions/vesselTrips/schemas";
import {
  buildTripPredictionBoundaryKeys,
  buildVesselSailingDayScopeKey,
  parseVesselSailingDayScopeKey,
} from "shared/keys";

type Ctx = Pick<GenericQueryCtx<DataModel>, "db">;

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
 * Batch-loads `eventsPredicted` for the given trips and enriches copies with
 * minimal prediction fields while preserving the canonical trip timestamps. WSF
 * ETA remains on `trip.Eta` only.
 *
 * @param ctx - Query context
 * @param trips - Stored trip documents
 * @returns Trips enriched with prediction fields matching
 *   {@link ConvexVesselTripWithPredictions}
 */
export const enrichTripsWithPredictions = async (
  ctx: Ctx,
  trips: ConvexVesselTrip[]
): Promise<ConvexVesselTripWithPredictions[]> => {
  type TripDoc = ConvexVesselTrip;

  const groups = trips
    .filter((trip): trip is TripDoc & { SailingDay: string } =>
      Boolean(trip.SailingDay)
    )
    .reduce((acc, trip) => {
      const g = buildVesselSailingDayScopeKey(
        trip.VesselAbbrev,
        trip.SailingDay
      );
      const list = acc.get(g) ?? [];
      list.push(trip);
      acc.set(g, list);
      return acc;
    }, new Map<string, TripDoc[]>());

  const predictedByGroup = new Map<
    string,
    Map<string, Doc<"eventsPredicted">>
  >();

  for (const g of groups.keys()) {
    const { vesselAbbrev, sailingDay } = parseVesselSailingDayScopeKey(g);

    const rows = await ctx.db
      .query("eventsPredicted")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q.eq("VesselAbbrev", vesselAbbrev).eq("SailingDay", sailingDay)
      )
      .collect();

    const map = new Map<string, Doc<"eventsPredicted">>();
    for (const row of rows) {
      map.set(predictedBoundaryCompositeKey(row), row);
    }
    predictedByGroup.set(g, map);
  }

  return trips.map((trip) => mergeTripPredictions(trip, predictedByGroup));
};

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
      predictedBoundaryCompositeKey({
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
