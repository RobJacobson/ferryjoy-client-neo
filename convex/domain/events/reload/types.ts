/**
 * Numeric reload input shapes for dock-event domain builders.
 *
 * Convex reload mutations validate epoch-millisecond payloads at their boundary
 * and pass these plain records into domain code. Adapter-specific Date rows stay
 * at the fetch edge.
 */

type EventReloadScheduleSegment = {
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

type EventReloadHistoryRecord = {
  VesselId: number;
  Vessel?: string;
  Departing?: string;
  Arriving?: string;
  ScheduledDepart?: number;
  ActualDepart?: number;
  EstArrival?: number;
};

export type { EventReloadHistoryRecord, EventReloadScheduleSegment };
