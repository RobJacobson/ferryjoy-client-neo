import { Stack } from "expo-router";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { useWsDottie } from "@/data/contexts";

export default function TerminalsScreen() {
  const { terminalVerbose } = useWsDottie();

  return (
    <View className="flex-1 bg-background p-4">
      <Stack.Screen options={{ title: "Terminal Information" }} />

      {terminalVerbose.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-2">Loading terminal information...</Text>
        </View>
      ) : terminalVerbose.error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-500">
            Error: {terminalVerbose.error.message}
          </Text>
        </View>
      ) : (
        <FlatList
          data={terminalVerbose.data}
          keyExtractor={(item) => item.TerminalID.toString()}
          renderItem={({ item }) => (
            <View className="bg-card p-4 mb-2 rounded-lg">
              <Text className="font-bold text-lg">{item.TerminalName}</Text>
              <Text className="text-muted-foreground">
                ID: {item.TerminalID}
              </Text>
              <Text className="text-muted-foreground">
                Location: {item.City}, {item.State}
              </Text>
              <Text className="text-muted-foreground">
                Latitude: {item.Latitude}, Longitude: {item.Longitude}
              </Text>
              <Text className="text-muted-foreground">
                Amenities: {item.Elevator ? "Elevator " : ""}
                {item.WaitingRoom ? "Waiting Room " : ""}
                {item.FoodService ? "Food Service " : ""}
                {item.Restroom ? "Restroom" : ""}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text className="text-center mt-4">No terminal data available</Text>
          }
        />
      )}
    </View>
  );
}
