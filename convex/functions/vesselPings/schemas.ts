/**
 * Validators and conversion helpers for stored vessel ping collection rows.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dateToEpochMs, epochMsToDate } from "shared/convertDates";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";

/**
 * Convex validator for individual vessel pings stored with numeric timestamps.
 */
export const vesselPingValidationSchema = v.object({
  VesselID: v.number(),
  Latitude: v.number(),
  Longitude: v.number(),
  Speed: v.number(),
  Heading: v.number(),
  AtDock: v.boolean(),
  TimeStamp: v.number(),
});

/**
 * Convex validator for one vessel ping collection snapshot row.
 */
export const vesselPingListValidationSchema = v.object({
  timestamp: v.number(),
  pings: v.array(vesselPingValidationSchema),
});

/**
 * Type for a vessel ping row stored in Convex with numeric timestamps.
 */
export type ConvexVesselPing = Infer<typeof vesselPingValidationSchema>;

/**
 * Type for a vessel ping collection row stored in Convex.
 */
export type ConvexVesselPingCollection = Infer<
  typeof vesselPingListValidationSchema
>;

/**
 * Convert a Dottie vessel location to a Convex vessel ping.
 * Manual conversion from Date objects to epoch milliseconds.
 *
 * @param dvl - Dottie vessel location with Date objects
 * @returns Convex vessel ping with numeric timestamp
 */
export const toConvexVesselPing = (
  dvl: DottieVesselLocation
): ConvexVesselPing => ({
  VesselID: dvl.VesselID,
  Latitude: Math.round(dvl.Latitude * 100000) / 100000,
  Longitude: Math.round(dvl.Longitude * 100000) / 100000,
  Speed: dvl.Speed,
  Heading: dvl.Heading,
  AtDock: dvl.AtDock,
  TimeStamp: dateToEpochMs(dvl.TimeStamp),
});

/**
 * Convert a Convex vessel ping to the domain-layer Date-based shape.
 * Manual conversion from epoch milliseconds to Date objects.
 *
 * @param ping - Convex vessel ping with numeric timestamp
 * @returns Domain vessel ping with Date object
 */
export const toDomainVesselPing = (ping: ConvexVesselPing) => ({
  ...ping,
  TimeStamp: epochMsToDate(ping.TimeStamp),
});

/**
 * Type for a domain vessel ping with `Date` timestamps.
 */
export type VesselPing = ReturnType<typeof toDomainVesselPing>;
