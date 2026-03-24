import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type { ConvexVesselTripEvent } from "../../functions/vesselTripEvents/schemas";
import type {
  ConvexVesselTimelineActiveState,
  ConvexVesselTimelineLiveState,
  ConvexVesselTimelineRowMatch,
} from "../../functions/vesselTripEvents/activeStateSchemas";

const INDICATOR_ANIMATION_SPEED_THRESHOLD = 0.1;

type CandidateRow = {
  kind: "dock" | "sea";
  startEvent: ConvexVesselTripEvent;
  endEvent: ConvexVesselTripEvent;
};

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

const buildCandidateRows = (events: ConvexVesselTripEvent[]): CandidateRow[] => {
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

const toRowMatch = (row: CandidateRow): ConvexVesselTimelineRowMatch => ({
  kind: row.kind,
  startEventKey: row.startEvent.Key,
  endEventKey: row.endEvent.Key,
});

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

const getDockSubtitle = (location: ConvexVesselLocation) =>
  location.DepartingTerminalAbbrev
    ? `At dock ${location.DepartingTerminalAbbrev}`
    : "At dock";

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

const shouldAnimateSeaIndicator = (location: ConvexVesselLocation) =>
  location.InService !== false &&
  !location.AtDock &&
  (location.Speed ?? 0) > INDICATOR_ANIMATION_SPEED_THRESHOLD;

const getDisplayTime = (event: ConvexVesselTripEvent) =>
  event.ActualTime ?? event.PredictedTime ?? event.ScheduledTime;
