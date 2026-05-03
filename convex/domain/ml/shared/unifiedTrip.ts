// ============================================================================
// UNIFIED TRIP STRUCTURE
// Single source of truth for ML training and prediction
// ============================================================================

import type {
  ConvexVesselTripWithML,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
// import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

// import { config } from "./core/config";

export type UnifiedTrip = {
  VesselAbbrev: string;
  PrevTerminalAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  // Physical-boundary semantics.
  TripStart?: number;
  TripEnd?: number;
  LeftDockActual?: number;
  ScheduledDeparture: number;
  LeftDock?: number;
  PrevLeftDock: number;
  PrevScheduledDeparture: number;
  /**
   * Physical arrival at the departing terminal when `TripStart` may still
   * carry a legacy mirror. Defaults to `TripStart` in `fromVesselTrip`.
   */
  OriginArrivalActual?: number;
  /**
   * Physical arrival at the destination terminal when `TripEnd` may still
   * carry a legacy mirror. Defaults to `TripEnd` in `fromVesselTrip`.
   */
  DestinationArrivalActual?: number;
};

/**
 * Creates a `UnifiedTrip` from the persisted vessel-trip shape used in
 * prediction flows.
 *
 * Normalizes `ConvexVesselTripWithPredictions` data for ML feature extraction and enforces
 * the minimum fields needed by the shared feature pipeline.
 *
 * Canonical timestamp fields are carried through when present so downstream
 * readers can observe the new contract without changing feature behavior yet.
 *
 * @param trip - Convex vessel trip record
 * @returns Unified trip structure ready for feature extraction
 */
export const fromVesselTrip = (
  trip: ConvexVesselTripWithPredictions | ConvexVesselTripWithML
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
    TripStart: trip.TripStart,
    TripEnd: trip.TripEnd,
    LeftDockActual: trip.LeftDockActual,
    ScheduledDeparture: trip.ScheduledDeparture,
    LeftDock: trip.LeftDock,
    PrevScheduledDeparture: trip.PrevScheduledDeparture,
    PrevLeftDock: trip.PrevLeftDock,
    OriginArrivalActual: trip.TripStart,
    DestinationArrivalActual: trip.TripEnd,
  };
};
