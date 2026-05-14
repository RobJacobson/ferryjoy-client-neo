/**
 * Builds hydrated, normalized, timeline-sorted boundary events for one sailing day.
 *
 * Projects each seed segment into a departure and arrival boundary record, overlays
 * actual times derived from WSF vessel history, nudges identical scheduled dock
 * seams so consecutive arrivals and departures sort distinctly, and returns the
 * boundary set in timeline order for scheduled-row projection and actual-row
 * synthesis to consume without re-sorting.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import { buildBoundaryKey } from "shared/keys";
import { getOfficialCrossingTimeMinutes } from "../../scheduledTrips";
import { collectRows } from "./collectionHelpers";
import { mapHistoryActualsToEventKeys } from "./history";
import type { WsfVesselHistory } from "./schemas";
import type { DockStatusEventRecord, RawSeedSegment } from "./types";

const IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS = 5 * 60 * 1000;

/**
 * Builds the boundary event tape that scheduled and actual stages share.
 *
 * Combines seed projection, history overlay, seam normalization, and timeline
 * sort in one pass so downstream stages can assume boundary records arrive in
 * a single canonical order. The function is pure; callers may project the
 * result into multiple row shapes without re-running the pipeline.
 *
 * @param seedSegments - Direct seed segments for the reload batch
 * @param historyRecords - WSF vessel history rows for the sailing day
 * @param vessels - Vessel identities for adapter resolution of history rows
 * @param terminals - Terminal identities for adapter resolution of history rows
 * @returns Boundary records sorted by timeline with history actuals overlaid
 */
const buildReloadBoundaryEvents = ({
  seedSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  seedSegments: RawSeedSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): DockStatusEventRecord[] => {
  const seededEvents = collectRows(seedSegments, buildSeedEventsForSegment);
  const historyActualsByEventKey = mapHistoryActualsToEventKeys(
    seedSegments,
    historyRecords,
    vessels,
    terminals
  );
  const hydratedBoundaryEvents = seededEvents.map((event) =>
    overlayHistoryActual(event, historyActualsByEventKey.get(event.Key))
  );
  const normalizedBoundaryEvents = normalizeScheduledDockSeams(
    hydratedBoundaryEvents
  );

  return [...normalizedBoundaryEvents].sort(compareDockEventsByTimeline);
};

/**
 * Overlays a history-derived actual time onto a seeded boundary record when present.
 *
 * @param event - Boundary record built from the seed segment
 * @param historyActualTime - Observed instant from history, when matched to this key
 * @returns Original event when no history matched, otherwise a copy carrying the actual
 */
const overlayHistoryActual = (
  event: DockStatusEventRecord,
  historyActualTime: number | undefined
): DockStatusEventRecord => {
  if (historyActualTime === undefined) {
    return event;
  }

  return {
    ...event,
    EventOccurred: true,
    EventActualTime: historyActualTime,
    EventPredictedTime: undefined,
  };
};

/**
 * Builds dep and arv boundary records for one seed segment.
 *
 * @param segment - Direct seed segment
 * @returns Departure followed by arrival boundary record
 */
const buildSeedEventsForSegment = (
  segment: RawSeedSegment
): [DockStatusEventRecord, DockStatusEventRecord] => {
  const scheduledArrival = normalizeScheduledArrivalTime(
    segment.ArrivingTime ?? getOfficialScheduledArrivalTime(segment),
    segment.DepartingTime
  );

  return [
    {
      SegmentKey: segment.Key,
      Key: buildBoundaryKey(segment.Key, "dep-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.DepartingTime,
      TerminalAbbrev: segment.DepartingTerminalAbbrev,
      EventType: "dep-dock",
      EventScheduledTime: segment.DepartingTime,
    },
    {
      SegmentKey: segment.Key,
      Key: buildBoundaryKey(segment.Key, "arv-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.DepartingTime,
      TerminalAbbrev: segment.ArrivingTerminalAbbrev,
      EventType: "arv-dock",
      EventScheduledTime: scheduledArrival,
    },
  ];
};

/**
 * Nudges scheduled arrival time backward when it equals the dep instant.
 *
 * @param scheduledArrival - Scheduled arrival time in epoch milliseconds
 * @param scheduledDeparture - Scheduled departure time in epoch milliseconds
 * @returns Adjusted arrival time or the original value when distinct
 */
const normalizeScheduledArrivalTime = (
  scheduledArrival: number | undefined,
  scheduledDeparture: number
) =>
  scheduledArrival !== undefined && scheduledArrival === scheduledDeparture
    ? scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
    : scheduledArrival;

/**
 * Resolves the schedule-implied arrival time when the segment lacks one.
 *
 * @param segment - Direct seed segment for one physical leg
 * @returns Scheduled arrival in epoch ms, or undefined when unresolvable
 */
const getOfficialScheduledArrivalTime = (segment: RawSeedSegment) => {
  if (segment.RouteID === 9 && segment.ArrivingTime !== undefined) {
    return segment.ArrivingTime;
  }

  const duration = getOfficialCrossingTimeMinutes({
    routeAbbrev: segment.RouteAbbrev,
    departingTerminalAbbrev: segment.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
  });

  return duration === undefined
    ? undefined
    : segment.DepartingTime + duration * 60 * 1000;
};

/**
 * Adjusts back-to-back scheduled dock seams that share the same scheduled minute.
 *
 * @param events - Boundary records for one reload batch
 * @returns Copy with arrival times nudged where identical seams were detected
 */
const normalizeScheduledDockSeams = (
  events: DockStatusEventRecord[]
): DockStatusEventRecord[] => {
  const eventsByVesselDay = new Map<string, DockStatusEventRecord[]>();

  for (const event of events) {
    const key = `${event.VesselAbbrev}:${event.SailingDay}`;
    eventsByVesselDay.set(key, [...(eventsByVesselDay.get(key) ?? []), event]);
  }

  return [...eventsByVesselDay.values()].reduce<DockStatusEventRecord[]>(
    (normalizedEvents, scopedEvents) => [
      ...normalizedEvents,
      ...[...scopedEvents]
        .sort(compareDockEventsByTimeline)
        .map((event, index, sortedScopedEvents) =>
          normalizeScheduledDockSeamEvent(event, sortedScopedEvents[index + 1])
        ),
    ],
    []
  );
};

/**
 * Nudges one arrival boundary when it shares a scheduled instant with the next departure at the same dock.
 *
 * @param event - Candidate arrival boundary in timeline order for its vessel day
 * @param next - Following boundary when present in sorted vessel-day scope
 * @returns Same event or a copy with arrival scheduled time shifted earlier by five minutes
 */
const normalizeScheduledDockSeamEvent = (
  event: DockStatusEventRecord,
  next: DockStatusEventRecord | undefined
): DockStatusEventRecord => {
  if (!shouldNudgeScheduledArrivalSeam(event, next)) {
    return event;
  }

  return {
    ...event,
    EventScheduledTime:
      event.EventScheduledTime - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS,
  };
};

/**
 * Returns whether an arrival and the next departure form an identical-time seam worth nudging.
 *
 * @param event - Candidate boundary record
 * @param next - Immediate successor in sorted vessel-day order when present
 * @returns True when event is arrival, next is departure at same terminal sharing scheduled time
 */
const shouldNudgeScheduledArrivalSeam = (
  event: DockStatusEventRecord,
  next: DockStatusEventRecord | undefined
): event is DockStatusEventRecord & { EventScheduledTime: number } =>
  event.EventScheduledTime !== undefined &&
  next !== undefined &&
  event.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  event.TerminalAbbrev === next.TerminalAbbrev &&
  event.EventScheduledTime === next.EventScheduledTime;

/**
 * Compares two boundary records for timeline ordering when sorting an array.
 *
 * @param left - First record
 * @param right - Second record
 * @returns Comparator value suitable for Array.sort
 */
const compareDockEventsByTimeline = (
  left: DockStatusEventRecord,
  right: DockStatusEventRecord
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  (left.EventType === "dep-dock" ? 0 : 1) -
    (right.EventType === "dep-dock" ? 0 : 1) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

export { buildReloadBoundaryEvents };
