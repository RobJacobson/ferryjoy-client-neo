/**
 * Pure helpers for deriving predicted boundary projection effects.
 */

import type {
  ConvexPredictedDockEvent,
  ConvexPredictedDockWriteBatch,
  ConvexPredictedDockWriteRow,
  ConvexPredictionSource,
} from "../../functions/eventsPredicted/schemas";
import { predictedDockCompositeKey } from "../../functions/eventsPredicted/schemas";
import type { PredictionType } from "../../functions/predictions/schemas";
import type { ConvexVesselTripWithML } from "../../functions/vesselTrips/schemas";
import {
  buildBoundaryKey,
  buildTripPredictionBoundaryKeys,
} from "../../shared/keys";

/**
 * Builds the prediction projection effect for one active trip.
 *
 * The effect carries both the rows to upsert and the full key scope to clear
 * when a previously emitted prediction no longer exists.
 *
 * @param trip - Active trip whose current prediction state should be projected
 * @returns Projection effect, or `null` when the trip cannot be scoped
 */
export const buildPredictedDockWriteBatch = (
  trip: ConvexVesselTripWithML
): ConvexPredictedDockWriteBatch | null => {
  if (!trip.SailingDay) {
    return null;
  }

  const TargetKeys = getPredictedBoundaryTargetKeys(trip);
  if (TargetKeys.length === 0) {
    return null;
  }

  return {
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    TargetKeys,
    Rows: buildPredictedBoundaryEventsFromTrip(trip).map(
      stripPredictedUpdatedAt
    ),
  };
};

/**
 * Builds a projection effect that clears any predicted rows in a trip's key
 * scope without emitting replacement rows.
 *
 * @param trip - Trip whose prediction scope should be cleared
 * @returns Clear effect, or `null` when the trip cannot be scoped
 */
export const buildPredictedDockClearBatch = (
  trip: ConvexVesselTripWithML
): ConvexPredictedDockWriteBatch | null => {
  if (!trip.SailingDay) {
    return null;
  }

  const TargetKeys = getPredictedBoundaryTargetKeys(trip);
  if (TargetKeys.length === 0) {
    return null;
  }

  return {
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    TargetKeys,
    Rows: [],
  };
};

const buildPredictedBoundaryEventsFromTrip = (trip: ConvexVesselTripWithML) => {
  const updatedAt = trip.TimeStamp;
  const rows: ConvexPredictedDockEvent[] = [];

  const currentDeparture = getCurrentDeparturePrediction(trip, updatedAt);
  if (currentDeparture) {
    rows.push(currentDeparture);
  }

  rows.push(...getCurrentArrivalPredictions(trip, updatedAt));

  const nextDeparture = getNextDeparturePrediction(trip, updatedAt);
  if (nextDeparture) {
    rows.push(nextDeparture);
  }

  return dedupePredictedBoundaryEvents(rows);
};

/** Boundary event keys touched by trip-driven prediction projection. */
const getPredictedBoundaryTargetKeys = (trip: ConvexVesselTripWithML) => {
  const { depDockKey, arvDockKey, nextDepDockKey } =
    buildTripPredictionBoundaryKeys(trip);
  return Array.from(
    new Set(
      [depDockKey, arvDockKey, nextDepDockKey].filter(
        (k): k is string => k !== undefined
      )
    )
  );
};

const predictionActualFields = (p: {
  Actual?: number;
  DeltaTotal?: number;
}) => ({
  ...(p.Actual !== undefined ? { Actual: p.Actual } : {}),
  ...(p.DeltaTotal !== undefined ? { DeltaTotal: p.DeltaTotal } : {}),
});

const getCurrentDeparturePrediction = (
  trip: ConvexVesselTripWithML,
  updatedAt: number
) => {
  if (
    !trip.ScheduleKey ||
    trip.ScheduledDeparture === undefined ||
    !trip.AtDockDepartCurr
  ) {
    return null;
  }

  return buildPredictedBoundaryEvent({
    Key: buildBoundaryKey(trip.ScheduleKey, "dep-dock"),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay ?? "",
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.DepartingTerminalAbbrev,
    EventPredictedTime: trip.AtDockDepartCurr.PredTime,
    PredictionType: "AtDockDepartCurr",
    PredictionSource: "ml",
    ...predictionActualFields(trip.AtDockDepartCurr),
  });
};

const getCurrentArrivalPredictions = (
  trip: ConvexVesselTripWithML,
  updatedAt: number
): ConvexPredictedDockEvent[] => {
  if (
    !trip.ScheduleKey ||
    trip.ScheduledDeparture === undefined ||
    !trip.ArrivingTerminalAbbrev
  ) {
    return [];
  }

  const arvKey = buildBoundaryKey(trip.ScheduleKey, "arv-dock");
  const base = {
    Key: arvKey,
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay ?? "",
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
  };

  const rows: ConvexPredictedDockEvent[] = [];

  if (trip.Eta !== undefined) {
    rows.push(
      buildPredictedBoundaryEvent({
        ...base,
        EventPredictedTime: trip.Eta,
        PredictionType: "AtSeaArriveNext" as PredictionType,
        PredictionSource: "wsf_eta" as ConvexPredictionSource,
      })
    );
  }

  if (trip.AtSeaArriveNext) {
    rows.push(
      buildPredictedBoundaryEvent({
        ...base,
        EventPredictedTime: trip.AtSeaArriveNext.PredTime,
        PredictionType: "AtSeaArriveNext" as PredictionType,
        PredictionSource: "ml" as ConvexPredictionSource,
        ...predictionActualFields(trip.AtSeaArriveNext),
      })
    );
  }

  if (trip.AtDockArriveNext) {
    rows.push(
      buildPredictedBoundaryEvent({
        ...base,
        EventPredictedTime: trip.AtDockArriveNext.PredTime,
        PredictionType: "AtDockArriveNext" as PredictionType,
        PredictionSource: "ml" as ConvexPredictionSource,
        ...predictionActualFields(trip.AtDockArriveNext),
      })
    );
  }

  return rows;
};

const getNextDeparturePrediction = (
  trip: ConvexVesselTripWithML,
  updatedAt: number
) => {
  if (
    !trip.NextScheduleKey ||
    trip.NextScheduledDeparture === undefined ||
    !trip.ArrivingTerminalAbbrev
  ) {
    return null;
  }

  const bestPrediction =
    (trip.AtSeaDepartNext
      ? {
          EventPredictedTime: trip.AtSeaDepartNext.PredTime,
          PredictionType: "AtSeaDepartNext" as PredictionType,
          PredictionSource: "ml" as ConvexPredictionSource,
        }
      : null) ??
    (trip.AtDockDepartNext
      ? {
          EventPredictedTime: trip.AtDockDepartNext.PredTime,
          PredictionType: "AtDockDepartNext" as PredictionType,
          PredictionSource: "ml" as ConvexPredictionSource,
        }
      : null);

  if (!bestPrediction) {
    return null;
  }

  const nextFields =
    bestPrediction.PredictionType === "AtSeaDepartNext"
      ? trip.AtSeaDepartNext
      : trip.AtDockDepartNext;

  return buildPredictedBoundaryEvent({
    Key: buildBoundaryKey(trip.NextScheduleKey, "dep-dock"),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay ?? "",
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.NextScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
    ...bestPrediction,
    ...(nextFields ? predictionActualFields(nextFields) : {}),
  });
};

const buildPredictedBoundaryEvent = (
  row: ConvexPredictedDockEvent
): ConvexPredictedDockEvent => row;

const stripPredictedUpdatedAt = (
  row: ConvexPredictedDockEvent
): ConvexPredictedDockWriteRow => ({
  Key: row.Key,
  VesselAbbrev: row.VesselAbbrev,
  SailingDay: row.SailingDay,
  ScheduledDeparture: row.ScheduledDeparture,
  TerminalAbbrev: row.TerminalAbbrev,
  EventPredictedTime: row.EventPredictedTime,
  PredictionType: row.PredictionType,
  PredictionSource: row.PredictionSource,
  ...(row.Actual !== undefined ? { Actual: row.Actual } : {}),
  ...(row.DeltaTotal !== undefined ? { DeltaTotal: row.DeltaTotal } : {}),
});

const dedupePredictedBoundaryEvents = (
  rows: ConvexPredictedDockEvent[]
): ConvexPredictedDockEvent[] =>
  Array.from(
    new Map(rows.map((row) => [predictedDockCompositeKey(row), row])).values()
  );
