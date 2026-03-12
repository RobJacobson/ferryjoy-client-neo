/**
 * Card title component for vessel trip cards showing route and departure time.
 */

import type { VesselTrip } from "functions/vesselTrips/schemas";
import { Text, View } from "@/components/ui";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";
import { toDisplayTime } from "@/shared/utils/dateConversions";

/**
 * Renders the card title for a vessel trip showing departure/arrival terminals
 * and scheduled departure time.
 *
 * Displays the route with a green arrow indicator between terminals and includes
 * the scheduled departure time. Provides accessibility label for screen readers.
 *
 * @param trip - Vessel trip data containing terminal abbreviations and schedule
 * @returns Component with terminal names, arrow indicator, and departure time
 */
export const VesselTripCardTitle = ({ trip }: { trip: VesselTrip }) => {
  const departingName = getTerminalNameByAbbrev(trip.DepartingTerminalAbbrev);
  const arrivingName = trip.ArrivingTerminalAbbrev
    ? getTerminalNameByAbbrev(trip.ArrivingTerminalAbbrev)
    : null;
  const departTime = trip.ScheduledDeparture
    ? toDisplayTime(trip.ScheduledDeparture)
    : null;
  const a11yText = [
    departingName,
    arrivingName && `to ${arrivingName}`,
    departTime && `, departure scheduled at ${departTime}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View
      className="flex-row items-center gap-1"
      role="heading"
      aria-level={3}
      aria-label={a11yText}
    >
      <View className="flex-1 flex-row gap-1">
        <Text className="font-bitcount-400 text-green-700 text-xl">
          {departingName}
        </Text>
        {arrivingName && (
          <>
            <Text className="translate-y-[-4px] p-1 font-bitcount-400 text-green-700 text-xl">
              →
            </Text>
            <Text className="font-bitcount-400 text-green-700 text-xl">
              {arrivingName}
            </Text>
          </>
        )}
      </View>
      <Text className="font-light text-black">{departTime}</Text>
    </View>
  );
};
