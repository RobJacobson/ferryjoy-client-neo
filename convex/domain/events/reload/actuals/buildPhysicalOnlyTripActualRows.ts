/**
 * Builds actual dock rows from physical-only trip evidence.
 *
 * Completed and active trips can carry direct observed dock times even when
 * they are not aligned to a scheduled segment. This module turns those trip
 * fields into normalized eventsActual rows before live-location fallback runs.
 */

import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { buildActualDockEventFromWrite } from "../../actual";
import type { ReloadTripForActuals } from "../types";
import { buildPhysicalOnlyTripPatch } from "./utils";

/**
 * Builds actual dock rows for all physical-only trips that have TripKeys.
 *
 * This is the trip-evidence physical-only stage of reload actual assembly.
 * It emits rows from durable trip fields before live-location reconciliation
 * so later fallback logic can treat these boundaries as already represented.
 *
 * @param trips - Merged active and completed trips for the sailing day
 * @param updatedAt - UpdatedAt stamp for persisted rows
 * @returns Flat list of dep and arv actual rows across trips
 */
const buildPhysicalOnlyTripActualRows = (
  trips: ReloadTripForActuals[],
  updatedAt: number
): ConvexActualDockEvent[] =>
  trips
    .filter(isPhysicalOnlyTripWithTripKey)
    .flatMap((trip) => buildPhysicalOnlyActualRowsForTrip(trip, updatedAt));

/**
 * Builds zero to two actual rows for one physical-only trip when dep or arv
 * evidence exists.
 *
 * @param trip - Physical-only trip with TripKey
 * @param updatedAt - UpdatedAt stamp for Convex rows
 * @returns Dep row, arv row, or both, in that order when present
 */
const buildPhysicalOnlyActualRowsForTrip = (
  trip: ReloadTripForActuals & { TripKey: string },
  updatedAt: number
): ConvexActualDockEvent[] =>
  [
    trip.LeftDockActual === undefined
      ? null
      : buildPhysicalOnlyActualRow(
          trip,
          trip.DepartingTerminalAbbrev,
          "dep-dock",
          trip.LeftDockActual,
          updatedAt
        ),
    trip.TripEnd === undefined || trip.ArrivingTerminalAbbrev === undefined
      ? null
      : buildPhysicalOnlyActualRow(
          trip,
          trip.ArrivingTerminalAbbrev,
          "arv-dock",
          trip.TripEnd,
          updatedAt
        ),
  ].filter((row): row is ConvexActualDockEvent => row !== null);

/**
 * Builds one normalized row for a physical-only trip boundary.
 *
 * @param trip - Physical-only trip with TripKey
 * @param terminalAbbrev - Terminal for this dep or arv row
 * @param eventType - dep-dock or arv-dock
 * @param eventActualTime - Observed time in epoch ms
 * @param updatedAt - UpdatedAt stamp for the Convex row
 * @returns Normalized eventsActual row
 */
const buildPhysicalOnlyActualRow = (
  trip: ReloadTripForActuals & { TripKey: string },
  terminalAbbrev: string,
  eventType: DockEventType,
  eventActualTime: number,
  updatedAt: number
): ConvexActualDockEvent =>
  buildActualDockEventFromWrite(
    buildPhysicalOnlyTripPatch(
      trip,
      terminalAbbrev,
      eventType,
      eventActualTime
    ),
    updatedAt
  );

/**
 * True when the trip is physical-only and carries a TripKey for actual rows.
 *
 * @param trip - Active or completed trip row from reload indexes
 * @returns Type guard narrowing TripKey to string when true
 */
const isPhysicalOnlyTripWithTripKey = (
  trip: ReloadTripForActuals
): trip is ReloadTripForActuals & { TripKey: string } =>
  trip.TripKey !== undefined && trip.ScheduleKey === undefined;

export { buildPhysicalOnlyTripActualRows };
