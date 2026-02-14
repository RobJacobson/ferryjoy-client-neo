// ============================================================================
// SunburstLayout Skia
// ============================================================================
// Positions the SunburstSkia so its center aligns to a given percentage of the
// container. Renders SunburstSkia with rotation animation.
// ============================================================================

import type { SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import {
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Sun } from "./Sun";
import SunburstSkia from "./SunburstSkia";

export type SunburstLayoutSkiaProps = {
  /**
   * Skia Image for the paper texture.
   */
  paperTexture?: SkImage | null;
  /** Number of rays in the sunburst (default 10). */
  rayCount?: number;
  /** Horizontal center of the sunburst, 0–100 (default 50). */
  centerX?: number;
  /** Vertical center of the sunburst, 0–100 (default 50). */
  centerY?: number;
  /** Rendered size in px. */
  size?: number;
};

const PINK_300 = "#f9a8d4";
const PINK_200 = "#fbcfe8";
const ORANGE_300 = "#fdba74";

const SUN_INNER_RADIUS_PX = 40;
const SUN_OUTER_RADIUS_PX = 50;
const SUN_SIZE_PX = 140;

/**
 * Lays out the SunburstSkia with centered positioning and rotation.
 *
 * @param props - Layout parameters and optional paper texture
 */
const SunburstLayoutSkia = ({
  paperTexture,
  rayCount = 10,
  centerX = 50,
  centerY = 50,
  size = 1500,
}: SunburstLayoutSkiaProps) => {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const rotation = useSharedValue(0);

  // Start rotation animation
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(-360, { duration: 180000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

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
      <View
        style={{
          position: "absolute",
          left,
          top,
          width: size,
          height: size,
        }}
        pointerEvents="none"
      >
        <SunburstSkia
          paperTexture={paperTexture}
          rayCount={rayCount}
          size={size}
          startColor={PINK_300}
          endColor={PINK_200}
          spiralStrength={-0.3}
          rotation={rotation.value}
        />
      </View>
      <View
        style={{
          position: "absolute",
          left: sunLeft,
          top: sunTop,
          width: SUN_SIZE_PX,
          height: SUN_SIZE_PX,
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

SunburstLayoutSkia.displayName = "SunburstLayoutSkia";

export default SunburstLayoutSkia;
