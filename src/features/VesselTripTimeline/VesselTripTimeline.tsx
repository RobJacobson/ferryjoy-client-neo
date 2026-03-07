/**
 * Card-level vessel trip timeline presentation using timeline primitives.
 */

import { Text, View } from "@/components/ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buildTimelineModelFromTrip } from "./adapters/buildTimelineModelFromTrip";
import { VesselTripTimelineContent } from "./components/VesselTripTimelineContent";
import type { VesselTripTimelineItem } from "./types";
import { VesselTripCardTitle } from "./VesselTripCardTitle";

type VesselTripTimelineProps = VesselTripTimelineItem;

/**
 * Renders a single vessel trip as a styled timeline card.
 *
 * @param props - Vessel trip and location pair
 * @returns Card with route heading and vertical timeline
 */
export const VesselTripTimeline = ({
  trip,
  vesselLocation,
}: VesselTripTimelineProps) => {
  const rows = buildTimelineModelFromTrip({
    trip,
    vesselLocation,
  });

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="gap-1">
        <View className="items-start">
          <VesselTripCardTitle trip={trip} />
          <Text className="font-medium text-emerald-700 text-xs uppercase leading-4">
            {vesselLocation.VesselName}
          </Text>
        </View>
      </CardHeader>
      <CardContent className="px-4">
        <VesselTripTimelineContent
          presentationRows={rows}
          item={{ trip, vesselLocation }}
        />
      </CardContent>
    </Card>
  );
};
