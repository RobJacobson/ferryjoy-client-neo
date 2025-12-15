import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Text, View } from "@/components/ui";
import { clamp } from "@/shared/utils";

export type TimelineCalloutProps = {
  text: string;
  trackWidth: number;
  progressX: number;
};

export const TimelineCallout = ({
  text,
  trackWidth,
  progressX,
}: TimelineCalloutProps) => {
  const [calloutWidth, setCalloutWidth] = useState(0);

  return (
    <View
      className="absolute top-0 items-center"
      style={{
        left: clamp(
          progressX - calloutWidth / 2,
          0,
          Math.max(0, trackWidth - calloutWidth)
        ),
      }}
      onLayout={(e) => setCalloutWidth(e.nativeEvent.layout.width)}
    >
      <View className="px-3 py-1 rounded-full border bg-card border-border">
        <Text variant="caption" className="text-foreground">
          {text}
        </Text>
      </View>
      <View
        className="mt-[-2px] w-2 h-2 bg-card border border-border"
        style={{
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
};
