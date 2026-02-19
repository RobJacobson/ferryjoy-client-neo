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
  amplitude: number;
  period: number;
  fillColor: string;
  fillOpacity?: number;
  height?: number;
  paperTextureUrl?: PaperTextureSource;
  renderWidthPx: number;
  renderHeightPx: number;
};

/**
 * Renders the wave SVG.
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
