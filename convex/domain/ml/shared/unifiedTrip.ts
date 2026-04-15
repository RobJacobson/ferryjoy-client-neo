// ============================================================================
// UNIFIED TRIP STRUCTURE
// Single source of truth for ML training and prediction
// ============================================================================

import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
// import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

// import { config } from "./core/config";

export type UnifiedTrip = {
  VesselAbbrev: string;
  PrevTerminalAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  ArriveOriginDockActual?: number;
  ArriveDestDockActual?: number;
  DepartOriginActual?: number;
  StartTime?: number;
  EndTime?: number;
  TripStart: number;
  ScheduledDeparture: number;
  LeftDock?: number;
  TripEnd?: number;
  PrevLeftDock: number;
  PrevScheduledDeparture: number;
};

/**
 * Creates a `UnifiedTrip` from the persisted vessel-trip shape used in
 * prediction flows.
 *
 * Normalizes `ConvexVesselTrip` data for ML feature extraction and enforces
 * the minimum fields needed by the shared feature pipeline.
 *
 * Canonical timestamp fields are carried through when present so downstream
 * readers can observe the new contract without changing feature behavior yet.
 *
 * @param trip - Convex vessel trip record
 * @returns Unified trip structure ready for feature extraction
 */
export const fromVesselTrip = (
  trip: ConvexVesselTrip | ConvexVesselTripWithML
): UnifiedTrip => {
  if (
    !trip.TripStart ||
    !trip.PrevTerminalAbbrev ||
    !trip.DepartingTerminalAbbrev ||
    !trip.ArrivingTerminalAbbrev ||
    !trip.PrevScheduledDeparture ||
    !trip.PrevLeftDock ||
    !trip.ScheduledDeparture
  ) {
    throw new Error("Missing required fields");
  }

  return {
    VesselAbbrev: trip.VesselAbbrev,
    PrevTerminalAbbrev: trip.PrevTerminalAbbrev,
    DepartingTerminalAbbrev: trip.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
    ArriveOriginDockActual: trip.ArriveOriginDockActual,
    ArriveDestDockActual: trip.ArriveDestDockActual,
    DepartOriginActual: trip.DepartOriginActual,
    StartTime: trip.StartTime,
    EndTime: trip.EndTime,
    TripStart: trip.TripStart,
    ScheduledDeparture: trip.ScheduledDeparture,
    LeftDock: trip.LeftDock,
    TripEnd: trip.TripEnd,
    PrevScheduledDeparture: trip.PrevScheduledDeparture,
    PrevLeftDock: trip.PrevLeftDock,
  };
};
