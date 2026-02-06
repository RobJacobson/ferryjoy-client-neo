// ============================================================================
// Animated Wave Component
// ============================================================================
// Renders a single animated wave using cubic Bezier curves.
// The wave is centered and repeated across the SVG bounding box.
// Uses transform-based animation for 60 FPS performance.
// ============================================================================

import { memo, useMemo } from "react";
import Animated from "react-native-reanimated";
import Svg, { Defs, Path, Pattern, Image as SvgImage } from "react-native-svg";
import { generateWavePath } from "./wavePath";

/** Width of the SVG canvas. Wider width allows oscillation without visible edges. */
const SVG_WIDTH = 2000;

/** Height of the SVG canvas. */
const SVG_HEIGHT = 500;

/**
 * Base64 encoded 1x1 transparent PNG.
 * Used as a placeholder to keep the SvgImage component active in the DOM
 * while the actual texture is being decoded.
 */
const PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

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
 */
const AnimatedWave = memo(
  ({
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

    // Create sinusoidal animation keyframes
    const sinusoidalAnimation = useMemo(
      () =>
        animationDuration
          ? {
              "0%": { transform: [{ translateX: 0 }] },
              "50%": { transform: [{ translateX: -waveDisplacement }] },
              "100%": { transform: [{ translateX: waveDisplacement }] },
            }
          : undefined,
      [animationDuration, waveDisplacement]
    );

    // Build animation style
    const animationStyle = useMemo(
      () => ({
        transform: [{ translateX: 0 }] as const,
        ...(animationDuration && {
          animationName: sinusoidalAnimation,
          animationDuration,
          animationDelay,
          animationIterationCount: "infinite" as const,
          animationTimingFunction: "ease-in-out" as const,
          animationDirection: "alternate" as const,
        }),
      }),
      [sinusoidalAnimation, animationDuration, animationDelay]
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
          animationStyle,
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
              width={512}
              height={512}
            >
              {/* 
                We use a layered approach for the image to prevent pop-in.
                The placeholder keeps the pattern active while the high-res 
                texture is being decoded by the native6 engine.
            */}
              {/* <SvgImage href={PLACEHOLDER} width={1} height={1} /> */}
              <SvgImage
                href={require("../../../assets/textures/paper-texture-4-bw.png")}
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
            fillOpacity={0.03}
            transform="translate(-12, -3)"
          />
          <Path
            d={pathData}
            fill="black"
            fillOpacity={0.03}
            transform="translate(-9, -2)"
          />
          <Path
            d={pathData}
            fill="black"
            fillOpacity={0.03}
            transform="translate(-6, -1)"
          />
          <Path
            d={pathData}
            fill="black"
            fillOpacity={0.03}
            transform="translate(-3, -0.5)"
          />

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
          {/* <Path
            d={pathData}
            fill={`url(#${LOCAL_TEXTURE_ID})`}
            fillOpacity={0.25}
          /> */}
        </Svg>
      </Animated.View>
    );
  }
);

export default AnimatedWave;
