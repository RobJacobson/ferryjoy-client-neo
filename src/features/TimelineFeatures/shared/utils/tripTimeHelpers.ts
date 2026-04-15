/**
 * Trip time helpers: best-available departure/arrival resolution and coverage
 * queries. Prefers canonical physical boundary fields (see trip-timestamp PRD)
 * over legacy TripStart / TripEnd / ArriveDest mirrors.
 */

import type { VesselLocation, VesselTrip } from "@/types";

/**
 * Returns true when the trip row has a coverage end (completed or synthetic
 * close). Checks {@link VesselTrip.EndTime} first, then legacy {@link VesselTrip.TripEnd}.
 *
 * @param trip - Vessel trip or undefined
 * @returns Whether coverage has ended
 */
export const hasTripCoverageEnded = (trip: VesselTrip | undefined): boolean =>
  Boolean(trip?.EndTime ?? trip?.TripEnd);

/**
 * Physical destination arrival if asserted, else legacy {@link VesselTrip.ArriveDest},
 * else coverage end ({@link VesselTrip.EndTime} / legacy {@link VesselTrip.TripEnd}).
 * Used for timeline “arrive next” actuals; do not treat coverage end as physical proof.
 *
 * @param trip - Vessel trip or undefined
 * @returns Best display time for destination-side closure, if any
 */
export const getDestinationArrivalOrCoverageClose = (
  trip: VesselTrip | undefined
): Date | undefined =>
  trip?.ArriveDestDockActual ??
  trip?.ArriveDest ??
  trip?.EndTime ??
  trip?.TripEnd;

/**
 * Origin-dock arrival actual, with legacy {@link VesselTrip.TripStart} fallback.
 *
 * @param trip - Vessel trip or undefined
 * @returns Asserted origin arrival time, if any
 */
export const getOriginArrivalActual = (
  trip: VesselTrip | undefined
): Date | undefined => trip?.ArriveOriginDockActual ?? trip?.TripStart;

/**
 * Stable list key fragment from coverage / identity timestamps (ms).
 * Prefer {@link VesselTrip.StartTime} and physical actuals over legacy fields.
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
 * Gets the best available arrival-at-destination time for a trip.
 *
 * Physical destination arrival ({@link VesselTrip.ArriveDestDockActual}) comes
 * first; {@link VesselTrip.EndTime} / legacy {@link VesselTrip.TripEnd} are
 * coverage-only closes and appear only after predictions and ETA fallbacks.
 *
 * Priority:
 * 1. ArriveDestDockActual
 * 2. ArriveDest (legacy)
 * 3. VesselLocation.Eta
 * 4. AtSeaArriveNext / AtDockArriveNext predictions
 * 5. EndTime / TripEnd (coverage window close — not asserted destination arrival)
 *
 * @param vesselLocation - VesselLocation with WSF data
 * @param trip - VesselTrip with ML predictions
 * @returns Best available arrival-related time
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
  trip?.EndTime ??
  trip?.TripEnd;
