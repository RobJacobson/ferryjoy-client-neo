/**
 * Type shapes for dock-event reload assembly.
 *
 * Reload transforms WSF schedule legs, active trips, vessel history, and
 * current vessel tracking into the scheduled and actual dock-event rows that
 * the persistence mutation replaces for one sailing day.
 */

import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { WsfScheduledSegment, WsfVesselHistory } from "./schemas";

type SeedLeg = {
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

type ScheduledBoundary = {
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

type ReloadTripInput = {
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

type ReloadTripWithTripKey = ReloadTripInput & { TripKey: string };

type BuildReloadRowsArgs = {
  sailingDay: string;
  scheduleSegments: WsfScheduledSegment[];
  historyRecords: WsfVesselHistory[];
  activeTrips: ReloadTripInput[];
  completedTrips: ReloadTripInput[];
  vesselLocations: ConvexVesselLocation[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  updatedAt: number;
};

type BuildReloadRowsResult = {
  scheduledRows: ConvexScheduledDockEvent[];
  actualRows: ConvexActualDockEvent[];
  preserveAbsentTripKeys: Set<string>;
};

export type {
  BuildReloadRowsArgs,
  BuildReloadRowsResult,
  ReloadTripInput,
  ReloadTripWithTripKey,
  ScheduledBoundary,
  SeedLeg,
};
