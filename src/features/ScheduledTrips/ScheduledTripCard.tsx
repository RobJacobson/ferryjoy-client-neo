/**
 * ScheduledTripCard component for displaying a scheduled ferry trip with its timeline.
 * Uses ShadCN Card components for consistent UI.
 */

import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import React from "react";
import { Text, View } from "@/components/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getVesselName } from "@/domain/vesselAbbreviations";
import { ScheduledTripTimeline } from "./ScheduledTripTimeline";
import { toSegment } from "./utils/conversion";

type ScheduledTripCardProps = {
  /**
   * Trip object containing vessel information and journey segments.
   */
  trip: {
    id: string;
    vesselAbbrev: string;
    routeAbbrev: string;
    departureTime: number;
    segments: (ConvexScheduledTrip & {
      DisplayArrivingTerminalAbbrev?: string;
    })[];
  };
};

/**
 * Displays a card with route information and a multi-segment timeline for a scheduled trip.
 *
 * @param trip - The trip data to display
 * @returns A Card component containing the trip header and timeline
 */
export const ScheduledTripCard = ({ trip }: ScheduledTripCardProps) => {
  const segments = trip.segments.map(toSegment);

  return (
    <Card className="mb-6 pt-2 pb-10 overflow-visible gap-4">
      <CardHeader>
        {/* Route title showing all segments */}
        <View className="w-full flex-row">
          <View className="flex-1 flex-row flex-wrap">
            {trip.segments.map((segment, index) => (
              <React.Fragment key={segment.Key}>
                <CardTitle className="text-xl font-bold">
                  {segment.DepartingTerminalAbbrev}
                </CardTitle>
                <Text className="mx-2 text-xl font-light text-muted-foreground">
                  →
                </Text>
                {index === trip.segments.length - 1 && (
                  <CardTitle className="text-xl font-semibold">
                    {segment.ArrivingTerminalAbbrev}
                  </CardTitle>
                )}
              </React.Fragment>
            ))}
          </View>
          <Text className="text-xl font-light text-muted-foreground ">
            {getVesselName(trip.vesselAbbrev)}
          </Text>
        </View>
      </CardHeader>
      <CardContent className="overflow-visible">
        <ScheduledTripTimeline
          vesselAbbrev={trip.vesselAbbrev}
          segments={segments}
        />
      </CardContent>
    </Card>
  );
};
