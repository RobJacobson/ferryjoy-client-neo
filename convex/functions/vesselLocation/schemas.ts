/**
 * Defines shared Convex vessel-location validators and conversions.
 */
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
import type {
  TerminalAbbrev,
  TerminalName,
  VesselAbbrev,
} from "../../shared/identity";
import { resolveVessel, type VesselIdentity } from "../../shared/vessels";
import { resolveTerminal, type TerminalIdentity } from "../terminals/resolver";

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
 * Vessel location whose vessel abbreviation has been resolved against the
 * backend vessel table.
 */
export type ResolvedVesselLocation = Omit<
  ConvexVesselLocation,
  | "VesselAbbrev"
  | "DepartingTerminalAbbrev"
  | "DepartingTerminalName"
  | "ArrivingTerminalAbbrev"
  | "ArrivingTerminalName"
> & {
  VesselAbbrev: VesselAbbrev;
  DepartingTerminalAbbrev: TerminalAbbrev;
  DepartingTerminalName: TerminalName;
  ArrivingTerminalAbbrev?: TerminalAbbrev;
  ArrivingTerminalName?: TerminalName;
};

/**
 * Convert a Dottie vessel location to a convex vessel location.
 * Manual conversion from Date objects to epoch milliseconds.
 * @param dvl - Dottie vessel location with Date objects
 * @param vessels - Backend vessel rows used to resolve the vessel abbreviation
 * @returns Convex vessel location with numeric timestamps
 */
export function toConvexVesselLocation(
  dvl: DottieVesselLocation,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ResolvedVesselLocation {
  const VesselName = (dvl.VesselName ?? "").trim();
  const rawDepartingTerminalAbbrev = (dvl.DepartingTerminalAbbrev ?? "").trim();
  const rawArrivingTerminalAbbrev =
    dvl.ArrivingTerminalAbbrev?.trim() ?? undefined;
  const resolvedVessel = resolveVessel({ VesselName }, vessels);
  const resolvedDepartingTerminal = rawDepartingTerminalAbbrev
    ? resolveTerminal({ TerminalAbbrev: rawDepartingTerminalAbbrev }, terminals)
    : null;
  const resolvedArrivingTerminal = rawArrivingTerminalAbbrev
    ? resolveTerminal({ TerminalAbbrev: rawArrivingTerminalAbbrev }, terminals)
    : null;

  if (!resolvedVessel) {
    throw new Error(`Unknown vessel in backend vessel lookup: ${VesselName}`);
  }

  if (!resolvedDepartingTerminal) {
    throw new Error(
      `Unknown departing terminal in backend terminal lookup: ${rawDepartingTerminalAbbrev}`
    );
  }

  const DepartingTerminalAbbrev = resolvedDepartingTerminal.TerminalAbbrev;
  const ArrivingTerminalAbbrev = resolvedArrivingTerminal?.TerminalAbbrev;
  const DepartingTerminalName = resolvedDepartingTerminal.TerminalName;
  const ArrivingTerminalName = resolvedArrivingTerminal?.TerminalName;

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
    ScheduledDeparture: optionalDateToEpochMs(dvl.ScheduledDeparture),
    RouteAbbrev: dvl.OpRouteAbbrev?.[0] ?? undefined,
    VesselPositionNum: dvl.VesselPositionNum ?? undefined,
    TimeStamp: dateToEpochMs(dvl.TimeStamp),
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

const getDistanceToTerminal = (
  latitude: number,
  longitude: number,
  terminalAbbrev: string | undefined | null,
  terminals: ReadonlyArray<TerminalIdentity>
): number | undefined => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminal =
    resolveTerminal({ TerminalAbbrev: terminalAbbrev }, terminals) ?? null;

  return calculateDistanceInMiles(
    latitude,
    longitude,
    terminal?.Latitude,
    terminal?.Longitude
  );
};
