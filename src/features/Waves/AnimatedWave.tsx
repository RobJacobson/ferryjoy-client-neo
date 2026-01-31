// ============================================================================
// Animated Wave Component
// ============================================================================
// Renders a single animated wave using cubic Bezier curves.
// The wave is centered and repeated across the SVG bounding box.
// Uses transform-based animation for 60 FPS performance.
// ============================================================================

import Animated from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import WaveShadow from "./WaveShadow";
import WaveTexturePattern from "./WaveTexturePattern";
import { generateWavePath } from "./wavePath";

/** Width of the SVG canvas. Wider width allows oscillation without visible edges. */
const SVG_WIDTH = 2000;

/** Height of the SVG canvas. */
const SVG_HEIGHT = 500;

/** Unique ID for the wave texture pattern. */
const TEXTURE_PATTERN_ID = "paperTexture";

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
   * Color of the wave stroke (border).
   */
  strokeColor?: string;

  /**
   * Width of the wave stroke in SVG units.
   */
  strokeWidth?: number;

  /**
   * Opacity of the wave stroke (0-1).
   */
  strokeOpacity?: number;
}

/**
 * AnimatedWave component that renders a single animated wave.
 *
 * The wave is rendered as an SVG path with a cubic Bezier curve pattern.
 * Animation uses transform-based approach for optimal 60 FPS performance.
 * The wave oscillates left and right with sinusoidal easing.
 *
 * @example
 * ```tsx
 * <AnimatedWave
 *   amplitude={92}
 *   period={660}
 *   fillColor="#3b82f6"
 *   height={50}
 *   animationDuration={10000}
 *   waveDisplacement={500}
 *   animationDelay={1500}
 * />
 * ```
 */
const AnimatedWave = ({
  amplitude,
  period,
  animationDuration,
  animationDelay = 0,
  waveDisplacement = 0,
  fillOpacity = 1,
  fillColor,
  height = 50,
  strokeColor = "black",
  strokeWidth = 0.5,
  strokeOpacity = 0.1,
}: AnimatedWaveProps) => {
  // Calculate centerY based on height percentage (0 = bottom, 100 = top)
  const centerY = SVG_HEIGHT - (SVG_HEIGHT * height) / 100;

  // Overscan the SVG by the max horizontal displacement so edges never show.
  const overscanX = Math.max(0, waveDisplacement);
  const svgRenderWidth = SVG_WIDTH + overscanX * 2;

  // Generate path
  const pathData = generateWavePath(
    amplitude,
    period,
    centerY,
    svgRenderWidth,
    SVG_HEIGHT
  );

  // Create sinusoidal animation keyframes
  const sinusoidalAnimation = animationDuration
    ? {
        "0%": { transform: [{ translateX: 0 }] },
        "50%": { transform: [{ translateX: -waveDisplacement }] },
        "100%": { transform: [{ translateX: waveDisplacement }] },
      }
    : undefined;

  // Build animation style
  const animationStyle = {
    transform: [{ translateX: 0 }] as const,
    ...(animationDuration && {
      animationName: sinusoidalAnimation,
      animationDuration,
      animationDelay,
      animationIterationCount: "infinite" as const,
      animationTimingFunction: "ease-in-out" as const,
      animationDirection: "alternate" as const,
    }),
  };

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          right: -overscanX,
          bottom: 0,
          left: -overscanX,
        },
        animationStyle,
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgRenderWidth} ${SVG_HEIGHT}`}
        preserveAspectRatio="none"
      >
        {/* Wave texture pattern definition */}
        <WaveTexturePattern id={TEXTURE_PATTERN_ID} />

        {/* Pseudo-drop shadow: layered black copies of wave creating depth effect */}
        <WaveShadow pathData={pathData} />

        {/* Main wave fill */}
        <Path
          d={pathData}
          fill={fillColor}
          fillOpacity={fillOpacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
        />

        {/* Paper texture overlay - adds surface texture while preserving color */}
        <Path
          d={pathData}
          fill={`url(#${TEXTURE_PATTERN_ID})`}
          fillOpacity={0.35}
        />
      </Svg>
    </Animated.View>
  );
};
export default AnimatedWave;
