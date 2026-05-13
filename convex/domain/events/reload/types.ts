/**
 * Type shapes for dock-event reload assembly: hydrated dock status event
 * records, trip indexes, sailing-day row build results, and reload wire rows
 * projected to epoch-ms for hydrate.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  WsfScheduledSegment,
  WsfVesselHistory,
} from "./schemas/validateReloadInput";
import type { DockStatusEventRecord } from "./schemas";

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

type TripContextForActualRow = {
  TripKey: string;
};

type TripRowForActualContext = {
  TripKey?: string;
  ScheduleKey?: string;
};

type ActiveTripForPhysicalActualReconcile = {
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

type ComputeReloadRowsFromScheduledEventsArgs = {
  sailingDay: string;
  events: DockStatusEventRecord[];
  updatedAt: number;
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
  physicalOnlyTrips: ActiveTripForPhysicalActualReconcile[];
  vesselLocations: ConvexVesselLocation[];
};

type ComputeReloadRowsFromScheduledEventsResult = {
  scheduledRows: ConvexScheduledDockEvent[];
  actualRows: ConvexActualDockEvent[];
};

type ComputeDockEventsReloadArgs = {
  sailingDay: string;
  scheduleSegments: WsfScheduledSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  activeTrips: ActiveTripForPhysicalActualReconcile[];
  completedTrips: ActiveTripForPhysicalActualReconcile[];
  vesselLocations: ConvexVesselLocation[];
  updatedAt: number;
};

type DockEventsReload = {
  sailingDay: string;
  scheduledRows: ConvexScheduledDockEvent[];
  actualRows: ConvexActualDockEvent[];
  physicalOnlyTripKeysToPreserve: Set<string>;
};

type HistoryActualSource = "departure-actual" | "arrival-proxy";

type NormalizedHistoryRecord = {
  tripKey: string;
  actualDeparture?: number;
  arrivalProxy?: number;
};

type ReloadActualDockWrite = {
  SegmentKey: string;
  TripKey?: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventOccurred: true;
  EventActualTime?: number;
};

export type { DockStatusEventRecord } from "./schemas";
export type {
  ActiveTripForPhysicalActualReconcile,
  ComputeDockEventsReloadArgs,
  ComputeReloadRowsFromScheduledEventsArgs,
  ComputeReloadRowsFromScheduledEventsResult,
  DockEventsReload,
  DockEventType,
  HistoryActualSource,
  NormalizedHistoryRecord,
  RawSeedSegment,
  ReloadActualDockWrite,
  TripContextForActualRow,
  TripRowForActualContext,
};
