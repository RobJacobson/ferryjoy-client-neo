/**
 * Presentational card for arrival-related timeline content.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { Text, View } from "@/components/ui";
import type { VesselTripTimelinePhase } from "../../types";

type ArriveEventCardProps = {
  phase: Extract<VesselTripTimelinePhase, "transit" | "arrival">;
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
  rowEndTime: Date;
};

/**
 * Renders arrival event content for a timeline row.
 *
 * @param phase - Row phase that selects arrival copy variant
 * @param trip - Trip state used for docking status copy
 * @param vesselLocation - Vessel location used for terminal labeling
 * @param rowEndTime - Row end time used for ETA display in transit phase
 * @returns Arrival event card
 */
export const ArriveEventCard = ({
  phase,
  trip,
  vesselLocation,
  rowEndTime,
}: ArriveEventCardProps) => {
  const terminal = vesselLocation.ArrivingTerminalAbbrev ?? "Terminal";
  const title = phase === "transit" ? `Arrive ${terminal}` : `Dock ${terminal}`;
  const subtitle =
    phase === "transit"
      ? `ETA ${formatTime(rowEndTime)}`
      : trip.TripEnd
        ? "Arrived"
        : "Awaiting arrival";

  return (
    <View className="rounded-lg border border-border bg-card p-3">
      <Text className="font-semibold text-base">{title}</Text>
      <Text className="text-muted-foreground text-sm">{subtitle}</Text>
    </View>
  );
};

/**
 * Formats a timestamp as a local short time string.
 *
 * @param value - Date to format
 * @returns Short local time string
 */
const formatTime = (value: Date): string =>
  value.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
