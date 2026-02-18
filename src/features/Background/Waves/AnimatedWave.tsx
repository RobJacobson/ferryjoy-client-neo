// ============================================================================
// Animated Wave Component
// ============================================================================
// Renders a single animated wave using cubic Bezier curves.
// The wave is centered and repeated across the SVG bounding box.
// Uses transform-based animation for 60 FPS performance.
// ============================================================================

import type { ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import Svg, { Defs, Path, Pattern, Image as SvgImage } from "react-native-svg";
import type { PaperTextureSource } from "../types";
import {
  PAPER_TEXTURE_OPACITY,
  SHADOW_LAYERS,
  SHADOW_OPACITY,
  SVG_HEIGHT,
  WAVE_STROKE,
} from "./config";
import { useWaveOscillation } from "./useWaveOscillation";
import { generateWavePath } from "./wavePath";

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

/**
 * AnimatedWave component that renders a single animated wave.
 */
const AnimatedWave = ({
  amplitude,
  period,
  animationDuration,
  animationDelay = 0,
  waveDisplacement = 0,
  phaseOffset = 0,
  fillOpacity = 1,
  fillColor,
  height = 50,
  paperTextureUrl,
}: AnimatedWaveProps) => {
  const { animatedOscillationStyle, svgRenderWidth } = useWaveOscillation({
    animationDuration,
    animationDelay,
    waveDisplacement,
    phaseOffset,
  });

  const centerY = SVG_HEIGHT - (SVG_HEIGHT * height) / 100;
  const pathData = generateWavePath(
    amplitude,
    period,
    centerY,
    svgRenderWidth,
    SVG_HEIGHT
  );

  const LOCAL_TEXTURE_ID = `texture-${amplitude}-${period}`;

  return (
    <Animated.View
      style={
        [
          {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
          animatedOscillationStyle,
        ] as (ViewStyle | AnimatedStyle<ViewStyle>)[]
      }
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgRenderWidth} ${SVG_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Defs>
          {paperTextureUrl != null && (
            <Pattern
              id={LOCAL_TEXTURE_ID}
              patternUnits="userSpaceOnUse"
              width={400}
              height={400}
            >
              <SvgImage
                href={paperTextureUrl}
                width={512}
                height={512}
                preserveAspectRatio="xMidYMid slice"
              />
            </Pattern>
          )}
        </Defs>

        {/* Pseudo-drop shadow: layered black copies of wave creating depth effect */}
        {SHADOW_LAYERS.map(([dx, dy]) => (
          <Path
            key={`shadow-${dx}-${dy}`}
            d={pathData}
            fill="black"
            fillOpacity={SHADOW_OPACITY}
            transform={`translate(${dx}, ${dy})`}
          />
        ))}

        {/* Main wave fill with paper-noise filter (fine grain overlay) */}
        <Path
          d={pathData}
          fill={fillColor}
          fillOpacity={fillOpacity}
          stroke={WAVE_STROKE.color}
          strokeWidth={WAVE_STROKE.width}
          strokeOpacity={WAVE_STROKE.opacity}
        />

        {/* Paper texture overlay - only when paperTextureUrl set */}
        {paperTextureUrl != null && (
          <Path
            d={pathData}
            fill={`url(#${LOCAL_TEXTURE_ID})`}
            fillOpacity={PAPER_TEXTURE_OPACITY}
          />
        )}
      </Svg>
    </Animated.View>
  );
};

export default AnimatedWave;

/** Alias for use in wave stack (single Wave component). */
export const Wave = AnimatedWave;
