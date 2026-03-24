/**
 * Resolves the compact active-state snapshot that accompanies the stable
 * `vesselTripEvents` day feed.
 *
 * This module only derives row matches and indicator copy. It does not mutate
 * read-model rows or recompute the heavier live-update reconciliation logic.
 */
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type {
  ConvexVesselTimelineActiveState,
  ConvexVesselTimelineLiveState,
  ConvexVesselTimelineRowMatch,
} from "../../functions/vesselTripEvents/activeStateSchemas";
import type { ConvexVesselTripEvent } from "../../functions/vesselTripEvents/schemas";

const INDICATOR_ANIMATION_SPEED_THRESHOLD = 0.1;

type CandidateRow = {
  kind: "dock" | "sea";
  startEvent: ConvexVesselTripEvent;
  endEvent: ConvexVesselTripEvent;
};

/**
 * Resolves the active row snapshot for one vessel/day timeline payload.
 *
 * Resolution order is: live location anchor, open actual-backed row,
 * scheduled display-time window, then an edge fallback near the start or end
 * of the service day.
 *
 * @param events - Ordered vessel/day boundary events from the read model
 * @param location - Latest live vessel location used for row anchoring
 * @param observedAt - Observation timestamp used by schedule fallbacks
 * @returns Compact live state, active row state, and the timestamp used
 */
export const resolveVesselTimelineActiveState = ({
  events,
  location,
  observedAt = location?.TimeStamp ?? Date.now(),
}: {
  events: ConvexVesselTripEvent[];
  location?: ConvexVesselLocation;
  observedAt?: number;
}): {
  Live: ConvexVesselTimelineLiveState | null;
  ActiveState: ConvexVesselTimelineActiveState | null;
  ObservedAt: number;
} => {
  const candidateRows = buildCandidateRows(events);
  const Live = location ? toLiveState(location) : null;

  const locationAnchoredState =
    location && candidateRows.length > 0
      ? resolveLocationAnchoredState(candidateRows, location)
      : null;
  if (locationAnchoredState) {
    return {
      Live,
      ActiveState: locationAnchoredState,
      ObservedAt: observedAt,
    };
  }

  const actualBackedState = resolveActualBackedState(candidateRows);
  if (actualBackedState) {
    return {
      Live,
      ActiveState: actualBackedState,
      ObservedAt: observedAt,
    };
  }

  const scheduledWindowState = resolveScheduledWindowState(
    candidateRows,
    observedAt
  );
  if (scheduledWindowState) {
    return {
      Live,
      ActiveState: scheduledWindowState,
      ObservedAt: observedAt,
    };
  }

  const edgeFallbackState = resolveEdgeFallbackState(candidateRows, observedAt);

  return {
    Live,
    ActiveState:
      edgeFallbackState ??
      (Live
        ? {
            kind: "unknown",
            rowMatch: null,
            subtitle: undefined,
            animate: false,
            speedKnots: Live.Speed ?? 0,
            reason: "unknown",
          }
        : null),
    ObservedAt: observedAt,
  };
};

/**
 * Converts adjacent event pairs into dock and sea candidate rows.
 *
 * @param events - Ordered boundary events for one vessel and sailing day
 * @returns Candidate rows eligible for active-state matching
 */
const buildCandidateRows = (
  events: ConvexVesselTripEvent[]
): CandidateRow[] => {
  const rows: CandidateRow[] = [];

  for (let index = 0; index < events.length - 1; index++) {
    const current = events[index];
    const next = events[index + 1];

    if (!current || !next) {
      continue;
    }

    if (
      current.EventType === "arv-dock" &&
      next.EventType === "dep-dock" &&
      current.TerminalAbbrev === next.TerminalAbbrev
    ) {
      rows.push({
        kind: "dock",
        startEvent: current,
        endEvent: next,
      });
      continue;
    }

    if (current.EventType === "dep-dock" && next.EventType === "arv-dock") {
      rows.push({
        kind: "sea",
        startEvent: current,
        endEvent: next,
      });
    }
  }

  return rows;
};

/**
 * Anchors the active row directly from the current live location when possible.
 *
 * @param rows - Candidate dock and sea rows
 * @param location - Live vessel location payload
 * @returns Active-state snapshot rooted in live vessel position, or `null`
 */
const resolveLocationAnchoredState = (
  rows: CandidateRow[],
  location: ConvexVesselLocation
): ConvexVesselTimelineActiveState | null => {
  if (location.AtDock) {
    const row =
      findDockRowByScheduledDeparture(rows, location) ??
      findLatestDockRowAtTerminal(rows, location.DepartingTerminalAbbrev);

    if (row) {
      return {
        kind: "dock",
        rowMatch: toRowMatch(row),
        subtitle: getDockSubtitle(location),
        animate: false,
        speedKnots: location.Speed ?? 0,
        reason: "location_anchor",
      };
    }
  }

  if (!location.AtDock) {
    const row =
      findSeaRowByScheduledDeparture(rows, location) ??
      findLatestSeaRowByTerminalPair(rows, location);

    if (row) {
      return {
        kind: "sea",
        rowMatch: toRowMatch(row),
        subtitle: getSeaSubtitle(location),
        animate: shouldAnimateSeaIndicator(location),
        speedKnots: location.Speed ?? 0,
        reason: "location_anchor",
      };
    }
  }

  return null;
};

/**
 * Finds the dock row whose departure boundary matches the live schedule anchor.
 *
 * @param rows - Candidate dock and sea rows
 * @param location - Live location carrying scheduled departure context
 * @returns Matching dock row, if the location exposes a departure anchor
 */
const findDockRowByScheduledDeparture = (
  rows: CandidateRow[],
  location: ConvexVesselLocation
) => {
  if (location.ScheduledDeparture === undefined) {
    return undefined;
  }

  return rows.find(
    (row) =>
      row.kind === "dock" &&
      row.endEvent.TerminalAbbrev === location.DepartingTerminalAbbrev &&
      row.endEvent.ScheduledDeparture === location.ScheduledDeparture
  );
};

/**
 * Finds the most recent dock row at the vessel's current terminal.
 *
 * @param rows - Candidate dock and sea rows
 * @param terminalAbbrev - Terminal abbreviation from live location
 * @returns Latest dock row at that terminal, if any
 */
const findLatestDockRowAtTerminal = (
  rows: CandidateRow[],
  terminalAbbrev: string
) =>
  [...rows]
    .reverse()
    .find(
      (row) =>
        row.kind === "dock" && row.endEvent.TerminalAbbrev === terminalAbbrev
    );

/**
 * Finds the sea row whose departure anchor matches the live location.
 *
 * @param rows - Candidate dock and sea rows
 * @param location - Live location carrying departure context
 * @returns Matching sea row, if one can be anchored directly
 */
const findSeaRowByScheduledDeparture = (
  rows: CandidateRow[],
  location: ConvexVesselLocation
) => {
  if (location.ScheduledDeparture === undefined) {
    return undefined;
  }

  return rows.find(
    (row) =>
      row.kind === "sea" &&
      row.startEvent.TerminalAbbrev === location.DepartingTerminalAbbrev &&
      row.startEvent.ScheduledDeparture === location.ScheduledDeparture &&
      (location.ArrivingTerminalAbbrev === undefined ||
        row.endEvent.TerminalAbbrev === location.ArrivingTerminalAbbrev)
  );
};

/**
 * Finds the most recent sea row that matches the live terminal pair.
 *
 * @param rows - Candidate dock and sea rows
 * @param location - Live location carrying departure and optional arrival terminal
 * @returns Latest compatible sea row, if any
 */
const findLatestSeaRowByTerminalPair = (
  rows: CandidateRow[],
  location: ConvexVesselLocation
) =>
  [...rows]
    .reverse()
    .find(
      (row) =>
        row.kind === "sea" &&
        row.startEvent.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        (location.ArrivingTerminalAbbrev === undefined ||
          row.endEvent.TerminalAbbrev === location.ArrivingTerminalAbbrev)
    );

/**
 * Uses event actuals as a fallback when no live row anchor is available.
 *
 * @param rows - Candidate dock and sea rows in timeline order
 * @returns Most recent row whose start actualized but end has not
 */
const resolveActualBackedState = (
  rows: CandidateRow[]
): ConvexVesselTimelineActiveState | null => {
  const row = [...rows]
    .reverse()
    .find(
      (candidate) =>
        candidate.startEvent.ActualTime !== undefined &&
        candidate.endEvent.ActualTime === undefined
    );

  if (!row) {
    return null;
  }

  return {
    kind: row.kind,
    rowMatch: toRowMatch(row),
    subtitle: undefined,
    animate: false,
    speedKnots: 0,
    reason: "open_actual_row",
  };
};

/**
 * Uses display-time windows as the schedule-first active-row fallback.
 *
 * @param rows - Candidate dock and sea rows
 * @param observedAt - Timestamp being matched against row windows
 * @returns Scheduled fallback state, or `null` when no row contains the time
 */
const resolveScheduledWindowState = (
  rows: CandidateRow[],
  observedAt: number
): ConvexVesselTimelineActiveState | null => {
  const row = rows.find((candidate) => {
    const start = getDisplayTime(candidate.startEvent);
    const end = getDisplayTime(candidate.endEvent);

    return (
      start !== undefined &&
      end !== undefined &&
      observedAt >= start &&
      observedAt <= end
    );
  });

  if (!row) {
    return null;
  }

  return {
    kind: "scheduled-fallback",
    rowMatch: toRowMatch(row),
    subtitle: undefined,
    animate: false,
    speedKnots: 0,
    reason: "scheduled_window",
  };
};

/**
 * Chooses the first or last row when the observation is outside all windows.
 *
 * @param rows - Candidate dock and sea rows
 * @param observedAt - Timestamp being compared to the row bounds
 * @returns Edge fallback state, or `null` when no rows exist
 */
const resolveEdgeFallbackState = (
  rows: CandidateRow[],
  observedAt: number
): ConvexVesselTimelineActiveState | null => {
  if (rows.length === 0) {
    return null;
  }

  const firstStart = getDisplayTime(rows[0]?.startEvent);
  const row =
    firstStart !== undefined && observedAt < firstStart
      ? rows[0]
      : rows[rows.length - 1];

  if (!row) {
    return null;
  }

  return {
    kind: "scheduled-fallback",
    rowMatch: toRowMatch(row),
    subtitle: undefined,
    animate: false,
    speedKnots: 0,
    reason: "fallback",
  };
};

/**
 * Converts a candidate row into the compact key-only row match payload.
 *
 * @param row - Candidate dock or sea row
 * @returns Stable-key row match for frontend correlation
 */
const toRowMatch = (row: CandidateRow): ConvexVesselTimelineRowMatch => ({
  kind: row.kind,
  startEventKey: row.startEvent.Key,
  endEventKey: row.endEvent.Key,
});

/**
 * Copies the live vessel-location payload into the compact active snapshot.
 *
 * @param location - Latest live vessel location
 * @returns Frontend-friendly live state projection
 */
const toLiveState = (
  location: ConvexVesselLocation
): ConvexVesselTimelineLiveState => ({
  VesselName: location.VesselName,
  AtDock: location.AtDock,
  InService: location.InService,
  Speed: location.Speed,
  DepartingTerminalAbbrev: location.DepartingTerminalAbbrev,
  ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
  DepartingDistance: location.DepartingDistance,
  ArrivingDistance: location.ArrivingDistance,
  ScheduledDeparture: location.ScheduledDeparture,
  TimeStamp: location.TimeStamp,
});

/**
 * Builds dock copy for the active indicator subtitle.
 *
 * @param location - Live vessel location
 * @returns Dock subtitle string
 */
const getDockSubtitle = (location: ConvexVesselLocation) =>
  location.DepartingTerminalAbbrev
    ? `At dock ${location.DepartingTerminalAbbrev}`
    : "At dock";

/**
 * Builds sea copy for the active indicator subtitle.
 *
 * @param location - Live vessel location
 * @returns Sea subtitle with speed and optional remaining distance
 */
const getSeaSubtitle = (location: ConvexVesselLocation) => {
  const speed = location.Speed ?? 0;

  if (location.ArrivingDistance === undefined) {
    return `${speed.toFixed(0)} kn`;
  }

  const terminalPart = location.ArrivingTerminalAbbrev
    ? ` to ${location.ArrivingTerminalAbbrev}`
    : "";

  return `${speed.toFixed(0)} kn · ${location.ArrivingDistance.toFixed(
    1
  )} mi${terminalPart}`;
};

/**
 * Gates rocking animation to in-service, under-way live states.
 *
 * @param location - Live vessel location
 * @returns True when the sea indicator should animate
 */
const shouldAnimateSeaIndicator = (location: ConvexVesselLocation) =>
  location.InService !== false &&
  !location.AtDock &&
  (location.Speed ?? 0) > INDICATOR_ANIMATION_SPEED_THRESHOLD;

/**
 * Active-state display-time precedence helper.
 *
 * @param event - Candidate boundary event
 * @returns Actual time, else prediction, else scheduled time
 */
const getDisplayTime = (event: ConvexVesselTripEvent) =>
  event.ActualTime ?? event.PredictedTime ?? event.ScheduledTime;
