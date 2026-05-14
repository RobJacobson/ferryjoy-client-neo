/**
 * Composes the actual dock row set from every reload evidence source.
 *
 * Runs the source-specific projections in the priority order reload guarantees
 * (history-hydrated boundaries, physical-only trip fields, schedule-aligned
 * pings, physical-only pings), threads represented-boundary state through the
 * weaker ping sources, and dedupes the combined output so the eventsActual
 * replacement receives one row per boundary.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { dedupeActualRowsByEventKey } from "../../dedupeActualRows";
import type { DockStatusEventRecord, ReloadTripContext } from "../types";
import { buildActualDockEventContext } from "./buildActualContext";
import { buildHistoryActualRows } from "./fromHydratedBoundaries";
import {
  buildPhysicalOnlyLocationFallbackRows,
  buildScheduleAlignedLocationFallbackRows,
  buildTripBoundaryKeySet,
  locationMatchesSailingDay,
} from "./fromLocationFallbacks";
import { buildPhysicalOnlyTripActualRows } from "./fromPhysicalOnlyTrips";

/**
 * Builds actual dock rows from history, physical-only trips, and live pings.
 *
 * The function runs four projections in priority order so stronger evidence
 * always wins: history-hydrated boundaries feed actuals first, physical-only
 * trip fields layer next, then live pings fall back where boundaries lack
 * observation evidence. Physical-only ping rows are filtered against a running
 * set of represented trip-boundary keys so they only appear when no stronger
 * source covered that trip and boundary. The final result is deduped by event
 * key so the replacement mutation can write each row exactly once.
 *
 * @param params - Sailing day, hydrated boundary tape, locations, updatedAt stamp, and trip context
 * @returns Unique actual dock rows for the sailing-day reload
 */
const buildReloadActualDockRows = ({
  sailingDay,
  boundaryEvents,
  vesselLocations,
  updatedAt,
  tripContext,
}: {
  sailingDay: string;
  boundaryEvents: DockStatusEventRecord[];
  vesselLocations: ConvexVesselLocation[];
  updatedAt: number;
  tripContext: ReloadTripContext;
}): ConvexActualDockEvent[] => {
  const context = buildActualDockEventContext(tripContext, boundaryEvents);
  const baseRows = [
    ...buildHistoryActualRows(
      boundaryEvents,
      updatedAt,
      context.tripKeyBySegmentKey
    ),
    ...buildPhysicalOnlyTripActualRows(updatedAt, context.physicalOnlyTrips),
  ];
  const sailingDayLocations = vesselLocations.filter((location) =>
    locationMatchesSailingDay(location, sailingDay)
  );
  const scheduleAlignedLocationRows = buildScheduleAlignedLocationFallbackRows({
    locations: sailingDayLocations,
    updatedAt,
    context,
  });
  const physicalOnlyLocationRows = buildPhysicalOnlyLocationFallbackRows({
    locations: sailingDayLocations,
    updatedAt,
    context,
    representedTripBoundaryKeys: buildTripBoundaryKeySet([
      ...baseRows,
      ...scheduleAlignedLocationRows,
    ]),
  });

  const combinedActualDockRows = [
    ...baseRows,
    ...scheduleAlignedLocationRows,
    ...physicalOnlyLocationRows,
  ];
  const dedupedActualDockRows = dedupeActualRowsByEventKey(
    combinedActualDockRows
  );

  return dedupedActualDockRows;
};

export { buildReloadActualDockRows };
