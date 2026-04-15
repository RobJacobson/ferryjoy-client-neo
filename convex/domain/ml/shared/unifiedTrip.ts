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
 * Coverage start timestamp for one trip instance.
 *
 * Canonical coverage fields are preferred; `TripStart` remains a transitional
 * fallback for legacy rows and older readers.
 */
export const getCoverageStartMs = (trip: {
  StartTime?: number;
  TripStart?: number;
}): number | undefined => trip.StartTime ?? trip.TripStart;

/**
 * Coverage end timestamp for one trip instance.
 *
 * Canonical coverage fields are preferred; `TripEnd` remains a transitional
 * fallback for legacy rows and older readers.
 */
export const getCoverageEndMs = (trip: {
  EndTime?: number;
  TripEnd?: number;
}): number | undefined => trip.EndTime ?? trip.TripEnd;

/**
 * Physical arrival at the origin dock for one trip instance.
 *
 * The canonical arrival boundary is preferred; `AtDockActual` and coverage
 * start are transitional fallbacks while the branch still has mixed readers.
 */
export const getOriginArrivalMs = (trip: {
  ArriveOriginDockActual?: number;
  AtDockActual?: number;
  StartTime?: number;
  TripStart?: number;
}): number | undefined =>
  trip.ArriveOriginDockActual ?? trip.AtDockActual ?? getCoverageStartMs(trip);

/**
 * Physical departure from the origin dock for one trip instance.
 *
 * Canonical departure is preferred; legacy departure mirrors remain only as
 * compatibility fallbacks.
 */
export const getDepartureMs = (trip: {
  DepartOriginActual?: number;
  LeftDockActual?: number;
  LeftDock?: number;
}): number | undefined =>
  trip.DepartOriginActual ?? trip.LeftDockActual ?? trip.LeftDock;

/**
 * Physical arrival at the destination dock for one trip instance.
 *
 * Canonical arrival is preferred; `ArriveDest` and coverage end are
 * transitional fallbacks.
 */
export const getDestinationArrivalMs = (trip: {
  ArriveDestDockActual?: number;
  ArriveDest?: number;
  EndTime?: number;
  TripEnd?: number;
}): number | undefined =>
  trip.ArriveDestDockActual ?? trip.ArriveDest ?? getCoverageEndMs(trip);

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
  const coverageStartMs = getCoverageStartMs(trip);
  const coverageEndMs = getCoverageEndMs(trip);
  if (
    !coverageStartMs ||
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
    TripStart: coverageStartMs,
    ScheduledDeparture: trip.ScheduledDeparture,
    LeftDock: trip.LeftDock,
    TripEnd: coverageEndMs,
    PrevScheduledDeparture: trip.PrevScheduledDeparture,
    PrevLeftDock: trip.PrevLeftDock,
  };
};
