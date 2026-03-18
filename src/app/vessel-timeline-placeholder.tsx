/**
 * Placeholder screen for the VesselTimeline feature.
 *
 * This screen exposes a vessel dropdown selector and renders the current
 * placeholder VesselTimeline implementation below it for the selected vessel.
 */

import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "@/components/ui";
import {
  NativeSelectScrollView,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConvexVesselLocations } from "@/data/contexts";
import { GradientBackground } from "@/features/GradientBackground";
import { VesselTimeline } from "@/features/VesselTimeline";
import { getSailingDay } from "@/shared/utils/getSailingDay";

type VesselOption = {
  value: string;
  label: string;
  routeAbbrev?: string;
};

/**
 * Placeholder route for exercising the VesselTimeline feature during
 * development.
 *
 * @returns Vessel selector screen with the selected vessel timeline
 */
export default function VesselTimelinePlaceholderScreen() {
  const { vesselLocations, isLoading, error } = useConvexVesselLocations();
  const [selectedOption, setSelectedOption] = useState<VesselOption>();

  const sailingDay = getSailingDay(new Date());
  const vesselOptions = vesselLocations
    .slice()
    .sort((left, right) => left.VesselName.localeCompare(right.VesselName))
    .map((vesselLocation) => ({
      value: vesselLocation.VesselAbbrev,
      label: `${vesselLocation.VesselName} (${vesselLocation.VesselAbbrev})`,
      routeAbbrev: vesselLocation.RouteAbbrev ?? undefined,
    }));

  useEffect(() => {
    if (selectedOption || vesselOptions.length === 0) {
      return;
    }

    const inServiceOption = vesselOptions.find((option) =>
      vesselLocations.some(
        (vesselLocation) =>
          vesselLocation.VesselAbbrev === option.value &&
          vesselLocation.InService
      )
    );

    setSelectedOption(inServiceOption ?? vesselOptions[0]);
  }, [selectedOption, vesselLocations, vesselOptions]);

  return (
    <GradientBackground backgroundColor="#F5EFE3">
      <View className="flex-1">
        <Stack.Screen
          options={{
            title: "Vessel Timeline",
            headerTitleAlign: "center",
          }}
        />
        <View className="gap-4 px-4 py-4">
          <Text className="font-semibold text-lg">
            Placeholder Vessel Timeline
          </Text>
          <Text className="text-muted-foreground text-sm">
            Select a vessel to preview the day-level timeline implementation.
          </Text>
          {isLoading ? (
            <Text className="text-muted-foreground text-sm">
              Loading vessel list...
            </Text>
          ) : error ? (
            <Text className="text-destructive text-sm">{error}</Text>
          ) : vesselOptions.length === 0 ? (
            <Text className="text-muted-foreground text-sm">
              No vessels are currently available.
            </Text>
          ) : (
            <Select value={selectedOption} onValueChange={setSelectedOption}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vessel" />
              </SelectTrigger>
              <SelectContent>
                <NativeSelectScrollView>
                  {vesselOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      label={option.label}
                    >
                      <Text>{option.label}</Text>
                    </SelectItem>
                  ))}
                </NativeSelectScrollView>
              </SelectContent>
            </Select>
          )}
        </View>
        {selectedOption ? (
          <VesselTimeline
            vesselAbbrev={selectedOption.value}
            sailingDay={sailingDay}
            routeAbbrevs={
              selectedOption.routeAbbrev ? [selectedOption.routeAbbrev] : []
            }
          />
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-muted-foreground text-sm">
              Select a vessel to view its timeline.
            </Text>
          </View>
        )}
      </View>
    </GradientBackground>
  );
}
