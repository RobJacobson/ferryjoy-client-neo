/**
 * Build semantic dock/sea rows directly from the ordered backend event feed.
 */

import type { VesselTimelineEvent } from "@/data/contexts";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";
import type {
  TimelineRowEvent,
  TimelineSemanticRow,
  VesselTimelinePolicy,
} from "../../types";
import { getLayoutTime } from "./timePrecedence";

/**
 * Builds ordered dock and sea rows for the vessel-day timeline.
 *
 * This is the main semantic transform for the feature: given a sorted vessel
 * event feed, emit the alternating dock and sea rows that the UI can lay out.
 */
export const buildTimelineRows = (
  events: VesselTimelineEvent[],
  policy: VesselTimelinePolicy
): TimelineSemanticRow[] => {
  const rows: TimelineSemanticRow[] = [];

  for (let index = 0; index < events.length - 1; index++) {
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

const toRowEvent = (event: VesselTimelineEvent): TimelineRowEvent => ({
  ...event,
  TerminalDisplayName: getDisplayTerminalName(event.TerminalAbbrev),
});

const isDockPair = (current: VesselTimelineEvent, next: VesselTimelineEvent) =>
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev;

const isSeaPair = (current: VesselTimelineEvent, next: VesselTimelineEvent) =>
  current.EventType === "dep-dock" && next.EventType === "arv-dock";

const getDockDisplayMode = (
  durationMinutes: number,
  policy: VesselTimelinePolicy
): TimelineSemanticRow["displayMode"] =>
  durationMinutes >= policy.compressedDockThresholdMinutes
    ? "compressed-dock-break"
    : "proportional";

const getDisplayDurationMinutes = (
  durationMinutes: number,
  displayMode: TimelineSemanticRow["displayMode"],
  policy: VesselTimelinePolicy
) =>
  displayMode === "compressed-dock-break"
    ? policy.compressedDockArrivalStubMinutes +
      policy.compressedDockDepartureWindowMinutes
    : durationMinutes;

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
