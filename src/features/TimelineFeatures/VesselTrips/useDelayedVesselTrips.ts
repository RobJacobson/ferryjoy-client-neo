/**
 * Custom hook for managing delayed vessel trips with a hold window.
 *
 * Tracks trips and maintains them for 30 seconds after they disappear
 * from the active list (e.g., when a vessel arrives at dock).
 * This prevents UI flicker and allows showing a "Completed" state.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { useEffect, useState } from "react";
import { useInterval } from "@/shared/hooks";

const HOLD_DURATION_MS = 30 * 1000; // 30 seconds

/**
 * Result type from useDelayedVesselTrips hook.
 */
export type DelayedVesselTripsResult = {
  /** Array of trips and their associated locations to display, applying hold window logic */
  displayData: {
    trip: VesselTrip;
    vesselLocation: VesselLocation;
  }[];
};

/**
 * Hook that manages delayed vessel trips with a hold window.
 *
 * This hook tracks current trips for each vessel and ensures that when a trip
 * completes (disappears from activeTrips), it remains in the display list
 * for 30 seconds with an injected TripEnd timestamp.
 *
 * It also handles the "preemption" logic: if a new trip starts for a vessel
 * while the previous one is still in its 30-second hold period, the old
 * trip continues to be shown until the hold expires.
 *
 * Crucially, it also captures and "freezes" the vesselLocation data when a trip
 * enters the hold state, ensuring the UI doesn't jump to the next trip's
 * location state (like AtDock: true at the destination) prematurely.
 *
 * @param activeTrips - Current active trips from Convex
 * @param vesselLocations - Current vessel locations from Convex
 * @returns Object with displayData array containing paired trips and locations
 */
export const useDelayedVesselTrips = (
  activeTrips: VesselTrip[],
  vesselLocations: VesselLocation[]
): DelayedVesselTripsResult => {
  // Internal state tracking trips and locations by vessel abbreviation
  const [tripsByAbbrev, setTripsByAbbrev] = useState<
    Record<string, VesselTrip>
  >({});
  const [locationsByAbbrev, setLocationsByAbbrev] = useState<
    Record<string, VesselLocation>
  >({});

  // Helper to reconcile state
  const reconcile = (nowMs: number) => {
    const activeByAbbrev: Record<string, VesselTrip> = {};
    for (const trip of activeTrips) {
      activeByAbbrev[trip.VesselAbbrev] = trip;
    }

    const locationByAbbrev: Record<string, VesselLocation> = {};
    for (const loc of vesselLocations) {
      locationByAbbrev[loc.VesselAbbrev] = loc;
    }

    const allAbbrevs = new Set<string>([
      ...Object.keys(tripsByAbbrev),
      ...Object.keys(activeByAbbrev),
    ]);

    let tripsChanged = false;
    let locationsChanged = false;
    const nextTrips: Record<string, VesselTrip> = {};
    const nextLocations: Record<string, VesselLocation> = {};

    // 2. Handle trips that just disappeared (Transition to HOLD)
    allAbbrevs.forEach((abbrev) => {
      const prevTrip = tripsByAbbrev[abbrev];
      const activeTrip = activeByAbbrev[abbrev];
      const currentLocation = locationByAbbrev[abbrev];

      let resolvedTrip: VesselTrip | null = null;

      if (!prevTrip) {
        resolvedTrip = activeTrip ?? null;
      } else if (!activeTrip) {
        // Trip disappeared: end+hold+expire.
        const ended = prevTrip.TripEnd
          ? prevTrip
          : { ...prevTrip, TripEnd: new Date(nowMs) };
        const endedAtMs = ended.TripEnd?.getTime() ?? nowMs;
        const shouldHold = nowMs - endedAtMs < HOLD_DURATION_MS;
        resolvedTrip = shouldHold ? ended : null;
      } else if (prevTrip.Key === activeTrip.Key) {
        // Same logical trip; allow updates from active data.
        resolvedTrip = activeTrip;
      } else {
        // Active trip changed: keep showing the previous trip for a short window.
        const endedPrev = prevTrip.TripEnd
          ? prevTrip
          : { ...prevTrip, TripEnd: new Date(nowMs) };
        const endedAtMs = endedPrev.TripEnd?.getTime() ?? nowMs;
        const shouldHold = nowMs - endedAtMs < HOLD_DURATION_MS;
        resolvedTrip = shouldHold ? endedPrev : activeTrip;
      }

      if (resolvedTrip) {
        nextTrips[abbrev] = resolvedTrip;

        // If we are holding a completed trip, we freeze the location
        if (resolvedTrip.TripEnd && prevTrip && locationsByAbbrev[abbrev]) {
          nextLocations[abbrev] = locationsByAbbrev[abbrev];
        } else if (currentLocation) {
          nextLocations[abbrev] = currentLocation;
        }

        // If the trip just ended (entered hold), capture the actual arrival time from the vessel location.
        // Truncate to the minute for a cleaner display.
        if (
          resolvedTrip.TripEnd &&
          !prevTrip?.TripEnd &&
          currentLocation?.TimeStamp
        ) {
          const arrivalDate = new Date(currentLocation.TimeStamp);
          arrivalDate.setSeconds(0, 0);
          resolvedTrip.TripEnd = arrivalDate;
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

  // Reconcile immediately when inputs change
  useEffect(() => {
    reconcile(Date.now());
  }, [reconcile]);

  // Reconcile periodically for expirations
  useInterval(() => {
    reconcile(Date.now());
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
