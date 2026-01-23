/**
 * TripProgressMarker component for displaying a marker between TripProgressBar components.
 * Displays a circle that overlaps with adjacent progress bars and a child component below it.
 */

import { useState } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import { cn } from "@/lib/utils";
import { PROGRESS_BAR_HEIGHT, STACKING } from "./config";
import TripProgressCircle from "./TripProgressCircle";

type TripProgressMarkerProps = {
  /**
   * Child component to display below the circle.
   */
  children: React.ReactNode;
  /**
   * Optional className for styling the container.
   */
  className?: string;
  /**
   * Optional zIndex for layering.
   */
  zIndex?: number;
};

/**
 * Displays a circle marker that overlaps with TripProgressBar bars and a child component below it.
 * Uses zero width and absolute positioning to work seamlessly when placed between
 * TripProgressBar components.
 *
 * @param children - Child component to display below the circle
 * @param className - Optional className for styling the container
 * @param zIndex - Optional zIndex for layering
 * @returns A View component with absolutely positioned circle and child component
 */
const TripProgressMarker = ({
  children,
  className,
  zIndex = STACKING.marker,
}: TripProgressMarkerProps) => {
  const [childWidth, setChildWidth] = useState(0);

  const handleChildLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setChildWidth((prev) => (prev === width ? prev : width));
  };

  return (
    <View
      className={cn("relative", className)}
      style={{
        width: 0,
        height: PROGRESS_BAR_HEIGHT,
        overflow: "visible",
        zIndex,
        elevation: zIndex,
      }}
    >
      {/* Circle positioned to overlap with progress bars */}
      <TripProgressCircle
        left="50%"
        backgroundColor="bg-white"
        borderColor="border border-pink-500"
        zIndex={zIndex}
      />
      {/* Child component positioned below the circle */}
      <View
        className="absolute items-center"
        style={{
          top: "100%",
          left: "50%",
          transform: [{ translateX: -childWidth / 2 }],
          marginTop: 8,
          zIndex,
          elevation: zIndex,
        }}
        onLayout={handleChildLayout}
      >
        {children}
      </View>
    </View>
  );
};

export default TripProgressMarker;
