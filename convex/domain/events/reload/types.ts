/**
 * Type shapes for dock-event reload assembly.
 *
 * Direct WSF reload seed rows, pure scheduled boundaries, history evidence,
 * and trip context used by the actual subtree.
 */

import type { DockEventType } from "functions/events/common/schemas";

type RawSeedSegment = {
  Key: string;
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  ArrivingTime?: number;
  SailingDay: string;
  RouteID: number;
  RouteAbbrev: string;
};

type ReloadScheduledBoundary = {
  SegmentKey: string;
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  NextTerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
};

type ReloadHistoryActualEvidence = {
  eventKey: string;
  actualTime: number;
};

type ReloadTripForActuals = {
  TripKey?: string;
  ScheduleKey?: string;
  VesselAbbrev: string;
  SailingDay?: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  LeftDockActual?: number;
  TripEnd?: number;
};

type ReloadTripWithTripKey = ReloadTripForActuals & { TripKey: string };

type ReloadTripContext = {
  tripKeyBySegmentKey: Map<string, string>;
  physicalOnlyTrips: ReloadTripWithTripKey[];
  activePhysicalOnlyTripsByVessel: Map<string, ReloadTripWithTripKey>;
};

export type {
  RawSeedSegment,
  ReloadHistoryActualEvidence,
  ReloadScheduledBoundary,
  ReloadTripContext,
  ReloadTripForActuals,
  ReloadTripWithTripKey,
};
