import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { useSelectedTerminalPair } from "@/data/contexts";

interface Destination {
  terminalId: number;
  terminalName: string;
  terminalSlug: string;
}

interface RouteCardProps {
  terminalName: string;
  terminalSlug: string;
  destinations: Destination[];
}

/**
 * RouteCard component that displays a terminal with buttons for reachable destinations.
 * Each destination button shows "To [destination name]" format.
 */
export const RouteCard = ({
  terminalName,
  terminalSlug,
  destinations,
}: RouteCardProps) => {
  const router = useRouter();
  const { setPair } = useSelectedTerminalPair();

  const handleDestinationPress = (destinationSlug: string) => {
    // Convert both origin and destination slugs to uppercase abbreviations
    const fromAbbrev = terminalSlug.toUpperCase();
    const destAbbrev = destinationSlug.toUpperCase();
    void setPair(fromAbbrev, destAbbrev);
    router.push(`/(tabs)/map/${fromAbbrev}/${destAbbrev}` as Href);
  };

  return (
    <View className="overflow-hidden h-full bg-white rounded-3xl border border-gray-100 shadow-sm">
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          flexGrow: 1,
          justifyContent: "space-between",
        }}
      >
        <View>
          <View className="justify-center items-center mb-6 h-40 bg-gray-200 rounded-xl">
            <Text className="text-gray-400">Photo Placeholder</Text>
          </View>
          <Text className="mb-6 text-2xl font-bold leading-tight text-center text-slate-900">
            {terminalName}
          </Text>
        </View>

        <View className="gap-3 pb-4">
          {destinations.map((destination) => (
            <Button
              key={destination.terminalSlug}
              variant="secondary"
              onPress={() => handleDestinationPress(destination.terminalSlug)}
              className="w-full"
            >
              <Text>To {destination.terminalName}</Text>
            </Button>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
