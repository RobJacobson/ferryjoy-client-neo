import { type DateFieldsToDate, toDomain, toStorage } from "../transformers";

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

// Define date fields as a const array - TypeScript will infer the union type
const DATE_FIELDS = [
  "ScheduledDeparture",
  "LeftDock",
  "LeftDockActual",
  "Eta",
  "TimeStamp",
  "TripStart",
] as const;

// Extract the union type from the const array
type ActiveVesselTripDateFields = (typeof DATE_FIELDS)[number];

/**
 * Domain type generated from storage type with proper null handling and Date objects
 */
export type ActiveVesselTrip = DateFieldsToDate<
  StoredActiveVesselTrip,
  (typeof DATE_FIELDS)[number]
>;

/**
 * Convert storage representation (Convex) to domain representation.
 */
export const toActiveVesselTrip = (
  stored: StoredActiveVesselTrip
): ActiveVesselTrip =>
  toDomain(stored, DATE_FIELDS) as unknown as ActiveVesselTrip;

/**
 * Convert domain representation to storage representation (Convex).
 */
export const toStoredActiveVesselTrip = (
  trip: ActiveVesselTrip
): StoredActiveVesselTrip =>
  toStorage(trip, DATE_FIELDS) as unknown as StoredActiveVesselTrip;
