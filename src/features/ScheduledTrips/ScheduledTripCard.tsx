/**
 * ScheduledTripCard displays one scheduled ferry trip: a route header (terminals + vessel name)
 * and a multi-segment timeline. Uses TripCard and ShadCN Card for consistent UI.
 */

import React from "react";
import { TripCard } from "@/components/TripCard";
import { Text, View } from "@/components/ui";
import { CardTitle } from "@/components/ui/card";
import { getVesselName } from "@/domain/vesselAbbreviations";
import { ScheduledTripTimeline } from "./ScheduledTripTimeline";
import type { ScheduledTripJourney, Segment } from "./types";
import type { ScheduledTripCardResolution } from "./utils/resolveScheduledTripsPageResolution";

type ScheduledTripCardProps = {
  /**
   * Trip object containing vessel information and journey segments.
   */
  trip: ScheduledTripJourney;
  /**
   * Optional page-level resolution props. When provided, the card/timeline does not refetch
   * realtime data per card.
   */
  resolution?: ScheduledTripCardResolution;
};

/**
 * Presentational header for a scheduled trip: route (terminals + arrow) and vessel name.
 *
 * @param segments - Ordered segments; first DepartingTerminalAbbrev and last ArrivingTerminalAbbrev form the route
 * @param vesselAbbrev - Vessel abbreviation for display name
 * @returns A View with route and vessel name
 */
const ScheduledTripRouteHeader = ({
  segments,
  vesselAbbrev,
}: {
  segments: Segment[];
  vesselAbbrev: string;
}) => (
  <View className="w-full flex-row">
    <View className="flex-1 flex-row flex-wrap">
      {/* Each segment: departing terminal, arrow; only the last segment shows final destination. */}
      {segments.map((segment, index) => (
        <React.Fragment key={segment.Key}>
          <CardTitle className="text-xl font-bold">
            {segment.DepartingTerminalAbbrev}
          </CardTitle>
          <Text className="mx-2 text-xl font-light text-muted-foreground">
            →
          </Text>
          {index === segments.length - 1 && (
            <CardTitle className="text-xl font-semibold">
              {segment.ArrivingTerminalAbbrev}
            </CardTitle>
          )}
        </React.Fragment>
      ))}
    </View>
    <Text className="text-xl font-light text-muted-foreground">
      {getVesselName(vesselAbbrev)}
    </Text>
  </View>
);

/**
 * Displays a card with route information and a multi-segment timeline for a scheduled trip.
 *
 * @param trip - The trip data to display
 * @param resolution - Optional page-level resolution; when provided, card/timeline does not refetch realtime data per card
 * @returns A Card component containing the trip header and timeline
 */
export const ScheduledTripCard = ({
  trip,
  resolution,
}: ScheduledTripCardProps) => (
  <TripCard
    cardClassName="pt-2 pb-10 overflow-visible"
    routeContent={
      <ScheduledTripRouteHeader
        segments={trip.segments}
        vesselAbbrev={trip.vesselAbbrev}
      />
    }
  >
    {/* When resolution is provided, timeline does not call useScheduledTripDisplayData. */}
    <ScheduledTripTimeline
      vesselAbbrev={trip.vesselAbbrev}
      segments={trip.segments}
      resolution={resolution}
    />
  </TripCard>
);
