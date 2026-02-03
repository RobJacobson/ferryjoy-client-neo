/**
 * Utility for matching a scheduled trip segment to a real-time vessel trip.
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { Segment } from "../types";

/**
 * Result of the vessel trip matching logic.
 */
export type MatchResult = {
  /**
   * The matched vessel trip, if any.
   */
  displayTrip: VesselTrip | null;
  /**
   * Whether the matched trip is an incoming vessel (heading to the origin).
   */
  isIncoming: boolean;
  /**
   * Whether the vessel is currently at the departing terminal for this segment.
   */
  isAtDepartingTerminal: boolean;
  /**
   * Whether the vessel is currently at sea for this segment.
   */
  isAtSeaForSegment: boolean;
  /**
   * Whether the vessel is actually at the terminal (AtDock + matching terminal).
   */
  isActuallyAtTerminal: boolean;
};

/**
 * Matches a scheduled segment to a real-time vessel trip using optimized maps.
 *
 * @param segment - The scheduled journey segment
 * @param vesselAbbrev - The vessel assigned to the schedule
 * @param vesselTripMap - Map of trips indexed by Key
 * @param vesselTripsByVessel - Map of all trips for each vessel
 * @param tripsByTerminalAndTime - Map of trips indexed by terminal + scheduled time
 * @returns MatchResult containing the matched trip and its status
 */
export const matchVesselTrip = (
  segment: Segment,
  vesselAbbrev: string,
  vesselTripMap: Map<string, VesselTrip>,
  vesselTripsByVessel: Map<string, VesselTrip[]>,
  tripsByTerminalAndTime: Map<string, VesselTrip>
): MatchResult => {
  // 1. Primary Lookup: Use DirectKey (physical movement) or Key (logical trip)
  const physicalKey = segment.DirectKey || segment.Key;
  const activeTrip = vesselTripMap.get(physicalKey);

  // 2. Secondary Lookup: Fallback to terminal + time if no active trip found
  // (Common for recently completed or upcoming trips not yet in activeVesselTrips)
  const terminalTimeKey = `${segment.DepartingTerminalAbbrev}_${segment.DepartingTime.getTime()}`;
  const directTripForPhysicalDeparture =
    activeTrip || tripsByTerminalAndTime.get(terminalTimeKey);

  // 3. Incoming Vessel Search: Find if the vessel is heading to the origin terminal
  const vesselTrips = vesselTripsByVessel.get(vesselAbbrev) || [];
  const incomingVesselTrip = vesselTrips.find(
    (t) =>
      t.ArrivingTerminalAbbrev === segment.DepartingTerminalAbbrev &&
      (t.predictions.departNext?.time.getTime() ===
        segment.DepartingTime.getTime() ||
        t.ScheduledTrip?.NextDepartingTime?.getTime() ===
          segment.DepartingTime.getTime() ||
        t.ScheduledTrip?.SchedArriveNext?.getTime() ===
          segment.DepartingTime.getTime() ||
        t.ScheduledDeparture?.getTime() === segment.DepartingTime.getTime() ||
        t.ScheduledTrip?.DepartingTime.getTime() ===
          segment.DepartingTime.getTime())
  );

  // 4. Vessel for Schedule: Vessel assigned to this schedule heading to or at the departing terminal
  const vesselForSchedule = vesselTrips.find(
    (t) =>
      !t.TripEnd &&
      !t.LeftDock &&
      // Priority 1: Currently at the dock for this segment
      ((t.AtDock &&
        t.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev &&
        (t.ScheduledDeparture?.getTime() === segment.DepartingTime.getTime() ||
          t.ScheduledTrip?.DepartingTime.getTime() ===
            segment.DepartingTime.getTime())) ||
        // Priority 2: Heading to the dock for this segment
        (!t.AtDock &&
          t.ArrivingTerminalAbbrev === segment.DepartingTerminalAbbrev &&
          (t.predictions.departNext?.time.getTime() ===
            segment.DepartingTime.getTime() ||
            t.ScheduledTrip?.NextDepartingTime?.getTime() ===
              segment.DepartingTime.getTime() ||
            t.ScheduledTrip?.SchedArriveNext?.getTime() ===
              segment.DepartingTime.getTime() ||
            t.ScheduledDeparture?.getTime() ===
              segment.DepartingTime.getTime() ||
            t.ScheduledTrip?.DepartingTime.getTime() ===
              segment.DepartingTime.getTime()))) &&
      // Temporal safety: Only match if the trip's scheduled departure is within 30 mins
      Math.abs((t.ScheduledDeparture?.getTime() || 0) - Date.now()) <
        30 * 60 * 1000
  );

  // Determine the display trip based on priority
  // We prioritize the active trip, then the physical departure match, then schedule-specific matches
  const displayTrip =
    activeTrip ||
    directTripForPhysicalDeparture ||
    vesselForSchedule ||
    incomingVesselTrip ||
    null;

  // Calculate status flags
  const isActuallyAtTerminal =
    !!displayTrip &&
    displayTrip.AtDock &&
    displayTrip.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev;

  const isAtDepartingTerminal =
    !!displayTrip &&
    displayTrip.AtDock &&
    displayTrip.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev &&
    (displayTrip.ScheduledDeparture?.getTime() ===
      segment.DepartingTime.getTime() ||
      displayTrip.ScheduledTrip?.DepartingTime.getTime() ===
        segment.DepartingTime.getTime());

  const isAtSeaForSegment =
    !!displayTrip &&
    !displayTrip.AtDock &&
    displayTrip.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev &&
    (displayTrip.ScheduledDeparture?.getTime() ===
      segment.DepartingTime.getTime() ||
      displayTrip.ScheduledTrip?.DepartingTime.getTime() ===
        segment.DepartingTime.getTime());

  const isIncoming =
    displayTrip === incomingVesselTrip ||
    (displayTrip === vesselForSchedule &&
      !!displayTrip &&
      !displayTrip.AtDock &&
      displayTrip.ArrivingTerminalAbbrev === segment.DepartingTerminalAbbrev &&
      (displayTrip.predictions.departNext?.time.getTime() ===
        segment.DepartingTime.getTime() ||
        displayTrip.ScheduledTrip?.NextDepartingTime?.getTime() ===
          segment.DepartingTime.getTime() ||
        displayTrip.ScheduledTrip?.SchedArriveNext?.getTime() ===
          segment.DepartingTime.getTime() ||
        displayTrip.ScheduledDeparture?.getTime() ===
          segment.DepartingTime.getTime() ||
        displayTrip.ScheduledTrip?.DepartingTime.getTime() ===
          segment.DepartingTime.getTime()));

  return {
    displayTrip,
    isIncoming,
    isAtDepartingTerminal,
    isAtSeaForSegment,
    isActuallyAtTerminal,
  };
};
