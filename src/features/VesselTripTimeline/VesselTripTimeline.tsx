/**
 * Card-level vessel trip timeline presentation using timeline primitives.
 */

import { VerticalTimeline } from "@/components/Timeline";
import { Text, View } from "@/components/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildTimelineRowsFromTrip } from "./adapters/buildTimelineRowsFromTrip";
import type { VesselTripTimelineItem } from "./types";

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
  const rows = buildTimelineRowsFromTrip({ trip, vesselLocation });
  const routeLabel = vesselLocation.ArrivingTerminalAbbrev
    ? `${vesselLocation.DepartingTerminalAbbrev} → ${vesselLocation.ArrivingTerminalAbbrev}`
    : vesselLocation.DepartingTerminalAbbrev;

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="gap-1">
        <View className="items-start gap-1">
          <CardTitle className="text-lg">{routeLabel}</CardTitle>
          <CardDescription>{vesselLocation.VesselName}</CardDescription>
          {trip.TripEnd ? (
            <Text className="font-medium text-emerald-700 text-xs uppercase">
              Completed
            </Text>
          ) : (
            <Text className="font-medium text-muted-foreground text-xs uppercase">
              Active Trip
            </Text>
          )}
        </View>
      </CardHeader>
      <CardContent className="px-4">
        <VerticalTimeline
          rows={rows}
          minSegmentPx={80}
          centerAxisSizePx={52}
          trackThicknessPx={8}
          markerSizePx={18}
          indicatorSizePx={34}
        />
      </CardContent>
    </Card>
  );
};
