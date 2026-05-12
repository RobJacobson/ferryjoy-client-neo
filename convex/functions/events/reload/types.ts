/**
 * Epoch-ms projections of WSF schedule and vessel-history payloads fed into
 * buildHydratedDockBoundaryEventsForReload. These are not persisted table
 * documents and are not Convex mutation args validators.
 */

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

export type { WsfScheduledSegment, WsfVesselHistory };
