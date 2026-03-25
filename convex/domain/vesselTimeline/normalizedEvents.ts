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
import type { ConvexVesselTripEvent } from "../../functions/vesselTripEvents/schemas";
import type { ConvexVesselTrip } from "../../functions/vesselTrips/schemas";
import { getSailingDay } from "../../shared/time";
import { buildEventKey } from "./events/liveUpdates";

/**
 * Builds normalized scheduled boundary rows from the current legacy event list.
 *
 * @param events - Legacy vessel timeline events
 * @param updatedAt - Timestamp to stamp onto rows that are inserted or updated
 * @returns Scheduled boundary rows keyed by the stable event key
 */
export const buildScheduledBoundaryEvents = (
  events: ConvexVesselTripEvent[],
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
    ScheduledTime: event.ScheduledTime,
  }));
};

/**
 * Builds normalized actual rows from the current legacy event list.
 *
 * @param events - Legacy vessel timeline events
 * @param updatedAt - Timestamp to stamp onto rows that are inserted or updated
 * @returns Actual boundary rows for events that have an actual time
 */
export const buildActualBoundaryEvents = (
  events: ConvexVesselTripEvent[],
  updatedAt: number
): ConvexActualBoundaryEvent[] =>
  events
    .filter((event) => event.ActualTime !== undefined)
    .map((event) => ({
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      UpdatedAt: updatedAt,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      ActualTime: event.ActualTime as number,
    }));

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
    const updatedAt = trip.TimeStamp;

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
  }

  return dedupePredictedBoundaryEvents(rows);
};

const getNextTerminalAbbrev = (
  event: ConvexVesselTripEvent,
  eventByKey: Map<string, ConvexVesselTripEvent>
) => {
  const arrivalKey = buildEventKey(
    event.SailingDay,
    event.VesselAbbrev,
    event.ScheduledDeparture,
    event.TerminalAbbrev,
    "arv-dock"
  );

  return eventByKey.get(arrivalKey)?.TerminalAbbrev ?? event.TerminalAbbrev;
};

const getCurrentDeparturePrediction = (
  trip: ConvexVesselTrip,
  updatedAt: number
) => {
  if (
    trip.ScheduledDeparture === undefined ||
    !trip.DepartingTerminalAbbrev ||
    !trip.AtDockDepartCurr
  ) {
    return null;
  }

  return buildPredictedBoundaryEvent({
    Key: buildEventKey(
      getSailingDay(new Date(trip.ScheduledDeparture)),
      trip.VesselAbbrev,
      trip.ScheduledDeparture,
      trip.DepartingTerminalAbbrev,
      "dep-dock"
    ),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: getSailingDay(new Date(trip.ScheduledDeparture)),
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.DepartingTerminalAbbrev,
    PredictedTime: trip.AtDockDepartCurr.PredTime,
    PredictionType: "AtDockDepartCurr",
    PredictionSource: "ml",
  });
};

const getCurrentArrivalPrediction = (
  trip: ConvexVesselTrip,
  updatedAt: number
) => {
  if (
    trip.ScheduledDeparture === undefined ||
    !trip.DepartingTerminalAbbrev ||
    !trip.ArrivingTerminalAbbrev
  ) {
    return null;
  }

  const bestPrediction =
    (trip.Eta
      ? ({
          PredictedTime: trip.Eta,
          PredictionType: "AtSeaArriveNext" as PredictionType,
          PredictionSource: "wsf_eta" as ConvexPredictionSource,
        })
      : null) ??
    (trip.AtSeaArriveNext
      ? ({
          PredictedTime: trip.AtSeaArriveNext.PredTime,
          PredictionType: "AtSeaArriveNext" as PredictionType,
          PredictionSource: "ml" as ConvexPredictionSource,
        })
      : null) ??
    (trip.AtDockArriveNext
      ? ({
          PredictedTime: trip.AtDockArriveNext.PredTime,
          PredictionType: "AtDockArriveNext" as PredictionType,
          PredictionSource: "ml" as ConvexPredictionSource,
        })
      : null);

  if (!bestPrediction) {
    return null;
  }

  return buildPredictedBoundaryEvent({
    Key: buildEventKey(
      getSailingDay(new Date(trip.ScheduledDeparture)),
      trip.VesselAbbrev,
      trip.ScheduledDeparture,
      trip.DepartingTerminalAbbrev,
      "arv-dock"
    ),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: getSailingDay(new Date(trip.ScheduledDeparture)),
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
    ...bestPrediction,
  });
};

const getNextDeparturePrediction = (
  trip: ConvexVesselTrip,
  updatedAt: number
) => {
  if (
    trip.NextScheduledDeparture === undefined ||
    !trip.ArrivingTerminalAbbrev
  ) {
    return null;
  }

  const bestPrediction =
    (trip.AtSeaDepartNext
      ? ({
          PredictedTime: trip.AtSeaDepartNext.PredTime,
          PredictionType: "AtSeaDepartNext" as PredictionType,
          PredictionSource: "ml" as ConvexPredictionSource,
        })
      : null) ??
    (trip.AtDockDepartNext
      ? ({
          PredictedTime: trip.AtDockDepartNext.PredTime,
          PredictionType: "AtDockDepartNext" as PredictionType,
          PredictionSource: "ml" as ConvexPredictionSource,
        })
      : null);

  if (!bestPrediction) {
    return null;
  }

  return buildPredictedBoundaryEvent({
    Key: buildEventKey(
      getSailingDay(new Date(trip.NextScheduledDeparture)),
      trip.VesselAbbrev,
      trip.NextScheduledDeparture,
      trip.ArrivingTerminalAbbrev,
      "dep-dock"
    ),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: getSailingDay(new Date(trip.NextScheduledDeparture)),
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.NextScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
    ...bestPrediction,
  });
};

const buildPredictedBoundaryEvent = (
  row: ConvexPredictedBoundaryEvent
): ConvexPredictedBoundaryEvent => row;

const dedupePredictedBoundaryEvents = (
  rows: ConvexPredictedBoundaryEvent[]
): ConvexPredictedBoundaryEvent[] =>
  Array.from(new Map(rows.map((row) => [row.Key, row])).values());
