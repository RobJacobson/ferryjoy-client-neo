/**
 * Resolves the backend-owned active VesselTimeline row from live identity.
 */

import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type { ConvexVesselTimelineRow } from "../../functions/vesselTimeline/schemas";
import type { ConvexVesselTrip } from "../../functions/vesselTrips/schemas";
import { buildRowId } from "./rows";

/**
 * Resolves the active row ID from live trip and location state.
 *
 * @param args - Rows plus authoritative live identity inputs
 * @returns Stable active row ID, or `null` when none can be resolved
 */
export const resolveActiveRowId = ({
  rows,
  location,
  activeTrip,
  inferredDockedTripKey,
}: {
  rows: ConvexVesselTimelineRow[];
  location: ConvexVesselLocation | null;
  activeTrip: ConvexVesselTrip | null;
  inferredDockedTripKey?: string | null;
}) => {
  const atDock = activeTrip?.AtDock ?? location?.AtDock;
  if (atDock === undefined) {
    return null;
  }

  const tripKey =
    activeTrip?.Key ??
    location?.Key ??
    (atDock ? (inferredDockedTripKey ?? undefined) : undefined);

  if (!tripKey) {
    return null;
  }

  const rowId = buildRowId(tripKey, atDock ? "at-dock" : "at-sea");
  return rows.some((row) => row.rowId === rowId) ? rowId : null;
};
