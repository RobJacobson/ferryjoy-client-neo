import { Text, View } from "@/components/ui";
import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { TripTimelineCard } from "@/features/TripTimelineCard";

type VesselTripCardProps = {
  trip: VesselTrip;
};

const getTimelineProps = (trip: VesselTrip) => {
  return {
    status: trip.AtDock ? ("atDock" as const) : ("atSea" as const),
    fromTerminal: trip.DepartingTerminalAbbrev || "",
    toTerminal: trip.ArrivingTerminalAbbrev || "",
    startTime: trip.TripStart || new Date(),
    departTime:
      trip.LeftDock ||
      new Date((trip.TripStart?.getTime() || 0) + 10 * 60 * 1000),
    endTime:
      trip.Eta || new Date((trip.TripStart?.getTime() || 0) + 30 * 60 * 1000),
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
  return (
    <View className="mb-4">
      <View className="">
        <View className="flex-row flex-1">
          <Text className="text-lg font-bold">
            {trip.DepartingTerminalName}
          </Text>
          <Text className="text-lg font-light">
            {` → ${trip.ArrivingTerminalName}`}
          </Text>
        </View>
        <View className="flex">
          <Text variant="muted">
            {`${trip.VesselName} • ${getVesselStatus(trip)}`}
          </Text>
        </View>
      </View>
      <TripTimelineCard {...getTimelineProps(trip)} />
    </View>
  );
};
