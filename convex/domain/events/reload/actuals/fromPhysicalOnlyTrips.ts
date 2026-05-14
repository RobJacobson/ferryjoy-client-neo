/**
 * Projects durable physical-only trip fields into actual dock rows.
 *
 * Physical-only trips have no scheduled boundary to anchor onto, so reload
 * derives departure and arrival rows from the trip's own LeftDockActual and
 * TripEnd fields. The rows emitted here represent the strongest evidence the
 * actuals pipeline can produce for these trips and run before any live-ping
 * fallbacks.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { buildActualDockEventFromWrite } from "../../actual";
import { collectRows, definedRows } from "../collectionHelpers";
import type { ReloadTripWithTripKey } from "../types";
import { buildPhysicalOnlyActualWrite } from "./context";

/**
 * Builds actual rows from physical-only trip fields.
 *
 * Iterates physical-only trips and emits up to two rows each (departure and
 * arrival) by reading the trip's own observed timestamps. Missing fields cause
 * the corresponding row to be skipped so the actuals set never carries
 * inferred timestamps.
 *
 * @param updatedAt - UpdatedAt stamp for the produced rows
 * @param physicalOnlyTrips - Physical-only trips with TripKey evidence
 * @returns Actual rows from durable trip departure and arrival fields
 */
const buildPhysicalOnlyTripActualRows = (
  updatedAt: number,
  physicalOnlyTrips: ReloadTripWithTripKey[]
): ConvexActualDockEvent[] => {
  const actualDockRowsFromPhysicalOnlyTrips = collectRows(
    physicalOnlyTrips,
    (trip) =>
      definedRows([
        buildPhysicalOnlyTripDepartureRow(trip, updatedAt),
        buildPhysicalOnlyTripArrivalRow(trip, updatedAt),
      ])
  );

  return actualDockRowsFromPhysicalOnlyTrips;
};

/**
 * Builds one departure actual row from physical-only trip departure evidence when present.
 *
 * @param trip - Physical-only trip carrying TripKey and departing terminal
 * @param updatedAt - UpdatedAt stamp for the produced row
 * @returns Actual row or undefined when LeftDockActual is missing
 */
const buildPhysicalOnlyTripDepartureRow = (
  trip: ReloadTripWithTripKey,
  updatedAt: number
): ConvexActualDockEvent | undefined => {
  if (trip.LeftDockActual === undefined) {
    return undefined;
  }

  const physicalOnlyDepartureWrite = buildPhysicalOnlyActualWrite(
    trip,
    trip.DepartingTerminalAbbrev,
    "dep-dock",
    trip.LeftDockActual
  );
  const departureActualDockRow = buildActualDockEventFromWrite(
    physicalOnlyDepartureWrite,
    updatedAt
  );

  return departureActualDockRow;
};

/**
 * Builds one arrival actual row from physical-only trip end evidence when present.
 *
 * @param trip - Physical-only trip carrying TripKey and arriving terminal
 * @param updatedAt - UpdatedAt stamp for the produced row
 * @returns Actual row or undefined when TripEnd or arriving terminal is missing
 */
const buildPhysicalOnlyTripArrivalRow = (
  trip: ReloadTripWithTripKey,
  updatedAt: number
): ConvexActualDockEvent | undefined => {
  if (trip.TripEnd === undefined || trip.ArrivingTerminalAbbrev === undefined) {
    return undefined;
  }

  const physicalOnlyArrivalWrite = buildPhysicalOnlyActualWrite(
    trip,
    trip.ArrivingTerminalAbbrev,
    "arv-dock",
    trip.TripEnd
  );
  const arrivalActualDockRow = buildActualDockEventFromWrite(
    physicalOnlyArrivalWrite,
    updatedAt
  );

  return arrivalActualDockRow;
};

export { buildPhysicalOnlyTripActualRows };
