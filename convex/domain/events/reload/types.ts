/**
 * Type shapes for dock-event reload assembly: hydrated boundary records, trip
 * indexes, and mutation slice results. Validators and inferred wire types live
 * under functions/events table schema modules.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import type {
  ConvexActualDockEvent,
  ConvexReloadDockHistoryRecord,
} from "functions/events/eventsActual/schemas";
import type {
  ConvexReloadDockScheduleSegment,
  ConvexScheduledDockEvent,
} from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";

type DockEventType = ConvexScheduledDockEvent["EventType"];

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

type BuildReloadDockRowSliceArgs = {
  sailingDay: string;
  scheduleSegments: ConvexReloadDockScheduleSegment[];
  historyRecords: ConvexReloadDockHistoryRecord[];
  updatedAt: number;
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
  physicalOnlyTrips: ActiveTripForPhysicalActualReconcile[];
  vesselLocations: ConvexVesselLocation[];
};

type BuildReloadDockSliceFromHydratedArgs = {
  sailingDay: string;
  events: DockBoundaryEventRecord[];
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

export type {
  ActiveTripForPhysicalActualReconcile,
  BuildReloadDockRowSliceArgs,
  BuildReloadDockSliceFromHydratedArgs,
  BuildReloadDockSliceResult,
  DockBoundaryEventRecord,
  DockEventType,
  HistoryActualSource,
  NormalizedHistoryRecord,
  RawSeedSegment,
  ReloadActualDockWrite,
  TripContextForActualRow,
  TripRowForActualContext,
};
