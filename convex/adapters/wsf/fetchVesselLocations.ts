/**
 * WSF vessel-location boundary adapter.
 *
 * Fetches raw vessel locations from the WSDOT-backed WSF API, resolves each row
 * against backend vessel and terminal identity, and maps to
 * {@link ConvexVesselLocation}. Authentication uses `WSDOT_ACCESS_TOKEN` from
 * the Convex deployment environment (read by `ws-dottie` at package init).
 */

import type { TerminalIdentity } from "functions/terminalIdentities/schemas";
import type { VesselIdentity } from "functions/vesselIdentities/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { dateToEpochMs, optionalDateToEpochMs } from "shared/convertDates";
import { calculateDistanceInMiles } from "shared/distanceUtils";
import { deriveTripIdentity } from "shared/tripIdentity";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";
import { resolveTerminalByAbbrev } from "./resolveTerminal";
import { resolveVessel } from "./resolveVessel";

/**
 * Fetches WSF vessel locations and maps each feed row to Convex storage shape.
 *
 * @param vessels - Backend vessel rows for name → abbreviation lookup
 * @param terminals - Backend terminal rows for terminal normalization and distances
 * @returns Convex vessel locations for every feed row
 * @throws Error when the WSF API returns no locations, or when vessel resolution fails
 */
export const fetchWsfVesselLocations = async (
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): Promise<ConvexVesselLocation[]> => {
  const dottieVesselLocations = await fetchVesselLocations();

  if (dottieVesselLocations.length === 0) {
    throw new Error("No vessel locations received from WSF API");
  }

  return dottieVesselLocations.map((dvl) =>
    toConvexVesselLocation(dvl, vessels, terminals)
  );
};

/**
 * Converts one Dottie vessel location to Convex storage shape. Resolves the
 * vessel exactly once via {@link resolveVessel}.
 *
 * @param dvl - Dottie vessel location with Date objects
 * @param vessels - Backend vessel rows used to resolve the vessel abbreviation
 * @param terminals - Backend terminal rows used to normalize terminal identity
 * @returns Convex vessel location with numeric timestamps
 */
export const toConvexVesselLocation = (
  dvl: DottieVesselLocation,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ConvexVesselLocation => {
  const VesselName = (dvl.VesselName ?? "").trim();
  const rawDepartingTerminalAbbrev = (dvl.DepartingTerminalAbbrev ?? "").trim();
  const rawDepartingTerminalName = (dvl.DepartingTerminalName ?? "").trim();
  const rawArrivingTerminalAbbrev =
    dvl.ArrivingTerminalAbbrev?.trim() ?? undefined;
  const rawArrivingTerminalName = dvl.ArrivingTerminalName?.trim() ?? undefined;
  const resolvedVessel = resolveVessel(VesselName, vessels);
  const resolvedDepartingTerminal = rawDepartingTerminalAbbrev
    ? resolveTerminalByAbbrev(rawDepartingTerminalAbbrev, terminals)
    : null;
  const resolvedArrivingTerminal = rawArrivingTerminalAbbrev
    ? resolveTerminalByAbbrev(rawArrivingTerminalAbbrev, terminals)
    : null;

  if (!rawDepartingTerminalAbbrev) {
    throw new Error(
      "Missing departing terminal abbreviation in vessel location."
    );
  }

  if (!resolvedDepartingTerminal) {
    warnAboutUnknownMarineLocation("departing", rawDepartingTerminalAbbrev);
  }

  if (rawArrivingTerminalAbbrev && !resolvedArrivingTerminal) {
    warnAboutUnknownMarineLocation("arriving", rawArrivingTerminalAbbrev);
  }

  const DepartingTerminalAbbrev =
    resolvedDepartingTerminal?.TerminalAbbrev ?? rawDepartingTerminalAbbrev;
  const ArrivingTerminalAbbrev =
    resolvedArrivingTerminal?.TerminalAbbrev ?? rawArrivingTerminalAbbrev;
  const DepartingTerminalName =
    resolvedDepartingTerminal?.TerminalName ?? rawDepartingTerminalName;
  const ArrivingTerminalName =
    resolvedArrivingTerminal?.TerminalName ?? rawArrivingTerminalName;
  const tripIdentity = deriveTripIdentity({
    vesselAbbrev: resolvedVessel.VesselAbbrev,
    departingTerminalAbbrev: DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: ArrivingTerminalAbbrev,
    scheduledDepartureMs: optionalDateToEpochMs(dvl.ScheduledDeparture),
  });
  const scheduledDepartureMs = optionalDateToEpochMs(dvl.ScheduledDeparture);

  return {
    VesselID: dvl.VesselID,
    VesselName,
    VesselAbbrev: resolvedVessel.VesselAbbrev,
    DepartingTerminalID: dvl.DepartingTerminalID,
    DepartingTerminalName,
    DepartingTerminalAbbrev,
    ArrivingTerminalID: dvl.ArrivingTerminalID ?? undefined,
    ArrivingTerminalName,
    ArrivingTerminalAbbrev,
    Latitude: dvl.Latitude,
    Longitude: dvl.Longitude,
    Speed: dvl.Speed,
    Heading: dvl.Heading,
    InService: dvl.InService,
    AtDock: dvl.AtDock,
    LeftDock: optionalDateToEpochMs(dvl.LeftDock),
    Eta: optionalDateToEpochMs(dvl.Eta),
    ScheduledDeparture: scheduledDepartureMs,
    RouteAbbrev: dvl.OpRouteAbbrev?.[0] ?? undefined,
    VesselPositionNum: dvl.VesselPositionNum ?? undefined,
    TimeStamp: dateToEpochMs(dvl.TimeStamp),
    ScheduleKey: tripIdentity.ScheduleKey,
    DepartingDistance: getDistanceToTerminal(
      dvl.Latitude,
      dvl.Longitude,
      DepartingTerminalAbbrev,
      terminals
    ),
    ArrivingDistance: getDistanceToTerminal(
      dvl.Latitude,
      dvl.Longitude,
      ArrivingTerminalAbbrev,
      terminals
    ),
  };
};

const warnedUnknownMarineLocations = new Set<string>();

/**
 * Measure the vessel's distance from a known terminal when that terminal can be
 * resolved from backend identity data.
 *
 * @param latitude - Vessel latitude in decimal degrees
 * @param longitude - Vessel longitude in decimal degrees
 * @param terminalAbbrev - Terminal abbreviation from the live feed
 * @param terminals - Backend terminal rows used for coordinate lookup
 * @returns Distance in miles, or `undefined` when the terminal cannot be resolved
 */
const getDistanceToTerminal = (
  latitude: number,
  longitude: number,
  terminalAbbrev: string | undefined | null,
  terminals: ReadonlyArray<TerminalIdentity>
): number | undefined => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminal = resolveTerminalByAbbrev(terminalAbbrev, terminals) ?? null;

  return calculateDistanceInMiles(
    latitude,
    longitude,
    terminal?.Latitude,
    terminal?.Longitude
  );
};

/**
 * Warn once per role/terminal pair when the live feed references a marine
 * location missing from backend terminal identity data.
 *
 * @param role - Whether the unresolved terminal is departing or arriving
 * @param terminalAbbrev - Unknown terminal abbreviation from the live feed
 * @returns `undefined` after the one-time warning check completes
 */
const warnAboutUnknownMarineLocation = (
  role: "departing" | "arriving",
  terminalAbbrev: string
) => {
  const key = `${role}:${terminalAbbrev.toUpperCase()}`;

  if (warnedUnknownMarineLocations.has(key)) {
    return;
  }

  warnedUnknownMarineLocations.add(key);
  console.warn(
    `[vesselLocation] Unknown ${role} marine location in backend terminal lookup: ${terminalAbbrev}`
  );
};
