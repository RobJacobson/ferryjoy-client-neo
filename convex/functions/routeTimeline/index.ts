/**
 * Route timeline Convex module — schema validators, wire types, and domain
 * conversion for `RouteTimelineSnapshot` (Stage 1: no registered queries yet).
 */

export type {
  ConvexRouteTimelineBoundary,
  ConvexRouteTimelineDockVisit,
  ConvexRouteTimelineScope,
  ConvexRouteTimelineSnapshot,
  ConvexRouteTimelineVessel,
  RouteTimelineBoundary,
  RouteTimelineDockEventType,
  RouteTimelineDockVisit,
  RouteTimelineScope,
  RouteTimelineSnapshot,
  RouteTimelineVessel,
} from "./schemas";
export {
  routeTimelineBoundarySchema,
  routeTimelineDockVisitSchema,
  routeTimelineScopeSchema,
  routeTimelineSnapshotSchema,
  routeTimelineVesselSchema,
  toDomainRouteTimelineSnapshot,
} from "./schemas";
