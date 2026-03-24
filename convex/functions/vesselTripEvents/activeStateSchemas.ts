import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  optionalDateToEpochMs,
  optionalEpochMsToDate,
} from "../../shared/convertDates";

export const vesselTimelineRowMatchKindSchema = v.union(
  v.literal("dock"),
  v.literal("sea")
);

export const vesselTimelineRowMatchSchema = v.object({
  kind: vesselTimelineRowMatchKindSchema,
  startEventKey: v.string(),
  endEventKey: v.string(),
});

export const vesselTimelineActiveStateKindSchema = v.union(
  v.literal("dock"),
  v.literal("sea"),
  v.literal("scheduled-fallback"),
  v.literal("unknown")
);

export const vesselTimelineActiveStateReasonSchema = v.union(
  v.literal("location_anchor"),
  v.literal("open_actual_row"),
  v.literal("scheduled_window"),
  v.literal("fallback"),
  v.literal("unknown")
);

export const vesselTimelineLiveStateSchema = v.object({
  VesselName: v.optional(v.string()),
  AtDock: v.optional(v.boolean()),
  InService: v.optional(v.boolean()),
  Speed: v.optional(v.number()),
  DepartingTerminalAbbrev: v.optional(v.string()),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  DepartingDistance: v.optional(v.number()),
  ArrivingDistance: v.optional(v.number()),
  ScheduledDeparture: v.optional(v.number()),
  TimeStamp: v.optional(v.number()),
});

export const vesselTimelineActiveStateSchema = v.object({
  kind: vesselTimelineActiveStateKindSchema,
  rowMatch: v.union(vesselTimelineRowMatchSchema, v.null()),
  terminalTailEventKey: v.optional(v.string()),
  subtitle: v.optional(v.string()),
  animate: v.boolean(),
  speedKnots: v.number(),
  reason: vesselTimelineActiveStateReasonSchema,
});

export const vesselTimelineActiveStateSnapshotSchema = v.object({
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ObservedAt: v.optional(v.number()),
  Live: v.union(vesselTimelineLiveStateSchema, v.null()),
  ActiveState: v.union(vesselTimelineActiveStateSchema, v.null()),
});

export type ConvexVesselTimelineRowMatch = Infer<
  typeof vesselTimelineRowMatchSchema
>;
export type ConvexVesselTimelineLiveState = Infer<
  typeof vesselTimelineLiveStateSchema
>;
export type ConvexVesselTimelineActiveState = Infer<
  typeof vesselTimelineActiveStateSchema
>;
export type ConvexVesselTimelineActiveStateSnapshot = Infer<
  typeof vesselTimelineActiveStateSnapshotSchema
>;

export const toConvexVesselTimelineLiveState = (live: {
  VesselName?: string;
  AtDock?: boolean;
  InService?: boolean;
  Speed?: number;
  DepartingTerminalAbbrev?: string;
  ArrivingTerminalAbbrev?: string;
  DepartingDistance?: number;
  ArrivingDistance?: number;
  ScheduledDeparture?: Date;
  TimeStamp?: Date;
}): ConvexVesselTimelineLiveState => ({
  ...live,
  ScheduledDeparture: optionalDateToEpochMs(live.ScheduledDeparture),
  TimeStamp: optionalDateToEpochMs(live.TimeStamp),
});

export const toDomainVesselTimelineLiveState = (
  live: ConvexVesselTimelineLiveState
) => ({
  ...live,
  ScheduledDeparture: optionalEpochMsToDate(live.ScheduledDeparture),
  TimeStamp: optionalEpochMsToDate(live.TimeStamp),
});

export const toDomainVesselTimelineActiveStateSnapshot = (
  snapshot: ConvexVesselTimelineActiveStateSnapshot
) => ({
  ...snapshot,
  ObservedAt: optionalEpochMsToDate(snapshot.ObservedAt),
  Live: snapshot.Live ? toDomainVesselTimelineLiveState(snapshot.Live) : null,
});

export type VesselTimelineRowMatch = ConvexVesselTimelineRowMatch;
export type VesselTimelineActiveState = ConvexVesselTimelineActiveState;
export type VesselTimelineLiveState = ReturnType<
  typeof toDomainVesselTimelineLiveState
>;
export type VesselTimelineActiveStateSnapshot = ReturnType<
  typeof toDomainVesselTimelineActiveStateSnapshot
>;
