/**
 * Client-owned dock visit assembly for the `VesselTimeline` render pipeline.
 *
 * The backend returns raw event rows. This module merges those rows and pairs
 * adjacent dock boundaries into the client shape consumed by timeline geometry.
 */

import type { ConvexActualDockEvent } from "convex/functions/events/eventsActual/schemas";
import type { ConvexPredictedDockEvent } from "convex/functions/events/eventsPredicted/schemas";
import type { ConvexScheduledDockEvent } from "convex/functions/events/eventsScheduled/schemas";
import type {
  RouteTimelineBoundary,
  RouteTimelineDockVisit,
} from "@/features/RouteTimelineModel";
import {
  mergeEventRowsForVesselTimeline,
  type VesselTimelineMergedEvent,
} from "./mergeEventRowsForVesselTimeline";

type BuildDockVisitsFromEventRowsArgs = {
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockEvent[];
  vesselAbbrev: string;
  sailingDay: string;
};

/**
 * Builds ordered dock visits from raw event row subscriptions for one
 * vessel/day.
 *
 * @param args - Event row arrays plus the vessel/day scope
 * @returns Ordered dock visits with `Date` timestamps for visual geometry
 */
const buildDockVisitsFromEventRows = ({
  scheduledEvents,
  actualEvents,
  predictedEvents,
  vesselAbbrev,
  sailingDay,
}: BuildDockVisitsFromEventRowsArgs): RouteTimelineDockVisit[] => {
  const merged = mergeEventRowsForVesselTimeline({
    scheduledEvents: filterRowsForVesselDay(
      scheduledEvents,
      vesselAbbrev,
      sailingDay
    ),
    actualEvents: filterRowsForVesselDay(
      actualEvents,
      vesselAbbrev,
      sailingDay
    ),
    predictedEvents: filterRowsForVesselDay(
      predictedEvents,
      vesselAbbrev,
      sailingDay
    ),
  });

  return mergedEventsToDockVisits(merged, vesselAbbrev, sailingDay);
};

/**
 * Filters event rows to one vessel/day scope.
 *
 * @param events - Event rows with vessel and sailing-day fields
 * @param vesselAbbrev - Vessel abbreviation
 * @param sailingDay - Sailing day string
 * @returns Rows scoped to the requested vessel and day
 */
const filterRowsForVesselDay = <
  T extends { VesselAbbrev: string; SailingDay: string },
>(
  events: T[],
  vesselAbbrev: string,
  sailingDay: string
) =>
  events.filter(
    (event) =>
      event.VesselAbbrev === vesselAbbrev && event.SailingDay === sailingDay
  );

/**
 * Pairs ordered merged boundary events into dock visits.
 *
 * @param merged - Ordered merged boundary events
 * @param vesselAbbrev - Vessel abbreviation owning the visits
 * @param sailingDay - Sailing day string
 * @returns Dock visits in render order
 */
const mergedEventsToDockVisits = (
  merged: VesselTimelineMergedEvent[],
  vesselAbbrev: string,
  sailingDay: string
): RouteTimelineDockVisit[] => {
  const visits: RouteTimelineDockVisit[] = [];

  for (let index = 0; index < merged.length; index += 1) {
    const event = merged[index];
    if (!event) {
      continue;
    }

    const terminalAbbrev = event.TerminalAbbrev;
    const boundary = toTimelineBoundary(event);
    const previousEvent = index > 0 ? merged[index - 1] : undefined;
    const nextEvent = merged[index + 1];
    const hasPreviousArrivalPair =
      previousEvent?.EventType === "arv-dock" &&
      previousEvent.TerminalAbbrev === terminalAbbrev;

    if (event.EventType === "arv-dock") {
      if (
        nextEvent?.EventType === "dep-dock" &&
        nextEvent.TerminalAbbrev === terminalAbbrev
      ) {
        const departure = toTimelineBoundary(nextEvent);
        visits.push(
          createDockVisit({
            arrival: boundary,
            departure,
            vesselAbbrev,
            sailingDay,
            terminalAbbrev,
          })
        );
        index += 1;
        continue;
      }

      visits.push(
        createDockVisit({
          arrival: boundary,
          departure: undefined,
          vesselAbbrev,
          sailingDay,
          terminalAbbrev,
        })
      );
      continue;
    }

    if (hasPreviousArrivalPair) {
      continue;
    }

    visits.push(
      createDockVisit({
        arrival: undefined,
        departure: boundary,
        vesselAbbrev,
        sailingDay,
        terminalAbbrev,
      })
    );
  }

  return visits;
};

/**
 * Creates one dock visit from optional arrival and departure boundaries.
 *
 * @param args - Dock visit fields
 * @returns Client dock visit
 */
const createDockVisit = ({
  arrival,
  departure,
  vesselAbbrev,
  sailingDay,
  terminalAbbrev,
}: {
  arrival: RouteTimelineBoundary | undefined;
  departure: RouteTimelineBoundary | undefined;
  vesselAbbrev: string;
  sailingDay: string;
  terminalAbbrev: string;
}): RouteTimelineDockVisit => ({
  Key: `${arrival?.Key ?? "none"}::${departure?.Key ?? "none"}`,
  VesselAbbrev: vesselAbbrev,
  SailingDay: sailingDay,
  TerminalAbbrev: terminalAbbrev,
  Arrival: arrival,
  Departure: departure,
});

/**
 * Converts one merged boundary event to the client timeline boundary shape.
 *
 * @param event - Merged boundary event with epoch millisecond timestamps
 * @returns Client boundary with `Date` timestamps
 */
const toTimelineBoundary = (
  event: VesselTimelineMergedEvent
): RouteTimelineBoundary => ({
  Key: event.Key,
  SegmentKey: event.SegmentKey,
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
  EventPredictedTime: optionalEpochMsToDate(event.EventPredictedTime),
  EventOccurred:
    event.EventOccurred ??
    (event.EventActualTime !== undefined ? true : undefined),
  EventActualTime: optionalEpochMsToDate(event.EventActualTime),
});

/**
 * Converts an optional epoch millisecond timestamp to a `Date`.
 *
 * @param epochMs - Optional epoch millisecond timestamp
 * @returns `Date` when `epochMs` is defined, otherwise `undefined`
 */
const optionalEpochMsToDate = (epochMs: number | undefined) =>
  epochMs === undefined ? undefined : new Date(epochMs);

export { buildDockVisitsFromEventRows, mergedEventsToDockVisits };
