/**
 * useVesselDailyTimeline hook aggregates scheduled and actual trip data for a vessel
 * and maps it to a vertical time-scaled timeline.
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../../convex/_generated/api";
import type { ScheduledTrip } from "../../../../convex/functions/scheduledTrips/schemas";
import { toDomainScheduledTrip } from "../../../../convex/functions/scheduledTrips/schemas";
import type { VesselLocation } from "../../../../convex/functions/vesselLocation/schemas";
import { getSailingDay } from "../../../shared/utils/getSailingDay";

// ============================================================================
// Constants
// ============================================================================

export const PIXELS_PER_HOUR = 800; // Adjusted for better mobile scrolling
const MS_PER_HOUR = 3600000;

// ============================================================================
// Types
// ============================================================================

export type TimelineEvent = {
  id: string;
  type: "arrival" | "departure";
  terminal: string;
  time: Date;
  scheduledTime: Date;
  offsetY: number;
  isActual: boolean;
};

export type VesselDailyTimelineData = {
  windowStartMs: number;
  windowEndMs: number;
  totalHeight: number;
  events: TimelineEvent[];
  currentProgressMs: number;
  currentOffsetY: number;
  vesselName?: string;
  speed?: number;
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Aggregates vessel trip data for a single sailing day and maps it to vertical offsets.
 *
 * @param vesselAbbrev - Vessel abbreviation (e.g. "SEA")
 * @param vesselLocation - Current real-time location data
 * @returns Timeline data for vertical rendering
 */
export const useVesselDailyTimeline = (
  vesselAbbrev: string,
  vesselLocation: VesselLocation | null
): VesselDailyTimelineData | null => {
  const now = vesselLocation?.TimeStamp
    ? new Date(vesselLocation.TimeStamp)
    : new Date();
  const sailingDay = getSailingDay(now);

  // 1. Fetch direct scheduled trips for the vessel
  const rawScheduledTrips = useQuery(
    api.functions.scheduledTrips.queries.getDirectScheduledTripsForVessel,
    {
      vesselAbbrev,
      sailingDay,
    }
  );

  const scheduledTrips = useMemo(
    () => rawScheduledTrips?.map(toDomainScheduledTrip),
    [rawScheduledTrips]
  );

  return useMemo(() => {
    if (!scheduledTrips || scheduledTrips.length === 0) return null;

    // Find the in-service window (rounded to hours)
    const firstDepartureMs = scheduledTrips[0].DepartingTime.getTime();
    const lastArrivalMs =
      scheduledTrips[scheduledTrips.length - 1].SchedArriveNext?.getTime() ??
      scheduledTrips[scheduledTrips.length - 1].DepartingTime.getTime() +
        MS_PER_HOUR / 2;

    const windowStartMs =
      Math.floor(firstDepartureMs / MS_PER_HOUR) * MS_PER_HOUR;
    const windowEndMs = Math.ceil(lastArrivalMs / MS_PER_HOUR) * MS_PER_HOUR;
    const totalHeight =
      ((windowEndMs - windowStartMs) / MS_PER_HOUR) * PIXELS_PER_HOUR;

    const calculateOffsetY = (timeMs: number) => {
      return ((timeMs - windowStartMs) / MS_PER_HOUR) * PIXELS_PER_HOUR;
    };

    // Map scheduled trips to events (Arrivals and Departures)
    const events: TimelineEvent[] = [];

    scheduledTrips.forEach((trip: ScheduledTrip) => {
      const depTimeMs = trip.DepartingTime.getTime();
      // Departure Event
      events.push({
        id: `${trip.Key}-dep`,
        type: "departure",
        terminal: trip.DepartingTerminalAbbrev,
        time: trip.DepartingTime,
        scheduledTime: trip.DepartingTime,
        offsetY: calculateOffsetY(depTimeMs),
        isActual: false, // Will be updated when we add historical data
      });

      // Arrival Event
      if (trip.SchedArriveNext) {
        const arrTimeMs = trip.SchedArriveNext.getTime();
        events.push({
          id: `${trip.Key}-arr`,
          type: "arrival",
          terminal: trip.ArrivingTerminalAbbrev,
          time: trip.SchedArriveNext,
          scheduledTime: trip.SchedArriveNext,
          offsetY: calculateOffsetY(arrTimeMs),
          isActual: false,
        });
      }
    });

    // Sort events by time just in case
    events.sort((a, b) => a.time.getTime() - b.time.getTime());

    const currentProgressMs = now.getTime();
    const currentOffsetY = calculateOffsetY(currentProgressMs);

    return {
      windowStartMs,
      windowEndMs,
      totalHeight,
      events,
      currentProgressMs,
      currentOffsetY,
      vesselName: vesselLocation?.VesselName,
      speed: vesselLocation?.Speed,
    };
  }, [scheduledTrips, vesselLocation, now]);
};
