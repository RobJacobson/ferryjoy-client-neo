/**
 * Pure helpers for deriving normalized VesselTimeline boundary-event rows.
 */

import type { ConvexActualBoundaryEvent } from "../../functions/eventsActual/schemas";
import type {
  ConvexPredictedBoundaryEvent,
  ConvexPredictionSource,
} from "../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import type { PredictionType } from "../../functions/predictions/schemas";
import type {
  ConvexActualBoundaryEffect,
  ConvexPredictedBoundaryProjectionEffect,
  ConvexPredictedBoundaryProjectionRow,
  ConvexVesselTimelineEventRecord,
} from "../../functions/vesselTimeline/schemas";
import type { ConvexVesselTrip } from "../../functions/vesselTrips/schemas";
import { buildBoundaryKey } from "../../shared/keys";

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
  }));
};

/**
 * Builds normalized actual rows from in-memory boundary event records.
 *
 * @param events - Boundary event records for one vessel/day slice
 * @param updatedAt - Timestamp to stamp onto rows that are inserted or updated
 * @returns Actual boundary rows for events that have an actual time
 */
export const buildActualBoundaryEvents = (
  events: ConvexVesselTimelineEventRecord[],
  updatedAt: number
): ConvexActualBoundaryEvent[] =>
  events
    .filter((event) => event.EventActualTime !== undefined)
    .map((event) => ({
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      UpdatedAt: updatedAt,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventActualTime: event.EventActualTime as number,
    }));

/**
 * Builds one normalized actual boundary row from a trip-driven projection
 * effect.
 *
 * @param effect - Actual boundary effect emitted by VesselTrips
 * @param updatedAt - Timestamp to stamp onto the normalized row
 * @returns Normalized actual boundary row
 */
export const buildActualBoundaryEventFromEffect = (
  effect: ConvexActualBoundaryEffect,
  updatedAt: number
): ConvexActualBoundaryEvent => ({
  Key: buildBoundaryKey(effect.SegmentKey, effect.EventType),
  VesselAbbrev: effect.VesselAbbrev,
  SailingDay: effect.SailingDay,
  UpdatedAt: updatedAt,
  ScheduledDeparture: effect.ScheduledDeparture,
  TerminalAbbrev: effect.TerminalAbbrev,
  EventActualTime: effect.EventActualTime,
});

/**
 * Builds best-prediction overlay rows from finalized active trip state.
 *
 * @param trips - Active trips that were just persisted
 * @returns Best-prediction rows keyed by the stable boundary event key
 */
export const buildPredictedBoundaryEventsFromTrips = (
  trips: ConvexVesselTrip[]
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
  trip: ConvexVesselTrip
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
  trip: ConvexVesselTrip
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

const buildPredictedBoundaryEventsFromTrip = (trip: ConvexVesselTrip) => {
  const updatedAt = trip.TimeStamp;
  const rows: ConvexPredictedBoundaryEvent[] = [];

  const currentDeparture = getCurrentDeparturePrediction(trip, updatedAt);
  if (currentDeparture) {
    rows.push(currentDeparture);
  }

  const currentArrival = getCurrentArrivalPrediction(trip, updatedAt);
  if (currentArrival) {
    rows.push(currentArrival);
  }

  const nextDeparture = getNextDeparturePrediction(trip, updatedAt);
  if (nextDeparture) {
    rows.push(nextDeparture);
  }

  return rows;
};

const getPredictedBoundaryTargetKeys = (trip: ConvexVesselTrip) => {
  const keys: string[] = [];

  if (trip.Key) {
    keys.push(buildBoundaryKey(trip.Key, "dep-dock"));
    keys.push(buildBoundaryKey(trip.Key, "arv-dock"));
  }

  if (trip.NextKey) {
    keys.push(buildBoundaryKey(trip.NextKey, "dep-dock"));
  }

  return Array.from(new Set(keys));
};

/**
 * Builds the prediction overlay row for the current trip's departure event.
 *
 * @param trip - Active vessel trip carrying at-dock departure predictions
 * @param updatedAt - Timestamp to stamp on the normalized row
 * @returns Predicted departure row, or `null` when no prediction is available
 */
const getCurrentDeparturePrediction = (
  trip: ConvexVesselTrip,
  updatedAt: number
) => {
  if (
    !trip.Key ||
    trip.ScheduledDeparture === undefined ||
    !trip.AtDockDepartCurr
  ) {
    return null;
  }

  return buildPredictedBoundaryEvent({
    Key: buildBoundaryKey(trip.Key, "dep-dock"),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay ?? "",
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.DepartingTerminalAbbrev,
    EventPredictedTime: trip.AtDockDepartCurr.PredTime,
    PredictionType: "AtDockDepartCurr",
    PredictionSource: "ml",
  });
};

/**
 * Builds the best arrival prediction overlay row for the current trip.
 *
 * WSF ETA takes precedence over ML predictions, followed by at-sea and then
 * at-dock ML outputs.
 *
 * @param trip - Active vessel trip carrying arrival predictions
 * @param updatedAt - Timestamp to stamp on the normalized row
 * @returns Predicted arrival row, or `null` when no prediction is available
 */
const getCurrentArrivalPrediction = (
  trip: ConvexVesselTrip,
  updatedAt: number
) => {
  if (
    !trip.Key ||
    trip.ScheduledDeparture === undefined ||
    !trip.ArrivingTerminalAbbrev
  ) {
    return null;
  }

  const bestPrediction =
    (trip.Eta
      ? {
          EventPredictedTime: trip.Eta,
          PredictionType: "AtSeaArriveNext" as PredictionType,
          PredictionSource: "wsf_eta" as ConvexPredictionSource,
        }
      : null) ??
    (trip.AtSeaArriveNext
      ? {
          EventPredictedTime: trip.AtSeaArriveNext.PredTime,
          PredictionType: "AtSeaArriveNext" as PredictionType,
          PredictionSource: "ml" as ConvexPredictionSource,
        }
      : null) ??
    (trip.AtDockArriveNext
      ? {
          EventPredictedTime: trip.AtDockArriveNext.PredTime,
          PredictionType: "AtDockArriveNext" as PredictionType,
          PredictionSource: "ml" as ConvexPredictionSource,
        }
      : null);

  if (!bestPrediction) {
    return null;
  }

  return buildPredictedBoundaryEvent({
    Key: buildBoundaryKey(trip.Key, "arv-dock"),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay ?? "",
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
    ...bestPrediction,
  });
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
  trip: ConvexVesselTrip,
  updatedAt: number
) => {
  if (
    !trip.NextKey ||
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

  return buildPredictedBoundaryEvent({
    Key: buildBoundaryKey(trip.NextKey, "dep-dock"),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay ?? "",
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.NextScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
    ...bestPrediction,
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
});

/**
 * Deduplicates prediction rows by stable event key, keeping the last row seen
 * for each key.
 *
 * @param rows - Candidate prediction rows
 * @returns Rows with at most one entry per event key
 */
const dedupePredictedBoundaryEvents = (
  rows: ConvexPredictedBoundaryEvent[]
): ConvexPredictedBoundaryEvent[] =>
  Array.from(new Map(rows.map((row) => [row.Key, row])).values());
