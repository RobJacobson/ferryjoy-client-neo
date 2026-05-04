/**
 * Defines shared Convex vessel-location validators and wire types.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Shared field validators for vessel-location storage.
 * Used to build the live and historic vessel-location schemas.
 */
const vesselLocationBaseValidationFields = {
  VesselID: v.number(),
  VesselName: v.string(),
  VesselAbbrev: v.string(),
  DepartingTerminalID: v.number(),
  DepartingTerminalName: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalID: v.optional(v.number()),
  ArrivingTerminalName: v.optional(v.string()),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  Latitude: v.number(),
  Longitude: v.number(),
  Speed: v.number(),
  Heading: v.number(),
  InService: v.boolean(),
  AtDock: v.boolean(),
  LeftDock: v.optional(v.number()),
  Eta: v.optional(v.number()),
  ScheduledDeparture: v.optional(v.number()),
  RouteAbbrev: v.optional(v.string()),
  VesselPositionNum: v.optional(v.number()),
  TimeStamp: v.number(),
} as const;

/**
 * Incoming normalized vessel-location fields before persistence-only enrichment.
 */
export const vesselLocationIncomingValidationFields = {
  ...vesselLocationBaseValidationFields,
  /** Feed-derived schedule segment composite (not physical trip identity). */
  ScheduleKey: v.optional(v.string()),
  DepartingDistance: v.optional(v.number()),
  ArrivingDistance: v.optional(v.number()),
} as const;

/**
 * Stored vessel-location fields, including derived terminal distances.
 */
export const vesselLocationValidationFields = {
  ...vesselLocationIncomingValidationFields,
  AtDockObserved: v.boolean(),
} as const;

/**
 * Convex validator for incoming normalized vessel locations before persistence.
 */
export const vesselLocationIncomingValidationSchema = v.object(
  vesselLocationIncomingValidationFields
);

/**
 * Convex validator for persisted live locations (epoch-ms fields; includes `AtDockObserved`).
 */
export const vesselLocationValidationSchema = v.object(
  vesselLocationValidationFields
);

/**
 * Type for normalized vessel location before persistence-side enrichment.
 */
export type ConvexVesselLocationIncoming = Infer<
  typeof vesselLocationIncomingValidationSchema
>;

/**
 * Type for vessel location in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;
