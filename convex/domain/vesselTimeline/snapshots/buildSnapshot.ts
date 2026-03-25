/**
 * Builds persisted semantic timeline snapshots from ordered vessel trip events.
 */

import { getTerminalNameByAbbrev } from "../../../shared/terminalLocations";
import type {
  ConvexVesselTimelineSegment,
  ConvexVesselTimelineSnapshot,
  ConvexVesselTimelineSnapshotEvent,
} from "../../../functions/vesselTimeline/schemas";
import type { ConvexVesselTripEvent } from "../../../functions/vesselTripEvents/schemas";

export const VESSEL_TIMELINE_SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * Builds a vessel/day semantic snapshot from ordered normalized event rows.
 *
 * @param args - Snapshot inputs
 * @param args.VesselAbbrev - Vessel abbreviation for the snapshot scope
 * @param args.SailingDay - Sailing day for the snapshot scope
 * @param args.events - Ordered normalized event rows for the vessel/day
 * @param args.generatedAt - Timestamp for snapshot generation metadata
 * @returns Persisted snapshot document
 */
export const buildVesselTimelineSnapshot = ({
  VesselAbbrev,
  SailingDay,
  events,
  generatedAt,
}: {
  VesselAbbrev: string;
  SailingDay: string;
  events: ConvexVesselTripEvent[];
  generatedAt: number;
}): ConvexVesselTimelineSnapshot => ({
  VesselAbbrev,
  SailingDay,
  SchemaVersion: VESSEL_TIMELINE_SNAPSHOT_SCHEMA_VERSION,
  GeneratedAt: generatedAt,
  Segments: buildSegments(events),
});

/**
 * Returns the stable comparable payload used to detect semantic snapshot
 * changes before rewriting the stored read model.
 *
 * @param snapshot - Persisted or newly built snapshot document
 * @returns Stable comparable payload without volatile timestamps
 */
export const getComparableSnapshotPayload = (
  snapshot: Pick<
    ConvexVesselTimelineSnapshot,
    "VesselAbbrev" | "SailingDay" | "SchemaVersion" | "Segments"
  >
) => ({
  VesselAbbrev: snapshot.VesselAbbrev,
  SailingDay: snapshot.SailingDay,
  SchemaVersion: snapshot.SchemaVersion,
  Segments: snapshot.Segments,
});

/**
 * Builds semantic dock, sea, placeholder, and terminal-tail segments.
 *
 * @param events - Ordered normalized event rows
 * @returns Semantic timeline segments
 */
const buildSegments = (events: ConvexVesselTripEvent[]) => {
  const segments: ConvexVesselTimelineSegment[] = [];

  for (let index = 0; index < events.length - 1; index++) {
    const previous = index > 0 ? events[index - 1] : undefined;
    const current = events[index];
    const next = events[index + 1];

    if (!current || !next) {
      continue;
    }

    if (isDockPair(current, next)) {
      segments.push({
        id: `${current.Key}--${next.Key}--dock`,
        segmentIndex: segments.length,
        kind: "dock",
        startEvent: toSnapshotEvent(current),
        endEvent: toSnapshotEvent(next),
        durationMinutes: getDurationMinutes(current, next),
      });
    }

    if (isSeaPair(current, next)) {
      if (needsArrivalPlaceholder(previous, current)) {
        segments.push(
          buildArrivalPlaceholderSegment(current, segments.length, index)
        );
      }

      segments.push({
        id: `${current.Key}--${next.Key}--sea`,
        segmentIndex: segments.length,
        kind: "sea",
        startEvent: toSnapshotEvent(current),
        endEvent: toSnapshotEvent(next),
        durationMinutes: getDurationMinutes(current, next),
      });
    }
  }

  const lastEvent = events[events.length - 1];
  if (lastEvent?.EventType === "arv-dock") {
    const terminalEvent = toSnapshotEvent(lastEvent);
    segments.push({
      id: `${lastEvent.Key}--terminal`,
      segmentIndex: segments.length,
      kind: "dock",
      isTerminal: true,
      startEvent: terminalEvent,
      endEvent: terminalEvent,
      durationMinutes: 0,
    });
  }

  return segments;
};

/**
 * Converts a boundary event into the persisted snapshot event shape.
 *
 * @param event - Source vessel/day event
 * @returns Snapshot event payload with display terminal name
 */
const toSnapshotEvent = (
  event: ConvexVesselTripEvent
): ConvexVesselTimelineSnapshotEvent => ({
  Key: event.Key,
  ScheduledDeparture: event.ScheduledDeparture,
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
  TerminalDisplayName: getDisplayTerminalName(event.TerminalAbbrev),
  ScheduledTime: event.ScheduledTime,
  PredictedTime: event.PredictedTime,
  ActualTime: event.ActualTime,
});

/**
 * Builds the synthetic arrival placeholder segment used at the start of the
 * bounded service day or when a broken seam is encountered.
 *
 * @param departureEvent - Departure event missing a matching prior arrival
 * @param segmentIndex - Index of this segment in timeline order
 * @param eventIndex - Index of the departure event in the ordered event list
 * @returns Synthetic dock segment with explicit placeholder reason
 */
const buildArrivalPlaceholderSegment = (
  departureEvent: ConvexVesselTripEvent,
  segmentIndex: number,
  eventIndex: number
): ConvexVesselTimelineSegment => ({
  id: `${departureEvent.Key}--arrival-placeholder--dock`,
  segmentIndex,
  kind: "dock",
  placeholderReason: eventIndex === 0 ? "start-of-day" : "broken-seam",
  startEvent: {
    Key: `${departureEvent.Key}--arrival-placeholder`,
    ScheduledDeparture: departureEvent.ScheduledDeparture,
    TerminalAbbrev: departureEvent.TerminalAbbrev,
    EventType: "arv-dock",
    TerminalDisplayName: getDisplayTerminalName(departureEvent.TerminalAbbrev),
    IsArrivalPlaceholder: true,
  },
  endEvent: toSnapshotEvent(departureEvent),
  durationMinutes: 0,
});

/**
 * True when `current` and `next` form a dock span at one terminal.
 *
 * @param current - Arrival boundary
 * @param next - Departure boundary
 * @returns Whether the pair forms a dock segment
 */
const isDockPair = (
  current: ConvexVesselTripEvent,
  next: ConvexVesselTripEvent
) =>
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev;

/**
 * True when `current` and `next` form a sea span.
 *
 * @param current - Departure boundary
 * @param next - Arrival boundary
 * @returns Whether the pair forms a sea segment
 */
const isSeaPair = (
  current: ConvexVesselTripEvent,
  next: ConvexVesselTripEvent
) => current.EventType === "dep-dock" && next.EventType === "arv-dock";

/**
 * True when a synthetic arrival placeholder should be inserted before a sea
 * segment.
 *
 * @param previous - Previous ordered event, if any
 * @param current - Current departure event
 * @returns Whether this departure lacks an immediately preceding arrival seam
 */
const needsArrivalPlaceholder = (
  previous: ConvexVesselTripEvent | undefined,
  current: ConvexVesselTripEvent
) =>
  current.EventType === "dep-dock" &&
  !(
    previous?.EventType === "arv-dock" &&
    previous.TerminalAbbrev === current.TerminalAbbrev
  );

/**
 * Schedule-first duration in minutes between two boundary events.
 *
 * @param startEvent - Row start boundary
 * @param endEvent - Row end boundary
 * @returns Positive duration in minutes, or `1` when unavailable/invalid
 */
const getDurationMinutes = (
  startEvent: ConvexVesselTripEvent,
  endEvent: ConvexVesselTripEvent
) => {
  const startTime = getLayoutTime(startEvent);
  const endTime = getLayoutTime(endEvent);

  if (startTime === undefined || endTime === undefined) {
    return 1;
  }

  const minutes = (endTime - startTime) / 60_000;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 1;
  }

  return Math.max(1, minutes);
};

/**
 * Schedule-first instant used for stable segment geometry.
 *
 * @param event - Source boundary event
 * @returns `ScheduledTime`, else `ActualTime`, else `PredictedTime`
 */
const getLayoutTime = (event: ConvexVesselTripEvent) =>
  event.ScheduledTime ?? event.ActualTime ?? event.PredictedTime;

/**
 * Short display terminal name used by the timeline UI.
 *
 * @param terminalAbbrev - Terminal abbreviation, if known
 * @returns Shortened display name or `undefined`
 */
const getDisplayTerminalName = (terminalAbbrev?: string) => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminalName = getTerminalNameByAbbrev(terminalAbbrev);
  if (!terminalName) {
    return terminalAbbrev;
  }

  return terminalName
    .replace("Island", "Is.")
    .replace("Point", "Pt.")
    .replace("Southworth", "Southworth");
};
