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
import {
  DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID,
  getVesselTimelineDesignVariant,
  VESSEL_TIMELINE_DESIGN_VARIANTS,
  VesselTimeline,
} from "@/features/VesselTimeline";
import { getSailingDay } from "@/shared/utils/getSailingDay";

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
  const [selectedDesign, setSelectedDesign] = useState<DesignOption>({
    value: DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID,
    label: getVesselTimelineDesignVariant(
      DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID
    ).label,
  });

  const sailingDay = getSailingDay(new Date());
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

  return (
    <GradientBackground
      backgroundColor={selectedVariant.backgroundColor}
      colors={selectedVariant.backgroundColors}
      overlayColor={selectedVariant.backgroundOverlayColor}
    >
      <View className="flex-1">
        <Stack.Screen
          options={{
            title: "Vessel Timeline",
            headerTitleAlign: "center",
          }}
        />
        <View className="gap-4 px-4 py-4">
          <Text
            className="font-semibold text-lg"
            style={{ color: selectedVariant.titleColor }}
          >
            Placeholder Vessel Timeline
          </Text>
          <Text
            className="text-sm"
            style={{ color: selectedVariant.bodyColor }}
          >
            Select a vessel to preview the day-level timeline implementation.
          </Text>
          <Select
            value={selectedDesign}
            onValueChange={(option) => {
              if (option) {
                setSelectedDesign(option);
              }
            }}
          >
            <SelectTrigger
              style={{
                backgroundColor: selectedVariant.selectorBackgroundColor,
                borderColor: selectedVariant.selectorBorderColor,
              }}
            >
              <SelectValue
                placeholder="Select a design variant"
                className="font-medium"
                style={{ color: selectedVariant.selectorTextColor }}
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
          <Text
            className="text-xs"
            style={{ color: selectedVariant.bodyColor }}
          >
            {selectedVariant.description}
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
              <SelectTrigger
                style={{
                  backgroundColor: selectedVariant.selectorBackgroundColor,
                  borderColor: selectedVariant.selectorBorderColor,
                }}
              >
                <SelectValue
                  placeholder="Select a vessel"
                  className="font-medium"
                  style={{ color: selectedVariant.selectorTextColor }}
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
        {selectedOption ? (
          <VesselTimeline
            vesselAbbrev={selectedOption.value}
            sailingDay={sailingDay}
            routeAbbrevs={
              selectedOption.routeAbbrev ? [selectedOption.routeAbbrev] : []
            }
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
