import type { VesselLocation as VesselLocationDottie } from "ws-dottie/wsf-vessels";
import type { DateFieldsToDate } from "../transformers";
import { toDomain, toStorage } from "../transformers";

/**
 * Storage representation used by Convex schemas.
 */
export type StoredVesselLocation = {
  VesselID: number;
  VesselName: string;
  DepartingTerminalID: number;
  DepartingTerminalName: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalID?: number;
  ArrivingTerminalName?: string;
  ArrivingTerminalAbbrev?: string;
  Latitude: number;
  Longitude: number;
  Speed: number;
  Heading: number;
  InService: boolean;
  AtDock: boolean;
  LeftDock?: number;
  Eta?: number;
  ScheduledDeparture?: number;
  OpRouteAbbrev?: string;
  VesselPositionNum?: number;
  TimeStamp: number;
};

// Define date fields as a const array - TypeScript will infer the union type
const DATE_FIELDS = [
  "LeftDock",
  "Eta",
  "ScheduledDeparture",
  "TimeStamp",
] as const;

// Extract the union type from the const array
type VesselLocationDateFields = (typeof DATE_FIELDS)[number];

/**
 * Domain model for vessel location with Dates and nullable fields.
 * Generated from storage type with proper null handling and Date objects
 */
export type VesselLocation = DateFieldsToDate<
  StoredVesselLocation,
  VesselLocationDateFields
>;

/**
 * Converts a raw ws-dottie VesselLocation into the domain shape.
 * Drops unused metadata fields and flattens OpRouteAbbrev to a single value.
 */
export const toVesselLocation = (vl: VesselLocationDottie): VesselLocation => {
  const { EtaBasis, SortSeq, ManagedBy, Mmsi, ...raw } = vl;
  const opRouteAbbrev = raw.OpRouteAbbrev?.[0] ?? null;

  return {
    VesselID: raw.VesselID,
    VesselName: raw.VesselName ?? "",
    DepartingTerminalID: raw.DepartingTerminalID,
    DepartingTerminalName: raw.DepartingTerminalName ?? "",
    DepartingTerminalAbbrev: raw.DepartingTerminalAbbrev ?? "",
    ArrivingTerminalID: raw.ArrivingTerminalID ?? null,
    ArrivingTerminalName: raw.ArrivingTerminalName ?? null,
    ArrivingTerminalAbbrev: raw.ArrivingTerminalAbbrev ?? null,
    Latitude: raw.Latitude,
    Longitude: raw.Longitude,
    Speed: raw.Speed,
    Heading: raw.Heading,
    InService: raw.InService ?? false,
    AtDock: raw.AtDock ?? false,
    LeftDock: raw.LeftDock ? new Date(raw.LeftDock) : null,
    Eta: raw.Eta ? new Date(raw.Eta) : null,
    ScheduledDeparture: raw.ScheduledDeparture
      ? new Date(raw.ScheduledDeparture)
      : null,
    OpRouteAbbrev: opRouteAbbrev,
    VesselPositionNum: raw.VesselPositionNum ?? null,
    TimeStamp: raw.TimeStamp ? new Date(raw.TimeStamp) : new Date(),
  };
};

/**
 * Convert storage representation (Convex) to domain representation.
 */
export const fromStoredVesselLocation = (
  stored: StoredVesselLocation
): VesselLocation => toDomain(stored, DATE_FIELDS) as unknown as VesselLocation;

/**
 * Convert domain representation to storage representation (Convex).
 */
export const toStoredVesselLocation = (
  location: VesselLocation
): StoredVesselLocation =>
  toStorage(location, DATE_FIELDS) as unknown as StoredVesselLocation;
