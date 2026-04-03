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
 * Prefer raw vessel-location state whenever it exists. Active trip state is a
 * fallback for cases where the live location row is temporarily unavailable.
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
  const atDock = location?.AtDock ?? activeTrip?.AtDock;
  if (atDock === undefined) {
    return null;
  }

  const tripKey =
    location?.Key ??
    activeTrip?.Key ??
    (atDock ? (inferredDockedTripKey ?? undefined) : undefined);

  if (!tripKey) {
    return null;
  }

  const rowId = buildRowId(tripKey, atDock ? "at-dock" : "at-sea");
  if (atDock) {
    const terminalTailRow = rows.find(
      (row) =>
        row.kind === "at-dock" &&
        row.rowEdge === "terminal-tail" &&
        row.tripKey === tripKey
    );

    if (terminalTailRow) {
      return terminalTailRow.rowId;
    }
  }

  return rows.find((row) => row.rowId === rowId)?.rowId ?? null;
};
