/**
 * Plain client-side timeline visit types used by route geometry helpers.
 *
 * These types describe the UI-facing dock visit model after a feature has
 * interpreted its own data source. They intentionally avoid Convex validators
 * and backend read-model contracts.
 */

type RouteTimelineDockEventType = "arv-dock" | "dep-dock";

type RouteTimelineBoundary = {
  Key: string;
  SegmentKey: string;
  TerminalAbbrev: string;
  EventType: RouteTimelineDockEventType;
  EventScheduledTime?: Date;
  EventPredictedTime?: Date;
  EventOccurred?: true;
  EventActualTime?: Date;
};

type RouteTimelineDockVisit = {
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  TerminalAbbrev: string;
  Arrival?: RouteTimelineBoundary;
  Departure?: RouteTimelineBoundary;
};

export type {
  RouteTimelineBoundary,
  RouteTimelineDockEventType,
  RouteTimelineDockVisit,
};
