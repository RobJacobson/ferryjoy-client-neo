/**
 * WSF vessel-identity boundary adapter.
 *
 * Wraps {@link fetchVesselBasics} and maps feed rows to {@link VesselIdentity}
 * for the backend snapshot.
 */

import type { VesselIdentity } from "functions/vessels/schemas";
import {
  fetchVesselBasics,
  type VesselBasic,
} from "ws-dottie/wsf-vessels/core";

type VesselBasicWithIdentity = VesselBasic & {
  VesselName: string;
  VesselAbbrev: string;
};

/**
 * Fetches WSF vessel basics and maps rows with required identity fields into
 * backend snapshot shapes.
 *
 * @returns Trimmed `VesselIdentity` rows ready for persistence
 */
export const fetchWsfVesselIdentities = async (): Promise<
  Array<VesselIdentity>
> => {
  const fetchedVessels = await fetchVesselBasics();
  return fetchedVessels.filter(hasVesselIdentity).map(toBackendVessel);
};

/**
 * Narrow raw WSF vessel basics to rows that contain the identity fields
 * required for the backend vessel table.
 *
 * @param vessel - Raw WSF vessel basics row
 * @returns True when the row contains both vessel name and abbreviation
 */
const hasVesselIdentity = (
  vessel: VesselBasic
): vessel is VesselBasicWithIdentity =>
  Boolean(vessel.VesselName && vessel.VesselAbbrev);

/**
 * Maps one WSF vessel basics row into the backend vessel snapshot shape.
 *
 * @param vessel - WSF vessel basics row with required identity fields
 * @returns Backend vessel snapshot row ready for persistence
 */
const toBackendVessel = (vessel: VesselBasicWithIdentity): VesselIdentity => ({
  VesselID: vessel.VesselID,
  VesselName: vessel.VesselName.trim(),
  VesselAbbrev: vessel.VesselAbbrev.trim(),
});
