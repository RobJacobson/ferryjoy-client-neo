/**
 * Composes the actual dock row set from every reload evidence source.
 *
 * Runs the source-specific projections in the priority order reload guarantees
 * using WSF history, physical-only trip fields, schedule-aligned tracking, and
 * physical-only tracking. Represented-boundary state makes the durable sources
 * win without placing actual evidence on scheduled boundary objects.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { dedupeActualRowsByEventKey } from "../../dedupeActualRows";
import type { ReloadScheduledBoundary, ReloadTripContext } from "../types";
import { buildActualDockEventContext } from "./buildActualContext";
import { buildHistoryActualRows } from "./fromHistoryActuals";
import { buildPhysicalOnlyTripActualRows } from "./fromPhysicalOnlyTrips";
import {
  buildPhysicalOnlyTrackingActualRows,
  buildScheduleAlignedTrackingActualRows,
  buildTripBoundaryKeySet,
  trackingLocationMatchesSailingDay,
} from "./fromTrackingEvidence";

/**
 * Builds actual dock rows from durable and tracking-derived evidence.
 *
 * The function runs four projections in priority order so stronger evidence
 * always wins: WSF history actuals feed actuals first, physical-only trip
 * fields layer next, then tracking data fills boundaries not already
 * represented. The final result is deduped by event key so the replacement
 * mutation can write each row exactly once.
 *
 * @param params - Sailing day, scheduled boundaries, locations, updatedAt stamp, trip context, and history evidence
 * @returns Unique actual dock rows for the sailing-day reload
 */
const buildReloadActualDockRows = ({
  sailingDay,
  boundaryEvents,
  vesselLocations,
  updatedAt,
  tripContext,
  historyActualsByEventKey,
}: {
  sailingDay: string;
  boundaryEvents: ReloadScheduledBoundary[];
  vesselLocations: ConvexVesselLocation[];
  updatedAt: number;
  tripContext: ReloadTripContext;
  historyActualsByEventKey: Map<string, number>;
}): ConvexActualDockEvent[] => {
  const context = buildActualDockEventContext(tripContext, boundaryEvents);
  const baseRows = [
    ...buildHistoryActualRows(
      boundaryEvents,
      updatedAt,
      context.tripKeyBySegmentKey,
      historyActualsByEventKey
    ),
    ...buildPhysicalOnlyTripActualRows(updatedAt, context.physicalOnlyTrips),
  ];
  const sailingDayLocations = vesselLocations.filter((location) =>
    trackingLocationMatchesSailingDay(location, sailingDay)
  );
  const scheduleAlignedTrackingRows = buildScheduleAlignedTrackingActualRows({
    locations: sailingDayLocations,
    updatedAt,
    context,
    representedTripBoundaryKeys: buildTripBoundaryKeySet(baseRows),
  });
  const physicalOnlyTrackingRows = buildPhysicalOnlyTrackingActualRows({
    locations: sailingDayLocations,
    updatedAt,
    context,
    representedTripBoundaryKeys: buildTripBoundaryKeySet([
      ...baseRows,
      ...scheduleAlignedTrackingRows,
    ]),
  });

  const combinedActualDockRows = [
    ...baseRows,
    ...scheduleAlignedTrackingRows,
    ...physicalOnlyTrackingRows,
  ];
  const dedupedActualDockRows = dedupeActualRowsByEventKey(
    combinedActualDockRows
  );

  return dedupedActualDockRows;
};

export { buildReloadActualDockRows };
