/**
 * Defines the shared VesselTimeline Convex schemas and conversion helpers.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";
import { predictionSourceSchema } from "../eventsPredicted/schemas";
import { boundaryEventTypeSchema } from "../eventsScheduled/schemas";
import { predictionTypeValidator } from "../predictions/schemas";

const vesselTimelineLiveStateSchema = v.object({
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

type ConvexVesselTimelineLiveState = Infer<
  typeof vesselTimelineLiveStateSchema
>;

const toDomainVesselTimelineLiveState = (
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

export type VesselTimelineEventType = Infer<typeof boundaryEventTypeSchema>;

export const vesselTimelineEventRecordSchema = v.object({
  SegmentKey: v.string(),
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: boundaryEventTypeSchema,
  EventScheduledTime: v.optional(v.number()),
  EventPredictedTime: v.optional(v.number()),
  EventActualTime: v.optional(v.number()),
});

export type ConvexVesselTimelineEventRecord = Infer<
  typeof vesselTimelineEventRecordSchema
>;

export const actualBoundaryEffectSchema = v.object({
  SegmentKey: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: boundaryEventTypeSchema,
  EventActualTime: v.number(),
});

export type ConvexActualBoundaryEffect = Infer<
  typeof actualBoundaryEffectSchema
>;

const predictedBoundaryProjectionRowSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventPredictedTime: v.number(),
  PredictionType: predictionTypeValidator,
  PredictionSource: predictionSourceSchema,
});

export const predictedBoundaryProjectionEffectSchema = v.object({
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  TargetKeys: v.array(v.string()),
  Rows: v.array(predictedBoundaryProjectionRowSchema),
});

export type ConvexPredictedBoundaryProjectionRow = Infer<
  typeof predictedBoundaryProjectionRowSchema
>;
export type ConvexPredictedBoundaryProjectionEffect = Infer<
  typeof predictedBoundaryProjectionEffectSchema
>;

const vesselTimelinePlaceholderReasonSchema = v.union(
  v.literal("start-of-day"),
  v.literal("broken-seam")
);

const vesselTimelineRowKindSchema = v.union(
  v.literal("at-dock"),
  v.literal("at-sea")
);

const vesselTimelineRowEdgeSchema = v.union(
  v.literal("normal"),
  v.literal("terminal-tail")
);

const vesselTimelineRowEventSchema = v.object({
  Key: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: boundaryEventTypeSchema,
  IsArrivalPlaceholder: v.optional(v.boolean()),
  EventScheduledTime: v.optional(v.number()),
  EventPredictedTime: v.optional(v.number()),
  EventActualTime: v.optional(v.number()),
});

const vesselTimelineRowSchema = v.object({
  rowId: v.string(),
  tripKey: v.string(),
  kind: vesselTimelineRowKindSchema,
  rowEdge: vesselTimelineRowEdgeSchema,
  placeholderReason: v.optional(vesselTimelinePlaceholderReasonSchema),
  startEvent: vesselTimelineRowEventSchema,
  endEvent: vesselTimelineRowEventSchema,
  durationMinutes: v.number(),
});

export const vesselTimelineViewModelSchema = v.object({
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ObservedAt: v.union(v.number(), v.null()),
  rows: v.array(vesselTimelineRowSchema),
  activeRowId: v.union(v.string(), v.null()),
  live: v.union(vesselTimelineLiveStateSchema, v.null()),
});

export type ConvexVesselTimelineRowEvent = Infer<
  typeof vesselTimelineRowEventSchema
>;
export type ConvexVesselTimelineRow = Infer<typeof vesselTimelineRowSchema>;
export type ConvexVesselTimelineViewModel = Infer<
  typeof vesselTimelineViewModelSchema
>;

const toDomainVesselTimelineRowEvent = (
  event: ConvexVesselTimelineRowEvent
) => ({
  ...event,
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
  EventPredictedTime: optionalEpochMsToDate(event.EventPredictedTime),
  EventActualTime: optionalEpochMsToDate(event.EventActualTime),
});

const toDomainVesselTimelineRow = (row: ConvexVesselTimelineRow) => ({
  ...row,
  startEvent: toDomainVesselTimelineRowEvent(row.startEvent),
  endEvent: toDomainVesselTimelineRowEvent(row.endEvent),
});

export const toDomainVesselTimelineViewModel = (
  viewModel: ConvexVesselTimelineViewModel
) => ({
  ...viewModel,
  ObservedAt: viewModel.ObservedAt ? new Date(viewModel.ObservedAt) : null,
  rows: viewModel.rows.map(toDomainVesselTimelineRow),
  live: viewModel.live ? toDomainVesselTimelineLiveState(viewModel.live) : null,
});

export type VesselTimelineRowEvent = ReturnType<
  typeof toDomainVesselTimelineRowEvent
>;
export type VesselTimelineRow = ReturnType<typeof toDomainVesselTimelineRow>;
export type VesselTimelineViewModel = ReturnType<
  typeof toDomainVesselTimelineViewModel
>;
