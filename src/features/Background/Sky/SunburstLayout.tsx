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
import config from "./config";
import { Sun } from "./Sun";
import { Sunburst } from "./Sunburst";

type SunburstLayoutProps = {
  /**
   * Paper texture source. When null, sunburst SVG does not render texture.
   */
  paperTextureUrl: PaperTextureSource;
  /** Number of rays in the sunburst. */
  rayCount: number;
  /** Horizontal center of the sunburst, 0–100 (default 50). */
  centerX?: number;
  /** Vertical center of the sunburst, 0–100 (default 50). */
  centerY?: number;
  /** Rendered size in px (default from config). */
  layoutSize?: number;
};

/** Reanimated 4 CSS rotation: one full rotation over rotationDurationMs, counterclockwise. */
const sunburstRotationStyle = {
  animationName: {
    from: { transform: [{ rotate: "0deg" }] },
    to: { transform: [{ rotate: "-360deg" }] },
  },
  animationDuration: `${config.sunburst.rotationDurationMs / 1000}s`,
  animationIterationCount: "infinite" as const,
  animationTimingFunction: "linear" as const,
};

/**
 * Minimum sunburst size multiplier so it extends to the container's right edge
 * when scrolled. With centerX=25%, sunburst right edge = 0.25*width + size/2.
 * Requiring that >= width gives size >= 1.5*width.
 */
const SUNBURST_WIDTH_MULTIPLIER = 1.5;

/**
 * Max sunburst size multiplier on small screens. Keeps the spiral visible and
 * rays curved; on phones, 2000px would make rays appear nearly straight.
 */
const SUNBURST_MAX_SCREEN_MULTIPLIER = 2.5;

/**
 * Sun disc max fraction of screen width. Prevents disproportionate size on phones.
 */
const SUN_MAX_WIDTH_FRACTION = 0.22;

/**
 * Lays out the Sunburst so its center is at (centerX%, centerY%) of the
 * container. Size scales with container width so the sunburst always covers
 * the full visible area when the carousel is panned (e.g. iPad landscape).
 *
 * @param props - paperTextureUrl, rayCount (required), centerX, centerY (0–100), optional size (px)
 * @returns Container view with positioned Sunburst
 */
const SunburstLayout = ({
  paperTextureUrl,
  rayCount,
  centerX = config.sunburst.centerX,
  centerY = config.sunburst.centerY,
  layoutSize: layoutSizeProp = config.sunburst.defaultSize,
}: SunburstLayoutProps) => {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  };

  // Cover right edge at max scroll; cap on small screens so rays stay curved
  const minForCoverage = layout.width * SUNBURST_WIDTH_MULTIPLIER;
  const maxForPhones = layout.width * SUNBURST_MAX_SCREEN_MULTIPLIER;
  const layoutSize = Math.max(
    minForCoverage,
    Math.min(layoutSizeProp, maxForPhones)
  );

  const { sizePx: sunSizePxConfig } = config.sun;
  const sunSizePx =
    layout.width > 0
      ? Math.min(sunSizePxConfig, layout.width * SUN_MAX_WIDTH_FRACTION)
      : sunSizePxConfig;
  const left = layout.width * (centerX / 100) - layoutSize / 2;
  const top = layout.height * (centerY / 100) - layoutSize / 2;
  const sunLeft = layout.width * (centerX / 100) - sunSizePx / 2;
  const sunTop = layout.height * (centerY / 100) - sunSizePx / 2;

  return (
    <View className="absolute inset-0" onLayout={onLayout}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left,
            top,
            width: layoutSize,
            height: layoutSize,
          },
          sunburstRotationStyle,
        ]}
        pointerEvents="none"
      >
        <Sunburst
          paperTextureUrl={paperTextureUrl}
          rayCount={rayCount}
          size={layoutSize}
          startColor={config.sunburst.startColor}
          endColor={config.sunburst.endColor}
          preserveAspectRatio={config.sunburst.preserveAspectRatio}
          spiralStrength={config.sunburst.spiralStrength}
        />
      </Animated.View>
      <View
        style={{
          position: "absolute",
          left: sunLeft,
          top: sunTop,
          width: sunSizePx,
          height: sunSizePx,
          minWidth: sunSizePx,
          minHeight: sunSizePx,
        }}
        pointerEvents="none"
      >
        <Sun
          rayCount={rayCount}
          color={config.sun.color}
          innerRadius={config.sun.innerRadiusPx}
          outerRadius={config.sun.outerRadiusPx}
          size={sunSizePx}
          preserveAspectRatio="xMidYMid meet"
        />
      </View>
    </View>
  );
};

export default SunburstLayout;
