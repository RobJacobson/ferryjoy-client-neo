/**
 * Convex validators and inferred types for internal dock-event reseed mutation
 * args and return payload. These are not database table schemas; args describe
 * external reload inputs passed from the action into the reseed mutation, and
 * the day-count return shape matches the mutation returns validator.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { terminalIdentitySchema } from "functions/terminals/schemas";
import { vesselIdentitySchema } from "functions/vessels/schemas";

const wsfScheduledSegmentArgs = v.object({
  VesselName: v.string(),
  DepartingTerminalID: v.number(),
  ArrivingTerminalID: v.number(),
  DepartingTerminalName: v.string(),
  ArrivingTerminalName: v.string(),
  DepartingTime: v.number(),
  ArrivingTime: v.optional(v.number()),
  SailingNotes: v.string(),
  Annotations: v.array(v.string()),
  RouteID: v.number(),
  RouteAbbrev: v.string(),
  SailingDay: v.string(),
});

const wsfVesselHistoryArgs = v.object({
  VesselId: v.number(),
  Vessel: v.optional(v.string()),
  Departing: v.optional(v.string()),
  Arriving: v.optional(v.string()),
  ScheduledDepart: v.optional(v.number()),
  ActualDepart: v.optional(v.number()),
  EstArrival: v.optional(v.number()),
});

const reseedDockStatusEventsFromExternalInputArgsSchema = v.object({
  SailingDay: v.string(),
  ScheduleSegments: v.array(wsfScheduledSegmentArgs),
  HistoryRecords: v.array(wsfVesselHistoryArgs),
  Vessels: v.array(vesselIdentitySchema),
  Terminals: v.array(terminalIdentitySchema),
});

const reseedDockEventsDayCountReturnSchema = v.object({
  scheduledCount: v.number(),
  actualCount: v.number(),
});

type WsfScheduledSegment = Infer<typeof wsfScheduledSegmentArgs>;

type WsfVesselHistory = Infer<typeof wsfVesselHistoryArgs>;

type ReseedDockStatusEventsFromExternalInputArgs = Infer<
  typeof reseedDockStatusEventsFromExternalInputArgsSchema
>;

type ReloadDockDayCountResult = Infer<
  typeof reseedDockEventsDayCountReturnSchema
>;

export type {
  ReloadDockDayCountResult,
  ReseedDockStatusEventsFromExternalInputArgs,
  WsfScheduledSegment,
  WsfVesselHistory,
};

export {
  reseedDockEventsDayCountReturnSchema,
  reseedDockStatusEventsFromExternalInputArgsSchema,
};
