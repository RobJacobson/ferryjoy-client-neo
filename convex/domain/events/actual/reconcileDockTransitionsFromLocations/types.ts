/**
 * Shared types for the live-location reconcile pipeline.
 *
 * The reconcile pipeline consumes scheduled boundaries, prior actual rows,
 * vessel locations, and trip indexes; this module centralizes the input args
 * and the neutral boundary-event row type so the orchestrator and helper
 * modules share one vocabulary without circular imports.
 */

import type { ConvexVesselLocation } from "../../../../functions/vesselLocation/schemas";
import type { DockEventType } from "../../scheduled";
import type { ConvexScheduledDockEvent } from "../../scheduled/schemas";
import type {
  ActiveTripForPhysicalActualReconcile,
  TripContextForActualRow,
} from "../bindActualRowsToTrips";
import type { ConvexActualDockEvent } from "../schemas";

type VesselEventsByAbbrev<T extends { VesselAbbrev: string }> = Map<
  string,
  T[]
>;

type VesselLocationScheduledEventsBundle = {
  location: ConvexVesselLocation;
  vesselScheduledEvents: ConvexScheduledDockEvent[];
};

type ReconcileActualDockWritesFromLocationsArgs = {
  sailingDay: string;
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  vesselLocations: ConvexVesselLocation[];
  tripBySegmentKey?: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev?: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
};

type LocationReconcileBoundaryEvent = {
  SegmentKey: string;
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
  EventOccurred?: true;
  EventActualTime?: number;
};

export type {
  LocationReconcileBoundaryEvent,
  ReconcileActualDockWritesFromLocationsArgs,
  VesselEventsByAbbrev,
  VesselLocationScheduledEventsBundle,
};
