/**
 * Defines the Convex schema and conversion helpers for the `vesselTripEvents`
 * read model shared between functions and domain code.
 */
import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";

export const vesselTripEventTypeSchema = v.union(
  v.literal("dep-dock"),
  v.literal("arv-dock")
);

export const vesselTripEventSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: vesselTripEventTypeSchema,
  ScheduledTime: v.optional(v.number()),
  PredictedTime: v.optional(v.number()),
  ActualTime: v.optional(v.number()),
});

export type VesselTripEventType = Infer<typeof vesselTripEventTypeSchema>;
export type ConvexVesselTripEvent = Infer<typeof vesselTripEventSchema>;

/**
 * Converts a persisted Convex event record into the domain shape with `Date`
 * instances.
 *
 * @param event - Persisted Convex event record using epoch millisecond fields
 * @returns Domain event record with temporal values converted to `Date`
 */
export const toDomainVesselTripEvent = (event: ConvexVesselTripEvent) => ({
  ...event,
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  ScheduledTime: optionalEpochMsToDate(event.ScheduledTime),
  PredictedTime: optionalEpochMsToDate(event.PredictedTime),
  ActualTime: optionalEpochMsToDate(event.ActualTime),
});

export type VesselTripEvent = ReturnType<typeof toDomainVesselTripEvent>;
