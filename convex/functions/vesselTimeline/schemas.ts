/**
 * Defines the backend-owned VesselTimeline row and view-model schemas.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { optionalEpochMsToDate } from "../../shared/convertDates";
import { boundaryEventTypeSchema } from "../eventsScheduled/schemas";
import {
  type ConvexVesselTimelineLiveState,
  toDomainVesselTimelineLiveState,
  vesselTimelineLiveStateSchema,
} from "./activeStateSchemas";

export const vesselTimelinePlaceholderReasonSchema = v.union(
  v.literal("start-of-day"),
  v.literal("broken-seam")
);

export const vesselTimelineRowKindSchema = v.union(
  v.literal("at-dock"),
  v.literal("at-sea")
);

export const vesselTimelineRowEdgeSchema = v.union(
  v.literal("normal"),
  v.literal("terminal-tail")
);

export const vesselTimelineRowEventSchema = v.object({
  Key: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: boundaryEventTypeSchema,
  IsArrivalPlaceholder: v.optional(v.boolean()),
  EventScheduledTime: v.optional(v.number()),
  EventPredictedTime: v.optional(v.number()),
  EventActualTime: v.optional(v.number()),
});

export const vesselTimelineRowSchema = v.object({
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

/**
 * Converts a Convex row event into the domain shape.
 *
 * @param event - Convex row event with epoch timestamps
 * @returns Domain row event with `Date` timestamps
 */
export const toDomainVesselTimelineRowEvent = (
  event: ConvexVesselTimelineRowEvent
) => ({
  ...event,
  ScheduledDeparture: new Date(event.ScheduledDeparture),
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
  EventPredictedTime: optionalEpochMsToDate(event.EventPredictedTime),
  EventActualTime: optionalEpochMsToDate(event.EventActualTime),
});

/**
 * Converts a Convex timeline row into the domain shape.
 *
 * @param row - Convex timeline row with epoch timestamps
 * @returns Domain timeline row with `Date` timestamps
 */
export const toDomainVesselTimelineRow = (row: ConvexVesselTimelineRow) => ({
  ...row,
  startEvent: toDomainVesselTimelineRowEvent(row.startEvent),
  endEvent: toDomainVesselTimelineRowEvent(row.endEvent),
});

/**
 * Converts a Convex timeline view model into the domain shape.
 *
 * @param viewModel - Convex view model with epoch timestamps
 * @returns Domain view model with `Date` timestamps
 */
export const toDomainVesselTimelineViewModel = (
  viewModel: ConvexVesselTimelineViewModel
) => ({
  ...viewModel,
  ObservedAt: viewModel.ObservedAt ? new Date(viewModel.ObservedAt) : null,
  rows: viewModel.rows.map(toDomainVesselTimelineRow),
  live: viewModel.live
    ? toDomainVesselTimelineLiveState(
        viewModel.live as ConvexVesselTimelineLiveState
      )
    : null,
});

export type VesselTimelineRowEvent = ReturnType<
  typeof toDomainVesselTimelineRowEvent
>;
export type VesselTimelineRow = ReturnType<typeof toDomainVesselTimelineRow>;
export type VesselTimelineViewModel = ReturnType<
  typeof toDomainVesselTimelineViewModel
>;
