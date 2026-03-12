/**
 * List presentation for vessel trip timeline cards.
 */

import { ScrollView } from "react-native";
import { Text, View } from "@/components/ui";
import type { TimelineItem } from "./types";
import { VesselTripTimeline } from "./VesselTripTimeline";

type VesselTripTimelineListProps = {
  items: TimelineItem[];
};

/**
 * Renders a scrollable list of vessel trip timeline cards.
 *
 * @param items - Pre-filtered vessel trip timeline items
 * @returns Card list presentation
 */
export const VesselTripTimelineList = ({
  items,
}: VesselTripTimelineListProps) => (
  <ScrollView className="flex-1 bg-background">
    <View className="gap-4 p-3 pb-8">
      <Text variant="h2" className="mb-1 text-center">
        Active Vessel Trips
      </Text>
      {items.map(({ trip, vesselLocation }) => (
        <VesselTripTimeline
          key={`${trip.VesselAbbrev}-${
            trip.TripStart?.getTime() ??
            trip.ArriveDest?.getTime() ??
            "no-start"
          }`}
          trip={trip}
          vesselLocation={vesselLocation}
        />
      ))}
    </View>
  </ScrollView>
);
