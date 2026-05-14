/**
 * Type shapes for dock-event reload assembly.
 *
 * Hydrated dock status event records, WSF reload wire rows, trip context shared
 * between the orchestrator and the actuals subtree, and the computed reload
 * payload returned to the persistence mutation.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { WsfScheduledSegment, WsfVesselHistory } from "./schemas";

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

type DockStatusEventRecord = {
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
  physicalOnlyTripKeysToPreserve: Set<string>;
};

type ComputeDockEventsReloadArgs = {
  sailingDay: string;
  scheduleSegments: WsfScheduledSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReloadTripForActuals[];
  completedTrips: ReloadTripForActuals[];
  vesselLocations: ConvexVesselLocation[];
  updatedAt: number;
};

type DockEventsReload = {
  sailingDay: string;
  scheduledRows: ConvexScheduledDockEvent[];
  actualRows: ConvexActualDockEvent[];
  physicalOnlyTripKeysToPreserve: Set<string>;
};

export type {
  ComputeDockEventsReloadArgs,
  DockEventsReload,
  DockStatusEventRecord,
  RawSeedSegment,
  ReloadTripContext,
  ReloadTripForActuals,
  ReloadTripWithTripKey,
};
