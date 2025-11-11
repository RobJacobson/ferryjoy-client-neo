import {
  dateOrNull,
  dateToNumber,
  nullIfUndefined,
  undefinedIfNull,
} from "../converters";

export type ActiveVesselTrip = {
  VesselID: number;
  VesselName: string;
  VesselAbbrev: string;
  DepartingTerminalID: number;
  DepartingTerminalName: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalID: number | null;
  ArrivingTerminalName: string | null;
  ArrivingTerminalAbbrev: string | null;
  InService: boolean;
  AtDock: boolean;
  ScheduledDeparture: Date | null;
  LeftDock: Date | null;
  LeftDockActual: Date | null;
  LeftDockDelay: number | null;
  Eta: Date | null;
  OpRouteAbbrev: string | null;
  VesselPositionNum: number | null;
  TimeStamp: Date;
  TripStart: Date;
};

/**
 * Storage shape used by Convex schemas.
 * Dates are represented as milliseconds and nulls become undefined.
 */
export type StoredActiveVesselTrip = {
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
  LeftDockActual?: number;
  LeftDockDelay?: number;
  Eta?: number;
  OpRouteAbbrev?: string;
  VesselPositionNum?: number;
  TimeStamp: number;
  TripStart: number;
};

/**
 * Convert storage representation (Convex) to domain representation.
 */
export const toActiveVesselTrip = (
  stored: StoredActiveVesselTrip
): ActiveVesselTrip => ({
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
  LeftDockActual: dateOrNull(stored.LeftDockActual),
  LeftDockDelay: nullIfUndefined(stored.LeftDockDelay),
  Eta: dateOrNull(stored.Eta),
  OpRouteAbbrev: nullIfUndefined(stored.OpRouteAbbrev),
  VesselPositionNum: nullIfUndefined(stored.VesselPositionNum),
  TimeStamp: new Date(stored.TimeStamp),
  TripStart: new Date(stored.TripStart),
});

/**
 * Convert domain representation to storage representation (Convex).
 */
export const toStoredActiveVesselTrip = (
  trip: ActiveVesselTrip
): StoredActiveVesselTrip => ({
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
  LeftDockActual: dateToNumber(trip.LeftDockActual),
  LeftDockDelay: undefinedIfNull(trip.LeftDockDelay),
  Eta: dateToNumber(trip.Eta),
  OpRouteAbbrev: undefinedIfNull(trip.OpRouteAbbrev),
  VesselPositionNum: undefinedIfNull(trip.VesselPositionNum),
  TimeStamp: trip.TimeStamp.getTime(),
  TripStart: trip.TripStart.getTime(),
});
