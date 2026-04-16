/**
 * Defines shared Convex vessel-location validators and conversions.
 */

import {
  resolveTerminalByAbbrev,
  resolveVessel,
  type TerminalIdentity,
  type VesselIdentity,
} from "adapters/wsf";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import {
  dateToEpochMs,
  epochMsToDate,
  optionalDateToEpochMs,
  optionalEpochMsToDate,
} from "../../shared/convertDates";
import { calculateDistanceInMiles } from "../../shared/distanceUtils";
import { deriveTripIdentity } from "../../shared/tripIdentity";

/**
 * Shared field validators for vessel-location storage.
 * Used to build the live and historic vessel-location schemas.
 */
const vesselLocationBaseValidationFields = {
  VesselID: v.number(),
  VesselName: v.string(),
  VesselAbbrev: v.string(),
  DepartingTerminalID: v.number(),
  DepartingTerminalName: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalID: v.optional(v.number()),
  ArrivingTerminalName: v.optional(v.string()),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  Latitude: v.number(),
  Longitude: v.number(),
  Speed: v.number(),
  Heading: v.number(),
  InService: v.boolean(),
  AtDock: v.boolean(),
  LeftDock: v.optional(v.number()),
  Eta: v.optional(v.number()),
  ScheduledDeparture: v.optional(v.number()),
  RouteAbbrev: v.optional(v.string()),
  VesselPositionNum: v.optional(v.number()),
  TimeStamp: v.number(),
} as const;

/**
 * Stored vessel-location fields, including derived terminal distances.
 */
export const vesselLocationValidationFields = {
  ...vesselLocationBaseValidationFields,
  /** Feed-derived schedule segment composite (not physical trip identity). */
  ScheduleKey: v.optional(v.string()),
  DepartingDistance: v.optional(v.number()),
  ArrivingDistance: v.optional(v.number()),
} as const;

/**
 * Convex validator for vessel locations (numbers)
 * This is used in defineTable and function argument validation
 */
export const vesselLocationValidationSchema = v.object(
  vesselLocationValidationFields
);

/**
 * Type for vessel location in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;

/**
 * Convert a Dottie vessel location to a convex vessel location.
 * Manual conversion from Date objects to epoch milliseconds.
 * `VesselAbbrev` is resolved against the backend vessel table.
 *
 * @param dvl - Dottie vessel location with Date objects
 * @param vessels - Backend vessel rows used to resolve the vessel abbreviation
 * @param terminals - Backend terminal rows used to normalize terminal identity
 * @returns Convex vessel location with numeric timestamps
 */
export function toConvexVesselLocation(
  dvl: DottieVesselLocation,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ConvexVesselLocation {
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

  if (!resolvedVessel) {
    throw new Error(`Unknown vessel in backend vessel lookup: ${VesselName}`);
  }

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
    resolvedDepartingTerminal?.TerminalName ??
    rawDepartingTerminalName ??
    rawDepartingTerminalAbbrev;
  const ArrivingTerminalName =
    resolvedArrivingTerminal?.TerminalName ??
    rawArrivingTerminalName ??
    rawArrivingTerminalAbbrev;
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
    Speed: dvl.Speed < 0.2 ? 0 : dvl.Speed,
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
}

/**
 * Convert Convex vessel location (numbers) to domain vessel location (Dates).
 * Manual conversion from epoch milliseconds to Date objects.
 * @param cvl - Convex vessel location with numeric timestamps
 * @returns Domain vessel location with Date objects
 */
export const toDomainVesselLocation = (cvl: ConvexVesselLocation) => ({
  ...cvl,
  LeftDock: optionalEpochMsToDate(cvl.LeftDock),
  Eta: optionalEpochMsToDate(cvl.Eta),
  ScheduledDeparture: optionalEpochMsToDate(cvl.ScheduledDeparture),
  TimeStamp: epochMsToDate(cvl.TimeStamp),
});

/**
 * Type for vessel location in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type VesselLocation = ReturnType<typeof toDomainVesselLocation>;

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

const warnedUnknownMarineLocations = new Set<string>();

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
