/**
 * Pure active-interval helpers shared by VesselTimeline readers.
 */

import {
  type AdjacentDockInterval,
  type AdjacentTimelineInterval,
  buildAdjacentTimelineIntervals,
} from "./timelineIntervals";

export type ActiveTimelineBoundaryEvent = {
  Key: string;
  SegmentKey: string;
  TerminalAbbrev: string;
  EventType: "dep-dock" | "arv-dock";
  EventActualTime?: unknown;
};

export type ActiveTimelineInterval =
  | {
      kind: "at-dock" | "at-sea";
      startEventKey: string | null;
      endEventKey: string | null;
    }
  | null;

/**
 * Resolves the active interval from ordered timeline events using actual
 * boundary completion only.
 *
 * The active interval is the structural interval immediately after the latest
 * event that has `EventActualTime`. If no actual boundary exists yet, the
 * opening dock interval becomes active when present.
 *
 * @param events - Ordered timeline events for one sailing day
 * @returns Active interval, or `null` when no interval can be proven
 */
export const resolveActiveTimelineInterval = (
  events: ActiveTimelineBoundaryEvent[]
): ActiveTimelineInterval => {
  const intervals = buildAdjacentTimelineIntervals(events);
  const latestActualEvent = [...events]
    .reverse()
    .find((event) => event.EventActualTime !== undefined);

  if (!latestActualEvent) {
    return toActiveInterval(
      getUniqueMatch(
        intervals.filter(
          (interval): interval is AdjacentDockInterval =>
            interval.kind === "at-dock" && interval.startEventKey === null
        )
      )
    );
  }

  if (latestActualEvent.EventType === "dep-dock") {
    return toActiveInterval(
      getUniqueMatch(
        intervals.filter(
          (interval) =>
            interval.kind === "at-sea" &&
            interval.startEventKey === latestActualEvent.Key
        )
      )
    );
  }

  return toActiveInterval(
    getUniqueMatch(
      intervals.filter(
        (interval): interval is AdjacentDockInterval =>
          interval.kind === "at-dock" &&
          interval.startEventKey === latestActualEvent.Key
      )
    )
  );
};

const getUniqueMatch = <T>(matches: T[]) =>
  matches.length === 1 ? matches[0] : null;

const toActiveInterval = (
  interval: AdjacentTimelineInterval | null
): ActiveTimelineInterval =>
  interval
    ? {
        kind: interval.kind,
        startEventKey: interval.startEventKey,
        endEventKey: interval.endEventKey,
      }
    : null;
