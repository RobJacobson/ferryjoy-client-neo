import { ScrollView, Text, View } from "react-native";
import { useConvexVesselPings, useSelectedVessel } from "@/data/contexts";

export default function VesselsScreen() {
  const { selectedVessel } = useSelectedVessel();
  const { vesselPingsByVesselId, isLoading, error } = useConvexVesselPings();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-xl">Loading vessel pings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-xl text-red-500">Error: {error}</Text>
      </View>
    );
  }

  if (!selectedVessel) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-xl font-bold mb-4">Vessels</Text>
        <Text className="text-gray-600">
          Select a vessel on the map to view its pings data
        </Text>
      </View>
    );
  }

  const vesselPings = vesselPingsByVesselId[selectedVessel.VesselID] || [];

  return (
    <View className="flex-1 bg-white">
      <View className="p-4 border-b border-gray-200">
        <Text className="text-2xl font-bold">{selectedVessel.VesselName}</Text>
        <Text className="text-gray-600">
          Vessel ID: {selectedVessel.VesselID}
        </Text>
        <Text className="text-gray-600">Total pings: {vesselPings.length}</Text>
      </View>

      <ScrollView className="flex-1">
        {vesselPings.length === 0 ? (
          <View className="p-4">
            <Text className="text-gray-600">
              No pings data available for this vessel
            </Text>
          </View>
        ) : (
          <View className="p-4">
            <Text className="text-lg font-semibold mb-4">Recent Pings</Text>
            {vesselPings.slice(0, 10).map((ping, index) => (
              <View
                key={`${ping.TimeStamp.getTime()}-${index}`}
                className="mb-4 p-3 bg-gray-50 rounded-lg"
              >
                <Text className="text-sm text-gray-600">
                  {ping.TimeStamp.toLocaleString()}
                </Text>
                <View className="flex-row justify-between mt-2">
                  <Text className="text-sm">
                    Lat: {ping.Latitude.toFixed(6)}
                  </Text>
                  <Text className="text-sm">
                    Lng: {ping.Longitude.toFixed(6)}
                  </Text>
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-sm">Speed: {ping.Speed} knots</Text>
                  <Text className="text-sm">Heading: {ping.Heading}°</Text>
                </View>
                <Text className="text-sm mt-1">
                  At Dock: {ping.AtDock ? "Yes" : "No"}
                </Text>
              </View>
            ))}
            {vesselPings.length > 10 && (
              <Text className="text-center text-gray-500 mt-4">
                ... and {vesselPings.length - 10} more pings
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
