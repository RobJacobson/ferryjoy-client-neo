// ============================================================================
// Animated Wave (clip-path variant)
// ============================================================================
// Clip-path version for comparison and testing: clips texture + color rects
// to the wave shape instead of filling the path. Same props and animation
// as AnimatedWave; uses useWaveOscillation and generateWavePath.
// ============================================================================

import type { ComponentProps } from "react";
import { memo, useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, {
  ClipPath,
  Defs,
  G,
  Path,
  Pattern,
  Rect,
  Image as SvgImage,
} from "react-native-svg";
import type { PaperTextureSource } from "../types";
import { useWaveOscillation } from "./useWaveOscillation";
import { useWaveTextureReady } from "./WaveTextureReadyContext";
import { generateWavePath } from "./wavePath";

/** Height of the SVG canvas. */
const SVG_HEIGHT = 500;

const PAPER_TEXTURE_OPACITY = 0.2;

const STROKE_COLOR = "black";
const STROKE_WIDTH = 1;
const STROKE_OPACITY = 0.05;

export const SHADOW_OPACITY = 0.05;
export const SHADOW_LAYERS: [number, number][] = [
  [9, -2],
  [6, -1],
  [3, -0.5],
];

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
 * Clip-path variant of AnimatedWave: same visual via clipped rects.
 * Use for comparison and performance testing.
 */
const AnimatedWaveClipped = memo(
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
    paperTextureUrl,
  }: AnimatedWaveProps) => {
    const { ready: textureReady, markReady: markTextureReady } =
      useWaveTextureReady();
    // When no texture is passed, show wave immediately (no wait for texture load).
    const effectiveReady = paperTextureUrl == null || textureReady;
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

    const clipId = `clip-wave-${amplitude}-${period}`;
    const textureId = `texture-${amplitude}-${period}`;

    return (
      <View
        style={{
          position: "absolute",
          top: 0,
          right: -overscanX,
          bottom: 0,
          left: -overscanX,
          opacity: effectiveReady ? 1 : 0,
        }}
        pointerEvents="box-none"
      >
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
              <ClipPath id={clipId}>
                <Path d={pathData} />
              </ClipPath>
              {paperTextureUrl != null && (
                <Pattern
                  id={textureId}
                  patternUnits="userSpaceOnUse"
                  width={512}
                  height={512}
                >
                  <SvgImage
                    href={paperTextureUrl}
                    width={512}
                    height={512}
                    preserveAspectRatio="xMidYMid slice"
                    onLoad={markTextureReady}
                  />
                </Pattern>
              )}
            </Defs>

            {/* Pseudo-drop shadow: layered black copies (shared with AnimatedWave) */}
            {SHADOW_LAYERS.map(([dx, dy]) => (
              <Path
                key={`shadow-${dx}-${dy}`}
                d={pathData}
                fill="black"
                fillOpacity={SHADOW_OPACITY}
                transform={`translate(${dx}, ${dy})`}
              />
            ))}

            {/* Clipped group: color rect then texture rect (when paperTextureUrl set) */}
            <G clipPath={`url(#${clipId})`}>
              <Rect
                x={0}
                y={0}
                width={svgRenderWidth}
                height={SVG_HEIGHT}
                fill={fillColor}
                fillOpacity={fillOpacity}
              />
              {paperTextureUrl != null && (
                <Rect
                  x={0}
                  y={0}
                  width={svgRenderWidth}
                  height={SVG_HEIGHT}
                  fill={`url(#${textureId})`}
                  fillOpacity={PAPER_TEXTURE_OPACITY}
                />
              )}
            </G>

            {/* Stroke outline to match AnimatedWave */}
            <Path
              d={pathData}
              fill="none"
              stroke={STROKE_COLOR}
              strokeWidth={STROKE_WIDTH}
              strokeOpacity={STROKE_OPACITY}
            />
          </Svg>
        </Animated.View>
      </View>
    );
  }
);

AnimatedWaveClipped.displayName = "AnimatedWaveClipped";

export default AnimatedWaveClipped;
