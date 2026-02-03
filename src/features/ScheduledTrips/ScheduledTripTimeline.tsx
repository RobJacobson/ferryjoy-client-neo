/**
 * ScheduledTripTimeline component for displaying a sequence of scheduled trip segments.
 * Visualizes the journey from departure terminal to final destination, including intermediate stops.
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { getVesselName } from "@/domain/vesselAbbreviations";
import { createVesselTripMap } from "../Timeline/utils";
import { TimelineSegmentLeg } from "./components/TimelineSegmentLeg";
import type { Segment } from "./types";

type ScheduledTripTimelineProps = {
  /**
   * Vessel abbreviation for the trip.
   */
  vesselAbbrev: string;
  /**
   * Array of segments forming the complete journey.
   */
  segments: Segment[];
};

/**
 * Displays a multi-segment timeline for scheduled ferry trips.
 * Shows scheduled departure times and arrival times, with actual times overlaid if a matching
 * active or recently completed trip is found.
 *
 * @param vesselAbbrev - Vessel abbreviation for the trip
 * @param segments - Array of trip segments to display
 * @returns A View component with a sequence of markers and progress bars
 */
export const ScheduledTripTimeline = ({
  vesselAbbrev,
  segments,
}: ScheduledTripTimelineProps) => {
  const { dailyVesselTrips, activeVesselTrips } = useConvexVesselTrips();
  const { vesselLocations } = useConvexVesselLocations();
  const circleSize = 20;

  // Index vessel trips by Key for O(1) lookup
  const vesselTripMap = createVesselTripMap(dailyVesselTrips);

  // Create a map of active trips for better matching
  const activeVesselTripMap = createVesselTripMap(activeVesselTrips);

  // Index trips by vessel for O(vessel) lookup
  const vesselTripsByVessel = new Map<string, VesselTrip[]>();
  for (const trip of dailyVesselTrips) {
    const existing = vesselTripsByVessel.get(trip.VesselAbbrev) || [];
    existing.push(trip);
    vesselTripsByVessel.set(trip.VesselAbbrev, existing);
  }

  // Index trips by terminal and time for O(1) lookup
  const tripsByTerminalAndTime = new Map<string, VesselTrip>();
  for (const trip of dailyVesselTrips) {
    const key = `${trip.DepartingTerminalAbbrev}_${trip.ScheduledDeparture?.getTime() || trip.ScheduledTrip?.DepartingTime.getTime()}`;
    tripsByTerminalAndTime.set(key, trip);
  }

  // Use the vessel name for progress bars
  const vesselName = getVesselName(vesselAbbrev);

  // Find current vessel location data
  const currentVessel = vesselLocations.find(
    (v) => v.VesselAbbrev === vesselAbbrev
  );
  const vesselSpeed = currentVessel?.Speed ?? 0;

  if (segments.length === 0) return null;

  const isMultiSegmentTrip = segments.length > 1;

  return (
    <View className="relative flex-row items-center w-full overflow-visible px-4 py-8">
      {segments.map((segment, index) => (
        <TimelineSegmentLeg
          key={segment.Key}
          segment={segment}
          vesselAbbrev={vesselAbbrev}
          vesselName={vesselName}
          vesselSpeed={vesselSpeed}
          circleSize={circleSize}
          vesselTripMap={vesselTripMap}
          activeVesselTripMap={activeVesselTripMap}
          vesselTripsByVessel={vesselTripsByVessel}
          tripsByTerminalAndTime={tripsByTerminalAndTime}
          currentVessel={currentVessel}
          isFirst={index === 0}
          isLast={index === segments.length - 1}
          skipAtDock={isMultiSegmentTrip && index === 0}
        />
      ))}
    </View>
  );
};
