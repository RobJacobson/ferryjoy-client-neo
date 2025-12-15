import { useState } from "react";
import { Text, View } from "@/components/ui";
import { clamp } from "@/shared/utils";
import { KNOB_SIZE, TRACK_HEIGHT, TRACK_Y } from "./constants";

export type TimelineKnobProps = {
  progressPosition: number; // 0-100, percentage position
  VesselName: string;
  VesselStatus: string;
};

export const TimelineKnob = ({
  progressPosition,
  VesselName,
  VesselStatus,
}: TimelineKnobProps) => {
  const [calloutWidth, setCalloutWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate left position in pixels, centered on progressPosition
  // Then clamp to ensure callout stays within bounds
  const leftPercent = progressPosition;
  const leftPx = (leftPercent / 100) * containerWidth - calloutWidth / 2;
  const clampedLeft = clamp(
    leftPx,
    0,
    Math.max(0, containerWidth - calloutWidth)
  );

  return (
    <View
      className="absolute inset-0"
      onLayout={(e) => {
        setContainerWidth(e.nativeEvent.layout.width);
      }}
    >
      {/* Callout */}
      <View
        className="absolute top-[-10px] items-center"
        style={{
          left: clampedLeft,
        }}
      >
        <View
          className="items-center px-3 py-1 rounded-full border bg-background border-primary"
          style={shadowStyle}
          onLayout={(e) => setCalloutWidth(e.nativeEvent.layout.width)}
        >
          <Text variant="caption" className="text-foreground">
            {`${VesselName} | ${VesselStatus}`}
          </Text>
        </View>
      </View>

      {/* Knob */}
      <View
        className="absolute rounded-full border-2 bg-background border-primary"
        style={{
          top: TRACK_Y + TRACK_HEIGHT / 2 - KNOB_SIZE / 2,
          left: `${progressPosition}%`,
          marginLeft: -KNOB_SIZE / 2, // Center the knob on the position
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          ...shadowStyle,
        }}
      />
    </View>
  );
};

const shadowStyle = {
  // iOS shadows
  shadowColor: "#000",
  shadowOffset: { width: -1, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
  // Android elevation
  elevation: 2,
};
