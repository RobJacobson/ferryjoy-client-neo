/**
 * Pure helpers for leave-dock depart-next actualization.
 *
 * @see persistVesselTripWriteSet - production path filters by `successfulVessels`
 * before calling mutations; this helper only extracts the timestamp.
 */

import type { PendingLeaveDockEffect } from "domain/vesselOrchestration/updateVesselTrips";

/**
 * Epoch ms passed to `setDepartNextActualsForMostRecentCompletedTrip` for a
 * pending leave-dock effect, or `undefined` when the effect should be skipped.
 */
export const actualDepartMsForLeaveDockEffect = (
  effect: PendingLeaveDockEffect
): number | undefined => effect.trip.LeftDockActual ?? effect.trip.LeftDock;
