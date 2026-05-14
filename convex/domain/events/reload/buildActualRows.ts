/**
 * Orchestrator-facing entry point for actual-row synthesis.
 *
 * Hides the actuals subtree behind a single function so the orchestrator never
 * imports from actuals internal modules. The actual composition runs inside
 * actuals; this wrapper only narrows the public surface.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildReloadActualDockRows } from "./actuals";
import type { DockStatusEventRecord, ReloadTripContext } from "./types";

/**
 * Computes the actual dock rows for one sailing-day reload.
 *
 * Delegates to the actuals composer so the orchestrator can sequence trip
 * context, boundary events, scheduled rows, and actual rows in a single
 * readable file. Keeping this entry point at the reload root lets the
 * actuals folder evolve internal structure without touching the orchestrator.
 *
 * @param params - Sailing day, hydrated boundary tape, vessel locations, updatedAt stamp, and trip context
 * @returns Unique actual dock rows for the sailing-day reload
 */
const buildActualRows = (params: {
  sailingDay: string;
  boundaryEvents: DockStatusEventRecord[];
  vesselLocations: ConvexVesselLocation[];
  updatedAt: number;
  tripContext: ReloadTripContext;
}): ConvexActualDockEvent[] => buildReloadActualDockRows(params);

export { buildActualRows };
