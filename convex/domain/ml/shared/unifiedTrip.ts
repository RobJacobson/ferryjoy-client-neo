// ============================================================================
// UNIFIED TRIP STRUCTURE
// Single source of truth for ML training and prediction
// ============================================================================

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
// import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

// import { config } from "./core/config";

export type UnifiedTrip = {
  VesselAbbrev: string;
  PrevTerminalAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  TripStart: number;
  ScheduledDeparture: number;
  LeftDock?: number;
  TripEnd?: number;
  PrevLeftDock: number;
  PrevScheduledDeparture: number;
};

/**
 * Create UnifiedTrip from VesselTrip (for prediction)
 *
 * Normalizes VesselTrip data for ML feature extraction.
 * Required fields are enforced (TripStart, PrevAtSeaDuration, PrevTripDelay).
 *
 * @param trip - Convex vessel trip record
 * @returns Unified trip structure or null if required fields missing
 */
export const fromVesselTrip = (trip: ConvexVesselTrip): UnifiedTrip => {
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
    TripStart: trip.TripStart,
    ScheduledDeparture: trip.ScheduledDeparture,
    LeftDock: trip.LeftDock,
    TripEnd: trip.TripEnd,
    PrevScheduledDeparture: trip.PrevScheduledDeparture,
    PrevLeftDock: trip.PrevLeftDock,
  };
};
