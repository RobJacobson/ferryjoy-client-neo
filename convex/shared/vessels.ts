/**
 * Shared vessel resolver utilities against a backend vessel identity snapshot.
 */

export type VesselIdentity = {
  VesselID: number;
  VesselName: string;
  VesselAbbrev: string;
};

/**
 * Resolve a vessel by its backend abbreviation (exact match after trim).
 *
 * @param abbrev - Known abbreviation string (e.g. from `VesselAbbrev` fields)
 * @param vessels - Backend vessel rows to search
 * @returns Matching vessel abbreviation, or `null` when not found
 */
export const resolveVesselAbbrev = (
  abbrev: string,
  vessels: ReadonlyArray<VesselIdentity>
): string | null => {
  const normalized = abbrev.trim();

  if (!normalized) {
    return null;
  }

  const row = vessels.find((vessel) => vessel.VesselAbbrev === normalized);
  return row ? row.VesselAbbrev : null;
};

/**
 * Resolve a vessel by its backend vessel name (exact match after trim).
 *
 * @param name - Known vessel name string (e.g. WSF `Vessel` / schedule `VesselName`)
 * @param vessels - Backend vessel rows to search
 * @returns Matching vessel abbreviation for downstream keys, or `null` when not found
 */
export const resolveVesselName = (
  name: string,
  vessels: ReadonlyArray<VesselIdentity>
): string | null => {
  const normalized = name.trim();

  if (!normalized) {
    return null;
  }

  const row = vessels.find((vessel) => vessel.VesselName === normalized);
  return row ? row.VesselAbbrev : null;
};
