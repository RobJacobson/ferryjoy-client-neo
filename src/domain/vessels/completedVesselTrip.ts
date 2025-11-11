import {
  dateOrNull,
  dateToNumber,
  nullIfUndefined,
  undefinedIfNull,
} from "../converters";
import type { ActiveVesselTrip } from "./activeVesselTrip";

/**
 * Completed trip domain model with guaranteed values for completion metrics.
 */
export type CompletedVesselTrip = ActiveVesselTrip & {
  Key: string;
  TripStart: Date;
  TripEnd: Date;
  LeftDockActual: Date;
  LeftDockDelay: number | null;
  AtDockDuration: number;
  AtSeaDuration: number;
  TotalDuration: number;
};

/**
 * Storage shape for completed trips used by Convex.
 */
export type StoredCompletedVesselTrip = {
  VesselID: number;
  VesselName: string;
  VesselAbbrev: string;
  DepartingTerminalID: number;
  DepartingTerminalName: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalID?: number;
  ArrivingTerminalName?: string;
  ArrivingTerminalAbbrev?: string;
  InService: boolean;
  AtDock: boolean;
  ScheduledDeparture?: number;
  LeftDock?: number;
  LeftDockActual: number;
  LeftDockDelay?: number;
  Eta?: number;
  OpRouteAbbrev?: string;
  VesselPositionNum?: number;
  TimeStamp: number;
  TripStart: number;
  TripEnd: number;
  Key: string;
  AtDockDuration: number;
  AtSeaDuration: number;
  TotalDuration: number;
};

/**
 * Convert storage representation (Convex) to domain representation.
 */
export const toCompletedVesselTrip = (
  stored: StoredCompletedVesselTrip
): CompletedVesselTrip => ({
  VesselID: stored.VesselID,
  VesselName: stored.VesselName,
  VesselAbbrev: stored.VesselAbbrev,
  DepartingTerminalID: stored.DepartingTerminalID,
  DepartingTerminalName: stored.DepartingTerminalName,
  DepartingTerminalAbbrev: stored.DepartingTerminalAbbrev,
  ArrivingTerminalID: nullIfUndefined(stored.ArrivingTerminalID),
  ArrivingTerminalName: nullIfUndefined(stored.ArrivingTerminalName),
  ArrivingTerminalAbbrev: nullIfUndefined(stored.ArrivingTerminalAbbrev),
  InService: stored.InService,
  AtDock: stored.AtDock,
  ScheduledDeparture: dateOrNull(stored.ScheduledDeparture),
  LeftDock: dateOrNull(stored.LeftDock),
  LeftDockActual: new Date(stored.LeftDockActual),
  LeftDockDelay: nullIfUndefined(stored.LeftDockDelay),
  Eta: dateOrNull(stored.Eta),
  OpRouteAbbrev: nullIfUndefined(stored.OpRouteAbbrev),
  VesselPositionNum: nullIfUndefined(stored.VesselPositionNum),
  TimeStamp: new Date(stored.TimeStamp),
  TripStart: new Date(stored.TripStart),
  TripEnd: new Date(stored.TripEnd),
  Key: stored.Key,
  AtDockDuration: stored.AtDockDuration,
  AtSeaDuration: stored.AtSeaDuration,
  TotalDuration: stored.TotalDuration,
});

/**
 * Convert domain representation to storage representation (Convex).
 */
export const toStoredCompletedVesselTrip = (
  trip: CompletedVesselTrip
): StoredCompletedVesselTrip => ({
  VesselID: trip.VesselID,
  VesselName: trip.VesselName,
  VesselAbbrev: trip.VesselAbbrev,
  DepartingTerminalID: trip.DepartingTerminalID,
  DepartingTerminalName: trip.DepartingTerminalName,
  DepartingTerminalAbbrev: trip.DepartingTerminalAbbrev,
  ArrivingTerminalID: undefinedIfNull(trip.ArrivingTerminalID),
  ArrivingTerminalName: undefinedIfNull(trip.ArrivingTerminalName),
  ArrivingTerminalAbbrev: undefinedIfNull(trip.ArrivingTerminalAbbrev),
  InService: trip.InService,
  AtDock: trip.AtDock,
  ScheduledDeparture: dateToNumber(trip.ScheduledDeparture),
  LeftDock: dateToNumber(trip.LeftDock),
  LeftDockActual: trip.LeftDockActual.getTime(),
  LeftDockDelay: undefinedIfNull(trip.LeftDockDelay),
  Eta: dateToNumber(trip.Eta),
  OpRouteAbbrev: undefinedIfNull(trip.OpRouteAbbrev),
  VesselPositionNum: undefinedIfNull(trip.VesselPositionNum),
  TimeStamp: trip.TimeStamp.getTime(),
  TripStart: trip.TripStart.getTime(),
  TripEnd: trip.TripEnd.getTime(),
  Key: trip.Key,
  AtDockDuration: trip.AtDockDuration,
  AtSeaDuration: trip.AtSeaDuration,
  TotalDuration: trip.TotalDuration,
});
