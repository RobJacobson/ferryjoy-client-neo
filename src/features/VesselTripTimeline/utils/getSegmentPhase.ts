/**
 * Derives segment lifecycle state from ordered position and active cursor.
 */

import type { SegmentPhase } from "../types";

/**
 * Derives the lifecycle state for one ordered segment.
 *
 * @param segmentIndex - Zero-based segment index in the ordered list
 * @param activeSegmentIndex - Active segment cursor, with `-1` before start and
 * `segmentCount` after completion
 * @returns Derived lifecycle state for the segment
 */
export const getSegmentPhase = (
  segmentIndex: number,
  activeSegmentIndex: number
): SegmentPhase => {
  if (activeSegmentIndex < 0) {
    return "upcoming";
  }

  if (segmentIndex < activeSegmentIndex) {
    return "completed";
  }

  if (segmentIndex === activeSegmentIndex) {
    return "active";
  }

  return "upcoming";
};
