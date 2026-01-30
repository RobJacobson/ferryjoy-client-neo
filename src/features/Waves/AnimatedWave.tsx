// ============================================================================
// Animated Wave Component
// ============================================================================
// Generates a wave using cubic Bezier curves pattern from CSS reference
// The wave is centered at y=0 and repeated across the SVG bounding box
// Uses transform-based animation for 60 FPS performance
// ============================================================================

import type React from "react";
import { useEffect, useState } from "react";
import Animated from "react-native-reanimated";
import Svg, { Defs, Path } from "react-native-svg";

/**
 * SVG dimensions constants for wave generation.
 * Wider width to handle oscillation without visible edges.
 */
const SVG_WIDTH = 4000;
const SVG_HEIGHT = 500;

/**
 * Generates an SVG path data string for a single wave.
 *
 * The wave uses cubic Bezier curves with both control points at the same Y level
 * (either peak or trough) to create a smooth, sine-like pattern.
 * Each period consists of two curves: one for the peak, one for the trough.
 *
 * Based on the CSS reference pattern:
 * - First curve: both control points at peakY (centerY - amplitude)
 * - Second curve: both control points at troughY (centerY + amplitude)
 * - Control points are at 1/3 and 2/3 of the half-period
 *
 * @param amplitude - Wave amplitude in SVG units (height from center to peak)
 * @param period - Wave period in SVG units (width of one complete cycle)
 * @param centerY - Vertical center position of the wave in SVG units
 * @returns SVG path data string
 */
const generateWavePath = (
  amplitude: number,
  period: number,
  centerY: number = SVG_HEIGHT / 2,
): string => {
  const peakY = centerY - amplitude;
  const troughY = centerY + amplitude;
  const halfPeriod = period / 2;
  const numPeriods = Math.ceil(SVG_WIDTH / period) + 1;

  // Start at the left edge
  let pathData = `M0,${centerY}`;

  // Generate wave curves across the width
  for (let i = 0; i < numPeriods; i++) {
    const periodStartX = i * period;

    // First curve: from center to peak and back to center
    // Both control points are at peakY for smooth, rounded sine-like shape
    const curve1EndX = periodStartX + halfPeriod;
    const cp1X = periodStartX + halfPeriod / 3;
    const cp2X = periodStartX + (halfPeriod * 2) / 3;

    pathData += ` C${cp1X},${peakY} ${cp2X},${peakY} ${curve1EndX},${centerY}`;

    // Second curve: from center to trough and back to center
    // Both control points are at troughY for smooth, rounded sine-like shape
    const curve2EndX = curve1EndX + halfPeriod;
    const cp3X = curve1EndX + halfPeriod / 3;
    const cp4X = curve1EndX + (halfPeriod * 2) / 3;

    pathData += ` C${cp3X},${troughY} ${cp4X},${troughY} ${curve2EndX},${centerY}`;
  }

  // Close the path to fill the bottom
  pathData += ` L${SVG_WIDTH} ${SVG_HEIGHT} L0 ${SVG_HEIGHT}`;

  return pathData;
};

/**
 * Props for the AnimatedWave component.
 */
export interface AnimatedWaveProps {
  /**
   * Wave amplitude in SVG units (height from center to peak/trough)
   */
  amplitude: number;

  /**
   * Wave period in SVG units (width of one complete cycle)
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
   * Creates staggered start times for natural layered appearance.
   */
  animationDelay?: number;

  /**
   * Maximum horizontal displacement in SVG units.
   * Wave will oscillate between -displacement and +displacement.
   */
  waveDisplacement?: number;

  /**
   * Opacity of the wave fill (0-1)
   */
  fillOpacity?: number;

  /**
   * Color of the wave fill
   */
  fillColor: string;

  /**
   * Vertical position of the wave centerline as a percentage (0-100).
   * 0 = bottom, 50 = middle, 100 = top
   */
  height?: number;

  /**
   * Color of the wave stroke (border)
   */
  strokeColor?: string;

  /**
   * Width of the wave stroke in SVG units
   */
  strokeWidth?: number;

  /**
   * Opacity of the wave stroke (0-1)
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
export const AnimatedWave: React.FC<AnimatedWaveProps> = ({
  amplitude,
  period,
  animationDuration,
  animationDelay = 0,
  waveDisplacement = 0,
  fillOpacity = 1,
  fillColor,
  height = 50,
  strokeColor = "black",
  strokeWidth = 1,
  strokeOpacity = 0.05,
}) => {
  // Calculate centerY based on height percentage (0 = bottom, 100 = top)
  const centerY = SVG_HEIGHT - (SVG_HEIGHT * height) / 100;

  // Generate path once on mount
  const [pathData, setPathData] = useState(() =>
    generateWavePath(amplitude, period, centerY),
  );

  // Regenerate path if wave parameters change
  useEffect(() => {
    setPathData(generateWavePath(amplitude, period, centerY));
  }, [amplitude, period, centerY]);

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
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Defs />
      {/* Main wave fill with animated transform */}
      <Animated.View style={animationStyle}>
        <Svg
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          preserveAspectRatio="none"
        >
          {/* Pseudo-drop shadow: layered black copies of wave creating depth effect */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <Path
              key={i}
              d={pathData}
              fill="black"
              fillOpacity={0.01}
              transform={`translate(${-2 * i}, ${-i * 0.5})`}
            />
          ))}
          {/* Main wave fill with animated transform */}
          <Path
            d={pathData}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeOpacity={strokeOpacity}
          />
        </Svg>
      </Animated.View>
    </Svg>
  );
};
