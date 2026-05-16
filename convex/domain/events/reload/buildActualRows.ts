/**
 * Builds reload actual dock-event rows through priority source phases.
 *
 * The reload path resolves scheduled and physical-only boundaries, then adds
 * each source type to event-keyed rows in priority order.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildActualBoundaryIndex } from "./buildActualBoundaryIndex";
import {
  applyHistoryActualRows,
  applyPhysicalFieldActualRows,
  applyPhysicalTrackingActualRows,
  applyScheduledTrackingActualRows,
  filterActualTrackingLocations,
} from "./buildActualRowSources";
import type { ActualRowsByEventKey } from "./buildActualRowsByEventKey";
import {
  isTripWithTripKey,
  resolveActualTripScope,
} from "./resolveActualTripScope";
import type { WsfVesselHistory } from "./schemas";
import type { ReloadTripInput, ScheduledBoundary, SeedLeg } from "./types";

type BuildActualRowsArgs = {
  sailingDay: string;
  seedLegs: SeedLeg[];
  boundaries: ScheduledBoundary[];
  historyRecords: WsfVesselHistory[];
  activeTrips: ReloadTripInput[];
  completedTrips: ReloadTripInput[];
  vesselLocations: ConvexVesselLocation[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  updatedAt: number;
};

/**
 * Builds actual dock rows from raw reload inputs.
 *
 * The function applies source precedence by running each source phase against
 * rowsByEventKey: WSF history first, durable physical trip fields second,
 * scheduled tracking third, and physical-only tracking last. Row helpers retain
 * the first event key so priority is explicit in the call sequence.
 *
 * @param args - Reload schedule, history, trip, tracking, identity, and timestamp inputs
 * @returns Deduped actual dock-event rows ready for persistence
 */
const buildActualRows = ({
  sailingDay,
  seedLegs,
  boundaries,
  historyRecords,
  activeTrips,
  completedTrips,
  vesselLocations,
  vessels,
  terminals,
  updatedAt,
}: BuildActualRowsArgs): ConvexActualDockEvent[] => {
  const tripScope = resolveActualTripScope(activeTrips, completedTrips);
  const index = buildActualBoundaryIndex(boundaries, tripScope);
  const locations = filterActualTrackingLocations(vesselLocations, sailingDay);
  const rowsByEventKey: ActualRowsByEventKey = {};

  applyHistoryActualRows({
    seedLegs,
    historyRecords,
    index,
    vessels,
    terminals,
    rowsByEventKey,
    updatedAt,
  });
  applyPhysicalFieldActualRows({
    tripsWithKeys: tripScope.tripsWithKeys,
    index,
    rowsByEventKey,
    updatedAt,
  });
  applyScheduledTrackingActualRows({
    locations,
    index,
    rowsByEventKey,
    updatedAt,
  });
  applyPhysicalTrackingActualRows({
    locations,
    index,
    rowsByEventKey,
    updatedAt,
  });

  return Object.values(rowsByEventKey);
};

/**
 * Builds the preserve set for physical-only actual replacement.
 *
 * Physical-only trips are not fully represented by the scheduled reload slice,
 * so replacement persistence needs to retain absent rows for their TripKeys.
 *
 * @param activeTrips - Active trip rows that may include physical-only TripKeys
 * @param completedTrips - Completed trip rows that may include physical-only TripKeys
 * @returns Physical-only TripKeys whose absent rows should be preserved
 */
const buildPreserveAbsentTripKeys = (
  activeTrips: ReloadTripInput[],
  completedTrips: ReloadTripInput[]
): Set<string> =>
  new Set(
    [...activeTrips, ...completedTrips]
      .filter(isTripWithTripKey)
      .filter((trip) => trip.ScheduleKey === undefined)
      .map((trip) => trip.TripKey)
  );

export { buildActualRows, buildPreserveAbsentTripKeys };
