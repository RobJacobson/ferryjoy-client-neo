/**
 * WSF vessel-ping boundary adapter.
 *
 * Entry point: {@link fetchInServiceWsfVesselPings}. It loads live positions via
 * {@link fetchVesselLocations}, keeps only rows with `InService`, resolves each
 * feed `VesselName` to a canonical `VesselAbbrev` with {@link resolveVessel}, and
 * maps matches into {@link ConvexVesselPing} rows (rounded coordinates, epoch
 * `TimeStamp`).
 *
 * Authentication uses `WSDOT_ACCESS_TOKEN` from the Convex deployment
 * environment (read by `ws-dottie` at package init).
 */

import type { VesselIdentity } from "functions/vesselIdentities/schemas";
import type { ConvexVesselPing } from "functions/vesselPings/schemas";
import { dateToEpochMs } from "shared/convertDates";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";
import { resolveVessel } from "./resolveVessel";

/**
 * Fetches live WSF positions and returns Convex vessel ping rows for in-service
 * vessels only.
 *
 * @param vesselIdentities - Backend rows for exact `VesselName` → `VesselAbbrev`
 *   lookup (see {@link resolveVessel})
 * @returns Stored-shape pings for in-service feed rows
 * @throws Error when the WSF API returns an empty location list, or when a feed
 *   vessel name does not match any backend identity
 */
export const fetchInServiceWsfVesselPings = async (
  vesselIdentities: ReadonlyArray<VesselIdentity>
): Promise<ConvexVesselPing[]> => {
  const dottieVesselLocations = await fetchVesselLocations();

  if (dottieVesselLocations.length === 0) {
    throw new Error("No vessel locations received from WSF API");
  }

  return dottieVesselLocations
    .filter((dvl) => dvl.InService)
    .map(mapDottieLocationToConvexPing(vesselIdentities));
};

/**
 * Curries vessel identities into a mapper from one WSF location to a ping row.
 * Vessel resolution throws when the feed name is unknown (see {@link resolveVessel}).
 *
 * @param vesselIdentities - Backend rows used to resolve `VesselAbbrev` from
 *   feed `VesselName` (normalization is handled inside {@link resolveVessel})
 * @returns Mapper from one Dottie vessel location to a {@link ConvexVesselPing}
 */
const mapDottieLocationToConvexPing =
  (vesselIdentities: ReadonlyArray<VesselIdentity>) =>
  (dvl: DottieVesselLocation): ConvexVesselPing => {
    const VesselName = dvl.VesselName ?? "";
    const resolvedVessel = resolveVessel(VesselName, vesselIdentities);

    return {
      VesselAbbrev: resolvedVessel.VesselAbbrev,
      Latitude: Math.round(dvl.Latitude * 10000) / 10000,
      Longitude: Math.round(dvl.Longitude * 10000) / 10000,
      Speed: dvl.Speed,
      Heading: dvl.Heading,
      AtDock: dvl.AtDock,
      TimeStamp: dateToEpochMs(dvl.TimeStamp),
    };
  };
