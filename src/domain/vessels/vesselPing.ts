import type { VesselLocation } from "./vesselLocation";

/**
 * Domain model for simplified vessel position snapshot.
 */
export type VesselPing = {
  VesselID: number;
  Latitude: number;
  Longitude: number;
  Speed: number;
  Heading: number;
  AtDock: boolean;
  TimeStamp: Date;
};

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
export const fromStoredVesselPing = (stored: StoredVesselPing): VesselPing => ({
  VesselID: stored.VesselID,
  Latitude: stored.Latitude,
  Longitude: stored.Longitude,
  Speed: stored.Speed,
  Heading: stored.Heading,
  AtDock: stored.AtDock,
  TimeStamp: new Date(stored.TimeStamp),
});

/**
 * Convert domain representation to storage representation (Convex).
 */
export const toStoredVesselPing = (ping: VesselPing): StoredVesselPing => ({
  VesselID: ping.VesselID,
  Latitude: ping.Latitude,
  Longitude: ping.Longitude,
  Speed: ping.Speed,
  Heading: ping.Heading,
  AtDock: ping.AtDock,
  TimeStamp: ping.TimeStamp.getTime(),
});
