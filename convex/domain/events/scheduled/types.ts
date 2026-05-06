/**
 * Scheduled event domain types.
 *
 * These in-memory shapes belong to schedule-derived event construction and are
 * shared with actual reload only as neutral boundary context, not as persisted
 * eventsScheduled table rows.
 */

import type { DockEventType } from "../common/types";

/**
 * In-memory scheduled boundary produced from reload schedule segments.
 *
 * The record is a transient domain shape used to derive scheduled rows and to
 * seed actual hydration. Persisted table row types live in functions/events.
 */
type DockBoundaryEventRecord = {
  SegmentKey: string;
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
  EventPredictedTime?: number;
  EventOccurred?: true;
  EventActualTime?: number;
};

/**
 * Verb-led alias used where reload code describes boundary records as
 * transitions through a dock boundary.
 */
type DockTransitionRecord = DockBoundaryEventRecord;

/**
 * Portable inferred segment used by schedule continuity and trip resolution.
 */
type ConvexInferredScheduledSegment = {
  Key: string;
  SailingDay: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  NextKey?: string;
  NextDepartingTime?: number;
};

/**
 * Numeric schedule segment payload consumed by event reload builders.
 *
 * Convex reload mutations validate epoch-millisecond payloads at their boundary
 * so schedule-domain builders can stay adapter-neutral and pure.
 */
type EventReloadScheduleSegment = {
  VesselName: string;
  DepartingTerminalID: number;
  ArrivingTerminalID: number;
  DepartingTerminalName: string;
  ArrivingTerminalName: string;
  DepartingTime: number;
  ArrivingTime?: number;
  SailingNotes: string;
  Annotations: string[];
  RouteID: number;
  RouteAbbrev: string;
  SailingDay: string;
};

export type {
  ConvexInferredScheduledSegment,
  DockBoundaryEventRecord,
  DockTransitionRecord,
  EventReloadScheduleSegment,
};
