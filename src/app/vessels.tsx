import { Stack } from "expo-router"
import { useEffect } from "react"
import { ActivityIndicator, FlatList, Text, View } from "react-native"

import { useWsDottie } from "@/shared/contexts"

export default function VesselsLocationScreen() {
  const { vesselLocations, vesselsVerbose } = useWsDottie()

  // Combine vessel location data with vessel details
  const getVesselDetails = (vesselId: number) => {
    return vesselsVerbose.data?.find(vessel => vessel.VesselID === vesselId)
  }

  return (
    <View className="flex-1 bg-background p-4">
      <Stack.Screen options={{ title: "Vessel Locations" }} />

      {vesselLocations.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-2">Loading vessel locations...</Text>
        </View>
      ) : vesselLocations.error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-500">
            Error: {vesselLocations.error.message}
          </Text>
        </View>
      ) : (
        <FlatList
          data={vesselLocations.data}
          keyExtractor={item => item.VesselID.toString()}
          renderItem={({ item }) => {
            const vesselDetails = getVesselDetails(item.VesselID)
            return (
              <View className="bg-card p-4 mb-2 rounded-lg border border-border">
                <Text className="font-bold text-lg text-primary">
                  {vesselDetails?.VesselName || `Vessel ${item.VesselID}`}
                </Text>
                <Text className="text-muted-foreground">
                  ID: {item.VesselID}
                </Text>

                <View className="mt-2">
                  <Text className="font-semibold text-secondary-foreground">
                    Location:
                  </Text>
                  <Text className="text-muted-foreground">
                    Latitude: {item.Latitude?.toFixed(6) || "N/A"}
                  </Text>
                  <Text className="text-muted-foreground">
                    Longitude: {item.Longitude?.toFixed(6) || "N/A"}
                  </Text>
                </View>

                {item.Heading !== null && (
                  <Text className="text-muted-foreground">
                    Heading: {item.Heading}°
                  </Text>
                )}

                {item.Speed !== null && (
                  <Text className="text-muted-foreground">
                    Speed: {item.Speed} knots
                  </Text>
                )}

                {item.TimeStamp && (
                  <Text className="text-muted-foreground text-sm mt-1">
                    Last Updated: {new Date(item.TimeStamp).toLocaleString()}
                  </Text>
                )}

                {vesselDetails && (
                  <View className="mt-2 pt-2 border-t border-border">
                    <Text className="text-muted-foreground text-sm">
                      Class: {vesselDetails.Class?.ClassName || "N/A"}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      Length: {vesselDetails.Length}m
                    </Text>
                  </View>
                )}
              </View>
            )
          }}
          ListEmptyComponent={
            <Text className="text-center mt-4">
              No vessel location data available
            </Text>
          }
        />
      )}
    </View>
  )
}
