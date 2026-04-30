/**
 * Client-side trip timestamp helpers. Elsewhere under `src/`, prefer canonical
 * fields from the trip-timestamp PRD.
 */

import type { VesselLocation, VesselTrip } from "@/types";

/**
 * Coverage window end from {@link VesselTrip.TripEnd}.
 *
 * @param trip - Vessel trip or undefined
 * @returns Coverage end time, if any
 */
export const getCoverageEndTime = (
  trip: VesselTrip | undefined
): Date | undefined => trip?.TripEnd;

/**
 * Whether the trip row has ended its coverage window (completed or synthetic close).
 *
 * @param trip - Vessel trip or undefined
 * @returns True if {@link getCoverageEndTime} is defined
 */
export const hasTripCoverageEnded = (trip: VesselTrip | undefined): boolean =>
  Boolean(getCoverageEndTime(trip));

/**
 * Destination-side display time from trip end coverage close.
 *
 * @param trip - Vessel trip or undefined
 * @returns Time to show for “arrive next” actual column, if any
 */
export const getDestinationArrivalOrCoverageClose = (
  trip: VesselTrip | undefined
): Date | undefined => trip?.TripEnd ?? getCoverageEndTime(trip);

/**
 * Origin-dock arrival from {@link VesselTrip.TripStart}.
 *
 * @param trip - Vessel trip or undefined
 * @returns Origin arrival time, if any
 */
export const getOriginArrivalActual = (
  trip: VesselTrip | undefined
): Date | undefined => trip?.TripStart;

/**
 * Stable list key from primary trip timestamps (ms).
 *
 * @param trip - Vessel trip
 * @returns Milliseconds for keying, or undefined if no stable time
 */
export const getTripListKeyTimeMs = (trip: VesselTrip): number | undefined =>
  trip.TripStart?.getTime() ?? trip.TripEnd?.getTime();

/**
 * Gets the best available departure time for a trip (display / estimates).
 *
 * Priority:
 * 1. {@link VesselTrip.LeftDockActual} (canonical physical departure)
 * 2. VesselLocation.LeftDock (WSF feed)
 * 3. VesselTrip.LeftDock (legacy mirror)
 * 4. VesselTrip.AtDockDepartCurr (ML prediction at dock)
 *
 * @param vesselLocation - VesselLocation with WSF data
 * @param trip - VesselTrip with ML predictions
 * @returns Best available departure time
 */
export const getBestDepartureTime = (
  vesselLocation: VesselLocation | undefined,
  trip: VesselTrip | undefined
): Date | undefined =>
  trip?.LeftDockActual ??
  vesselLocation?.LeftDock ??
  trip?.LeftDock ??
  trip?.AtDockDepartCurr?.PredTime;

/**
 * Best arrival-related time for estimates, then ETA/predictions, then
 * coverage close as final fallback.
 *
 * @param vesselLocation - VesselLocation with WSF data
 * @param trip - VesselTrip with ML predictions
 * @returns Best arrival-related time for fallback chains
 */
export const getBestArrivalTime = (
  vesselLocation: VesselLocation | undefined,
  trip: VesselTrip | undefined
): Date | undefined =>
  trip?.TripEnd ??
  vesselLocation?.Eta ??
  trip?.AtSeaArriveNext?.PredTime ??
  trip?.AtDockArriveNext?.PredTime ??
  getCoverageEndTime(trip);
