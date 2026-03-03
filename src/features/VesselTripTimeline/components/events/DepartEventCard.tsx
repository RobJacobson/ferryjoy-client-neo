/**
 * Presentational card for departure-related timeline content.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { Text, View } from "@/components/ui";

type DepartEventCardProps = {
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
};

/**
 * Renders departure event content for a timeline row.
 *
 * @param trip - Trip state used to derive departure status copy
 * @param vesselLocation - Vessel location used for terminal labeling
 * @returns Departure event card
 */
export const DepartEventCard = ({
  trip,
  vesselLocation,
}: DepartEventCardProps) => {
  const title = `Depart ${vesselLocation.DepartingTerminalAbbrev}`;
  const subtitle = trip.LeftDock ? "Departed" : "Preparing to depart";

  return (
    <View className="rounded-lg border border-border bg-card p-3">
      <Text className="font-semibold text-base">{title}</Text>
      <Text className="text-muted-foreground text-sm">{subtitle}</Text>
    </View>
  );
};
