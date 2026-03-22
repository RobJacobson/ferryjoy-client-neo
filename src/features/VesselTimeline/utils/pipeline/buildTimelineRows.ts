/**
 * Builds semantic dock and sea rows from the backend vessel-day event feed.
 *
 * Adjacent event pairs become rows per `ARCHITECTURE.md`: dock spans share a
 * terminal between arrival and departure; sea spans run departure to arrival.
 * Long docks may use compressed display durations per feature policy.
 */

import type { VesselTimelineEvent } from "@/data/contexts";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";
import type {
  TimelineRowEvent,
  TimelineSemanticRow,
  VesselTimelinePolicy,
} from "../../types";
import { getLayoutTime } from "../shared/rowEventTime";

/**
 * Builds ordered dock and sea rows for the vessel-day timeline.
 *
 * This is stage 1 of the frontend pipeline: a sorted `VesselTimelineEvent`
 * feed becomes alternating dock/sea semantic rows, including terminal tail
 * and arrival placeholder rows when required.
 *
 * @param events - Backend events for one vessel and sailing day, sorted
 * @param policy - Compressed-dock thresholds and stub/window minutes
 * @returns Semantic rows with layout-ready duration metadata
 */
export const buildTimelineRows = (
  events: VesselTimelineEvent[],
  policy: VesselTimelinePolicy
): TimelineSemanticRow[] => {
  const rows: TimelineSemanticRow[] = [];

  for (let index = 0; index < events.length - 1; index++) {
    const previous = index > 0 ? events[index - 1] : undefined;
    const current = events[index];
    const next = events[index + 1];

    if (!current || !next) {
      continue;
    }

    if (isDockPair(current, next)) {
      const startEvent = toRowEvent(current);
      const endEvent = toRowEvent(next);
      const dockDurationMinutes = getDurationMinutes(startEvent, endEvent);
      const displayMode = getDockDisplayMode(dockDurationMinutes, policy);

      rows.push({
        id: `${current.Key}--${next.Key}--dock`,
        segmentIndex: rows.length,
        kind: "dock",
        startEvent,
        endEvent,
        actualDurationMinutes: dockDurationMinutes,
        displayDurationMinutes: getDisplayDurationMinutes(
          dockDurationMinutes,
          displayMode,
          policy
        ),
        displayMode,
      });
    }

    if (isSeaPair(current, next)) {
      if (needsArrivalPlaceholder(previous, current)) {
        rows.push(buildArrivalPlaceholderRow(current, rows.length));
      }

      const startEvent = toRowEvent(current);
      const endEvent = toRowEvent(next);
      const seaDurationMinutes = getDurationMinutes(startEvent, endEvent);

      rows.push({
        id: `${current.Key}--${next.Key}--sea`,
        segmentIndex: rows.length,
        kind: "sea",
        startEvent,
        endEvent,
        actualDurationMinutes: seaDurationMinutes,
        displayDurationMinutes: seaDurationMinutes,
        displayMode: "proportional",
      });
    }
  }

  const lastEvent = events[events.length - 1];
  if (lastEvent?.EventType === "arv-dock") {
    const terminalEvent = toRowEvent(lastEvent);

    rows.push({
      id: `${lastEvent.Key}--terminal`,
      segmentIndex: rows.length,
      kind: "dock",
      isTerminal: true,
      startEvent: terminalEvent,
      endEvent: terminalEvent,
      actualDurationMinutes: 0,
      displayDurationMinutes: 0,
      displayMode: "proportional",
    });
  }

  return rows;
};

/**
 * Copies a backend event into a row event with display terminal name.
 *
 * @param event - Source vessel timeline event
 * @returns Row event including abbreviated terminal display name when known
 */
const toRowEvent = (event: VesselTimelineEvent): TimelineRowEvent => ({
  ...event,
  TerminalDisplayName: getDisplayTerminalName(event.TerminalAbbrev),
});

/**
 * Synthesizes a zero-duration dock row so the UI can show arrival before the
 * matching departure exists in the feed.
 *
 * @param departureEvent - Current departure event missing a preceding arrival
 * @param segmentIndex - Index of this row among semantic rows
 * @returns Placeholder dock row bracketing synthetic arrival and real departure
 */
const buildArrivalPlaceholderRow = (
  departureEvent: VesselTimelineEvent,
  segmentIndex: number
): TimelineSemanticRow => {
  const placeholderArrivalEvent: TimelineRowEvent = {
    ...departureEvent,
    Key: `${departureEvent.Key}--arrival-placeholder`,
    EventType: "arv-dock",
    ScheduledTime: undefined,
    PredictedTime: undefined,
    ActualTime: undefined,
    TerminalDisplayName: getDisplayTerminalName(departureEvent.TerminalAbbrev),
    IsArrivalPlaceholder: true,
  };

  return {
    id: `${departureEvent.Key}--arrival-placeholder--dock`,
    segmentIndex,
    kind: "dock",
    startEvent: placeholderArrivalEvent,
    endEvent: toRowEvent(departureEvent),
    actualDurationMinutes: 0,
    displayDurationMinutes: 0,
    displayMode: "proportional",
  };
};

/**
 * True when `current` is an arrival and `next` is a departure at the same
 * terminal (dock span).
 *
 * @param current - First event in the pair
 * @param next - Second event in the pair
 * @returns Whether the pair forms a dock segment at one terminal
 */
const isDockPair = (current: VesselTimelineEvent, next: VesselTimelineEvent) =>
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev;

/**
 * True when `current` is a departure and `next` is an arrival (sea span).
 *
 * @param current - Departure event
 * @param next - Arrival event at the next terminal
 * @returns Whether the pair forms a sea segment
 */
const isSeaPair = (current: VesselTimelineEvent, next: VesselTimelineEvent) =>
  current.EventType === "dep-dock" && next.EventType === "arv-dock";

/**
 * True when a sea row should be preceded by a synthetic arrival dock row.
 *
 * @param previous - Event before the departure, if any
 * @param current - Departure event starting a sea span
 * @returns Whether to insert an arrival placeholder dock row before this sea
 */
const needsArrivalPlaceholder = (
  previous: VesselTimelineEvent | undefined,
  current: VesselTimelineEvent
) =>
  current.EventType === "dep-dock" &&
  !(
    previous?.EventType === "arv-dock" &&
    previous.TerminalAbbrev === current.TerminalAbbrev
  );

/**
 * Chooses proportional vs compressed dock display from actual duration.
 *
 * @param durationMinutes - Real dock span length from layout times
 * @param policy - Threshold above which the UI uses compressed dock break
 * @returns Row display mode for layout height rules
 */
const getDockDisplayMode = (
  durationMinutes: number,
  policy: VesselTimelinePolicy
): TimelineSemanticRow["displayMode"] =>
  durationMinutes >= policy.compressedDockThresholdMinutes
    ? "compressed-dock-break"
    : "proportional";

/**
 * Maps actual dock minutes to the minutes allocated in the layout height.
 *
 * @param durationMinutes - Real span length
 * @param displayMode - Proportional or compressed break layout
 * @param policy - Stub and departure window minutes when compressed
 * @returns Minutes used for row `displayDurationMinutes`
 */
const getDisplayDurationMinutes = (
  durationMinutes: number,
  displayMode: TimelineSemanticRow["displayMode"],
  policy: VesselTimelinePolicy
) =>
  displayMode === "compressed-dock-break"
    ? policy.compressedDockArrivalStubMinutes +
      policy.compressedDockDepartureWindowMinutes
    : durationMinutes;

/**
 * Duration between row boundaries using schedule-first layout precedence.
 *
 * @param startEvent - Row start with `ScheduledTime` / `ActualTime` / etc.
 * @param endEvent - Row end using the same precedence via `getLayoutTime`
 * @returns Positive minute span, at least 1 when times are missing or invalid
 */
const getDurationMinutes = (
  startEvent: TimelineRowEvent,
  endEvent: TimelineRowEvent
) => {
  const startTime = getLayoutTime(startEvent);
  const endTime = getLayoutTime(endEvent);

  if (!startTime || !endTime) {
    return 1;
  }

  const minutes = (endTime.getTime() - startTime.getTime()) / 60_000;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 1;
  }

  return Math.max(1, minutes);
};

/**
 * Short display name for map labels (abbreviates common words in terminal
 * names).
 *
 * @param terminalAbbrev - WSF terminal code, if known
 * @returns Shortened display string or undefined when abbrev is missing
 */
const getDisplayTerminalName = (terminalAbbrev?: string) => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminalName = getTerminalNameByAbbrev(terminalAbbrev);
  return terminalName
    ?.replace("Island", "Is.")
    .replace("Port", "Pt.")
    .replace("Point", "Pt.");
};
