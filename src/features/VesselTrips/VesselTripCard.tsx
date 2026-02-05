/**
 * TripProgressCard component for displaying vessel trip information with progress visualization.
 * Uses TripProgressTimeline component for progress display.
 * Uses ShadCN Card components for a polished, consistent UI.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import { Text, View } from "@/components/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import VesselTripTimeline from "./VesselTripTimeline";

type VesselTripCardProps = {
  /**
   * VesselTrip object containing trip data with actual, predicted, and scheduled times.
   */
  trip: VesselTrip;
  /**
   * VesselLocation object containing real-time WSF data.
   * Passed from parent to ensure synchronization during hold window.
   */
  vesselLocation: VesselLocation;
};

/**
 * Displays vessel trip information with route details and progress visualization.
 * Shows the departing and arriving terminals, vessel abbreviation, status, and
 * a progress meter that visualizes the trip's progress through two sequential segments.
 * Uses ShadCN Card components for a polished, consistent design.
 *
 * The hold window logic is implemented in VesselTripList's
 * useDelayedVesselTrips hook, which provides both the trip and the
 * synchronized vesselLocation.
 *
 * @param trip - VesselTrip object with trip data (may be in hold window or current active)
 * @param vesselLocation - VesselLocation object (may be frozen during hold window)
 * @returns A Card component with trip header and progress meter
 */
export const VesselTripCard = ({
  trip,
  vesselLocation,
}: VesselTripCardProps) => {
  // Check if trip has a destination (some trips might be one-way or in transit)
  const hasDestination = !!trip.ArrivingTerminalAbbrev;

  return (
    <Card className="mb-6 px-4 pt-4 pb-12 gap-4">
      <CardHeader className="z-10">
        {/* Terminal route display with vessel info on the right */}
        <View className="w-full flex-row">
          <View className="flex-1 flex-row items-center ">
            <CardTitle className="flex text-xl font-bold">
              {vesselLocation.DepartingTerminalAbbrev}
              {hasDestination && (
                <>
                  {/* Arrow separator for route visualization */}
                  <Text className="text-xl font-light text-muted-foreground">
                    {" → "}
                  </Text>
                  <CardTitle className="text-xl font-semibold">
                    {vesselLocation.ArrivingTerminalAbbrev}
                  </CardTitle>
                </>
              )}
            </CardTitle>
          </View>
          {/* Vessel info and status on the right */}
          <Text className="text-xl font-light text-muted-foreground">
            {vesselLocation.VesselName}
          </Text>
        </View>
      </CardHeader>
      {/* Progress meter container with overflow-visible for portal-rendered indicators */}
      <CardContent className="overflow-visible z-10 pt-2">
        {vesselLocation && (
          <VesselTripTimeline vesselLocation={vesselLocation} trip={trip} />
        )}
      </CardContent>
    </Card>
  );
};
