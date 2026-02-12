import { BlurView } from "expo-blur";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import type { RefObject } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/ui";
import { useSelectedTerminalPair } from "@/data/contexts";
import { cn } from "@/shared/utils/cn";

interface Destination {
  terminalId: number;
  terminalName: string;
  terminalSlug: string;
}

interface RouteCardProps {
  /**
   * Ref to BlurTargetView; card uses BlurView with this as blur source.
   */
  blurTargetRef: RefObject<View | null>;
  terminalName: string;
  terminalSlug: string;
  destinations: Destination[];
}

const borderStyle =
  "border border-t-white/25 border-l-white/25 border-r-black/10 border-b-black/10 ";

export const RouteCard = ({
  blurTargetRef,
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
    <BlurView
      blurTarget={blurTargetRef}
      intensity={10}
      blurMethod="dimezisBlurView"
      className="h-full w-full overflow-hidden rounded-[32px]"
    >
      <View className={cn("flex-1 gap-4 bg-white/30 p-4", borderStyle)}>
        <View
          className={cn(
            "aspect-[3/4] w-full items-center justify-center rounded-3xl bg-gray-200",
            borderStyle,
          )}
        >
          <Text className="text-gray-400">Photo Placeholder</Text>
        </View>

        <Text className="text-center font-playpen-500 text-3xl text-blue-800">
          {terminalName}
        </Text>

        <View className="flex-1 items-center justify-center gap-3 py-4">
          {destinations.map((destination) => (
            <Button
              key={destination.terminalSlug}
              variant="secondary"
              onPress={() => handleDestinationPress(destination.terminalSlug)}
              className={cn(
                "w-full rounded-full bg-white/25 p-1 font-playpen-500 text-blue-800",
                borderStyle,
              )}
            >
              <Text className="font-playpen-500 text-blue-800 text-lg">
                → {destination.terminalName}
              </Text>
            </Button>
          ))}
        </View>
      </View>
    </BlurView>
  );
};
