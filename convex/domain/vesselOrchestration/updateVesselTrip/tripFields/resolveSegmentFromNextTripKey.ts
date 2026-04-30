/**
 * Keyed schedule-segment resolution from prior trip continuity.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { UpdateVesselTripDbAccess } from "../types";

type ResolveSegmentFromNextTripKeyInput = {
  nextScheduleKey: string | undefined;
  departingTerminalAbbrev: string | undefined;
  scheduleAccess: UpdateVesselTripDbAccess;
};

/**
 * Attempts keyed segment resolution from the prior active row's next-trip key.
 *
 * @param input - Prior next schedule key, current departing terminal, and DB access
 * @returns Matching scheduled segment when key exists and terminal continuity holds;
 *   otherwise null
 */
export const tryResolveScheduledSegmentFromNextTripKey = async ({
  nextScheduleKey,
  departingTerminalAbbrev,
  scheduleAccess,
}: ResolveSegmentFromNextTripKeyInput): Promise<ConvexInferredScheduledSegment | null> => {
  if (nextScheduleKey === undefined) {
    return null;
  }

  const segment =
    await scheduleAccess.getScheduledSegmentByScheduleKey(nextScheduleKey);
  if (segment === null) {
    return null;
  }

  return segment.DepartingTerminalAbbrev === departingTerminalAbbrev
    ? segment
    : null;
};
