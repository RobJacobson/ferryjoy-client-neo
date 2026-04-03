/**
 * Resolves the backend-owned active VesselTimeline row from live identity.
 */

import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type { ConvexVesselTimelineRow } from "../../functions/vesselTimeline/schemas";
import { buildRowId } from "./rows";

/**
 * Resolves the active row ID from live vessel-location state.
 *
 * The timeline read path intentionally trusts `vesselLocations` as its only
 * live source. When the live row is missing, or when a keyless at-sea vessel
 * cannot be attached to a stable trip key, the read model returns `null`.
 *
 * @param args - Rows plus authoritative live identity inputs
 * @returns Stable active row ID, or `null` when none can be resolved
 */
export const resolveActiveRowId = ({
  rows,
  location,
  inferredDockedTripKey,
}: {
  rows: ConvexVesselTimelineRow[];
  location: ConvexVesselLocation | null;
  inferredDockedTripKey?: string | null;
}) => {
  if (!location) {
    return null;
  }

  const tripKey =
    location.Key ??
    (location.AtDock ? (inferredDockedTripKey ?? undefined) : undefined);

  if (!tripKey) {
    return null;
  }

  const rowId = buildRowId(tripKey, location.AtDock ? "at-dock" : "at-sea");
  if (location.AtDock) {
    const terminalTailRow = rows.find(
      (row) =>
        row.kind === "at-dock" &&
        row.rowEdge === "terminal-tail" &&
        row.tripKey === tripKey &&
        row.endEvent.TerminalAbbrev === location.DepartingTerminalAbbrev
    );

    if (terminalTailRow) {
      // Terminal tails only win when the live docked terminal matches the
      // final arrival terminal for that trip key.
      return terminalTailRow.rowId;
    }
  }

  return rows.find((row) => row.rowId === rowId)?.rowId ?? null;
};
