/**
 * Route timeline read model: Convex validators, inferred wire types, and domain
 * conversion from epoch milliseconds to `Date` for `RouteTimelineSnapshot`.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { optionalEpochMsToDate } from "../../shared/convertDates";
import { dockEventTypeSchema } from "../events/eventsScheduled/schemas";

export type RouteTimelineDockEventType = Infer<typeof dockEventTypeSchema>;

export const routeTimelineBoundarySchema = v.object({
  Key: v.string(),
  SegmentKey: v.string(),
  TerminalAbbrev: v.string(),
  EventType: dockEventTypeSchema,
  EventScheduledTime: v.optional(v.number()),
  EventPredictedTime: v.optional(v.number()),
  EventOccurred: v.optional(v.literal(true)),
  EventActualTime: v.optional(v.number()),
});

export type ConvexRouteTimelineBoundary = Infer<
  typeof routeTimelineBoundarySchema
>;

export const routeTimelineDockVisitSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  TerminalAbbrev: v.string(),
  Arrival: v.optional(routeTimelineBoundarySchema),
  Departure: v.optional(routeTimelineBoundarySchema),
});

export type ConvexRouteTimelineDockVisit = Infer<
  typeof routeTimelineDockVisitSchema
>;

export const routeTimelineScopeSchema = v.object({
  VesselAbbrev: v.optional(v.string()),
  WindowStart: v.optional(v.number()),
  WindowEnd: v.optional(v.number()),
  IsPartial: v.boolean(),
});

export type ConvexRouteTimelineScope = Infer<typeof routeTimelineScopeSchema>;

export const routeTimelineVesselSchema = v.object({
  VesselAbbrev: v.string(),
  DockVisits: v.array(routeTimelineDockVisitSchema),
});

export type ConvexRouteTimelineVessel = Infer<typeof routeTimelineVesselSchema>;

export const routeTimelineSnapshotSchema = v.object({
  RouteAbbrev: v.string(),
  SailingDay: v.string(),
  Scope: routeTimelineScopeSchema,
  Vessels: v.array(routeTimelineVesselSchema),
});

export type ConvexRouteTimelineSnapshot = Infer<
  typeof routeTimelineSnapshotSchema
>;

/**
 * Convert one route timeline boundary from epoch millisecond fields to domain
 * `Date` fields.
 *
 * @param boundary - Stored Convex route timeline boundary
 * @returns Domain boundary with `Date`-typed timestamps
 */
const toDomainRouteTimelineBoundary = (
  boundary: ConvexRouteTimelineBoundary
) => ({
  ...boundary,
  EventScheduledTime: optionalEpochMsToDate(boundary.EventScheduledTime),
  EventPredictedTime: optionalEpochMsToDate(boundary.EventPredictedTime),
  EventOccurred:
    boundary.EventOccurred ??
    (boundary.EventActualTime !== undefined ? true : undefined),
  EventActualTime: optionalEpochMsToDate(boundary.EventActualTime),
});

/**
 * Convert one stored dock visit, mapping optional nested boundaries when
 * present.
 *
 * @param visit - Stored Convex route timeline dock visit
 * @returns Domain dock visit with optional `Date`-typed boundaries
 */
const toDomainRouteTimelineDockVisit = (
  visit: ConvexRouteTimelineDockVisit
) => ({
  ...visit,
  Arrival: visit.Arrival
    ? toDomainRouteTimelineBoundary(visit.Arrival)
    : undefined,
  Departure: visit.Departure
    ? toDomainRouteTimelineBoundary(visit.Departure)
    : undefined,
});

/**
 * Convert stored route timeline scope: optional window bounds from epoch ms
 * to `Date`.
 *
 * @param scope - Stored Convex route timeline scope
 * @returns Domain scope with optional `Date` window fields
 */
const toDomainRouteTimelineScope = (scope: ConvexRouteTimelineScope) => ({
  ...scope,
  WindowStart: optionalEpochMsToDate(scope.WindowStart),
  WindowEnd: optionalEpochMsToDate(scope.WindowEnd),
});

/**
 * Convert one vessel row and its dock visits to domain timestamps.
 *
 * @param vessel - Stored Convex route timeline vessel
 * @returns Domain vessel with converted dock visits
 */
const toDomainRouteTimelineVessel = (vessel: ConvexRouteTimelineVessel) => ({
  ...vessel,
  DockVisits: vessel.DockVisits.map(toDomainRouteTimelineDockVisit),
});

/**
 * Convert a stored `RouteTimelineSnapshot` into the domain-layer `Date`-based
 * shape.
 *
 * @param snapshot - Stored Convex route timeline snapshot
 * @returns Domain snapshot with converted timestamps throughout
 */
export const toDomainRouteTimelineSnapshot = (
  snapshot: ConvexRouteTimelineSnapshot
) => ({
  ...snapshot,
  Scope: toDomainRouteTimelineScope(snapshot.Scope),
  Vessels: snapshot.Vessels.map(toDomainRouteTimelineVessel),
});

export type RouteTimelineBoundary = ReturnType<
  typeof toDomainRouteTimelineBoundary
>;
export type RouteTimelineDockVisit = ReturnType<
  typeof toDomainRouteTimelineDockVisit
>;
export type RouteTimelineScope = ReturnType<typeof toDomainRouteTimelineScope>;
export type RouteTimelineVessel = ReturnType<
  typeof toDomainRouteTimelineVessel
>;
export type RouteTimelineSnapshot = ReturnType<
  typeof toDomainRouteTimelineSnapshot
>;
