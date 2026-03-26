/**
 * Active segment selection for the vessel-day timeline.
 *
 * Chooses which server-owned semantic segment should host the floating
 * indicator based on the backend active-state contract.
 */

import type {
  VesselTimelineActiveState,
  VesselTimelineSegment,
} from "@/data/contexts";

/**
 * Picks the semantic segment index that should host the active indicator.
 *
 * Prefers the backend-resolved event-pair match when available. When the
 * backend resolves a terminal-tail fallback, matches the final terminal
 * segment by event key. Otherwise, no active segment is selected.
 *
 * @param segments - Semantic dock/sea segments for the day
 * @param activeState - Backend-resolved active segment state, when available
 * @returns Index into `segments` for the active segment
 */
export const resolveActiveSegmentIndex = (
  segments: VesselTimelineSegment[],
  activeState: VesselTimelineActiveState | null
) => {
  const matchedSegmentIndex = findSegmentMatchIndex(segments, activeState);
  if (matchedSegmentIndex >= 0) {
    return matchedSegmentIndex;
  }

  return findTerminalTailMatchIndex(segments, activeState);
};

const findSegmentMatchIndex = (
  segments: VesselTimelineSegment[],
  activeState: VesselTimelineActiveState | null
) => {
  const rowMatch = activeState?.rowMatch;
  if (!rowMatch) {
    return -1;
  }

  return segments.findIndex(
    (segment) =>
      segment.kind === rowMatch.kind &&
      segment.startEvent.Key === rowMatch.startEventKey &&
      segment.endEvent.Key === rowMatch.endEventKey
  );
};

/**
 * Finds the terminal-tail segment that corresponds to the backend
 * terminal-tail event key.
 *
 * @param segments - Semantic segments in order
 * @param activeState - Backend-resolved active segment state, when available
 * @returns Index or -1 when no terminal-tail fallback was supplied
 */
const findTerminalTailMatchIndex = (
  segments: VesselTimelineSegment[],
  activeState: VesselTimelineActiveState | null
) => {
  const terminalTailEventKey = activeState?.terminalTailEventKey;
  if (!terminalTailEventKey) {
    return -1;
  }

  return segments.findIndex(
    (segment) =>
      segment.isTerminal === true &&
      segment.startEvent.Key === terminalTailEventKey
  );
};
