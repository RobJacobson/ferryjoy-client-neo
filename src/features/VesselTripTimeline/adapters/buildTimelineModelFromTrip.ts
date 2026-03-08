/**
 * Builds a pure timeline data model from vessel trip domain data.
 * This module intentionally contains no JSX so timeline business logic can be
 * read/tested independently from rendering concerns.
 */

import { config, formatTerminalPairKey } from "convex/domain/ml/shared/config";
import { getPredictedArriveNextTime } from "@/features/TimelineFeatures/shared/utils/tripTimeHelpers";
import { clamp } from "@/shared/utils";
import type { TimelineItem, TimelineRowModel, TimePoint } from "../types";

const MIN_SEGMENT_MINUTES = 1;
const DEFAULT_ARRIVAL_MINUTES = 10;

/**
 * Parses a trip key to extract the departing terminal abbreviation.
 * Key format: [VesselAbbrev]--[PacificDate]--[PacificTime]--[Departing]-[Arriving]
 * Example: "KITT--2026-03-04--14:30--CLI-MUK"
 *
 * @param key - Trip key to parse
 * @returns Departing terminal abbreviation, or undefined if parsing fails
 */
const parseDepartingTerminalFromKey = (
  key: string | undefined
): string | undefined => {
  if (!key) return undefined;
  const parts = key.split("--");
  if (parts.length < 4) return undefined;
  const terminalPair = parts[3]; // Last part: "CLI-MUK"
  const terminals = terminalPair.split("-");
  return terminals[0]; // Departing terminal: "CLI"
};

/**
 * Builds a timeline data model for a single vessel trip card.
 * Produces 3 rows: at-dock (origin) | at-sea | at-dock (destination).
 *
 * @param item - Vessel trip and location pair
 * @param now - Current time used for progress calculations
 * @returns Pure timeline model rows for timeline rendering
 */
export const buildTimelineModelFromTrip = (
  item: TimelineItem,
  now: Date = new Date()
): TimelineRowModel[] => {
  const { trip, vesselLocation } = item;
  const context = buildTimelineContext(item);
  const events = buildTimelineEvents(item, context, now);
  const layout = buildTimelineLayout(events, context);
  const atSeaPercent = getAtSeaPercent(
    layout.originDockEnd,
    layout.atSeaEnd,
    trip,
    vesselLocation,
    now
  );

  const useDistanceProgress =
    vesselLocation.DepartingDistance !== undefined &&
    vesselLocation.ArrivingDistance !== undefined &&
    vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance > 0;

  const rows: TimelineRowModel[] = [
    {
      id: `${trip.VesselAbbrev}-at-dock-origin`,
      kind: "at-dock",
      startTime: layout.originDockStart,
      endTime: layout.originDockEnd,
      percentComplete: events.departOrigin.actual ? 1 : 0,
      eventTimeStart: events.arriveOrigin,
      eventTimeEnd: events.departOrigin,
      terminalName: vesselLocation.DepartingTerminalName,
      leftContentKind: "terminal-label",
      rightContentKind: "time-events",
    },
    {
      id: `${trip.VesselAbbrev}-at-sea`,
      kind: "at-sea",
      startTime: layout.originDockEnd,
      endTime: layout.atSeaEnd,
      percentComplete: atSeaPercent,
      eventTimeStart: events.departOrigin,
      eventTimeEnd: events.arriveNext,
      terminalName: vesselLocation.ArrivingTerminalName,
      leftContentKind: "terminal-label",
      rightContentKind: "time-events",
      useDistanceProgress,
    },
    {
      id: `${trip.VesselAbbrev}-at-dock-dest`,
      kind: "at-dock",
      startTime: layout.destinationDockStart,
      endTime: layout.destinationDockEnd,
      percentComplete: 0,
      eventTimeStart: events.arriveNext,
      eventTimeEnd: events.departNext,
      terminalName: vesselLocation.ArrivingTerminalName,
      leftContentKind: "terminal-label",
      rightContentKind: "time-events",
      minHeight: 0,
    },
  ];

  return rows;
};

type TimelineContext = {
  defaultOriginDockMinutes: number;
  defaultAtSeaMinutes: number;
  defaultDestinationDockMinutes: number;
};

/**
 * Timeline events shown on the card.
 *
 * These are the meaningful business events on the timeline, independent of the
 * row geometry used to draw proportional blocks.
 */
type TimelineEvents = {
  arriveOrigin: TimePoint;
  departOrigin: TimePoint;
  arriveNext: TimePoint;
  departNext: TimePoint;
};

/**
 * Timeline geometry used to draw the three rows.
 */
type TimelineLayout = {
  originDockStart: Date;
  originDockEnd: Date;
  atSeaEnd: Date;
  destinationDockStart: Date;
  destinationDockEnd: Date;
};

/**
 * Resolves default durations for each timeline phase.
 *
 * @param item - Vessel trip and location pair
 * @returns Mean fallback durations for the current and next terminal pairs
 */
const buildTimelineContext = (item: TimelineItem): TimelineContext => {
  const { trip } = item;
  const arrivingTerminal = trip.ArrivingTerminalAbbrev;
  const terminalPairKey = arrivingTerminal
    ? formatTerminalPairKey(trip.DepartingTerminalAbbrev, arrivingTerminal)
    : "";
  const nextDepartingTerminal = parseDepartingTerminalFromKey(
    trip.ScheduledTrip?.NextKey
  );
  const nextTerminalPairKey =
    arrivingTerminal && nextDepartingTerminal
      ? formatTerminalPairKey(arrivingTerminal, nextDepartingTerminal)
      : terminalPairKey;

  return {
    defaultOriginDockMinutes: config.getMeanAtDockDuration(terminalPairKey),
    defaultAtSeaMinutes: config.getMeanAtSeaDuration(terminalPairKey),
    defaultDestinationDockMinutes:
      config.getMeanAtDockDuration(nextTerminalPairKey),
  };
};

/**
 * Resolves the four significant timeline events shown by the card.
 *
 * @param item - Vessel trip and location pair
 * @param context - Duration defaults for schedule fallbacks
 * @param now - Current time used as a final fallback when schedule data is absent
 * @returns Event-first timeline model
 */
const buildTimelineEvents = (
  item: TimelineItem,
  context: TimelineContext,
  now: Date
): TimelineEvents => {
  const { trip, vesselLocation } = item;
  const actualDepartOrigin = vesselLocation.LeftDock ?? trip.LeftDock;
  const estimatedDepartOrigin = trip.AtDockDepartCurr?.PredTime;
  const scheduledDepartOrigin =
    trip.ScheduledTrip?.DepartingTime ??
    trip.ScheduledDeparture ??
    vesselLocation.ScheduledDeparture ??
    actualDepartOrigin ??
    estimatedDepartOrigin ??
    now;
  const scheduledArriveOrigin = resolveScheduledCurrentArrival(
    trip.ScheduledTrip?.SchedArriveCurr,
    scheduledDepartOrigin,
    trip.TripStart ?? scheduledDepartOrigin
  );
  const estimatedArriveNext = getPredictedArriveNextTime(trip, vesselLocation);
  const actualArriveNext = trip.TripEnd;
  const scheduledArriveNext = resolveScheduledFutureTime(
    trip.ScheduledTrip?.SchedArriveNext ?? trip.ScheduledTrip?.ArrivingTime,
    scheduledDepartOrigin,
    actualArriveNext ??
      estimatedArriveNext ??
      addMinutes(scheduledDepartOrigin, context.defaultAtSeaMinutes)
  );
  const estimatedDepartNext = getPredictedNextDepartureTime(trip);
  const actualDepartNext = trip.AtDockDepartNext?.Actual;
  const scheduledDepartNext = resolveScheduledFutureTime(
    trip.ScheduledTrip?.NextDepartingTime,
    scheduledArriveNext,
    actualDepartNext ??
      estimatedDepartNext ??
      addMinutes(scheduledArriveNext, context.defaultDestinationDockMinutes)
  );

  return {
    arriveOrigin: {
      scheduled: scheduledArriveOrigin,
      actual: trip.TripStart,
    },
    departOrigin: {
      scheduled: scheduledDepartOrigin,
      actual: actualDepartOrigin,
      estimated: estimatedDepartOrigin,
    },
    arriveNext: {
      scheduled: scheduledArriveNext,
      actual: actualArriveNext,
      estimated: estimatedArriveNext,
    },
    departNext: {
      scheduled: scheduledDepartNext,
      actual: actualDepartNext,
      estimated: estimatedDepartNext,
    },
  };
};

/**
 * Builds monotonic row geometry from semantic timeline events.
 *
 * @param events - Event-first timeline model
 * @param context - Duration defaults for each timeline phase
 * @returns Geometry for the three rendered timeline rows
 */
const buildTimelineLayout = (
  events: TimelineEvents,
  context: TimelineContext
): TimelineLayout => {
  const originDockStart =
    getBoundaryTime(events.arriveOrigin) ?? events.departOrigin.scheduled;
  const originDockEnd = ensureAfter(
    getDisplayTime(events.departOrigin),
    originDockStart,
    context.defaultOriginDockMinutes
  );
  const atSeaEnd = ensureAfter(
    getDisplayTime(events.arriveNext),
    originDockEnd,
    context.defaultAtSeaMinutes
  );
  const destinationDockStart = ensureAfter(
    events.arriveNext.actual,
    atSeaEnd,
    DEFAULT_ARRIVAL_MINUTES
  );
  const destinationDockEnd = ensureAfter(
    getDisplayTime(events.departNext),
    destinationDockStart,
    context.defaultDestinationDockMinutes
  );

  return {
    originDockStart,
    originDockEnd,
    atSeaEnd,
    destinationDockStart,
    destinationDockEnd,
  };
};

/**
 * Calculates the completion ratio for the at-sea segment.
 * Uses distance-based progress when vesselLocation has distance data.
 *
 * @param departedAt - Segment start timestamp
 * @param arriveEta - Segment end timestamp
 * @param trip - Vessel trip with completion markers
 * @param vesselLocation - Real-time vessel location for distance-based progress
 * @param now - Current time used for time-based progress
 * @returns Normalized completion value from 0 to 1
 */
const getAtSeaPercent = (
  departedAt: Date,
  arriveEta: Date,
  trip: TimelineItem["trip"],
  vesselLocation: TimelineItem["vesselLocation"],
  now: Date
): number => {
  if (!(vesselLocation.LeftDock ?? trip.LeftDock)) return 0;
  if (trip.TripEnd) return 1;

  // Prefer distance-based progress when telemetry is available
  const departing = vesselLocation.DepartingDistance;
  const arriving = vesselLocation.ArrivingDistance;
  if (
    departing !== undefined &&
    arriving !== undefined &&
    departing + arriving > 0
  ) {
    const ratio = departing / (departing + arriving);
    return clamp(ratio, 0, 1);
  }

  // Fallback to time-based progress
  const duration = arriveEta.getTime() - departedAt.getTime();
  if (duration <= 0) return 0;
  const elapsed = now.getTime() - departedAt.getTime();
  return clamp(elapsed / duration, 0, 1);
};

/**
 * Ensures a timestamp is strictly after an anchor with a fallback offset.
 *
 * @param value - Candidate timestamp (undefined uses fallback)
 * @param anchor - Reference timestamp
 * @param fallbackMinutes - Offset applied if value is not after anchor
 * @returns Timestamp that is at least fallback minutes after anchor
 */
const ensureAfter = (
  value: Date | undefined,
  anchor: Date,
  fallbackMinutes: number
): Date => {
  if (value === undefined) {
    return addMinutes(anchor, Math.max(MIN_SEGMENT_MINUTES, fallbackMinutes));
  }
  if (value.getTime() > anchor.getTime()) return new Date(value);
  return addMinutes(anchor, Math.max(MIN_SEGMENT_MINUTES, fallbackMinutes));
};

/**
 * Adds minutes to a Date and returns a new Date instance.
 *
 * @param value - Base timestamp
 * @param minutes - Minutes to add
 * @returns Shifted Date
 */
const addMinutes = (value: Date, minutes: number): Date =>
  new Date(value.getTime() + minutes * 60000);

/**
 * Gets the preferred time to display for a timeline event.
 *
 * @param timePoint - Event with scheduled, estimated, and actual values
 * @returns Actual time when available, otherwise estimated time
 */
const getDisplayTime = (timePoint: TimePoint): Date | undefined =>
  timePoint.actual ?? timePoint.estimated;

/**
 * Gets the best available boundary time for geometry and layout.
 *
 * @param timePoint - Event with scheduled, estimated, and actual values
 * @returns Actual, estimated, or scheduled time in that priority order
 */
const getBoundaryTime = (timePoint: TimePoint): Date | undefined =>
  timePoint.actual ?? timePoint.estimated ?? timePoint.scheduled;

/**
 * Resolves the best available predicted next-departure time.
 *
 * @param trip - Vessel trip with next-leg departure predictions
 * @returns Predicted departure from the destination terminal, if available
 */
const getPredictedNextDepartureTime = (
  trip: TimelineItem["trip"]
): Date | undefined =>
  trip.AtDockDepartNext?.PredTime ?? trip.AtSeaDepartNext?.PredTime;

/**
 * Prevents stale schedule joins from showing an arrival after the current
 * segment's departure. When the scheduled arrival is invalid, prefer the
 * observed arrival time and otherwise collapse to the departure boundary.
 *
 * @param scheduledArrival - Scheduled arrival at the current terminal
 * @param scheduledDeparture - Scheduled departure from the current terminal
 * @param fallback - Best available replacement when the schedule pair is invalid
 * @returns A scheduled arrival that does not exceed the departure time
 */
const resolveScheduledCurrentArrival = (
  scheduledArrival: Date | undefined,
  scheduledDeparture: Date,
  fallback: Date
): Date => {
  if (!scheduledArrival) return fallback;
  if (scheduledArrival.getTime() <= scheduledDeparture.getTime()) {
    return scheduledArrival;
  }
  if (fallback.getTime() <= scheduledDeparture.getTime()) {
    return fallback;
  }
  return scheduledDeparture;
};

/**
 * Resolves a future scheduled time that must occur after its anchor.
 *
 * @param scheduledTime - Candidate scheduled timestamp
 * @param anchor - Reference timestamp that must come first
 * @param fallback - Coherent fallback when schedule data is missing or stale
 * @returns A time that is strictly after the anchor
 */
const resolveScheduledFutureTime = (
  scheduledTime: Date | undefined,
  anchor: Date,
  fallback: Date
): Date => {
  if (scheduledTime && scheduledTime.getTime() > anchor.getTime()) {
    return scheduledTime;
  }
  return fallback.getTime() > anchor.getTime() ? fallback : anchor;
};
