/**
 * Resolves a new-trip schedule from prior-row NextScheduleKey continuity.
 *
 * This resolver owns the keyed rollover path only. It reads the scheduled
 * segment by key, validates that it still matches the current departing
 * terminal, and returns merge-ready schedule fields when continuity holds.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { UpdateVesselTripDbAccess } from "../types";
import { mapScheduledSegmentToTripScheduleResolution } from "./mapScheduledSegmentToTripScheduleResolution";
import type { ResolvedTripScheduleFields } from "./types";

type ResolveScheduleFromNextScheduleKeyInput = {
  existingTrip: ConvexVesselTrip | undefined;
  departingTerminalAbbrev: string | undefined;
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Resolves schedule fields from a prior active trip's NextScheduleKey.
 *
 * @param input - Prior trip, current departing terminal, and schedule read access
 * @returns Resolved schedule fields when the key points to the current terminal; otherwise undefined
 */
const resolveScheduleFromNextScheduleKey = async ({
  existingTrip,
  departingTerminalAbbrev,
  dbAccess,
}: ResolveScheduleFromNextScheduleKeyInput): Promise<
  ResolvedTripScheduleFields | undefined
> => {
  const nextScheduleKey = existingTrip?.NextScheduleKey;
  if (nextScheduleKey === undefined) {
    return undefined;
  }

  const segment =
    await dbAccess.getScheduledSegmentByScheduleKey(nextScheduleKey);
  if (
    segment === null ||
    segment.DepartingTerminalAbbrev !== departingTerminalAbbrev
  ) {
    return undefined;
  }

  return mapScheduledSegmentToTripScheduleResolution(
    segment,
    "nextScheduleKey"
  );
};

export type { ResolveScheduleFromNextScheduleKeyInput };
export { resolveScheduleFromNextScheduleKey };
