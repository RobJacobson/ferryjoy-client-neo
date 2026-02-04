/**
 * TripProgressCard component for displaying vessel trip information with progress visualization.
 * Uses TripProgressTimeline component for progress display.
 * Uses ShadCN Card components for a polished, consistent UI.
 */

import { Text, View } from "@/components/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { getVesselName } from "@/domain";
import VesselTripTimeline from "./VesselTripTimeline";

type VesselTripCardProps = {
  /**
   * VesselTrip object containing trip data with actual, predicted, and scheduled times.
   */
  trip: VesselTrip;
};

/**
 * Returns the vessel status string based on the trip's dock state.
 *
 * @param trip - VesselTrip object to check dock state
 * @returns "At Dock" if trip.AtDock is true, otherwise "At Sea"
 */
const getVesselStatus = (trip: VesselTrip): string => {
  if (trip.AtDock) {
    return "At Dock";
  }
  return "At Sea";
};

/**
 * Displays vessel trip information with route details and progress visualization.
 * Shows the departing and arriving terminals, vessel abbreviation, status, and
 * a progress meter that visualizes the trip's progress through two sequential segments.
 * Uses ShadCN Card components for a polished, consistent design.
 *
 * The parent component (VesselsTripList) handles the 15-second "Arrived" delay
 * by passing the appropriate trip (held or current) via props.
 *
 * @param trip - VesselTrip object with trip data (may be held completed trip or current trip)
 * @returns A Card component with trip header and progress meter
 */
export const VesselTripCard = ({ trip }: VesselTripCardProps) => {
  // Check if trip has a destination (some trips might be one-way or in transit)
  const hasDestination = !!trip.ArrivingTerminalAbbrev;

  return (
    // Card with overflow-visible to allow progress indicators to extend beyond boundaries
    <Card className="mb-6 pt-2 pb-10 overflow-visible gap-4">
      <CardHeader>
        {/* Terminal route display with vessel info on the right */}
        <View className="w-full flex-row">
          <View className="flex-1 flex-row items-center gap-2">
            <CardTitle className="text-xl font-bold">
              {trip.DepartingTerminalAbbrev}
            </CardTitle>
            {hasDestination && (
              <>
                {/* Arrow separator for route visualization */}
                <Text className="mx-2 text-xl font-light text-muted-foreground">
                  →
                </Text>
                <CardTitle className="text-xl font-semibold">
                  {trip.ArrivingTerminalAbbrev}
                </CardTitle>
              </>
            )}
          </View>
          {/* Vessel info and status on the right */}
          <Text className="text-xl font-light text-muted-foreground">
            {getVesselName(trip.VesselAbbrev)}
          </Text>
        </View>
      </CardHeader>
      {/* Progress meter container with overflow-visible for portal-rendered indicators */}
      <CardContent className="overflow-visible">
        <VesselTripTimeline trip={trip} />
      </CardContent>
    </Card>
  );
};
