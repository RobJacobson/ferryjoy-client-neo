/**
 * ScheduledTripTimeline component for displaying a sequence of scheduled trip segments.
 * Visualizes the journey from departure terminal to final destination, including intermediate stops.
 */

import { api } from "convex/_generated/api";
import { toDomainVesselTrip } from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { View } from "react-native";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { createVesselTripMap } from "../Timeline/utils";
import { useDelayedVesselTrips } from "../VesselTrips/useDelayedVesselTrips";
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
 * VesselLocation is PRIMARY source for all vessel state data.
 * VesselTrip and ScheduledTrips are SECONDARY lookups for predictions and schedule info.
 *
 * @param vesselAbbrev - Vessel abbreviation for the trip
 * @param segments - Array of trip segments to display
 * @returns A View component with a sequence of markers and progress bars
 */
export const ScheduledTripTimeline = ({
  vesselAbbrev,
  segments,
}: ScheduledTripTimelineProps) => {
  const { activeVesselTrips } = useConvexVesselTrips();
  const { vesselLocations } = useConvexVesselLocations();
  const { displayData } = useDelayedVesselTrips(
    activeVesselTrips,
    vesselLocations
  );
  const circleSize = 20;

  const sailingDay = segments[0]?.SailingDay;
  const departingTerminalAbbrevs = [
    ...new Set(segments.map((s) => s.DepartingTerminalAbbrev)),
  ];
  const rawCompletedTrips = useQuery(
    api.functions.vesselTrips.queries
      .getCompletedTripsForSailingDayAndTerminals,
    sailingDay && departingTerminalAbbrevs.length > 0
      ? { sailingDay, departingTerminalAbbrevs }
      : "skip"
  );
  const completedTrips = rawCompletedTrips?.map(toDomainVesselTrip) ?? [];

  // Index vessel trips by Key for O(1) lookup. Historical (completed) first,
  // then active, then displayData so current/held state wins.
  // useMemo keeps map reference stable for children that receive it as a prop.
  const vesselTripMap = useMemo(() => {
    const map = createVesselTripMap(completedTrips);
    for (const trip of activeVesselTrips) {
      if (trip.Key) map.set(trip.Key, trip);
    }
    for (const d of displayData) {
      map.set(d.trip.Key || "", d.trip);
    }
    return map;
  }, [completedTrips, activeVesselTrips, displayData]);

  // Find the synchronized vessel location from displayData
  const synchronizedData = displayData.find(
    (d) => d.trip.VesselAbbrev === vesselAbbrev
  );

  // Fallback to live location if no synchronized data is found (e.g. vessel not in a trip)
  const vesselLocation =
    synchronizedData?.vesselLocation ||
    vesselLocations.find((v) => v.VesselAbbrev === vesselAbbrev);

  if (!vesselLocation || segments.length === 0) return null;

  return (
    <View className="relative flex-row items-center justify-between w-full overflow-visible px-4 py-8">
      {segments.map((segment, index) => (
        <TimelineSegmentLeg
          key={segment.Key}
          segment={segment}
          vesselLocation={vesselLocation} // PRIMARY: real-time WSF data (synchronized)
          displayTrip={vesselTripMap.get(segment.DirectKey || segment.Key)} // SECONDARY: ML predictions, historical data (synchronized)
          vesselTripMap={vesselTripMap}
          circleSize={circleSize}
          isFirst={index === 0}
          isLast={index === segments.length - 1}
          skipAtDock={segments.length > 1 && index === 0}
        />
      ))}
    </View>
  );
};
