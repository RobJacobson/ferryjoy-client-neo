/**
 * Leave-dock ML patch payload for `eventsPredicted` depart-next rows.
 *
 * Bridges one ping's sparse trip update to downstream prediction maintenance:
 * when `updateVesselTrip` records a leave-dock transition with
 * `LeftDockActual`, persistence stamps `Actual` / `DeltaTotal` on
 * AtDockDepartNext and AtSeaDepartNext ML rows for that leg's dep-dock key.
 * A null result from the exported function means skip patching: missing
 * evidence, no schedule key, or not the leave-dock edge ping.
 */

import {
  currentTripDockEvents,
  type VesselTripUpdate,
} from "domain/vesselOrchestration/updateVesselTrip";
import { buildBoundaryKey } from "shared/keys";
import { floorToSecond } from "shared/time";

/**
 * Arguments forwarded through `persistVesselUpdates` to patch prediction rows.
 */
export type UpdateLeaveDockEventPatch = {
  vesselAbbrev: string;
  depBoundaryKey: string;
  actualDepartMs: number;
};

/**
 * Derives leave-dock ML patch inputs from one sparse trip update, or null.
 *
 * Produces a payload only when this ping is the at-dock→at-sea crossing,
 * `LeftDockActual` is set, and `ScheduleKey` can build a stable dep-dock key.
 * Otherwise returns null so the orchestrator does not re-patch on routine
 * at-sea location ticks. Non-null results flow to `patchDepartNextMlRowsForDepBoundary` in
 * the same `persistVesselUpdates` transaction as trip and timeline writes.
 *
 * @param tripUpdate - Sparse trip delta from `updateVesselTrip` for this ping
 * @returns `UpdateLeaveDockEventPatch` for `eventsPredicted` ML rows, or `null`
 */
export const updateLeaveDockEventPatch = (
  tripUpdate: VesselTripUpdate
): UpdateLeaveDockEventPatch | null => {
  const activeTrip = tripUpdate.activeVesselTrip;
  const leftDockActual = activeTrip.LeftDockActual;
  // Require departure instant and schedule key to target dep-dock ML rows.
  if (leftDockActual === undefined || !activeTrip.ScheduleKey) {
    return null;
  }

  // Restrict to leave-dock edge pings so routine at-sea ticks do not re-patch.
  const { didJustLeaveDock } = currentTripDockEvents(
    tripUpdate.existingVesselTrip,
    activeTrip
  );
  if (!didJustLeaveDock) {
    return null;
  }

  // Emit dep-dock key and normalized depart instant for ML row patchers.
  return {
    vesselAbbrev: tripUpdate.vesselAbbrev,
    depBoundaryKey: buildBoundaryKey(activeTrip.ScheduleKey, "dep-dock"),
    actualDepartMs: floorToSecond(leftDockActual),
  };
};
