/**
 * Defines the live-state schema for VesselTimeline.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { optionalEpochMsToDate } from "../../shared/convertDates";

export const vesselTimelineLiveStateSchema = v.object({
  VesselName: v.optional(v.string()),
  AtDock: v.optional(v.boolean()),
  InService: v.optional(v.boolean()),
  Speed: v.optional(v.number()),
  DepartingTerminalAbbrev: v.optional(v.string()),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  DepartingDistance: v.optional(v.number()),
  ArrivingDistance: v.optional(v.number()),
  LeftDock: v.optional(v.number()),
  Eta: v.optional(v.number()),
  ScheduledDeparture: v.optional(v.number()),
  TimeStamp: v.optional(v.number()),
});

export type ConvexVesselTimelineLiveState = Infer<
  typeof vesselTimelineLiveStateSchema
>;

/**
 * Converts a Convex live-state payload into the domain shape.
 *
 * @param live - Convex live-state payload with epoch timestamps
 * @returns Domain live-state payload with `Date` instances
 */
export const toDomainVesselTimelineLiveState = (
  live: ConvexVesselTimelineLiveState
) => ({
  ...live,
  LeftDock: optionalEpochMsToDate(live.LeftDock),
  Eta: optionalEpochMsToDate(live.Eta),
  ScheduledDeparture: optionalEpochMsToDate(live.ScheduledDeparture),
  TimeStamp: optionalEpochMsToDate(live.TimeStamp),
});

export type VesselTimelineLiveState = ReturnType<
  typeof toDomainVesselTimelineLiveState
>;
