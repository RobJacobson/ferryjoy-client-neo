import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Text, View } from "@/components/ui";

export type TimelineLabelProps = {
  position: number; // 0-100 percentage
  time: string;
  description?: string;
};

export const TimelineLabel = ({
  position,
  time,
  description,
}: TimelineLabelProps) => {
  const [labelWidth, setLabelWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setLabelWidth(width);
  };

  return (
    <View
      className="absolute items-center"
      style={{
        left: `${position}%`,
        transform: [{ translateX: -(labelWidth / 2) || 0 }], // Center the label
      }}
      onLayout={handleLayout}
    >
      <Text
        variant="default"
        className="font-bold leading-tight text-center line-height-tight"
      >
        {time}
      </Text>
      {description && (
        <Text variant="muted" className="font-light leading-tight text-center">
          {description}
        </Text>
      )}
    </View>
  );
};
