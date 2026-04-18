/**
 * Validators and domain conversions for individual vessel ping rows stored in Convex.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

import { epochMsToDate } from "../../shared/convertDates";

/**
 * Convex validator for one vessel ping document (one row per ping).
 */
export const vesselPingValidationSchema = v.object({
  VesselAbbrev: v.string(),
  Latitude: v.number(),
  Longitude: v.number(),
  Speed: v.number(),
  Heading: v.number(),
  AtDock: v.boolean(),
  TimeStamp: v.number(),
});

/**
 * Type for a vessel ping row stored in Convex with numeric timestamps.
 */
export type ConvexVesselPing = Infer<typeof vesselPingValidationSchema>;

/**
 * Domain vessel ping: same fields as stored rows, but `TimeStamp` is a `Date`.
 */
export type VesselPing = Omit<ConvexVesselPing, "TimeStamp"> & {
  TimeStamp: Date;
};

/**
 * Maps a stored Convex vessel ping to the domain shape.
 *
 * @param ping - Convex vessel ping with epoch `TimeStamp`
 * @returns Domain ping with `Date` timestamp
 */
export const toDomainVesselPing = (ping: ConvexVesselPing): VesselPing => ({
  VesselAbbrev: ping.VesselAbbrev,
  Latitude: ping.Latitude,
  Longitude: ping.Longitude,
  Speed: ping.Speed,
  Heading: ping.Heading,
  AtDock: ping.AtDock,
  TimeStamp: epochMsToDate(ping.TimeStamp),
});
