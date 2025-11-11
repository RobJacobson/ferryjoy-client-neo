import type { VesselLocation as VesselLocationDottie } from "ws-dottie/wsf-vessels";
import {
  dateOrNull,
  dateToNumber,
  nullIfUndefined,
  undefinedIfNull,
} from "../converters";

/**
 * Domain model for vessel location with Dates and nullable fields.
 */
export type VesselLocation = {
  VesselID: number;
  VesselName: string;
  DepartingTerminalID: number;
  DepartingTerminalName: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalID: number | null;
  ArrivingTerminalName: string | null;
  ArrivingTerminalAbbrev: string | null;
  Latitude: number;
  Longitude: number;
  Speed: number;
  Heading: number;
  InService: boolean;
  AtDock: boolean;
  LeftDock: Date | null;
  Eta: Date | null;
  ScheduledDeparture: Date | null;
  OpRouteAbbrev: string | null;
  VesselPositionNum: number | null;
  TimeStamp: Date;
};

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
): VesselLocation => ({
  VesselID: stored.VesselID,
  VesselName: stored.VesselName,
  DepartingTerminalID: stored.DepartingTerminalID,
  DepartingTerminalName: stored.DepartingTerminalName,
  DepartingTerminalAbbrev: stored.DepartingTerminalAbbrev,
  ArrivingTerminalID: nullIfUndefined(stored.ArrivingTerminalID),
  ArrivingTerminalName: nullIfUndefined(stored.ArrivingTerminalName),
  ArrivingTerminalAbbrev: nullIfUndefined(stored.ArrivingTerminalAbbrev),
  Latitude: stored.Latitude,
  Longitude: stored.Longitude,
  Speed: stored.Speed,
  Heading: stored.Heading,
  InService: stored.InService,
  AtDock: stored.AtDock,
  LeftDock: dateOrNull(stored.LeftDock),
  Eta: dateOrNull(stored.Eta),
  ScheduledDeparture: dateOrNull(stored.ScheduledDeparture),
  OpRouteAbbrev: nullIfUndefined(stored.OpRouteAbbrev),
  VesselPositionNum: nullIfUndefined(stored.VesselPositionNum),
  TimeStamp: new Date(stored.TimeStamp),
});

/**
 * Convert domain representation to storage representation (Convex).
 */
export const toStoredVesselLocation = (
  location: VesselLocation
): StoredVesselLocation => ({
  VesselID: location.VesselID,
  VesselName: location.VesselName,
  DepartingTerminalID: location.DepartingTerminalID,
  DepartingTerminalName: location.DepartingTerminalName,
  DepartingTerminalAbbrev: location.DepartingTerminalAbbrev,
  ArrivingTerminalID: undefinedIfNull(location.ArrivingTerminalID),
  ArrivingTerminalName: undefinedIfNull(location.ArrivingTerminalName),
  ArrivingTerminalAbbrev: undefinedIfNull(location.ArrivingTerminalAbbrev),
  Latitude: location.Latitude,
  Longitude: location.Longitude,
  Speed: location.Speed,
  Heading: location.Heading,
  InService: location.InService,
  AtDock: location.AtDock,
  LeftDock: dateToNumber(location.LeftDock),
  Eta: dateToNumber(location.Eta),
  ScheduledDeparture: dateToNumber(location.ScheduledDeparture),
  OpRouteAbbrev: undefinedIfNull(location.OpRouteAbbrev),
  VesselPositionNum: undefinedIfNull(location.VesselPositionNum),
  TimeStamp: location.TimeStamp.getTime(),
});
