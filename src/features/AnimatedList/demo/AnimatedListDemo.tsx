/**
 * AnimatedListDemo – Demo component showcasing the generic AnimatedList.
 * Demonstrates rendering of same card content as the original implementation
 * using the new renderItem callback pattern, with direction toggle support,
 * scroll progress display, and programmatic scroll controls.
 */

import { useRef, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import data from "@/shared/utils/fakerData";
import { useAvailableDimensions } from "@/shared/utils/useAvailableDimensions";
import AnimatedList from "../AnimatedList";
import type { AnimatedListRef } from "../types";
import AnimatedListDemoCard from "./AnimatedListDemoCard";
import animatedStyleDemo from "./animatedStyleDemo";

const SPACING = 4;
const CARD_HEIGHT_RATIO = 0.3;

const AnimatedListDemo = () => {
  const { availableHeight: totalHeight } = useAvailableDimensions();
  const [direction, setDirection] = useState<"vertical" | "horizontal">(
    "vertical",
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const listViewRef = useRef<AnimatedListRef>(null);

  // Fixed card size based on direction
  const itemSize =
    direction === "vertical"
      ? Math.floor(totalHeight * CARD_HEIGHT_RATIO)
      : 280;

  const handleScrollEnd = (index: number) => {
    setActiveIndex(index);
  };

  const scrollTo = (targetIndex: number) => {
    listViewRef.current?.scrollToIndex(targetIndex, true);
  };

  const scrollToPrevious = () => {
    if (activeIndex > 0) {
      scrollTo(activeIndex - 1);
    }
  };

  const scrollToNext = () => {
    if (activeIndex < data.length - 1) {
      scrollTo(activeIndex + 1);
    }
  };

  const scrollToStart = () => {
    scrollTo(0);
  };

  const scrollToEnd = () => {
    scrollTo(data.length - 1);
  };

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 py-2">
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
            <Text className="text-xs">V</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value="horizontal" isLast>
            <Text className="text-xs">H</Text>
          </ToggleGroupItem>
        </ToggleGroup>
        <Text className="text-muted-foreground text-xs">
          {activeIndex} / {Math.max(0, data.length - 1)}
        </Text>
      </View>
      <View className="flex-1">
        <AnimatedList
          ref={listViewRef}
          data={data}
          renderItem={(item) => <AnimatedListDemoCard item={item} />}
          layout={{
            direction,
            itemSize,
            spacing: SPACING,
          }}
          itemAnimationStyle={animatedStyleDemo}
          onScrollEnd={handleScrollEnd}
        />
      </View>
      <View className="flex-row items-center justify-center gap-1 pb-2">
        <Button variant="ghost" size="sm" onPress={scrollToStart}>
          <Text className="text-sm">⏮</Text>
        </Button>
        <Button variant="ghost" size="sm" onPress={scrollToPrevious}>
          <Text className="text-sm">◀</Text>
        </Button>
        <Button variant="ghost" size="sm" onPress={scrollToNext}>
          <Text className="text-sm">▶</Text>
        </Button>
        <Button variant="ghost" size="sm" onPress={scrollToEnd}>
          <Text className="text-sm">⏭</Text>
        </Button>
      </View>
    </View>
  );
};

export default AnimatedListDemo;
