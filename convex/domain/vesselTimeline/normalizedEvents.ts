/**
 * Pure helpers for deriving normalized VesselTimeline boundary-event rows.
 */

import type {
  ConvexActualBoundaryEvent,
  ConvexActualBoundaryPatchPersistable,
} from "../../functions/eventsActual/schemas";
import type {
  ConvexPredictedBoundaryEvent,
  ConvexPredictedBoundaryProjectionEffect,
  ConvexPredictedBoundaryProjectionRow,
  ConvexPredictionSource,
} from "../../functions/eventsPredicted/schemas";
import { predictedBoundaryCompositeKey } from "../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import type { PredictionType } from "../../functions/predictions/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../functions/vesselTimeline/schemas";
import type { ConvexVesselTripWithML } from "../../functions/vesselTrips/schemas";
import {
  buildBoundaryKey,
  buildTripPredictionBoundaryKeys,
} from "../../shared/keys";
import { buildPhysicalActualEventKey } from "../../shared/physicalTripIdentity";
import { getSailingDay } from "../../shared/time";
import type { TripContextForActualRow } from "./tripContextForActualRows";

/**
 * Builds normalized scheduled boundary rows from in-memory boundary event
 * records.
 *
 * @param events - Boundary event records for one vessel/day slice
 * @param updatedAt - Timestamp to stamp onto rows that are inserted or updated
 * @returns Scheduled boundary rows keyed by the stable event key
 */
export const buildScheduledBoundaryEvents = (
  events: ConvexVesselTimelineEventRecord[],
  updatedAt: number
): ConvexScheduledBoundaryEvent[] => {
  const eventByKey = new Map(events.map((event) => [event.Key, event]));
  const lastArrivalKey = getLastArrivalKey(events);

  return events.map((event) => ({
    Key: event.Key,
    VesselAbbrev: event.VesselAbbrev,
    SailingDay: event.SailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: event.ScheduledDeparture,
    TerminalAbbrev: event.TerminalAbbrev,
    NextTerminalAbbrev:
      event.EventType === "arv-dock"
        ? event.TerminalAbbrev
        : getNextTerminalAbbrev(event, eventByKey),
    EventType: event.EventType,
    EventScheduledTime: event.EventScheduledTime,
    IsLastArrivalOfSailingDay:
      event.EventType === "arv-dock" && event.Key === lastArrivalKey,
  }));
};

/**
 * Builds normalized actual rows from in-memory boundary event records.
 * PR3: emits a row only when `tripBySegmentKey` resolves a `TripKey` for
 * `event.SegmentKey`; otherwise skips (no persisted schedule-shaped identity).
 *
 * @param events - Boundary event records for one vessel/day slice
 * @param updatedAt - Timestamp to stamp onto rows that are inserted or updated
 * @param tripBySegmentKey - Schedule segment key to physical trip context
 * @returns Actual boundary rows for events that have an actual time and trip context
 */
export const buildActualBoundaryEvents = (
  events: ConvexVesselTimelineEventRecord[],
  updatedAt: number,
  tripBySegmentKey: Map<string, TripContextForActualRow>
): ConvexActualBoundaryEvent[] =>
  events
    .filter(
      (event) =>
        event.EventOccurred === true || event.EventActualTime !== undefined
    )
    .flatMap((event) => {
      const trip = tripBySegmentKey.get(event.SegmentKey);
      if (!trip?.TripKey) {
        return [];
      }

      const eventKey = buildPhysicalActualEventKey(
        trip.TripKey,
        event.EventType
      );

      return [
        {
          EventKey: eventKey,
          TripKey: trip.TripKey,
          ScheduleKey: trip.ScheduleKey,
          EventType: event.EventType,
          VesselAbbrev: event.VesselAbbrev,
          SailingDay: event.SailingDay,
          UpdatedAt: updatedAt,
          ScheduledDeparture: event.ScheduledDeparture,
          TerminalAbbrev: event.TerminalAbbrev,
          EventOccurred: true,
          EventActualTime: event.EventActualTime,
        },
      ];
    });

/**
 * Builds one normalized actual boundary row from a sparse actual patch.
 * When `SailingDay` or `ScheduledDeparture` are omitted (weak schedule
 * metadata), they are filled conservatively from `EventActualTime` or
 * `ScheduledDeparture` (whichever is present).
 *
 * @param patch - {@link ConvexActualBoundaryPatchPersistable}: `TripKey` plus
 *   at least one of `EventActualTime` or `ScheduledDeparture` (ms)
 * @param updatedAt - Timestamp to stamp onto the normalized row
 * @returns Persisted-shape actual boundary row
 */
export const buildActualBoundaryEventFromPatch = (
  patch: ConvexActualBoundaryPatchPersistable,
  updatedAt: number
): ConvexActualBoundaryEvent => {
  // `ConvexActualBoundaryPatchPersistable` guarantees at least one anchor; the
  // union shape does not narrow through `??` without a branch.
  const anchorMs: number =
    patch.EventActualTime !== undefined
      ? patch.EventActualTime
      : (patch.ScheduledDeparture as number);

  const eventKey =
    patch.EventKey ??
    buildPhysicalActualEventKey(patch.TripKey, patch.EventType);

  const sailingDay = patch.SailingDay ?? getSailingDay(new Date(anchorMs));

  const scheduledDeparture: number =
    patch.ScheduledDeparture ?? patch.EventActualTime ?? anchorMs;

  return {
    EventKey: eventKey,
    TripKey: patch.TripKey,
    ScheduleKey: patch.ScheduleKey,
    EventType: patch.EventType,
    VesselAbbrev: patch.VesselAbbrev,
    SailingDay: sailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: scheduledDeparture,
    TerminalAbbrev: patch.TerminalAbbrev,
    EventOccurred: true,
    EventActualTime: patch.EventActualTime,
  };
};

/**
 * Builds best-prediction overlay rows from finalized active trip state.
 *
 * @param trips - Active trips that were just persisted
 * @returns Best-prediction rows keyed by the stable boundary event key
 */
export const buildPredictedBoundaryEventsFromTrips = (
  trips: ConvexVesselTripWithML[]
): ConvexPredictedBoundaryEvent[] => {
  const rows: ConvexPredictedBoundaryEvent[] = [];

  for (const trip of trips) {
    rows.push(...buildPredictedBoundaryEventsFromTrip(trip));
  }

  return dedupePredictedBoundaryEvents(rows);
};

/**
 * Builds the prediction projection effect for one active trip.
 *
 * The effect carries both the rows to upsert and the full key scope to clear
 * when a previously emitted prediction no longer exists.
 *
 * @param trip - Active trip whose current prediction state should be projected
 * @returns Projection effect, or `null` when the trip cannot be scoped
 */
export const buildPredictedBoundaryProjectionEffect = (
  trip: ConvexVesselTripWithML
): ConvexPredictedBoundaryProjectionEffect | null => {
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
export const buildPredictedBoundaryClearEffect = (
  trip: ConvexVesselTripWithML
): ConvexPredictedBoundaryProjectionEffect | null => {
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

const getNextTerminalAbbrev = (
  event: ConvexVesselTimelineEventRecord,
  eventByKey: Map<string, ConvexVesselTimelineEventRecord>
) => {
  const arrivalKey = buildBoundaryKey(event.SegmentKey, "arv-dock");

  return eventByKey.get(arrivalKey)?.TerminalAbbrev ?? event.TerminalAbbrev;
};

/**
 * Finds the latest arrival boundary in one sailing-day event slice.
 *
 * @param events - Ordered boundary events for one sailing day
 * @returns Boundary key for the last arrival, or `null`
 */
const getLastArrivalKey = (events: ConvexVesselTimelineEventRecord[]) =>
  [...events].reverse().find((event) => event.EventType === "arv-dock")?.Key ??
  null;

const buildPredictedBoundaryEventsFromTrip = (trip: ConvexVesselTripWithML) => {
  const updatedAt = trip.TimeStamp;
  const rows: ConvexPredictedBoundaryEvent[] = [];

  const currentDeparture = getCurrentDeparturePrediction(trip, updatedAt);
  if (currentDeparture) {
    rows.push(currentDeparture);
  }

  rows.push(...getCurrentArrivalPredictions(trip, updatedAt));

  const nextDeparture = getNextDeparturePrediction(trip, updatedAt);
  if (nextDeparture) {
    rows.push(nextDeparture);
  }

  return rows;
};

/** Boundary event keys touched by trip-driven prediction projection. */
export const getPredictedBoundaryTargetKeys = (
  trip: ConvexVesselTripWithML
) => {
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

/**
 * Builds the prediction overlay row for the current trip's departure event.
 *
 * @param trip - Active vessel trip carrying at-dock departure predictions
 * @param updatedAt - Timestamp to stamp on the normalized row
 * @returns Predicted departure row, or `null` when no prediction is available
 */
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

/**
 * Builds arrival overlay rows: WSF ETA and ML outputs are separate rows
 * (same boundary Key, distinguished by PredictionType + PredictionSource).
 *
 * @param trip - Active vessel trip carrying arrival predictions
 * @param updatedAt - Timestamp to stamp on the normalized row
 * @returns Zero or more predicted arrival rows
 */
const getCurrentArrivalPredictions = (
  trip: ConvexVesselTripWithML,
  updatedAt: number
): ConvexPredictedBoundaryEvent[] => {
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

  const rows: ConvexPredictedBoundaryEvent[] = [];

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

/**
 * Builds the best next-departure prediction overlay row for the trip's
 * arriving terminal.
 *
 * @param trip - Active vessel trip carrying next-departure predictions
 * @param updatedAt - Timestamp to stamp on the normalized row
 * @returns Predicted next-departure row, or `null` when no prediction exists
 */
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

/**
 * Preserves a typed seam for predicted boundary-row construction.
 *
 * @param row - Fully constructed normalized prediction row
 * @returns The same row, unchanged
 */
const buildPredictedBoundaryEvent = (
  row: ConvexPredictedBoundaryEvent
): ConvexPredictedBoundaryEvent => row;

const stripPredictedUpdatedAt = (
  row: ConvexPredictedBoundaryEvent
): ConvexPredictedBoundaryProjectionRow => ({
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

/**
 * Deduplicates prediction rows by Key + PredictionType + PredictionSource.
 *
 * @param rows - Candidate prediction rows
 * @returns Rows with at most one entry per composite identity
 */
const dedupePredictedBoundaryEvents = (
  rows: ConvexPredictedBoundaryEvent[]
): ConvexPredictedBoundaryEvent[] =>
  Array.from(
    new Map(
      rows.map((row) => [predictedBoundaryCompositeKey(row), row])
    ).values()
  );
