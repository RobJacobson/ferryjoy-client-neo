/**
 * Pure adjacent-interval helpers shared by Convex timeline readers.
 */

export type AdjacentTimelineBoundaryEvent = {
  Key: string;
  SegmentKey: string;
  TerminalAbbrev: string;
  EventType: "dep-dock" | "arv-dock";
};

export type AdjacentDockInterval = {
  kind: "at-dock";
  terminalAbbrev: string;
  startEventKey: string | null;
  endEventKey: string | null;
  previousSegmentKey: string | null;
  nextSegmentKey: string | null;
};

export type AdjacentSeaInterval = {
  kind: "at-sea";
  segmentKey: string;
  startEventKey: string;
  endEventKey: string;
};

export type AdjacentTimelineInterval =
  | AdjacentDockInterval
  | AdjacentSeaInterval;

/**
 * Builds structural dock and sea intervals from an ordered boundary-event list.
 *
 * Invalid adjacent pairs are ignored so interval ownership stays grounded in
 * explicit event adjacency rather than repaired seams.
 *
 * @param events - Ordered boundary events for one timeline slice
 * @returns Adjacent structural intervals in query/render order
 */
export const buildAdjacentTimelineIntervals = (
  events: AdjacentTimelineBoundaryEvent[]
): AdjacentTimelineInterval[] => {
  const intervals: AdjacentTimelineInterval[] = [];
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];

  if (firstEvent?.EventType === "dep-dock") {
    intervals.push({
      kind: "at-dock",
      terminalAbbrev: firstEvent.TerminalAbbrev,
      startEventKey: null,
      endEventKey: firstEvent.Key,
      previousSegmentKey: null,
      nextSegmentKey: firstEvent.SegmentKey,
    });
  }

  for (let index = 0; index < events.length - 1; index++) {
    const currentEvent = events[index];
    const nextEvent = events[index + 1];

    if (!currentEvent || !nextEvent) {
      continue;
    }

    if (
      currentEvent.EventType === "arv-dock" &&
      nextEvent.EventType === "dep-dock" &&
      currentEvent.TerminalAbbrev === nextEvent.TerminalAbbrev
    ) {
      intervals.push({
        kind: "at-dock",
        terminalAbbrev: currentEvent.TerminalAbbrev,
        startEventKey: currentEvent.Key,
        endEventKey: nextEvent.Key,
        previousSegmentKey: currentEvent.SegmentKey,
        nextSegmentKey: nextEvent.SegmentKey,
      });
      continue;
    }

    if (
      currentEvent.EventType === "dep-dock" &&
      nextEvent.EventType === "arv-dock" &&
      currentEvent.SegmentKey === nextEvent.SegmentKey
    ) {
      intervals.push({
        kind: "at-sea",
        segmentKey: currentEvent.SegmentKey,
        startEventKey: currentEvent.Key,
        endEventKey: nextEvent.Key,
      });
    }
  }

  if (lastEvent?.EventType === "arv-dock") {
    intervals.push({
      kind: "at-dock",
      terminalAbbrev: lastEvent.TerminalAbbrev,
      startEventKey: lastEvent.Key,
      endEventKey: null,
      previousSegmentKey: lastEvent.SegmentKey,
      nextSegmentKey: null,
    });
  }

  return intervals;
};
