/**
 * ScheduledTripCard displays one scheduled ferry trip: a route header (terminals + vessel name)
 * and a multi-segment timeline. Uses TripCard and ShadCN Card for consistent UI.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import React, { useMemo } from "react";
import { TripCard } from "@/components/TripCard";
import { Text, View } from "@/components/ui";
import { CardTitle } from "@/components/ui/card";
import { getVesselName } from "@/domain/vesselAbbreviations";
import { synthesizeTripSegments } from "../Timeline/synthesizeTripSegments";
import { ScheduledTripTimeline } from "./ScheduledTripTimeline";
import type { ScheduledTripJourney, Segment } from "./types";
import type { ScheduledTripCardDisplayState } from "./utils/computePageDisplayState";

type ScheduledTripCardProps = {
  /**
   * Trip object containing vessel information and journey segments.
   */
  trip: ScheduledTripJourney;
  /**
   * Page-level display state for this journey: active selection + segment statuses and prediction wiring.
   */
  displayState: ScheduledTripCardDisplayState;
  /**
   * Real-time vessel location when available; undefined when overlay data is missing.
   */
  vesselLocation: VesselLocation | undefined;
  /**
   * Map of segment Key to VesselTrip for O(1) lookup. Used with PrevKey/NextKey for prev/next trips.
   */
  vesselTripMap: Map<string, VesselTrip>;
};

/**
 * Displays a card with route information and a multi-segment timeline for a scheduled trip.
 * Route header shows terminals (depart → arrive) and vessel name; timeline uses synthesized segments.
 *
 * @param trip - Journey data (id, vessel, route, segments) to display
 * @param displayState - Page-level display state for this journey
 * @param vesselLocation - Real-time vessel location when available; undefined for schedule-only
 * @param vesselTripMap - Map of segment Key to VesselTrip for overlay lookups
 * @returns TripCard containing ScheduledTripRouteHeader and ScheduledTripTimeline
 */
export const ScheduledTripCard = ({
  trip,
  displayState,
  vesselLocation,
  vesselTripMap,
}: ScheduledTripCardProps) => {
  const synthesizedSegments = useMemo(
    () =>
      synthesizeTripSegments({
        segments: trip.segments as any, // Segment types are compatible but may need explicit cast if types.ts differs slightly
        vesselTripMap,
        vesselLocation,
        activeKey: displayState.timeline.activeKey,
        activePhase: displayState.timeline.activePhase,
        statusByKey: displayState.timeline.statusByKey as any,
      }),
    [trip.segments, vesselTripMap, vesselLocation, displayState.timeline]
  );

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
      <ScheduledTripTimeline segments={synthesizedSegments} />
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
