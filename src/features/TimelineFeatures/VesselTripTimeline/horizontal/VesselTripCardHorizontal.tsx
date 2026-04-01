/**
 * VesselTripCardHorizontal component for displaying vessel trip information with horizontal progress visualization.
 * Uses VesselTripTimelineHorizontal for progress display.
 * Uses ShadCN Card components for a polished, consistent UI.
 */

import { TripCard } from "@/components/TripCard";
import { CardTitle, Text, View } from "@/components/ui";
import type { VesselTripWithScheduledTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import type { VesselLocation } from "@/types";
import VesselTripTimelineHorizontal from "./VesselTripTimelineHorizontal";

type VesselTripCardHorizontalProps = {
  /**
   * VesselTrip with optional ScheduledTrip for display (scheduled times).
   */
  trip: VesselTripWithScheduledTrip;
  /**
   * VesselLocation object containing real-time WSF data.
   * Passed from parent to ensure synchronization during hold window.
   */
  vesselLocation: VesselLocation;
};

/**
 * Displays vessel trip information with route details and horizontal progress visualization.
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
export const VesselTripCardHorizontal = ({
  trip,
  vesselLocation,
}: VesselTripCardHorizontalProps) => {
  // Check if trip has a destination (some trips might be one-way or in transit)
  const hasDestination = !!trip.ArrivingTerminalAbbrev;

  const routeContent = (
    <View className="w-full flex-row">
      <View className="flex-1 flex-row items-center">
        <CardTitle className="flex font-bold text-xl">
          {vesselLocation.DepartingTerminalAbbrev}
          {hasDestination && (
            <>
              <Text className="font-light text-muted-foreground text-xl">
                {" → "}
              </Text>
              <Text className="font-semibold text-xl">
                {vesselLocation.ArrivingTerminalAbbrev}
              </Text>
            </>
          )}
        </CardTitle>
      </View>
      <Text className="font-light text-muted-foreground text-xl">
        {vesselLocation.VesselName}
      </Text>
    </View>
  );

  return (
    <TripCard
      routeContent={routeContent}
      cardClassName="px-4 pt-4 pb-12"
      contentClassName="z-10 pt-2"
    >
      {vesselLocation && (
        <VesselTripTimelineHorizontal
          vesselLocation={vesselLocation}
          trip={trip}
        />
      )}
    </TripCard>
  );
};
