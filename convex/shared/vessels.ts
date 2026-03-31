/**
 * Shared vessel selector and resolver utilities.
 */

import {
  toVesselAbbrev,
  toVesselName,
  type VesselAbbrev,
  type VesselName,
} from "./identity";

export type VesselIdentity = {
  VesselID: number;
  VesselName: string;
  VesselAbbrev: string;
};

export type ResolvedVessel = {
  VesselID: number;
  VesselName: VesselName;
  VesselAbbrev: VesselAbbrev;
};

export type VesselSelector =
  | { VesselAbbrev: string }
  | { VesselID: number }
  | { VesselName: string };

/**
 * Resolve a vessel from the backend vessel identity snapshot.
 *
 * @param selector - Exactly one vessel identifier field to match
 * @param vessels - Backend vessel rows to search
 * @returns Matching vessel row, or `null` when not found
 */
export const resolveVessel = (
  selector: VesselSelector,
  vessels: ReadonlyArray<VesselIdentity>
): ResolvedVessel | null => {
  if ("VesselAbbrev" in selector) {
    return toResolvedVessel(
      vessels.find((vessel) => vessel.VesselAbbrev === selector.VesselAbbrev) ??
        null
    );
  }

  if ("VesselID" in selector) {
    return toResolvedVessel(
      vessels.find((vessel) => vessel.VesselID === selector.VesselID) ?? null
    );
  }

  return toResolvedVessel(
    vessels.find((vessel) => vessel.VesselName === selector.VesselName) ?? null
  );
};

/**
 * Resolve a vessel abbreviation from a raw vessel name or abbreviation.
 *
 * @param value - Raw vessel identifier from WSF
 * @param vessels - Backend vessel rows to search
 * @returns Resolved vessel abbreviation, or `null` when not found
 */
export const resolveVesselAbbrev = (
  value: string,
  vessels: ReadonlyArray<VesselIdentity>
): VesselAbbrev | null => {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return (
    resolveVessel({ VesselAbbrev: normalized }, vessels)?.VesselAbbrev ??
    resolveVessel({ VesselName: normalized }, vessels)?.VesselAbbrev ??
    null
  );
};

/**
 * Convert a raw backend vessel row into the branded resolved form.
 *
 * @param vessel - Raw backend vessel row
 * @returns Branded resolved vessel, or `null` when no row was provided
 */
const toResolvedVessel = (
  vessel: VesselIdentity | null
): ResolvedVessel | null =>
  vessel
    ? {
        VesselID: vessel.VesselID,
        VesselName: toVesselName(vessel.VesselName),
        VesselAbbrev: toVesselAbbrev(vessel.VesselAbbrev),
      }
    : null;
