/**
 * ScheduledTripCard displays one scheduled ferry trip: a route header (terminals + vessel name)
 * and a multi-segment timeline. Uses TripCard and ShadCN Card for consistent UI.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import React from "react";
import { TripCard } from "@/components/TripCard";
import { Text, View } from "@/components/ui";
import { CardTitle } from "@/components/ui/card";
import { getVesselName } from "@/domain/vesselAbbreviations";
import { ScheduledTripTimeline } from "./ScheduledTripTimeline";
import type { ScheduledTripJourney, Segment } from "./types";

type ScheduledTripCardProps = {
  /**
   * Trip object containing vessel information and journey segments.
   */
  trip: ScheduledTripJourney;
  /**
   * Real-time vessel location when available; undefined when overlay data is missing.
   */
  vesselLocation: VesselLocation | undefined;
  /**
   * Map of segment Key to VesselTrip for O(1) lookup. Used with PrevKey/NextKey for prev/next trips.
   */
  vesselTripByKeys: Map<string, VesselTrip>;
  /**
   * The trip currently being held (if any).
   */
  heldTrip?: VesselTrip;
};

/**
 * Displays a card with route information and a multi-segment timeline for a scheduled trip.
 * Route header shows terminals (depart → arrive) and vessel name; timeline uses synthesized segments.
 *
 * @param trip - Journey data (id, vessel, route, segments) to display
 * @param vesselLocation - Real-time vessel location when available; undefined for schedule-only
 * @param vesselTripByKeys - Map of segment Key to VesselTrip for overlay lookups
 * @param heldTrip - The trip currently being held (if any)
 * @returns TripCard containing ScheduledTripRouteHeader and ScheduledTripTimeline
 */
export const ScheduledTripCard = ({
  trip,
  vesselLocation,
  vesselTripByKeys,
  heldTrip,
}: ScheduledTripCardProps) => {
  return (
    <TripCard
      cardClassName="pt-2 pb-10 overflow-visible"
      routeContent={
        <ScheduledTripRouteHeader
          segments={trip.segments}
          vesselAbbrev={trip.vesselAbbrev}
        />
      }
    >
      {/* <ScheduledTripTimelineVertical
        journey={trip}
        vesselTripByKeys={vesselTripByKeys}
        vesselLocation={vesselLocation}
        height={250} // Optional, defaults to 250
      /> */}
      <ScheduledTripTimeline
        journey={trip}
        vesselTripByKeys={vesselTripByKeys}
        vesselLocation={vesselLocation}
        heldTrip={heldTrip}
      />
    </TripCard>
  );
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
          <CardTitle className="font-bold text-xl">
            {segment.DepartingTerminalAbbrev}
          </CardTitle>
          <Text className="mx-2 font-light text-muted-foreground text-xl">
            →
          </Text>
          {index === segments.length - 1 && (
            <CardTitle className="font-semibold text-xl">
              {segment.ArrivingTerminalAbbrev}
            </CardTitle>
          )}
        </React.Fragment>
      ))}
    </View>
    <Text className="font-light text-muted-foreground text-xl">
      {getVesselName(vesselAbbrev)}
    </Text>
  </View>
);
