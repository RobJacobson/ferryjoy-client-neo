// ============================================================================
// Animated Wave Component
// ============================================================================
// Renders a single animated wave using cubic Bezier curves.
// The wave is centered and repeated across the SVG bounding box.
// Uses transform-based animation for 60 FPS performance.
// ============================================================================

import { memo, useEffect, useMemo } from "react";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Defs, Path, Pattern, Image as SvgImage } from "react-native-svg";
import { generateWavePath } from "./wavePath";

/** Width of the SVG canvas. Wider width allows oscillation without visible edges. */
const SVG_WIDTH = 2000;

/** Height of the SVG canvas. */
const SVG_HEIGHT = 500;

const BASE_FRAME_MS = 1000 / 60;
const MAX_FRAME_DT_MS = 34;
const TWO_PI = 2 * Math.PI;

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

    const shouldAnimate = Boolean(animationDuration) && waveDisplacement !== 0;

    const animateSV = useSharedValue(shouldAnimate);
    const delayRemainingMsSV = useSharedValue(Math.max(0, animationDelay));
    const angularVelocityRadPerMsSV = useSharedValue(
      shouldAnimate ? TWO_PI / Math.max(1, animationDuration ?? 1) : 0
    );
    const displacementSV = useSharedValue(waveDisplacement);

    // theta is the phase for the sine wave in radians.
    const theta = useSharedValue(phaseOffset);
    const translateX = useDerivedValue(() => {
      return Math.sin(theta.value) * displacementSV.value;
    });

    useEffect(() => {
      animateSV.value = shouldAnimate;
      displacementSV.value = waveDisplacement;
      delayRemainingMsSV.value = Math.max(0, animationDelay);
      angularVelocityRadPerMsSV.value = shouldAnimate
        ? TWO_PI / Math.max(1, animationDuration ?? 1)
        : 0;

      // Ensure phase is correct immediately (no "jump" after mount).
      theta.value = phaseOffset;
    }, [
      animateSV,
      animationDelay,
      animationDuration,
      angularVelocityRadPerMsSV,
      delayRemainingMsSV,
      displacementSV,
      phaseOffset,
      theta,
      waveDisplacement,
      shouldAnimate,
    ]);

    const frameCallback = useFrameCallback((frameInfo) => {
      "worklet";

      const rawDtMs = frameInfo.timeSincePreviousFrame;
      const dtMs = rawDtMs ?? BASE_FRAME_MS;
      const cappedDtMs = Math.min(MAX_FRAME_DT_MS, dtMs);

      if (!animateSV.value || rawDtMs == null) {
        return;
      }

      if (delayRemainingMsSV.value > 0) {
        delayRemainingMsSV.value = Math.max(
          0,
          delayRemainingMsSV.value - cappedDtMs
        );
        return;
      }

      theta.value += angularVelocityRadPerMsSV.value * cappedDtMs;
      if (theta.value > TWO_PI) {
        // Keep bounded to avoid long-run float growth.
        theta.value = theta.value % TWO_PI;
      }
    });

    useEffect(() => {
      frameCallback.setActive(true);
      return () => frameCallback.setActive(false);
    }, [frameCallback]);

    const animatedOscillationStyle = useAnimatedStyle(() => {
      if (!animationDuration || waveDisplacement === 0) {
        return {
          transform: [{ translateX: 0 }],
        };
      }

      return {
        transform: [{ translateX: translateX.value }],
      };
    }, [animationDuration, translateX, waveDisplacement]);

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
          animatedOscillationStyle,
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
