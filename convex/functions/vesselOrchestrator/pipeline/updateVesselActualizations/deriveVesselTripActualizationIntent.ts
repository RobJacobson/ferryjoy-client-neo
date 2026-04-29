/**
 * Stage helper for deriving trip actualization intent.
 */

import {
  type DepartNextActualizationIntent,
  deriveDepartNextActualizationIntent,
} from "domain/vesselOrchestration/updateVesselActualizations";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";

/**
 * Derives depart-next actualization intent from one trip update branch.
 *
 * @param tripUpdate - Sparse trip update for the current vessel branch
 * @returns Depart-next actualization intent or `null`
 */
export const deriveVesselTripActualizationIntent = (
  tripUpdate: VesselTripUpdate
): DepartNextActualizationIntent | null =>
  deriveDepartNextActualizationIntent(tripUpdate);
