// ============================================================================
// SunburstLayout
// ============================================================================
// Positions the Sunburst so its center aligns to a given percentage of the
// container (centerX%/centerY%). Renders Sunburst with fill layout and aspect.
// ============================================================================

import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Sunburst } from "./Sunburst";

export type SunburstLayoutProps = {
  /** Number of rays in the sunburst (default 10). */
  rayCount?: number;
  /** Horizontal center of the sunburst, 0–100 (default 50). */
  centerX?: number;
  /** Vertical center of the sunburst, 0–100 (default 50). */
  centerY?: number;
  /** Rendered size in px (default SUNBURST_VIEWBOX_SIZE). */
  size?: number;
};

const _PINK_100 = "#fce7f3";
const _PINK_400 = "#f472b6";
const PINK_300 = "#f9a8d4";
const PINK_200 = "#fbcfe8";

/** CSS-style rotation animation: one rotation per minute, counterclockwise. */
const sunburstRotationStyle = {
  animationName: {
    from: { transform: [{ rotate: "0deg" }] },
    to: { transform: [{ rotate: "-360deg" }] },
  },
  animationDuration: "120s",
  animationIterationCount: "infinite" as const,
  animationTimingFunction: "linear" as const,
};

/**
 * Lays out the Sunburst so its center is at (centerX%, centerY%) of the
 * container. Size is the size prop (px) or SUNBURST_VIEWBOX_SIZE.
 *
 * @param props - centerX, centerY (0–100), optional size (px)
 * @returns Container view with positioned Sunburst
 */
const SunburstLayout = ({
  rayCount = 10,
  centerX = 50,
  centerY = 50,
  size = 1500,
}: SunburstLayoutProps) => {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  };

  const left = layout.width * (centerX / 100) - size / 2;
  const top = layout.height * (centerY / 100) - size / 2;

  return (
    <View className="absolute inset-0" onLayout={onLayout}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left,
            top,
            width: size,
            height: size,
          },
          sunburstRotationStyle,
        ]}
        pointerEvents="none"
      >
        <Sunburst
          rayCount={rayCount}
          size={size}
          startColor={PINK_300}
          endColor={PINK_200}
          preserveAspectRatio="xMidYMid slice"
          spiralStrength={-0.3}
        />
      </Animated.View>
    </View>
  );
};

export default SunburstLayout;
