/**
 * Resolve trip identity subsets for reload actual rows.
 *
 * Separates raw active and completed reload trips from the keyed views needed
 * by boundary indexing and source phases. The rest of the actual-row
 * pipeline can then assume persisted trip identity is present.
 */

import type { ReloadTripInput, ReloadTripWithTripKey } from "./types";

type ActualTripScope = {
  tripsWithKeys: ReloadTripWithTripKey[];
  activeTripsWithKeys: ReloadTripWithTripKey[];
};

/**
 * Resolves active and completed trips into the keyed subsets actual rows need.
 *
 * Active trips are retained separately because physical-only tracking should
 * only infer rows for trips still in progress. Completed keyed trips remain in
 * the combined scope so durable physical fields can still produce rows.
 *
 * @param activeTrips - Active trip rows from reload input
 * @param completedTrips - Completed trip rows from reload input
 * @returns Keyed active trips and keyed active-plus-completed trips
 */
const resolveActualTripScope = (
  activeTrips: ReloadTripInput[],
  completedTrips: ReloadTripInput[]
): ActualTripScope => ({
  tripsWithKeys: [...activeTrips, ...completedTrips].filter(isTripWithTripKey),
  activeTripsWithKeys: activeTrips.filter(isTripWithTripKey),
});

/**
 * Returns whether a reload trip carries persisted trip identity.
 *
 * @param trip - Reload trip input from active or completed trip storage
 * @returns True when the trip has a TripKey usable for actual rows
 */
const isTripWithTripKey = (
  trip: ReloadTripInput
): trip is ReloadTripWithTripKey => trip.TripKey !== undefined;

export type { ActualTripScope };
export { isTripWithTripKey, resolveActualTripScope };
