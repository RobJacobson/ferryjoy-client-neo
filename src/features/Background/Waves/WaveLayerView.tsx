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
 * Pixel sizing for a wave layer container.
 */
export type WaveLayerContainerSize = {
  /**
   * Width of the layer container in pixels (the parallax-provisioned width).
   */
  containerWidthPx: number;

  /**
   * Height of the layer container in pixels.
   */
  containerHeightPx: number;
};

/**
 * Props for rendering a wave layer.
 */
export type WaveLayerContentProps = {
  /**
   * Wave amplitude in pixels (height from center to peak/trough).
   */
  amplitude: number;

  /**
   * Wave period in pixels (width of one complete cycle).
   */
  period: number;

  /**
   * Animation duration in milliseconds.
   * When provided (and waveDisplacementPx > 0), oscillation is enabled.
   */
  animationDuration?: number;

  /**
   * Delay before animation starts in milliseconds.
   */
  animationDelay?: number;

  /**
   * Maximum horizontal displacement in pixels.
   * Oscillation runs between -waveDisplacementPx and +waveDisplacementPx.
   */
  waveDisplacementPx?: number;

  /**
   * Phase offset for the wave oscillation in radians.
   */
  phaseOffset?: number;

  /**
   * Opacity of the wave fill (0-1).
   */
  fillOpacity?: number;

  /**
   * Color of the wave fill.
   */
  fillColor: string;

  /**
   * Vertical position of the wave centerline as a percentage (0-100).
   * 0 = bottom, 50 = middle, 100 = top.
   */
  height?: number;

  /**
   * Paper texture source. When null, SVG does not render the texture overlay.
   */
  paperTextureUrl?: PaperTextureSource;
};

/**
 * Full props for WaveLayerView, including container sizing.
 */
export type WaveLayerViewProps = WaveLayerContentProps & WaveLayerContainerSize;

// ============================================================================
// Constants
// ============================================================================

const ABSOLUTE_FILL: ViewStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const SEAM_MARGIN_PX = 16;

// ============================================================================
// WaveLayerView
// ============================================================================

/**
 * Renders one wave layer into an overscanned rail and (optionally) oscillates
 * it horizontally. Overscan is done with layout (left + width) to guarantee
 * SVG edges never enter the visible viewport.
 *
 * @param props - Wave rendering params plus container pixel size
 */
export const WaveLayerView = ({
  containerWidthPx,
  containerHeightPx,
  amplitude,
  period,
  animationDuration,
  animationDelay,
  waveDisplacementPx,
  phaseOffset,
  fillOpacity,
  fillColor,
  height,
  paperTextureUrl,
}: WaveLayerViewProps) => {
  const displacementPx = Math.max(0, waveDisplacementPx ?? 0);
  const shouldOscillate = (animationDuration ?? 0) > 0 && displacementPx > 0;
  const overscanPx = shouldOscillate ? displacementPx + SEAM_MARGIN_PX : 0;
  const railWidthPx = containerWidthPx + 2 * overscanPx;

  const { animatedOscillationStyle } = useWaveOscillation({
    animationDuration: shouldOscillate ? animationDuration : undefined,
    animationDelay: animationDelay ?? 0,
    waveDisplacementPx: displacementPx,
    phaseOffset: phaseOffset ?? 0,
  });

  return (
    <View style={ABSOLUTE_FILL}>
      <Animated.View
        style={
          [
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              left: -overscanPx,
              width: railWidthPx,
            },
            animatedOscillationStyle,
          ] as (ViewStyle | AnimatedStyle<ViewStyle>)[]
        }
      >
        <WaveSvg
          amplitude={amplitude}
          period={period}
          fillColor={fillColor}
          fillOpacity={fillOpacity}
          height={height}
          paperTextureUrl={paperTextureUrl}
          renderWidthPx={railWidthPx}
          renderHeightPx={containerHeightPx}
        />
      </Animated.View>
    </View>
  );
};
