// ============================================================================
// SunburstLayout
// ============================================================================
// Positions the Sunburst so its center aligns to a given percentage of the
// container (centerX%/centerY%). Renders Sunburst with fill layout and aspect.
// Sun sits at the center of the sunburst (no rotation).
// ============================================================================

import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import type { PaperTextureSource } from "../types";
import { Sun } from "./Sun";
import SunburstClipped from "./SunburstClipped";

export type SunburstLayoutProps = {
  /**
   * Paper texture source. When null, sunburst SVG does not render texture.
   */
  paperTextureUrl: PaperTextureSource;
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

/** Tailwind orange-300. */
const ORANGE_300 = "#fdba74";

/** Sun inner radius in px (viewBox units in fixed-size Sun container). */
const SUN_INNER_RADIUS_PX = 40;
/** Sun outer radius in px. */
const SUN_OUTER_RADIUS_PX = 50;
/** Sun container size (px). */
const SUN_SIZE_PX = 140;

/** CSS-style rotation animation: one rotation per minute, counterclockwise. */
const sunburstRotationStyle = {
  animationName: {
    from: { transform: [{ rotate: "0deg" }] },
    to: { transform: [{ rotate: "-360deg" }] },
  },
  animationDuration: "180s",
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
  paperTextureUrl,
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
  const sunLeft = layout.width * (centerX / 100) - SUN_SIZE_PX / 2;
  const sunTop = layout.height * (centerY / 100) - SUN_SIZE_PX / 2;

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
        <SunburstClipped
          paperTextureUrl={paperTextureUrl}
          rayCount={rayCount}
          size={size}
          startColor={PINK_300}
          endColor={PINK_200}
          preserveAspectRatio="xMidYMid slice"
          spiralStrength={-0.3}
        />
      </Animated.View>
      <View
        style={{
          position: "absolute",
          left: sunLeft,
          top: sunTop,
          width: SUN_SIZE_PX,
          height: SUN_SIZE_PX,
          minWidth: SUN_SIZE_PX,
          minHeight: SUN_SIZE_PX,
        }}
        pointerEvents="none"
      >
        <Sun
          rayCount={rayCount}
          color={ORANGE_300}
          innerRadius={SUN_INNER_RADIUS_PX}
          outerRadius={SUN_OUTER_RADIUS_PX}
          size={SUN_SIZE_PX}
          preserveAspectRatio="xMidYMid meet"
        />
      </View>
    </View>
  );
};

export default SunburstLayout;
