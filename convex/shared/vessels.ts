/**
 * Shared vessel selector and resolver utilities.
 */

export type VesselIdentity = {
  VesselID: number;
  VesselName: string;
  VesselAbbrev: string;
};

export type VesselSelector =
  | { VesselAbbrev: string }
  | { VesselID: number }
  | { VesselName: string };

/**
 * Resolve a vessel from a canonical vessel snapshot.
 *
 * @param selector - Exactly one vessel identifier field to match
 * @param vessels - Canonical vessel rows to search
 * @returns Matching vessel row, or `null` when not found
 */
export const resolveVessel = (
  selector: VesselSelector,
  vessels: ReadonlyArray<VesselIdentity>
): VesselIdentity | null => {
  if ("VesselAbbrev" in selector) {
    return (
      vessels.find(
        (vessel) => vessel.VesselAbbrev === selector.VesselAbbrev
      ) ?? null
    );
  }

  if ("VesselID" in selector) {
    return (
      vessels.find((vessel) => vessel.VesselID === selector.VesselID) ?? null
    );
  }

  return (
    vessels.find((vessel) => vessel.VesselName === selector.VesselName) ?? null
  );
};
