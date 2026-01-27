/**
 * Schedule domain types (client-side).
 *
 * Mirrors the Convex `scheduledTrips` schema semantics while using Date objects
 * for all timestamps in the client domain layer.
 */

// ============================================================================
// TYPES
// ============================================================================

export type TripType = "direct" | "indirect";

/**
 * Scheduled trip representation for internal computation (epoch milliseconds).
 *
 * This is intentionally close to the Convex storage shape so we can port and
 * reuse the server-side sync algorithms with minimal changes.
 */
export type ScheduledTripMs = {
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  ArrivingTime?: number;
  SailingNotes: string;
  Annotations: string[];
  RouteID: number;
  RouteAbbrev: string;
  Key: string;
  SailingDay: string;
  TripType: TripType;
  PrevKey?: string;
  NextKey?: string;
  NextDepartingTime?: number;
  EstArriveNext?: number;
  EstArriveCurr?: number;
};

/**
 * Scheduled trip representation for the client domain layer (Date objects).
 */
export type ScheduledTrip = Omit<
  ScheduledTripMs,
  | "DepartingTime"
  | "ArrivingTime"
  | "NextDepartingTime"
  | "EstArriveNext"
  | "EstArriveCurr"
> & {
  DepartingTime: Date;
  ArrivingTime?: Date;
  NextDepartingTime?: Date;
  EstArriveNext?: Date;
  EstArriveCurr?: Date;
};

// ============================================================================
// CONVERSIONS
// ============================================================================

/**
 * Convert a ms-based scheduled trip to the client domain representation.
 *
 * @param trip - Scheduled trip with numeric timestamps (epoch ms)
 * @returns Scheduled trip with Date objects
 */
export const toDomainScheduledTrip = (trip: ScheduledTripMs): ScheduledTrip => ({
  ...trip,
  DepartingTime: new Date(trip.DepartingTime),
  ArrivingTime: trip.ArrivingTime ? new Date(trip.ArrivingTime) : undefined,
  NextDepartingTime: trip.NextDepartingTime
    ? new Date(trip.NextDepartingTime)
    : undefined,
  EstArriveNext: trip.EstArriveNext ? new Date(trip.EstArriveNext) : undefined,
  EstArriveCurr: trip.EstArriveCurr ? new Date(trip.EstArriveCurr) : undefined,
});

