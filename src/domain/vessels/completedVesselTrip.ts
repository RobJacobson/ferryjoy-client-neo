import type { DateFieldsToDate } from "../transformers";
import { toDomain, toStorage } from "../transformers";
import type { ActiveVesselTrip } from "./activeVesselTrip";

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

// Define date fields as a const array - TypeScript will infer the union type
const DATE_FIELDS = [
  "ScheduledDeparture",
  "LeftDock",
  "LeftDockActual",
  "Eta",
  "TimeStamp",
  "TripStart",
  "TripEnd",
] as const;

// Extract the union type from the const array
type CompletedVesselTripDateFields = (typeof DATE_FIELDS)[number];

/**
 * Completed trip domain model with guaranteed values for completion metrics.
 * Generated from storage type with proper null handling and Date objects
 */
export type CompletedVesselTrip = DateFieldsToDate<
  StoredCompletedVesselTrip,
  CompletedVesselTripDateFields
> & {
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
 * Convert storage representation (Convex) to domain representation.
 */
export const toCompletedVesselTrip = (
  stored: StoredCompletedVesselTrip
): CompletedVesselTrip =>
  toDomain(stored, DATE_FIELDS) as unknown as CompletedVesselTrip;

/**
 * Convert domain representation to storage representation (Convex).
 */
export const toStoredCompletedVesselTrip = (
  trip: CompletedVesselTrip
): StoredCompletedVesselTrip =>
  toStorage(trip, DATE_FIELDS) as unknown as StoredCompletedVesselTrip;
