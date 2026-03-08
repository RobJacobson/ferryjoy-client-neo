/**
 * Builds a pure timeline data model from vessel trip domain data.
 * This module intentionally contains no JSX so timeline business logic can be
 * read/tested independently from rendering concerns.
 */

import { config, formatTerminalPairKey } from "convex/domain/ml/shared/config";
import { clamp } from "@/shared/utils";
import type { TimelineItem, TimelineRowModel, TimePoint } from "../types";
import {
  buildTimelineEvents,
  type TimelineEvents,
} from "../utils/buildTimelineEvents";

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
 * @returns Pure timeline model rows for timeline rendering
 */
export const buildTimelineModelFromTrip = (
  item: TimelineItem
): TimelineRowModel[] => {
  const { trip, vesselLocation } = item;
  const context = buildTimelineContext(item);
  const events = buildTimelineEvents(item);
  const layout = buildTimelineLayout(events, context);
  const atSeaPercent = getAtSeaPercent(
    layout.originDockEnd,
    layout.atSeaEnd,
    trip,
    vesselLocation
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

/** Sentinel used for layout when no event-derived times exist (never shown). */
const LAYOUT_ANCHOR = new Date(0);

/**
 * Builds monotonic row geometry from semantic timeline events.
 * Uses a sentinel when no event-derived times exist (geometry only, never shown).
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
    getBoundaryTime(events.arriveOrigin) ??
    events.departOrigin.scheduled ??
    LAYOUT_ANCHOR;
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
 * Uses distance-based progress when vesselLocation has distance data;
 * returns 0 when only time-based progress is possible (no time reference).
 *
 * @param departedAt - Segment start timestamp
 * @param arriveEta - Segment end timestamp
 * @param trip - Vessel trip with completion markers
 * @param vesselLocation - Real-time vessel location for distance-based progress
 * @returns Normalized completion value from 0 to 1
 */
const getAtSeaPercent = (
  _departedAt: Date,
  _arriveEta: Date,
  trip: TimelineItem["trip"],
  vesselLocation: TimelineItem["vesselLocation"]
): number => {
  if (!(vesselLocation.LeftDock ?? trip.LeftDock)) return 0;
  if (trip.TripEnd) return 1;

  // Use distance-based progress when telemetry is available
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

  // No time reference for time-based progress; return 0
  return 0;
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
