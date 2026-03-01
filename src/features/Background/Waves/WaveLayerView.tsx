// ============================================================================
// WaveLayerView
// ============================================================================
// A single wave layer renderer that:
// - Always renders WaveSvg into a "rail" view sized in pixels
// - Optionally applies horizontal oscillation (ocean) via CSS keyframes
// - Uses left+width overscan so SVG edges never appear in the viewport
// ============================================================================

import type { ViewStyle } from "react-native";
import { View } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import type { PaperTextureSource } from "../types";
import { useWaveOscillation } from "./useWaveOscillation";
import { WaveSvg } from "./WaveSvg";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for wave content configuration (amplitude, period, fill, etc.).
 */
export type WaveLayerContentProps = {
  /** Wave amplitude in pixels (height from center to peak/trough) */
  amplitude: number;
  /** Wave period in pixels (width of one complete cycle) */
  period: number;
  /** Animation duration in milliseconds (enables oscillation if > 0) */
  animationDuration?: number;
  /** Delay before animation starts in milliseconds */
  animationDelay?: number;
  /** Static horizontal offset for the wave rail in pixels */
  xOffsetPx?: number;
  /** Maximum expected horizontal shift magnitude in pixels */
  maxXShiftPx?: number;
  /** Phase offset for the wave oscillation in radians */
  phaseOffset?: number;
  /** Opacity of the wave fill (0-1) */
  fillOpacity?: number;
  /** Color of the wave fill */
  fillColor: string;
  /** Vertical position of wave centerline as percentage (0-100) */
  height?: number;
  /** Paper texture source (null for no texture) */
  paperTextureUrl?: PaperTextureSource;
};

/**
 * Layout configuration for a wave layer container.
 * Groups dimension-related properties needed for rendering.
 */
export type WaveLayerLayout = {
  /** Width of the layer container in pixels */
  containerWidthPx: number;
  /** Height of the layer container in pixels */
  containerHeightPx: number;
};

/**
 * Props for rendering a wave layer.
 */
export type WaveLayerViewProps = {
  /** Complete wave content configuration */
  waveProps: WaveLayerContentProps;
  /** Layout dimensions for the wave layer container */
  layout: WaveLayerLayout;
};

// ============================================================================
// Constants
// ============================================================================

/** Additional margin beyond max shift to ensure SVG seams never appear */
const SEAM_MARGIN_PX = 16;

// ============================================================================
// WaveLayerView
// ============================================================================

/**
 * Renders one wave layer into an overscanned rail and (optionally) oscillates
 * it horizontally. Overscan is done with layout (left + width) to guarantee
 * SVG edges never enter the visible viewport.
 *
 * @param waveProps - Complete wave content configuration
 * @param layout - Layout dimensions for the wave layer container
 * @returns Wave layer with optional oscillation
 */
export const WaveLayerView = ({ waveProps, layout }: WaveLayerViewProps) => {
  const { containerWidthPx, containerHeightPx } = layout;
  const offsetPx = waveProps.xOffsetPx ?? 0;
  const xShiftPx = Math.max(0, waveProps.maxXShiftPx ?? 0);
  const shouldOscillate =
    (waveProps.animationDuration ?? 0) > 0 && xShiftPx > 0;
  const overscanPx = xShiftPx + SEAM_MARGIN_PX;
  const railWidthPx = containerWidthPx + 2 * overscanPx;

  const { animatedOscillationStyle } = useWaveOscillation({
    animationDuration: shouldOscillate
      ? waveProps.animationDuration
      : undefined,
    animationDelay: waveProps.animationDelay ?? 0,
    maxXShiftPx: xShiftPx,
    phaseOffset: waveProps.phaseOffset ?? 0,
  });

  return (
    <View className="absolute top-0 right-0 bottom-0 left-0 overflow-visible">
      <View className="absolute top-0 right-0 bottom-0 left-0 overflow-visible">
        <Animated.View
          style={
            [
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: -overscanPx + offsetPx,
                width: railWidthPx,
              },
              animatedOscillationStyle,
            ] as (ViewStyle | AnimatedStyle<ViewStyle>)[]
          }
        >
          <WaveSvg
            amplitude={waveProps.amplitude}
            period={waveProps.period}
            fillColor={waveProps.fillColor}
            fillOpacity={waveProps.fillOpacity}
            height={waveProps.height}
            paperTextureUrl={waveProps.paperTextureUrl}
            renderWidthPx={railWidthPx}
            renderHeightPx={containerHeightPx}
          />
        </Animated.View>
      </View>
    </View>
  );
};
