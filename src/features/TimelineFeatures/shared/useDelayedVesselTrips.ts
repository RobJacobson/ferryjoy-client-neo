/**
 * Custom hook for managing delayed vessel trips with a hold window.
 *
 * Tracks trips and maintains them for 30 seconds after they disappear
 * from the active list (e.g., when a vessel arrives at dock).
 * This prevents UI flicker and allows showing a "Completed" state.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { useEffect, useRef, useState } from "react";
import { useInterval } from "@/shared/hooks";

const HOLD_DURATION_MS = 30 * 1000; // 30 seconds

/**
 * Rounds a timestamp down to the start of its minute (seconds and ms zeroed).
 *
 * @param ts - Unix timestamp in ms
 * @returns Date rounded to minute boundary
 */
function roundToMinute(ts: number): Date {
  const d = new Date(ts);
  d.setSeconds(0, 0);
  return d;
}

/**
 * Result type from useDelayedVesselTrips hook.
 */
export type DelayedVesselTripsResult = {
  /** Array of trips and their associated locations to display, applying hold window logic */
  displayData: {
    trip: VesselTripWithScheduledTrip;
    vesselLocation: VesselLocation;
  }[];
};

/**
 * Hook that manages delayed vessel trips with a hold window.
 *
 * Tracks current trips for each vessel and ensures that when a trip completes
 * (disappears from activeTrips), it remains in the display list for 30 seconds
 * with an injected TripEnd timestamp.
 *
 * Handles preemption: if a new trip starts while the previous is in its hold
 * period, the old trip continues to be shown until the hold expires.
 *
 * Freezes vesselLocation when a trip enters hold so the UI doesn't jump to the
 * next trip's state (e.g., AtDock at destination) prematurely.
 *
 * @param activeTrips - Current active trips from Convex
 * @param vesselLocations - Current vessel locations from Convex
 * @returns Object with displayData array containing paired trips and locations
 */
export const useDelayedVesselTrips = (
  activeTrips: VesselTripWithScheduledTrip[],
  vesselLocations: VesselLocation[]
): DelayedVesselTripsResult => {
  const [tripsByAbbrev, setTripsByAbbrev] = useState<
    Record<string, VesselTripWithScheduledTrip>
  >({});
  const [locationsByAbbrev, setLocationsByAbbrev] = useState<
    Record<string, VesselLocation>
  >({});

  const paramsRef = useRef({ activeTrips, vesselLocations });
  paramsRef.current = { activeTrips, vesselLocations };

  const reconcile = (
    nowMs: number,
    trips: VesselTripWithScheduledTrip[],
    locations: VesselLocation[]
  ) => {
    const activeByAbbrev: Record<string, VesselTripWithScheduledTrip> = {};
    for (const trip of trips) {
      activeByAbbrev[trip.VesselAbbrev] = trip;
    }

    const locationByAbbrev: Record<string, VesselLocation> = {};
    for (const loc of locations) {
      locationByAbbrev[loc.VesselAbbrev] = loc;
    }

    const allAbbrevs = new Set<string>([
      ...Object.keys(tripsByAbbrev),
      ...Object.keys(activeByAbbrev),
    ]);

    let tripsChanged = false;
    let locationsChanged = false;
    const nextTrips: Record<string, VesselTripWithScheduledTrip> = {};
    const nextLocations: Record<string, VesselLocation> = {};

    allAbbrevs.forEach((abbrev) => {
      const prevTrip = tripsByAbbrev[abbrev];
      const activeTrip = activeByAbbrev[abbrev];
      const currentLocation = locationByAbbrev[abbrev];

      let resolvedTrip: VesselTripWithScheduledTrip | null = null;

      if (!prevTrip) {
        // No previous: show active or nothing
        resolvedTrip = activeTrip ?? null;
      } else if (!activeTrip) {
        // Trip disappeared: inject TripEnd, hold for 30s, then clear
        const ended = prevTrip.TripEnd
          ? prevTrip
          : { ...prevTrip, TripEnd: new Date(nowMs) };
        const endedAtMs = ended.TripEnd?.getTime() ?? nowMs;
        const shouldHold = nowMs - endedAtMs < HOLD_DURATION_MS;
        resolvedTrip = shouldHold ? ended : null;
      } else if (prevTrip.Key === activeTrip.Key) {
        // Same trip: allow updates from active
        resolvedTrip = activeTrip;
      } else {
        // Different trip (new one started): hold previous for 30s, then show new
        const endedPrev = prevTrip.TripEnd
          ? prevTrip
          : { ...prevTrip, TripEnd: new Date(nowMs) };
        const endedAtMs = endedPrev.TripEnd?.getTime() ?? nowMs;
        const shouldHold = nowMs - endedAtMs < HOLD_DURATION_MS;
        resolvedTrip = shouldHold ? endedPrev : activeTrip;
      }

      if (resolvedTrip) {
        nextTrips[abbrev] = resolvedTrip;

        // When holding a completed trip, freeze location; otherwise use current
        if (resolvedTrip.TripEnd && prevTrip && locationsByAbbrev[abbrev]) {
          nextLocations[abbrev] = locationsByAbbrev[abbrev];
        } else if (currentLocation) {
          nextLocations[abbrev] = currentLocation;
        }

        // On first entering hold: capture actual arrival from location (rounded to minute)
        if (
          resolvedTrip.TripEnd &&
          !prevTrip?.TripEnd &&
          currentLocation?.TimeStamp
        ) {
          resolvedTrip.TripEnd = roundToMinute(
            currentLocation.TimeStamp.getTime()
          );
        }

        if (!prevTrip || prevTrip.TimeStamp !== resolvedTrip.TimeStamp) {
          tripsChanged = true;
        }
        if (
          !locationsByAbbrev[abbrev] ||
          locationsByAbbrev[abbrev].TimeStamp !==
            nextLocations[abbrev].TimeStamp
        ) {
          locationsChanged = true;
        }
      } else {
        if (prevTrip) tripsChanged = true;
        if (locationsByAbbrev[abbrev]) locationsChanged = true;
      }
    });

    if (tripsChanged) setTripsByAbbrev(nextTrips);
    if (locationsChanged) setLocationsByAbbrev(nextLocations);
  };

  // Reconcile when inputs change; reconcile is stable (params passed explicitly)
  // biome-ignore lint/correctness/useExhaustiveDependencies: reconcile recreated each render; activeTrips/vesselLocations are the meaningful deps
  useEffect(() => {
    reconcile(Date.now(), activeTrips, vesselLocations);
  }, [activeTrips, vesselLocations]);

  useInterval(() => {
    const { activeTrips: trips, vesselLocations: locs } = paramsRef.current;
    reconcile(Date.now(), trips, locs);
  }, 1000);

  const displayData = Object.keys(tripsByAbbrev)
    .map((abbrev) => ({
      trip: tripsByAbbrev[abbrev],
      vesselLocation: locationsByAbbrev[abbrev],
    }))
    .filter((item) => item.vesselLocation !== undefined);

  return {
    displayData,
  };
};
