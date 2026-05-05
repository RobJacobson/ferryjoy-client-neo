/**
 * Resolves a scheduled segment from prior next-leg continuity.
 *
 * This module uses a prior active row's NextScheduleKey as the fastest schedule
 * recovery path for a newly started trip, then verifies that the current
 * departing terminal still matches the segment.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { UpdateVesselTripDbAccess } from "../types";

type ResolveSegmentFromNextScheduleKeyInput = {
  nextScheduleKey: string | undefined;
  departingTerminalAbbrev: string | undefined;
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Attempts keyed segment resolution from the prior active row's next-trip key.
 *
 * This helper is the first continuity strategy for new-trip schedule recovery.
 * It uses the prior row's NextScheduleKey to fetch one candidate segment,
 * then validates that the candidate still matches the vessel's current
 * departing terminal. That terminal guard prevents stale key reuse when the
 * vessel state has already advanced to a different physical leg.
 *
 * @param input - Prior next schedule key, current departing terminal, and schedule read access
 * @returns Matching scheduled segment when key exists and terminal continuity holds;
 *   otherwise null
 */
const tryResolveScheduledSegmentFromNextScheduleKey = async ({
  nextScheduleKey,
  departingTerminalAbbrev,
  dbAccess,
}: ResolveSegmentFromNextScheduleKeyInput): Promise<ConvexInferredScheduledSegment | null> => {
  if (nextScheduleKey === undefined) {
    return null;
  }

  // Load the keyed segment first so continuity stays O(1) when prior linkage is valid.
  const segment =
    await dbAccess.getScheduledSegmentByScheduleKey(nextScheduleKey);
  if (segment === null) {
    return null;
  }

  // Enforce terminal continuity so stale keys do not attach the wrong scheduled leg.
  return segment.DepartingTerminalAbbrev === departingTerminalAbbrev
    ? segment
    : null;
};

export { tryResolveScheduledSegmentFromNextScheduleKey };
