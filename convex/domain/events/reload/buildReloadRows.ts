/**
 * Build scheduled and actual dock-event rows for a reload sailing day.
 *
 * The reload transform keeps the data flow direct: schedule inputs become seed
 * legs, seed legs become scheduled boundaries, and durable plus tracking
 * evidence becomes actual rows with clear source precedence.
 */

import {
  buildActualRows,
  buildPreserveAbsentTripKeys,
} from "./buildActualRows";
import { buildScheduledBoundaries } from "./buildScheduledBoundaries";
import { buildScheduledRows } from "./buildScheduledRows";
import { resolveSeedLegs } from "./resolveSeedLegs";
import type { BuildReloadRowsArgs, BuildReloadRowsResult } from "./types";

/**
 * Builds scheduled rows, actual rows, and physical-only preserve keys.
 *
 * The function is the public domain entry point for the reload mutation. It
 * applies source precedence by reducing evidence in order: WSF history first,
 * durable trip fields second, current tracking last. Existing physical-only
 * TripKeys are returned with the rows so replacement persistence can preserve
 * absent physical-only actuals.
 *
 * @param args - Reload inputs from WSF, Convex trips, current locations, identity tables, and updatedAt
 * @returns Scheduled rows, actual rows, and physical-only TripKeys to preserve
 */
const buildReloadRows = ({
  sailingDay,
  scheduleSegments,
  historyRecords,
  activeTrips,
  completedTrips,
  vesselLocations,
  vessels,
  terminals,
  updatedAt,
}: BuildReloadRowsArgs): BuildReloadRowsResult => {
  const seedLegs = resolveSeedLegs(scheduleSegments, vessels, terminals);
  const boundaries = buildScheduledBoundaries(seedLegs);
  const scheduledRows = buildScheduledRows(boundaries, updatedAt);
  const actualRows = buildActualRows({
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
  });
  const preserveAbsentTripKeys = buildPreserveAbsentTripKeys(
    activeTrips,
    completedTrips
  );
  const reloadRows = {
    scheduledRows,
    actualRows,
    preserveAbsentTripKeys,
  };

  return reloadRows;
};

export { buildReloadRows };
