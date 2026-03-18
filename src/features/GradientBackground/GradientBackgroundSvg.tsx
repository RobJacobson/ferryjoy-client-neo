/**
 * SVG scene composition for the gradient background.
 *
 * The scene is intentionally split into three layers: a solid base fill, the
 * animated orb layers, and a final overlay wash that unifies the colors.
 */

import { StyleSheet } from "react-native";
import Svg, { Defs, Pattern, Rect, Image as SvgImage } from "react-native-svg";
import {
  GRADIENT_BACKGROUND_NOISE_CONFIG,
  GRADIENT_BACKGROUND_STOPS,
  type GradientOrbConfig,
} from "./config";
import { GradientOrb } from "./GradientOrb";

const GRADIENT_BACKGROUND_NOISE_TEXTURE = require("../../../assets/textures/gradient-background-noise.png");
const GRADIENT_BACKGROUND_NOISE_TEXTURE_SIZE_PX = 512;
const GRADIENT_BACKGROUND_NOISE_PATTERN_ID = "gradient-background-noise";

type GradientBackgroundSvgProps = {
  backgroundColor: string;
  overlayColor: string;
  orbs: readonly GradientOrbConfig[];
  width: number;
  height: number;
};

/**
 * Renders the static SVG layers and animated orb instances.
 *
 * @param props - Scene sizing and color props
 * @param props.backgroundColor - Base fill color beneath all animated orbs
 * @param props.overlayColor - Top fill used to gently mute and blend the scene
 * @param props.orbs - Precomputed orb definitions to render
 * @param props.width - Viewport width in device pixels
 * @param props.height - Viewport height in device pixels
 * @returns Fragment containing the base fill, orb layers, and overlay wash
 */
export const GradientBackgroundSvg = ({
  backgroundColor,
  overlayColor,
  orbs,
  width,
  height,
}: GradientBackgroundSvgProps) => {
  const noisePatternSize =
    GRADIENT_BACKGROUND_NOISE_TEXTURE_SIZE_PX *
    GRADIENT_BACKGROUND_NOISE_CONFIG.scale;

  return (
    <>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Rect width="100%" height="100%" fill={backgroundColor} />
      </Svg>
      {orbs.map((orb) => (
        <GradientOrb key={orb.id} orb={orb} stops={GRADIENT_BACKGROUND_STOPS} />
      ))}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Rect width="100%" height="100%" fill={overlayColor} />
      </Svg>
      {GRADIENT_BACKGROUND_NOISE_CONFIG.enabled && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id={GRADIENT_BACKGROUND_NOISE_PATTERN_ID}
              patternUnits="userSpaceOnUse"
              width={noisePatternSize}
              height={noisePatternSize}
              x={GRADIENT_BACKGROUND_NOISE_CONFIG.offsetXPx}
              y={GRADIENT_BACKGROUND_NOISE_CONFIG.offsetYPx}
            >
              <SvgImage
                href={GRADIENT_BACKGROUND_NOISE_TEXTURE}
                width={noisePatternSize}
                height={noisePatternSize}
              />
            </Pattern>
          </Defs>
          <Rect
            width="100%"
            height="100%"
            fill={`url(#${GRADIENT_BACKGROUND_NOISE_PATTERN_ID})`}
            fillOpacity={GRADIENT_BACKGROUND_NOISE_CONFIG.opacity}
          />
        </Svg>
      )}
    </>
  );
};
