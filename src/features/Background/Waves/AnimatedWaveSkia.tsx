// ============================================================================
// Animated Wave Skia Component
// ============================================================================
// Renders a single animated wave using Skia.
// Uses ImageShader for paper texture and GPU-accelerated rendering.
// Drop-in replacement for AnimatedWave.
// ============================================================================

import {
  Canvas,
  Group,
  ImageShader,
  Path,
  type SkImage,
  Skia,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { useWaveOscillation } from "./useWaveOscillation";
import { generateWavePath } from "./wavePath";

/** Height of the SVG canvas. */
const SVG_HEIGHT = 500;

const PAPER_TEXTURE_OPACITY = 0.25;

const STROKE_COLOR = "black";
const STROKE_WIDTH = 0.5;
const STROKE_OPACITY = 0.1;

/** Pseudo-drop shadow: [dx, dy] offsets and opacity (layered black copies). */
export const SHADOW_OPACITY = 0.1;
export const SHADOW_LAYERS: [number, number][] = [
  [9, -2],
  [6, -1],
  [3, -0.5],
];

/**
 * Props for the AnimatedWaveSkia component.
 */
export interface AnimatedWaveSkiaProps {
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
   */
  animationDuration?: number;

  /**
   * Delay before animation starts in milliseconds.
   */
  animationDelay?: number;

  /**
   * Maximum horizontal displacement in SVG units.
   */
  waveDisplacement?: number;

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
   */
  height?: number;

  /**
   * Skia Image for the paper texture.
   */
  paperTexture?: SkImage | null;
}

/**
 * AnimatedWaveSkia component that renders a single animated wave using Skia.
 *
 * @param props - Wave parameters and optional paper texture
 */
const AnimatedWaveSkia = ({
  amplitude,
  period,
  animationDuration,
  animationDelay = 0,
  waveDisplacement = 0,
  phaseOffset = 0,
  fillOpacity = 1,
  fillColor,
  height = 50,
  paperTexture,
}: AnimatedWaveSkiaProps) => {
  const { overscanX, svgRenderWidth, translateX } = useWaveOscillation({
    animationDuration,
    animationDelay,
    waveDisplacement,
    phaseOffset,
  });

  const centerY = SVG_HEIGHT - (SVG_HEIGHT * height) / 100;

  const path = useMemo(
    () =>
      Skia.Path.MakeFromSVGString(
        generateWavePath(amplitude, period, centerY, svgRenderWidth, SVG_HEIGHT)
      ),
    [amplitude, period, centerY, svgRenderWidth]
  );

  return (
    <Canvas
      style={{
        position: "absolute",
        top: 0,
        right: -overscanX,
        bottom: 0,
        left: -overscanX,
      }}
    >
      <Group
        transform={useDerivedValue(() => [{ translateX: translateX.value }])}
      >
        {/* Pseudo-drop shadow: layered black copies */}
        {SHADOW_LAYERS.map(([dx, dy], i) => (
          <Path
            // biome-ignore lint/suspicious/noArrayIndexKey: deterministic
            key={`shadow-${i}`}
            path={path as any}
            color="black"
            opacity={SHADOW_OPACITY}
            transform={[{ translateX: dx }, { translateY: dy }]}
          />
        ))}

        {/* Main wave fill */}
        <Path
          path={path as any}
          color={fillColor}
          opacity={fillOpacity}
          strokeWidth={STROKE_WIDTH}
          style="fill"
        />

        {/* Stroke outline */}
        <Path
          path={path as any}
          color={STROKE_COLOR}
          opacity={STROKE_OPACITY}
          strokeWidth={STROKE_WIDTH}
          style="stroke"
        />

        {/* Paper texture overlay */}
        {paperTexture && (
          <Path path={path as any} opacity={PAPER_TEXTURE_OPACITY}>
            <ImageShader
              image={paperTexture}
              tx="repeat"
              ty="repeat"
              rect={{ x: 0, y: 0, width: svgRenderWidth, height: SVG_HEIGHT }}
              // Using a local matrix for tiling if needed, but tx/ty="repeat" should work
            />
          </Path>
        )}
      </Group>
    </Canvas>
  );
};

AnimatedWaveSkia.displayName = "AnimatedWaveSkia";

export default AnimatedWaveSkia;
