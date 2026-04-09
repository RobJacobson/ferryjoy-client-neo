/**
 * Joins `eventsPredicted` rows onto stored trip documents for query responses.
 */

import type { DataModel, Doc } from "_generated/dataModel";
import type { GenericQueryCtx } from "convex/server";
import {
  buildTripPredictionBoundaryKeys,
  buildVesselSailingDayScopeKey,
  parseVesselSailingDayScopeKey,
} from "../../shared/keys";
import {
  type ConvexPredictionSource,
  predictedBoundaryCompositeKey,
} from "../eventsPredicted/schemas";
import type { PredictionType } from "../predictions/schemas";
import type {
  ConvexJoinedTripPrediction,
  ConvexVesselTrip,
  ConvexVesselTripStored,
} from "./schemas";

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
 * Batch-loads `eventsPredicted` for the given trips and merges ML prediction
 * fields onto copies (WSF ETA remains on `trip.Eta` only).
 *
 * @param ctx - Query context
 * @param trips - Stored trip documents
 * @returns Hydrated trips matching {@link ConvexVesselTrip}
 */
export const hydrateStoredTripsWithPredictions = async (
  ctx: Ctx,
  trips: ConvexVesselTripStored[]
): Promise<ConvexVesselTrip[]> => {
  type TripDoc = ConvexVesselTripStored;

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
  trip: ConvexVesselTripStored,
  predictedByGroup: Map<string, Map<string, Doc<"eventsPredicted">>>
): ConvexVesselTrip => {
  if (!trip.SailingDay) {
    return { ...trip } as ConvexVesselTrip;
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
    VesselAbbrev: trip.VesselAbbrev,
    DepartingTerminalAbbrev: trip.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
    RouteAbbrev: trip.RouteAbbrev,
    Key: trip.Key,
    SailingDay: trip.SailingDay,
    PrevTerminalAbbrev: trip.PrevTerminalAbbrev,
    ArriveDest: trip.ArriveDest,
    TripStart: trip.TripStart,
    AtDock: trip.AtDock,
    AtDockDuration: trip.AtDockDuration,
    ScheduledDeparture: trip.ScheduledDeparture,
    LeftDock: trip.LeftDock,
    TripDelay: trip.TripDelay,
    Eta: trip.Eta,
    TripEnd: trip.TripEnd,
    AtSeaDuration: trip.AtSeaDuration,
    TotalDuration: trip.TotalDuration,
    InService: trip.InService,
    TimeStamp: trip.TimeStamp,
    PrevScheduledDeparture: trip.PrevScheduledDeparture,
    PrevLeftDock: trip.PrevLeftDock,
    NextKey: trip.NextKey,
    NextScheduledDeparture: trip.NextScheduledDeparture,
    ...(AtDockDepartCurr !== undefined ? { AtDockDepartCurr } : {}),
    ...(AtDockArriveNext !== undefined ? { AtDockArriveNext } : {}),
    ...(AtDockDepartNext !== undefined ? { AtDockDepartNext } : {}),
    ...(AtSeaArriveNext !== undefined ? { AtSeaArriveNext } : {}),
    ...(AtSeaDepartNext !== undefined ? { AtSeaDepartNext } : {}),
  };
};
