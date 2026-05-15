/**
 * Orchestrator-facing entry point for actual-row synthesis.
 *
 * Hides the actual subtree behind a single function so the orchestrator never
 * imports from actual internals. The actual composition runs inside actual;
 * this wrapper only narrows the public surface.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { DockStatusEventRecord, ReloadTripForActuals } from "../types";
import { buildReloadActualDockRows } from "./buildReloadActualDockRows";
import { buildActualTripContext } from "./buildTripContext";

/**
 * Computes the actual dock rows for one sailing-day reload.
 *
 * Builds trip-key joins and physical-only collections from active and completed
 * Convex trips, then hands the hydrated boundary tape plus same-day vessel
 * locations to the actual composer. That keeps scheduled and actual reload
 * stages on one shared boundary list while still hiding actual subtree imports
 * behind this single entry for orchestrators and mutations.
 *
 * @param params - Sailing day, hydrated boundary tape, trip evidence, vessel locations, and updatedAt stamp
 * @returns Unique actual dock rows for the sailing-day reload
 */
const buildActualRows = ({
  activeTrips,
  completedTrips,
  ...params
}: {
  sailingDay: string;
  boundaryEvents: DockStatusEventRecord[];
  activeTrips: ReloadTripForActuals[];
  completedTrips: ReloadTripForActuals[];
  vesselLocations: ConvexVesselLocation[];
  updatedAt: number;
}): ConvexActualDockEvent[] =>
  buildReloadActualDockRows({
    ...params,
    tripContext: buildActualTripContext(activeTrips, completedTrips),
  });

export { buildActualRows };
