// ============================================================================
// Animated Wave Component
// ============================================================================
// Renders a single animated wave using cubic Bezier curves.
// The wave is centered and repeated across the SVG bounding box.
// Uses transform-based animation for 60 FPS performance.
// ============================================================================

import type { ComponentProps } from "react";
import { memo, useMemo } from "react";
import Animated from "react-native-reanimated";
import Svg, { Defs, Path, Pattern, Image as SvgImage } from "react-native-svg";
import { useWaveOscillation } from "./useWaveOscillation";
import { generateWavePath } from "./wavePath";

/** Height of the SVG canvas. */
const SVG_HEIGHT = 500;

const PAPER_TEXTURE_OPACITY = 0.25;
const PAPER_TEXTURE = require("assets/textures/paper-texture-4-bw.png");

const STROKE_COLOR = "black";
const STROKE_WIDTH = 0.5;
const STROKE_OPACITY = 0.1;

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
}

/**
 * AnimatedWave component that renders a single animated wave.
 */
const AnimatedWave = memo(
  ({
    amplitude,
    period,
    animationDuration,
    animationDelay = 0,
    waveDisplacement = 0,
    phaseOffset = 0,
    fillOpacity = 1,
    fillColor,
    height = 50,
  }: AnimatedWaveProps) => {
    const { animatedOscillationStyle, overscanX, svgRenderWidth } =
      useWaveOscillation({
        animationDuration,
        animationDelay,
        waveDisplacement,
        phaseOffset,
      });

    const centerY = SVG_HEIGHT - (SVG_HEIGHT * height) / 100;

    const pathData = useMemo(
      () =>
        generateWavePath(
          amplitude,
          period,
          centerY,
          svgRenderWidth,
          SVG_HEIGHT
        ),
      [amplitude, period, centerY, svgRenderWidth]
    );

    const LOCAL_TEXTURE_ID = `texture-${amplitude}-${period}`;

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
          animatedOscillationStyle as ComponentProps<
            typeof Animated.View
          >["style"],
        ]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgRenderWidth} ${SVG_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <Defs>
            <Pattern
              id={LOCAL_TEXTURE_ID}
              patternUnits="userSpaceOnUse"
              width={400}
              height={400}
            >
              <SvgImage
                href={PAPER_TEXTURE}
                width={512}
                height={512}
                preserveAspectRatio="xMidYMid slice"
              />
            </Pattern>
          </Defs>

          {/* Pseudo-drop shadow: layered black copies of wave creating depth effect */}
          <Path
            d={pathData}
            fill="black"
            fillOpacity={0.04}
            transform="translate(-9, -2)"
          />
          <Path
            d={pathData}
            fill="black"
            fillOpacity={0.04}
            transform="translate(-6, -1)"
          />
          <Path
            d={pathData}
            fill="black"
            fillOpacity={0.04}
            transform="translate(-3, -0.5)"
          />

          {/* Main wave fill with paper-noise filter (fine grain overlay) */}
          <Path
            d={pathData}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={STROKE_COLOR}
            strokeWidth={STROKE_WIDTH}
            strokeOpacity={STROKE_OPACITY}
          />

          {/* Paper texture overlay - adds surface texture while preserving color */}
          <Path
            d={pathData}
            fill={`url(#${LOCAL_TEXTURE_ID})`}
            fillOpacity={PAPER_TEXTURE_OPACITY}
          />
        </Svg>
      </Animated.View>
    );
  }
);

export default AnimatedWave;
