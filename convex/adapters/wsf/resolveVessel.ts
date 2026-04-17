/**
 * WSF-facing vessel lookup helpers against backend vessel snapshots.
 */

import type { VesselIdentity } from "functions/vesselIdentities/schemas";

/**
 * Looks up backend vessel identity by exact `VesselName` (e.g. to read canonical
 * `VesselAbbrev` for a feed vessel name). Returns `null` when the name is blank
 * or missing from the snapshot — use {@link resolveVessel} when a match is
 * required.
 *
 * @param vesselName - Raw vessel name from a WSF payload
 * @param vessels - Backend vessel rows to search
 * @returns Matching identity row, or `null` when not found
 */
export const tryResolveVessel = (
  vesselName: string,
  vessels: ReadonlyArray<VesselIdentity>
): VesselIdentity | null => {
  const normalized = vesselName.trim();

  if (!normalized) {
    return null;
  }

  return vessels.find((vessel) => vessel.VesselName === normalized) ?? null;
};

/**
 * Looks up backend vessel identity by exact `VesselName`, throwing when the name
 * is unknown or blank.
 *
 * @param vesselName - Raw vessel name from a WSF payload
 * @param vessels - Backend vessel rows to search
 * @returns Matching identity row
 * @throws Error when the name is empty or not present in `vessels`
 */
export const resolveVessel = (
  vesselName: string,
  vessels: ReadonlyArray<VesselIdentity>
): VesselIdentity => {
  const resolved = tryResolveVessel(vesselName, vessels);

  if (!resolved) {
    throw new Error(
      `Unknown vessel in backend vessel lookup: ${vesselName.trim() || "(empty)"}`
    );
  }

  return resolved;
};
