/**
 * Trip time helpers: best-available departure/arrival time resolution.
 * Used by vesselTripToTripSegment for TimePoint construction.
 */

import type { VesselLocation, VesselTrip } from "@/types";

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
 * 1. VesselTrip.ArriveDest (actual arrival at destination)
 * 2. VesselTrip.TripEnd (delayed trip completion tick)
 * 3. VesselLocation.Eta (WSF at-sea prediction)
 * 4. VesselTrip.AtSeaArriveNext (ML at-sea prediction)
 * 5. VesselTrip.AtDockArriveNext (ML at-dock prediction)
 *
 * @param vesselLocation - VesselLocation with WSF data
 * @param trip - VesselTrip with ML predictions
 * @returns Best available arrival time
 */
export const getBestArrivalTime = (
  vesselLocation: VesselLocation | undefined,
  trip: VesselTrip | undefined
): Date | undefined =>
  trip?.ArriveDest ??
  trip?.TripEnd ??
  vesselLocation?.Eta ??
  trip?.AtSeaArriveNext?.PredTime ??
  trip?.AtDockArriveNext?.PredTime;
