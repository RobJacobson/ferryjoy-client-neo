/**
 * Placeholder screen for the VesselTimeline feature.
 *
 * This screen exposes a vessel dropdown selector and renders the current
 * placeholder VesselTimeline implementation below it for the selected vessel.
 */

import { useFocusEffect } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
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
import { GradientBackground } from "@/features/GradientBackground/GradientBackground";
import {
  DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID,
  getCurrentSailingDay,
  getRefreshedSailingDay,
  getVesselTimelineDesignVariant,
  VESSEL_TIMELINE_DESIGN_VARIANTS,
  VesselTimeline,
} from "@/features/VesselTimeline";

type VesselOption = {
  value: string;
  label: string;
  routeAbbrev?: string;
};

type DesignOption = {
  value: string;
  label: string;
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
  const [sailingDay, setSailingDay] = useState(() => getCurrentSailingDay());
  const [selectedDesign, setSelectedDesign] = useState<DesignOption>({
    value: DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID,
    label: getVesselTimelineDesignVariant(
      DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID
    ).label,
  });

  const designOptions = VESSEL_TIMELINE_DESIGN_VARIANTS.map((variant) => ({
    value: variant.id,
    label: variant.label,
  }));
  const selectedVariant = getVesselTimelineDesignVariant(selectedDesign.value);
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

  useFocusEffect(() => {
    setSailingDay((current) => getRefreshedSailingDay(current));
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setSailingDay((current) => getRefreshedSailingDay(current));
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GradientBackground
      backgroundColor={selectedVariant.backgroundColor}
      colors={selectedVariant.backgroundColors}
    >
      <View className="flex-1">
        <Stack.Screen
          options={{
            title: "Vessel Timeline",
            headerTitleAlign: "center",
          }}
        />
        <View className="gap-3 px-4 py-4">
          <Text className="font-semibold text-lg text-slate-900">
            Placeholder Vessel Timeline
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Select
                value={selectedDesign}
                onValueChange={(option) => {
                  if (option) {
                    setSelectedDesign(option);
                  }
                }}
              >
                <SelectTrigger className="w-full border-white bg-white">
                  <SelectValue
                    placeholder="Select a design variant"
                    className="font-medium text-slate-900"
                  />
                </SelectTrigger>
                <SelectContent>
                  <NativeSelectScrollView>
                    {designOptions.map((option) => (
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
            </View>
            <View className="flex-1">
              {isLoading ? (
                <View className="h-10 justify-center rounded-md border border-white bg-white px-3">
                  <Text className="text-muted-foreground text-sm">
                    Loading vessel list...
                  </Text>
                </View>
              ) : error ? (
                <View className="h-10 justify-center rounded-md border border-destructive/30 bg-white px-3">
                  <Text className="text-destructive text-sm" numberOfLines={1}>
                    {error}
                  </Text>
                </View>
              ) : vesselOptions.length === 0 ? (
                <View className="h-10 justify-center rounded-md border border-white bg-white px-3">
                  <Text
                    className="text-muted-foreground text-sm"
                    numberOfLines={1}
                  >
                    No vessels available
                  </Text>
                </View>
              ) : (
                <Select
                  value={selectedOption}
                  onValueChange={setSelectedOption}
                >
                  <SelectTrigger className="w-full border-white bg-white">
                    <SelectValue
                      placeholder="Select a vessel"
                      className="font-medium text-slate-900"
                    />
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
          </View>
        </View>
        {selectedOption ? (
          <VesselTimeline
            vesselAbbrev={selectedOption.value}
            routeAbbrev={selectedOption.routeAbbrev}
            sailingDay={sailingDay}
            theme={selectedVariant.timelineTheme}
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
