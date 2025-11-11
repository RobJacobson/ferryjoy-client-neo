import type { DateFieldsToDate } from "../transformers";
import { toDomain, toStorage } from "../transformers";
import type { VesselLocation } from "./vesselLocation";

/**
 * Storage representation for vessel pings in Convex.
 */
export type StoredVesselPing = {
  VesselID: number;
  Latitude: number;
  Longitude: number;
  Speed: number;
  Heading: number;
  AtDock: boolean;
  TimeStamp: number;
};

// Define date fields as a const array - TypeScript will infer the union type
const DATE_FIELDS = ["TimeStamp"] as const;

// Extract the union type from the const array
type VesselPingDateFields = (typeof DATE_FIELDS)[number];

/**
 * Domain model for simplified vessel position snapshot.
 * Generated from storage type with proper null handling and Date objects
 */
export type VesselPing = DateFieldsToDate<
  StoredVesselPing,
  VesselPingDateFields
>;

/**
 * Reduce a vessel location to a ping domain model.
 */
export const toVesselPing = (vl: VesselLocation): VesselPing => ({
  VesselID: vl.VesselID,
  Latitude: Math.round(vl.Latitude * 100000) / 100000,
  Longitude: Math.round(vl.Longitude * 100000) / 100000,
  Speed: vl.Speed > 0.2 ? vl.Speed : 0,
  Heading: vl.Heading,
  AtDock: vl.AtDock,
  TimeStamp: vl.TimeStamp,
});

/**
 * Convert storage representation (Convex) to domain representation.
 */
export const fromStoredVesselPing = (stored: StoredVesselPing): VesselPing =>
  toDomain(stored, DATE_FIELDS) as unknown as VesselPing;

/**
 * Convert domain representation to storage representation (Convex).
 */
export const toStoredVesselPing = (ping: VesselPing): StoredVesselPing =>
  toStorage(ping, DATE_FIELDS) as unknown as StoredVesselPing;
