// ============================================================================
// Animated Wave Component
// ============================================================================
// Renders a single animated wave. Uses useWaveOscillationCSS and wraps WaveSvg
// in Animated.View. For static waves, use a plain View wrapping WaveSvg.
// ============================================================================

import type { ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import type { PaperTextureSource } from "../types";
import { useWaveOscillationCSS } from "./useWaveOscillationCSS";
import { WaveSvg } from "./WaveSvg";

/**
 * Props for the AnimatedWave component.
 */
export interface AnimatedWaveProps {
  /**
   * Wave amplitude in SVG units (height from center to peak/trough).
   */
  amplitude: number;

  /**
   * Wave period in SVG units (width of one complete cycle).
   */
  period: number;

  /**
   * Animation duration in milliseconds.
   * If provided, the wave will animate continuously with sinusoidal easing.
   * If omitted, the wave will be static.
   */
  animationDuration?: number;

  /**
   * Delay before animation starts in milliseconds.
   * Creates staggered start times for a natural layered appearance.
   */
  animationDelay?: number;

  /**
   * Maximum horizontal displacement in SVG units.
   * The wave will oscillate between -displacement and +displacement.
   */
  waveDisplacement?: number;

  /**
   * Phase offset for the wave oscillation in radians.
   * Use this to de-sync layers without animation delays.
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
}

const ABSOLUTE_FILL: ViewStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

/**
 * Animated wave (ocean). Uses useWaveOscillationCSS and Animated.View wrapper.
 */
const AnimatedWave = (props: AnimatedWaveProps) => {
  const { animatedOscillationStyle, svgRenderWidth } = useWaveOscillationCSS({
    animationDuration: props.animationDuration,
    animationDelay: props.animationDelay ?? 0,
    waveDisplacement: props.waveDisplacement ?? 0,
    phaseOffset: props.phaseOffset ?? 0,
  });
  return (
    <Animated.View
      style={
        [ABSOLUTE_FILL, animatedOscillationStyle] as (
          | ViewStyle
          | AnimatedStyle<ViewStyle>
        )[]
      }
    >
      <WaveSvg {...props} svgRenderWidth={svgRenderWidth} />
    </Animated.View>
  );
};

export default AnimatedWave;
export { AnimatedWave };
