// ============================================================================
// Wave Shadow Component
// ============================================================================
// Creates a pseudo-drop shadow effect by layering multiple offset copies
// of a wave path with very low opacity. Adds depth to wave surface.
// ============================================================================

import { Path } from "react-native-svg";

/** Number of shadow layers to render for depth effect. */
const SHADOW_LAYERS = 2;

/** Horizontal offset per shadow layer in SVG units. */
const HORIZONTAL_OFFSET = -4;

/** Vertical offset per shadow layer in SVG units. */
const VERTICAL_OFFSET = -1;

/** Opacity of each shadow layer. */
const SHADOW_OPACITY = 0.04;

/**
 * Props for the WaveShadow component.
 */
export interface WaveShadowProps {
  /**
   * SVG path data string for the wave shape to shadow.
   */
  pathData: string;
}

/**
 * WaveShadow component that creates a pseudo-drop shadow effect.
 *
 * Renders multiple layered copies of wave path with subtle offsets
 * and very low opacity to create a sense of depth. Each layer is offset
 * slightly upward and leftward from the previous one.
 */
const WaveShadow = ({ pathData }: WaveShadowProps) => {
  // biome-ignore lint/suspicious/noArrayIndexKey: shadow layers never reorder
  return (
    <>
      {Array.from({ length: SHADOW_LAYERS }).map((_, i) => (
        <Path
          key={i}
          d={pathData}
          fill="black"
          fillOpacity={SHADOW_OPACITY}
          transform={`translate(${HORIZONTAL_OFFSET * (i + 1)}, ${
            VERTICAL_OFFSET * (i + 1)
          })`}
        />
      ))}
    </>
  );
};

export default WaveShadow;
