/**
 * Shared trip evidence checks for updateVesselTrip lifecycle and row building.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Checks whether a trip has enough evidence to count as an actual trip.
 *
 * @param trip - Active trip row to inspect
 * @returns True when any meaningful lifecycle timestamp exists
 */
export const hasTripEvidence = (
  trip: ConvexVesselTrip | undefined
): trip is ConvexVesselTrip =>
  Boolean(
    trip &&
      (trip.LeftDockActual !== undefined ||
        trip.ArrivedNextActual !== undefined ||
        trip.LeftDock !== undefined ||
        trip.ArriveDest !== undefined)
  );
