import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
  VesselTimelineRowMatch,
} from "convex/functions/vesselTimeline/activeStateSchemas";
import type { VesselTimelineSegment } from "convex/functions/vesselTimeline/schemas";
import { getDisplayTime } from "../rowEventTime";

const INDICATOR_ANIMATION_SPEED_THRESHOLD = 0.1;

type TimelineRowSegment = VesselTimelineSegment & { isTerminal?: false };

export const resolveActiveStateFromTimeline = ({
  segments,
  location,
  observedAt = location?.TimeStamp ?? new Date(),
}: {
  segments: VesselTimelineSegment[];
  location?: VesselLocation | null;
  observedAt?: Date;
}): {
  Live: VesselTimelineLiveState | null;
  ActiveState: VesselTimelineActiveState | null;
  ObservedAt: Date;
} => {
  const rowSegments = segments.filter(isTimelineRowSegment);
  const live = location ? toLiveState(location) : null;

  const locationAnchoredState =
    location && rowSegments.length > 0
      ? resolveLocationAnchoredState(
          rowSegments,
          segments,
          location,
          observedAt.getTime()
        )
      : null;
  if (locationAnchoredState) {
    return { Live: live, ActiveState: locationAnchoredState, ObservedAt: observedAt };
  }

  const actualBackedState = resolveActualBackedState(rowSegments);
  if (actualBackedState) {
    return { Live: live, ActiveState: actualBackedState, ObservedAt: observedAt };
  }

  const scheduledWindowState = resolveScheduledWindowState(rowSegments, observedAt.getTime());
  if (scheduledWindowState) {
    return { Live: live, ActiveState: scheduledWindowState, ObservedAt: observedAt };
  }

  const terminalTailState = resolveTerminalTailState(segments, observedAt.getTime());
  if (terminalTailState) {
    return { Live: live, ActiveState: terminalTailState, ObservedAt: observedAt };
  }

  const edgeFallbackState = resolveEdgeFallbackState(rowSegments, observedAt.getTime());
  if (edgeFallbackState) {
    return { Live: live, ActiveState: edgeFallbackState, ObservedAt: observedAt };
  }

  return {
    Live: live,
    ActiveState: live
      ? {
          kind: "unknown",
          rowMatch: null,
          terminalTailEventKey: undefined,
          subtitle: undefined,
          animate: false,
          speedKnots: live.Speed ?? 0,
          reason: "unknown",
        }
      : null,
    ObservedAt: observedAt,
  };
};

const isTimelineRowSegment = (
  segment: VesselTimelineSegment
): segment is TimelineRowSegment => segment.isTerminal !== true;

const resolveLocationAnchoredState = (
  segments: TimelineRowSegment[],
  allSegments: VesselTimelineSegment[],
  location: VesselLocation,
  observedAt: number
): VesselTimelineActiveState | null => {
  if (location.AtDock) {
    const terminalTailSegment = getTerminalTailSegment(
      allSegments,
      location.DepartingTerminalAbbrev
    );
    const terminalTailTime = terminalTailSegment
      ? getDisplayTime(terminalTailSegment.startEvent)
      : undefined;

    if (
      terminalTailSegment &&
      terminalTailTime !== undefined &&
      observedAt >= terminalTailTime.getTime()
    ) {
      return {
        kind: "scheduled-fallback",
        rowMatch: null,
        terminalTailEventKey: terminalTailSegment.startEvent.Key,
        subtitle: getDockSubtitle(location),
        animate: false,
        speedKnots: location.Speed ?? 0,
        reason: "location_anchor",
      };
    }

    const row =
      findDockSegmentByScheduledDeparture(segments, location) ??
      findNearestDockSegmentAtTerminal(
        segments,
        location.DepartingTerminalAbbrev,
        observedAt
      );

    if (row) {
      return {
        kind: "dock",
        rowMatch: toRowMatch(row),
        terminalTailEventKey: undefined,
        subtitle: getDockSubtitle(location),
        animate: false,
        speedKnots: location.Speed ?? 0,
        reason: "location_anchor",
      };
    }
  }

  if (!location.AtDock) {
    const row =
      findSeaSegmentByScheduledDeparture(segments, location) ??
      findNearestSeaSegmentByTerminalPair(segments, location, observedAt);

    if (row) {
      return {
        kind: "sea",
        rowMatch: toRowMatch(row),
        terminalTailEventKey: undefined,
        subtitle: getSeaSubtitle(location),
        animate: shouldAnimateSeaIndicator(location),
        speedKnots: location.Speed ?? 0,
        reason: "location_anchor",
      };
    }
  }

  return null;
};

const findDockSegmentByScheduledDeparture = (
  segments: TimelineRowSegment[],
  location: VesselLocation
) => {
  const scheduledDeparture = location.ScheduledDeparture;
  if (!scheduledDeparture) {
    return undefined;
  }

  return segments.find(
    (segment) =>
      segment.kind === "dock" &&
      segment.endEvent.TerminalAbbrev === location.DepartingTerminalAbbrev &&
      segment.endEvent.ScheduledDeparture?.getTime() === scheduledDeparture.getTime()
  );
};

const findNearestDockSegmentAtTerminal = (
  segments: TimelineRowSegment[],
  terminalAbbrev: string,
  observedAt: number
) =>
  [...segments]
    .filter(
      (segment) =>
        segment.kind === "dock" &&
        segment.endEvent.TerminalAbbrev === terminalAbbrev
    )
    .sort(
      (left, right) =>
        getSegmentWindowDistance(left, observedAt) -
        getSegmentWindowDistance(right, observedAt)
    )
    .at(0);

const findSeaSegmentByScheduledDeparture = (
  segments: TimelineRowSegment[],
  location: VesselLocation
) => {
  const scheduledDeparture = location.ScheduledDeparture;
  if (!scheduledDeparture) {
    return undefined;
  }

  return segments.find(
    (segment) =>
      segment.kind === "sea" &&
      segment.startEvent.TerminalAbbrev === location.DepartingTerminalAbbrev &&
      segment.startEvent.ScheduledDeparture?.getTime() ===
        scheduledDeparture.getTime() &&
      (location.ArrivingTerminalAbbrev === undefined ||
        segment.endEvent.TerminalAbbrev === location.ArrivingTerminalAbbrev)
  );
};

const findNearestSeaSegmentByTerminalPair = (
  segments: TimelineRowSegment[],
  location: VesselLocation,
  observedAt: number
) =>
  [...segments]
    .filter(
      (segment) =>
        segment.kind === "sea" &&
        segment.startEvent.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        (location.ArrivingTerminalAbbrev === undefined ||
          segment.endEvent.TerminalAbbrev === location.ArrivingTerminalAbbrev)
    )
    .sort(
      (left, right) =>
        getSegmentWindowDistance(left, observedAt) -
        getSegmentWindowDistance(right, observedAt)
    )
    .at(0);

const resolveActualBackedState = (
  segments: TimelineRowSegment[]
): VesselTimelineActiveState | null => {
  const row = [...segments]
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
    terminalTailEventKey: undefined,
    subtitle: undefined,
    animate: false,
    speedKnots: 0,
    reason: "open_actual_row",
  };
};

const resolveScheduledWindowState = (
  segments: TimelineRowSegment[],
  observedAt: number
): VesselTimelineActiveState | null => {
  const row = segments.find((candidate) => {
    const start = getDisplayTime(candidate.startEvent);
    const end = getDisplayTime(candidate.endEvent);

    return (
      start !== undefined &&
      end !== undefined &&
      observedAt >= start.getTime() &&
      observedAt <= end.getTime()
    );
  });

  if (!row) {
    return null;
  }

  return {
    kind: "scheduled-fallback",
    rowMatch: toRowMatch(row),
    terminalTailEventKey: undefined,
    subtitle: undefined,
    animate: false,
    speedKnots: 0,
    reason: "scheduled_window",
  };
};

const resolveEdgeFallbackState = (
  segments: TimelineRowSegment[],
  observedAt: number
): VesselTimelineActiveState | null => {
  if (segments.length === 0) {
    return null;
  }

  const firstStart = getDisplayTime(segments[0].startEvent);
  const row =
    firstStart !== undefined && observedAt < firstStart.getTime()
      ? segments[0]
      : segments[segments.length - 1];

  if (!row) {
    return null;
  }

  return {
    kind: "scheduled-fallback",
    rowMatch: toRowMatch(row),
    terminalTailEventKey: undefined,
    subtitle: undefined,
    animate: false,
    speedKnots: 0,
    reason: "fallback",
  };
};

const resolveTerminalTailState = (
  segments: VesselTimelineSegment[],
  observedAt: number
): VesselTimelineActiveState | null => {
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment || lastSegment.isTerminal !== true) {
    return null;
  }

  const lastEventDisplayTime = getDisplayTime(lastSegment.startEvent);
  if (
    lastEventDisplayTime !== undefined &&
    observedAt < lastEventDisplayTime.getTime()
  ) {
    return null;
  }

  return {
    kind: "scheduled-fallback",
    rowMatch: null,
    terminalTailEventKey: lastSegment.startEvent.Key,
    subtitle: undefined,
    animate: false,
    speedKnots: 0,
    reason: "fallback",
  };
};

const toRowMatch = (segment: TimelineRowSegment): VesselTimelineRowMatch => ({
  kind: segment.kind,
  startEventKey: segment.startEvent.Key,
  endEventKey: segment.endEvent.Key,
});

const toLiveState = (location: VesselLocation): VesselTimelineLiveState => ({
  VesselName: location.VesselName,
  AtDock: location.AtDock,
  InService: location.InService,
  Speed: location.Speed,
  DepartingTerminalAbbrev: location.DepartingTerminalAbbrev,
  ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
  DepartingDistance: location.DepartingDistance,
  ArrivingDistance: location.ArrivingDistance,
  LeftDock: location.LeftDock,
  Eta: location.Eta,
  ScheduledDeparture: location.ScheduledDeparture,
  TimeStamp: location.TimeStamp,
});

const getDockSubtitle = (location: VesselLocation) =>
  location.DepartingTerminalAbbrev
    ? `At dock ${location.DepartingTerminalAbbrev}`
    : "At dock";

const getSeaSubtitle = (location: VesselLocation) => {
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

const shouldAnimateSeaIndicator = (location: VesselLocation) =>
  location.InService !== false &&
  !location.AtDock &&
  (location.Speed ?? 0) > INDICATOR_ANIMATION_SPEED_THRESHOLD;

const getTerminalTailSegment = (
  segments: VesselTimelineSegment[],
  terminalAbbrev: string
) => {
  const lastSegment = segments[segments.length - 1];
  if (
    lastSegment?.isTerminal === true &&
    lastSegment.startEvent.TerminalAbbrev === terminalAbbrev
  ) {
    return lastSegment;
  }

  return null;
};

const getSegmentWindowDistance = (
  segment: TimelineRowSegment,
  observedAt: number
) => {
  const start = getDisplayTime(segment.startEvent)?.getTime();
  const end = getDisplayTime(segment.endEvent)?.getTime();

  if (start !== undefined && end !== undefined) {
    if (observedAt < start) {
      return start - observedAt;
    }

    if (observedAt > end) {
      return observedAt - end;
    }

    return 0;
  }

  const fallbackTime = end ?? start;
  if (fallbackTime === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(observedAt - fallbackTime);
};
