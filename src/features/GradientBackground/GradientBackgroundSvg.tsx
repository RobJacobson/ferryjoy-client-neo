/**
 * SVG scene composition for the gradient background.
 *
 * The scene is intentionally split into three layers: a solid base fill, the
 * animated orb layers, and a final overlay wash that unifies the colors.
 */

import { StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { GRADIENT_BACKGROUND_STOPS, type GradientOrbConfig } from "./config";
import { GradientOrb } from "./GradientOrb";

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
}: GradientBackgroundSvgProps) => (
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
  </>
);
