// ============================================================================
// Wave SVG
// ============================================================================
// Renders the wave path as an SVG. Shared by static (View) and animated
// (Animated.View) wrappers.
// ============================================================================

import Svg, { Defs, Path, Pattern, Image as SvgImage } from "react-native-svg";
import type { PaperTextureSource } from "../types";
import {
  PAPER_TEXTURE_OPACITY,
  SHADOW_LAYERS,
  SHADOW_OPACITY,
  SVG_HEIGHT,
  WAVE_STROKE,
} from "./config";
import { generateWavePath } from "./wavePath";

type WaveSvgProps = {
  /**
   * Wave amplitude in pixels (height from center to peak/trough).
   */
  amplitude: number;
  /**
   * Wave period in pixels (width of one complete cycle).
   */
  period: number;
  /**
   * Color of the wave fill.
   */
  fillColor: string;
  /**
   * Opacity of the wave fill (0-1). Default is 1.
   */
  fillOpacity?: number;
  /**
   * Vertical position of the wave centerline as a percentage (0-100).
   * 0 = bottom, 50 = middle, 100 = top. Default is 50.
   */
  height?: number;
  /**
   * Paper texture source. When null, SVG does not render the texture overlay.
   */
  paperTextureUrl?: PaperTextureSource;
  /**
   * Width of the wave SVG render area in pixels.
   */
  renderWidthPx: number;
  /**
   * Height of the wave SVG render area in pixels.
   */
  renderHeightPx: number;
};

/**
 * Renders the wave SVG with optional shadow layers, stroke, and paper texture overlay.
 * The wave is rendered as a fill path with an optional stroke for definition.
 *
 * @param amplitude - Wave amplitude in pixels
 * @param period - Wave period in pixels
 * @param fillColor - Color of the wave fill
 * @param fillOpacity - Opacity of the wave fill (default: 1)
 * @param height - Vertical position as percentage (default: 50)
 * @param paperTextureUrl - Optional paper texture overlay
 * @param renderWidthPx - Render area width in pixels
 * @param renderHeightPx - Render area height in pixels
 * @returns SVG element containing the wave
 */
export const WaveSvg = ({
  amplitude,
  period,
  fillColor,
  fillOpacity = 1,
  height = 50,
  paperTextureUrl,
  renderWidthPx,
  renderHeightPx,
}: WaveSvgProps) => {
  const viewBoxWidth = (renderWidthPx / renderHeightPx) * SVG_HEIGHT;
  const centerY = SVG_HEIGHT - (SVG_HEIGHT * height) / 100;
  const pathData = generateWavePath(
    amplitude,
    period,
    centerY,
    viewBoxWidth,
    SVG_HEIGHT
  );
  // Unique ID for pattern referencing (avoids conflicts between multiple wave layers)
  const LOCAL_TEXTURE_ID = `texture-${amplitude}-${period}`;

  const pathContent = (
    <>
      {SHADOW_LAYERS.map(([dx, dy]) => (
        <Path
          key={`shadow-${dx}-${dy}`}
          d={pathData}
          fill="black"
          fillOpacity={SHADOW_OPACITY}
          transform={`translate(${dx}, ${dy})`}
        />
      ))}
      <Path
        d={pathData}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={WAVE_STROKE.color}
        strokeWidth={WAVE_STROKE.width}
        strokeOpacity={WAVE_STROKE.opacity}
      />
      {paperTextureUrl != null && (
        <Path
          d={pathData}
          fill={`url(#${LOCAL_TEXTURE_ID})`}
          fillOpacity={PAPER_TEXTURE_OPACITY}
        />
      )}
    </>
  );

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${viewBoxWidth} ${SVG_HEIGHT}`}
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
      {pathContent}
    </Svg>
  );
};
