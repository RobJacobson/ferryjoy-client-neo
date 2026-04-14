/**
 * Public reseed row-slice assembly entrypoint.
 */

import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../functions/vesselTimeline/schemas";
import {
  buildActualBoundaryEvents,
  buildScheduledBoundaryEvents,
  type TripContextForActualRow,
} from "../timelineRows";
import { mergeActualBoundaryPatchesIntoRows } from "./mergeActualBoundaryPatchesIntoRows";
import {
  normalizeScheduledDockSeams,
  sortVesselTripEvents,
} from "./normalizeEventRecords";
import { buildActualBoundaryPatchesForSailingDay } from "./reconcileLiveLocations";

type BuildReseedTimelineSliceArgs = {
  sailingDay: string;
  events: ConvexVesselTimelineEventRecord[];
  updatedAt: number;
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  vesselLocations: ConvexVesselLocation[];
};

/**
 * Builds the scheduled/actual row slice for one reseeded sailing day from
 * already-hydrated event records plus live reconciliation inputs.
 */
export const buildReseedTimelineSlice = ({
  sailingDay,
  events,
  updatedAt,
  tripBySegmentKey,
  vesselLocations,
}: BuildReseedTimelineSliceArgs) => {
  const normalizedEvents =
    normalizeScheduledDockSeams(events).sort(sortVesselTripEvents);
  const scheduledRows = buildScheduledBoundaryEvents(
    normalizedEvents,
    updatedAt
  );
  const baseActualRows = buildActualBoundaryEvents(
    normalizedEvents,
    updatedAt,
    tripBySegmentKey
  );
  const liveLocationActualPatches = buildActualBoundaryPatchesForSailingDay({
    sailingDay,
    scheduledEvents: scheduledRows,
    actualEvents: baseActualRows,
    vesselLocations,
    tripBySegmentKey,
  });
  const actualRows = mergeActualBoundaryPatchesIntoRows(
    baseActualRows,
    liveLocationActualPatches,
    updatedAt
  );

  return {
    scheduledRows,
    actualRows,
    scheduledCount: normalizedEvents.length,
    actualCount: actualRows.length,
  };
};
