/**
 * TripProgressCard component for displaying vessel trip information with progress visualization.
 * Based on VesselTripCard but uses improved TripProgressMeter component for progress display.
 * Uses ShadCN Card components for a polished, consistent UI.
 */

import { Text, View } from "@/components/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import TripProgressMeter from "@/features/TripProgressMeter";

type TripProgressCardProps = {
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
export const TripProgressCard = ({ trip }: TripProgressCardProps) => {
  // Check if trip has a destination (some trips might be one-way or in transit)
  const hasDestination = !!trip.ArrivingTerminalAbbrev;

  return (
    // Card with overflow-visible to allow progress indicators to extend beyond boundaries
    <Card className="overflow-visible p-2 pb-12">
      <CardHeader>
        {/* Terminal route display with conditional destination */}
        <View className="flex-row items-center gap-2">
          <CardTitle className="text-xl font-bold leading-tight">
            {trip.DepartingTerminalAbbrev}
          </CardTitle>
          {hasDestination && (
            <>
              {/* Arrow separator for route visualization */}
              <Text className="text-xl font-light leading-tight text-muted-foreground">
                →
              </Text>
              <CardTitle className="text-xl font-semibold leading-tight">
                {trip.ArrivingTerminalAbbrev}
              </CardTitle>
            </>
          )}
        </View>
        {/* Vessel info and status summary */}
        <CardDescription className="text-base">
          {`${trip.VesselAbbrev} • ${getVesselStatus(trip)}`}
        </CardDescription>
      </CardHeader>
      {/* Progress meter container with overflow-visible for portal-rendered indicators */}
      <CardContent className="overflow-visible">
        <TripProgressMeter trip={trip} />
      </CardContent>
    </Card>
  );
};
