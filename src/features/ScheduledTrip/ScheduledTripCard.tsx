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
import { ScheduledTripTimeline } from "./ScheduledTripTimeline";

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
  return (
    <Card className="mb-4 overflow-visible">
      <CardHeader>
        {/* Route title showing all segments */}
        <View className="flex-row flex-wrap items-center gap-y-1">
          {trip.segments.map((segment, index) => (
            <React.Fragment key={segment.Key}>
              <CardTitle className="text-xl font-bold leading-tight">
                {segment.DepartingTerminalAbbrev}
              </CardTitle>
              <Text className="mx-2 text-xl font-light leading-tight text-muted-foreground">
                →
              </Text>
              {index === trip.segments.length - 1 && (
                <CardTitle className="text-xl font-semibold leading-tight">
                  {segment.ArrivingTerminalAbbrev}
                </CardTitle>
              )}
            </React.Fragment>
          ))}
        </View>
        {/* Vessel and route information */}
        <CardDescription className="text-base">
          {`${trip.vesselAbbrev} • Route ${trip.routeAbbrev}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-visible">
        <ScheduledTripTimeline segments={trip.segments} />
      </CardContent>
    </Card>
  );
};
