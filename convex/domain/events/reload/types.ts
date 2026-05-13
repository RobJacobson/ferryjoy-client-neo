/**
 * Type shapes for dock-event reload assembly: hydrated dock status event
 * records, trip indexes, mutation slice results, and WSF adapter rows projected
 * to epoch-ms for hydrate. WsfScheduledSegment and WsfVesselHistory are not
 * persisted table documents and are not Convex mutation args validators.
 */

import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { DockStatusEventRecord } from "./dockStatusEventSchemas";

type WsfVesselHistory = {
  VesselId: number;
  Vessel?: string;
  Departing?: string;
  Arriving?: string;
  ScheduledDepart?: number;
  ActualDepart?: number;
  EstArrival?: number;
};

type WsfScheduledSegment = {
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

type BuildReloadDockSliceFromHydratedArgs = {
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

type BuildReloadDockSliceResult = {
  scheduledRows: ConvexScheduledDockEvent[];
  scheduledCount: number;
  actualRows: ConvexActualDockEvent[];
  actualCount: number;
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

export type { DockStatusEventRecord } from "./dockStatusEventSchemas";
export type {
  ActiveTripForPhysicalActualReconcile,
  BuildReloadDockSliceFromHydratedArgs,
  BuildReloadDockSliceResult,
  DockEventType,
  HistoryActualSource,
  NormalizedHistoryRecord,
  RawSeedSegment,
  ReloadActualDockWrite,
  TripContextForActualRow,
  TripRowForActualContext,
  WsfScheduledSegment,
  WsfVesselHistory,
};
