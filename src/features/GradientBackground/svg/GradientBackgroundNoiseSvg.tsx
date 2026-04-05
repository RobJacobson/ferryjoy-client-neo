/**
 * Tiled PNG noise pattern over the gradient scene; gated by module config.
 */

import { StyleSheet } from "react-native";
import Svg, { Defs, Pattern, Rect, Image as SvgImage } from "react-native-svg";
import { gradientBackgroundConfig } from "../config";

type GradientBackgroundNoiseSvgProps = {
  width: number;
  height: number;
  svgIdPrefix: string;
};

/**
 * Full-viewport SVG rect filled with a repeating noise texture, or `null` when
 * disabled in `gradientBackgroundConfig.noise`.
 *
 * @param props - SVG dimensions
 * @param props.width - Viewport width in logical pixels
 * @param props.height - Viewport height in logical pixels
 * @returns Noise overlay SVG or nothing when disabled
 */
export const GradientBackgroundNoiseSvg = ({
  width,
  height,
  svgIdPrefix,
}: GradientBackgroundNoiseSvgProps) => {
  const { noise } = gradientBackgroundConfig;

  if (!noise.enabled) {
    return null;
  }

  const patternId = `${svgIdPrefix}-gradient-background-noise`;
  const noisePatternSize = noise.textureSizePx * noise.scale;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={noisePatternSize}
          height={noisePatternSize}
          x={noise.offsetXPx}
          y={noise.offsetYPx}
        >
          <SvgImage
            href={noise.textureSource}
            width={noisePatternSize}
            height={noisePatternSize}
          />
        </Pattern>
      </Defs>
      <Rect
        width="100%"
        height="100%"
        fill={`url(#${patternId})`}
        fillOpacity={noise.opacity}
      />
    </Svg>
  );
};
