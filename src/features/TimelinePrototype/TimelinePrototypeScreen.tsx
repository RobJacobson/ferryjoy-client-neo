/**
 * TimelinePrototypeScreen demonstrates domain-agnostic timeline primitives
 * with static data and parent-controlled card content.
 */

import { ScrollView } from "react-native";
import { VerticalTimeline } from "@/components/Timeline";
import { Text, View } from "@/components/ui";
import { createStaticTimelineRows } from "./data/staticTimelineRows";

/**
 * Renders static demo content for the universal timeline prototype.
 *
 * @returns Prototype screen
 */
export const TimelinePrototypeScreen = () => {
  const rows = createStaticTimelineRows();

  const theme = {
    minSegmentPx: 80,
    centerAxisSizePx: 56,
    trackThicknessPx: 8,
    markerSizePx: 18,
    indicatorSizePx: 34,
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="gap-4 p-4">
        <Text variant="h2">Timeline Prototype</Text>
        <Text className="text-muted-foreground">
          Domain-agnostic timeline with parent-owned cards and progress.
        </Text>
        <VerticalTimeline rows={rows} theme={theme} />
      </View>
    </ScrollView>
  );
};
