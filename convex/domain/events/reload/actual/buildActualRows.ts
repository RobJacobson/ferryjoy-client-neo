/**
 * Orchestrator-facing entry point for actual-row synthesis.
 *
 * Hides the actual subtree behind a single function so the orchestrator never
 * imports from actual internals. The actual composition runs inside actual;
 * this wrapper only narrows the public surface.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { WsfVesselHistory } from "../schemas";
import type {
  RawSeedSegment,
  ReloadScheduledBoundary,
  ReloadTripForActuals,
} from "../types";
import { buildReloadActualDockRows } from "./buildReloadActualDockRows";
import { buildActualTripContext } from "./buildTripContext";
import { mapHistoryActualsToEventKeys } from "./mapHistoryActualsToEventKeys";

/**
 * Computes actual dock rows for one sailing-day reload.
 *
 * Builds trip-key joins and physical-only collections from active and completed
 * Convex trips, indexes WSF history as durable actual evidence, then hands
 * pure scheduled boundaries and same-day tracking rows to the actual composer.
 * This keeps boundary construction schedule-only while preserving tracking as a
 * first-class event source.
 *
 * @param params - Sailing day, seed segments, scheduled boundaries, history, trip evidence, tracking rows, identity tables, and updatedAt stamp
 * @returns Unique actual dock rows for the sailing-day reload
 */
const buildActualRows = ({
  activeTrips,
  completedTrips,
  seedSegments,
  historyRecords,
  vessels,
  terminals,
  ...params
}: {
  sailingDay: string;
  seedSegments: RawSeedSegment[];
  boundaryEvents: ReloadScheduledBoundary[];
  historyRecords: WsfVesselHistory[];
  activeTrips: ReloadTripForActuals[];
  completedTrips: ReloadTripForActuals[];
  vesselLocations: ConvexVesselLocation[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  updatedAt: number;
}): ConvexActualDockEvent[] =>
  buildReloadActualDockRows({
    ...params,
    tripContext: buildActualTripContext(activeTrips, completedTrips),
    historyActualsByEventKey: mapHistoryActualsToEventKeys(
      seedSegments,
      historyRecords,
      vessels,
      terminals
    ),
  });

export { buildActualRows };
