/**
 * Trip time helpers: best-available departure/arrival time resolution.
 * Used by vesselTripToTripSegment for TimePoint construction.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";

/**
 * Gets arrival time for the next segment of the trip using predicted arrival time.
 * Returns undefined when trip or vesselLocation is missing.
 *
 * @param trip - The vessel trip object (optional)
 * @param vesselLocation - VesselLocation with Eta (optional)
 * @returns Arrival time Date, or undefined if none available or inputs missing
 */
export const getPredictedArriveNextTime = (
  trip: VesselTrip | undefined,
  vesselLocation: VesselLocation | undefined
): Date | undefined =>
  vesselLocation?.Eta ??
  trip?.AtSeaArriveNext?.PredTime ??
  trip?.AtDockArriveNext?.PredTime;

/**
 * Gets the best available departure time for a trip.
 *
 * Priority:
 * 1. VesselLocation.LeftDock (WSF actual departure)
 * 2. VesselTrip.LeftDock (ML actual departure)
 * 3. VesselTrip.AtDockDepartCurr (ML prediction at dock)
 *
 * @param vesselLocation - VesselLocation with WSF data
 * @param trip - VesselTrip with ML predictions
 * @returns Best available departure time
 */
export const getBestDepartureTime = (
  vesselLocation: VesselLocation | undefined,
  trip: VesselTrip | undefined
): Date | undefined =>
  vesselLocation?.LeftDock ??
  trip?.LeftDock ??
  trip?.AtDockDepartCurr?.PredTime;

/**
 * Gets the best available arrival time for a trip.
 *
 * Priority:
 * 1. VesselTrip.TripEnd (WSF actual arrival)
 * 2. VesselLocation.Eta (WSF at-sea prediction)
 * 3. VesselTrip.AtSeaArriveNext (ML at-sea prediction)
 * 4. VesselTrip.AtDockArriveNext (ML at-dock prediction)
 *
 * @param vesselLocation - VesselLocation with WSF data
 * @param trip - VesselTrip with ML predictions
 * @returns Best available arrival time
 */
export const getBestArrivalTime = (
  vesselLocation: VesselLocation | undefined,
  trip: VesselTrip | undefined
): Date | undefined =>
  trip?.TripEnd ??
  vesselLocation?.Eta ??
  trip?.AtSeaArriveNext?.PredTime ??
  trip?.AtDockArriveNext?.PredTime;
