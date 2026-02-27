/**
 * AnimatedListViewDemo – Demo component showcasing the generic AnimatedListView.
 * Demonstrates rendering the same card content as the original implementation
 * using the new renderItem callback pattern, with direction toggle support.
 */

import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import data from "@/shared/utils/fakerData";
import { useAvailableDimensions } from "@/shared/utils/useAvailableDimensions";
import AnimatedListView from "./AnimatedListView";
import DemoCard from "./DemoCard";
import { CARD_HEIGHT_RATIO, SPACING } from "./types";

const AnimatedListViewDemo = () => {
  const { availableHeight: totalHeight } = useAvailableDimensions();
  const [direction, setDirection] = useState<"vertical" | "horizontal">(
    "vertical"
  );

  // Fixed card size based on direction
  const itemSize =
    direction === "vertical"
      ? Math.floor(totalHeight * CARD_HEIGHT_RATIO)
      : 280;

  return (
    <View className="flex-1 gap-4">
      <View className="items-center gap-2">
        <Text className="font-bold text-lg">Direction</Text>
        <ToggleGroup
          type="single"
          value={direction}
          onValueChange={(value) => {
            if (value === "vertical" || value === "horizontal") {
              setDirection(value);
            }
          }}
        >
          <ToggleGroupItem value="vertical" isFirst>
            <Text>Vertical</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value="horizontal" isLast>
            <Text>Horizontal</Text>
          </ToggleGroupItem>
        </ToggleGroup>
      </View>
      <AnimatedListView
        data={data}
        renderItem={(item) => <DemoCard item={item} />}
        layout={{
          direction,
          itemSize,
          spacing: SPACING,
          activePositionRatio: 0.5,
        }}
      />
    </View>
  );
};

export default AnimatedListViewDemo;
