/**
 * WSF-facing vessel lookup helpers against backend vessel snapshots.
 */

export type VesselIdentity = {
  VesselID: number;
  VesselName: string;
  VesselAbbrev: string;
};

/**
 * Resolves a vessel by its exact backend vessel name.
 *
 * @param vesselName - Raw vessel name from a WSF payload
 * @param vessels - Backend vessel rows to search
 * @returns Matching vessel row, or `null` when not found
 */
export const resolveVessel = (
  vesselName: string,
  vessels: ReadonlyArray<VesselIdentity>
): VesselIdentity | null => {
  const normalized = vesselName.trim();

  if (!normalized) {
    return null;
  }

  return vessels.find((vessel) => vessel.VesselName === normalized) ?? null;
};
