/**
 * Client-side trip timestamp helpers. Elsewhere under `src/`, prefer canonical
 * fields from the trip-timestamp PRD; this module is the only place that should
 * read legacy `TripStart` / `TripEnd` / `ArriveDest` for UI compatibility
 * (besides tests).
 */

import type { VesselLocation, VesselTrip } from "@/types";

/**
 * Coverage window end: {@link VesselTrip.EndTime}, else legacy {@link VesselTrip.TripEnd}.
 *
 * @param trip - Vessel trip or undefined
 * @returns Coverage end time, if any
 */
export const getCoverageEndTime = (
  trip: VesselTrip | undefined
): Date | undefined => trip?.EndTime ?? trip?.TripEnd;

/**
 * Whether the trip row has ended its coverage window (completed or synthetic close).
 *
 * @param trip - Vessel trip or undefined
 * @returns True if {@link getCoverageEndTime} is defined
 */
export const hasTripCoverageEnded = (trip: VesselTrip | undefined): boolean =>
  Boolean(getCoverageEndTime(trip));

/**
 * Destination-side display time: physical arrival, then legacy `ArriveDest`, then
 * coverage end. Coverage end is not asserted destination arrival.
 *
 * @param trip - Vessel trip or undefined
 * @returns Time to show for “arrive next” actual column, if any
 */
export const getDestinationArrivalOrCoverageClose = (
  trip: VesselTrip | undefined
): Date | undefined =>
  trip?.ArriveDestDockActual ?? trip?.ArriveDest ?? getCoverageEndTime(trip);

/**
 * Origin-dock arrival: {@link VesselTrip.ArriveOriginDockActual}, else legacy
 * {@link VesselTrip.TripStart}.
 *
 * @param trip - Vessel trip or undefined
 * @returns Origin arrival time, if any
 */
export const getOriginArrivalActual = (
  trip: VesselTrip | undefined
): Date | undefined => trip?.ArriveOriginDockActual ?? trip?.TripStart;

/**
 * Stable list key from coverage and physical timestamps (ms); legacy mirrors last.
 *
 * @param trip - Vessel trip
 * @returns Milliseconds for keying, or undefined if no stable time
 */
export const getTripListKeyTimeMs = (trip: VesselTrip): number | undefined =>
  trip.StartTime?.getTime() ??
  trip.ArriveOriginDockActual?.getTime() ??
  trip.TripStart?.getTime() ??
  trip.ArriveDestDockActual?.getTime() ??
  trip.ArriveDest?.getTime() ??
  trip.EndTime?.getTime() ??
  trip.TripEnd?.getTime();

/**
 * Gets the best available departure time for a trip (display / estimates).
 *
 * Priority:
 * 1. {@link VesselTrip.DepartOriginActual} (canonical physical departure)
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
  trip?.DepartOriginActual ??
  vesselLocation?.LeftDock ??
  trip?.LeftDock ??
  trip?.AtDockDepartCurr?.PredTime;

/**
 * Best arrival-related time for estimates: physical and legacy actuals first, then
 * ETA and ML preds, then {@link getCoverageEndTime} (coverage only, not guaranteed
 * destination arrival).
 *
 * @param vesselLocation - VesselLocation with WSF data
 * @param trip - VesselTrip with ML predictions
 * @returns Best arrival-related time for fallback chains
 */
export const getBestArrivalTime = (
  vesselLocation: VesselLocation | undefined,
  trip: VesselTrip | undefined
): Date | undefined =>
  trip?.ArriveDestDockActual ??
  trip?.ArriveDest ??
  vesselLocation?.Eta ??
  trip?.AtSeaArriveNext?.PredTime ??
  trip?.AtDockArriveNext?.PredTime ??
  getCoverageEndTime(trip);
