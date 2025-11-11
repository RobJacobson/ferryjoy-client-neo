import { Stack } from "expo-router";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { useConvexData } from "@/shared/contexts/ConvexContext";

export default function VesselPingsScreen() {
  const { vesselPings } = useConvexData();

  // Convert vessel pings to an array of vessel IDs for FlatList
  const vesselIds = Object.keys(vesselPings).map((id) => parseInt(id));

  return (
    <View className="flex-1 bg-background p-4">
      <Stack.Screen options={{ title: "Vessel Pings" }} />

      {vesselIds.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-2">Loading vessel pings...</Text>
        </View>
      ) : (
        <FlatList
          data={vesselIds}
          keyExtractor={(item) => item.toString()}
          renderItem={({ item }) => {
            const pings = vesselPings[item];
            return (
              <View className="bg-card p-4 mb-2 rounded-lg border border-border">
                <Text className="font-bold text-lg text-primary mb-2">
                  Vessel {item}
                </Text>
                <Text className="font-semibold text-secondary-foreground mb-1">
                  Lat/Lon Pings ({pings.length} points):
                </Text>
                <View className="bg-background p-2 rounded border border-border">
                  {pings.slice(0, 10).map((ping, index) => (
                    <Text
                      key={`${ping.TimeStamp}-${index}`}
                      className="text-muted-foreground text-sm"
                    >
                      [{ping.Latitude.toFixed(6)}, {ping.Longitude.toFixed(6)}]
                    </Text>
                  ))}
                  {pings.length > 10 && (
                    <Text className="text-muted-foreground text-sm italic mt-1">
                      ... and {pings.length - 10} more points
                    </Text>
                  )}
                </View>
                <Text className="text-muted-foreground text-xs mt-2">
                  Latest: {new Date(pings[0].TimeStamp).toLocaleString()}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text className="text-center mt-4">
              No vessel ping data available
            </Text>
          }
        />
      )}
    </View>
  );
}
