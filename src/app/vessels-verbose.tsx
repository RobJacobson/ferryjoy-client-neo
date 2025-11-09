import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { useWsDottie } from "@/shared/contexts";

export default function VesselsVerboseScreen() {
  const { vesselsVerbose } = useWsDottie();

  return (
    <View className="flex-1 bg-background p-4">
      <Stack.Screen options={{ title: "Vessels Verbose" }} />

      {vesselsVerbose.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-2">Loading vessels verbose data...</Text>
        </View>
      ) : vesselsVerbose.error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-500">
            Error: {vesselsVerbose.error.message}
          </Text>
        </View>
      ) : (
        <FlatList
          data={vesselsVerbose.data}
          keyExtractor={(item) => item.VesselID.toString()}
          renderItem={({ item }) => (
            <View className="bg-card p-4 mb-2 rounded-lg">
              <Text className="font-bold text-lg">{item.VesselName}</Text>
              <Text className="text-muted-foreground">ID: {item.VesselID}</Text>
              <Text className="text-muted-foreground">
                Class: {item.Class?.ClassName}
              </Text>
              <Text className="text-muted-foreground">
                Length: {item.Length}
              </Text>
              <Text className="text-muted-foreground">
                Year Built: {item.YearBuilt}
              </Text>
              <Text className="text-muted-foreground">
                Max Passengers: {item.MaxPassengerCount}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text className="text-center mt-4">
              No vessels verbose data available
            </Text>
          }
        />
      )}
    </View>
  );
}
