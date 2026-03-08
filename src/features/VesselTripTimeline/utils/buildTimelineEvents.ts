/**
 * Resolves the four significant timeline events from trip and location data.
 * Each event is a TimePoint (scheduled, actual, estimated) used for timeline
 * geometry and labels.
 */

import type { TimelineItem, TimePoint } from "../types";

/** Four significant events shown on the timeline card. */
export type TimelineEvents = {
  arriveOrigin: TimePoint;
  departOrigin: TimePoint;
  arriveNext: TimePoint;
  departNext: TimePoint;
};

/**
 * Resolves the four significant timeline events shown by the card.
 * Only reports data we have: scheduled from schedule, actual from observations,
 * estimated from predictions. Never fabricates or uses fallbacks.
 *
 * @param item - Vessel trip and location pair
 * @returns Event-first timeline model
 */
export const buildTimelineEvents = (item: TimelineItem): TimelineEvents => {
  const { trip, vesselLocation } = item;
  return {
    departOrigin: {
      actual: vesselLocation.LeftDock ?? trip.LeftDock,
      estimated: trip.AtDockDepartCurr?.PredTime,
      scheduled:
        trip.ScheduledTrip?.DepartingTime ??
        trip.ScheduledDeparture ??
        vesselLocation.ScheduledDeparture,
    },
    arriveOrigin: {
      scheduled: trip.ScheduledTrip?.SchedArriveCurr,
      actual: trip.TripStart,
    },
    arriveNext: {
      actual: trip.TripEnd,
      estimated:
        vesselLocation.Eta ??
        trip.AtSeaArriveNext?.PredTime ??
        trip.AtDockArriveNext?.PredTime,
      scheduled:
        trip.ScheduledTrip?.SchedArriveNext ?? trip.ScheduledTrip?.ArrivingTime,
    },
    departNext: {
      actual: trip.AtDockDepartNext?.Actual,
      estimated:
        trip.AtDockDepartNext?.PredTime ?? trip.AtSeaDepartNext?.PredTime,
      scheduled: trip.ScheduledTrip?.NextDepartingTime,
    },
  };
};
