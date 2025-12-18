import { Text, View } from "@/components/ui";
import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { TripTimelineCard } from "@/features/TripTimelineCard";

type VesselTripCardProps = {
  trip: VesselTrip;
};

const getTimelineProps = (trip: VesselTrip) => {
  const hasDestination = !!trip.ArrivingTerminalAbbrev;
  const hasScheduledDeparture = !!trip.ScheduledDeparture;

  return {
    status: trip.AtDock ? ("atDock" as const) : ("atSea" as const),
    fromTerminal: trip.DepartingTerminalAbbrev || "",
    toTerminal: hasDestination ? trip.ArrivingTerminalAbbrev || "" : undefined,
    startTime: trip.TripStart || new Date(),
    departTime: hasScheduledDeparture
      ? trip.LeftDock ||
        new Date((trip.TripStart?.getTime() || 0) + 10 * 60 * 1000)
      : undefined,
    endTime: hasDestination
      ? trip.Eta || new Date((trip.TripStart?.getTime() || 0) + 30 * 60 * 1000)
      : undefined,
  };
};

const getVesselStatus = (trip: VesselTrip): string => {
  if (trip.AtDock) {
    return "At Dock";
  }
  if (!trip.Speed) {
    return "At Sea";
  }
  return `${trip.Speed?.toFixed(1)} knots`;
};

export const VesselTripCard = ({ trip }: VesselTripCardProps) => {
  const hasDestination = !!trip.ArrivingTerminalName;

  return (
    <View className="">
      <View>
        <View className="flex-row flex-1">
          <Text className="text-lg font-bold leading-tight">
            {trip.DepartingTerminalName}
          </Text>
          {hasDestination && (
            <Text className="text-lg font-light leading-tight">
              {` → ${trip.ArrivingTerminalName}`}
            </Text>
          )}
        </View>
        <View className="flex">
          <Text variant="muted" className="text-sm font-light leading-tight">
            {`${trip.VesselName} • ${getVesselStatus(trip)}`}
          </Text>
        </View>
      </View>
      <TripTimelineCard {...getTimelineProps(trip)} />
    </View>
  );
};
