/**
 * Composes the gradient background draw order: base rect, orb layers, then
 * optional noise on top.
 */

import { StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import type { GradientOrbConfig } from "./GradientBackgroundLayer";
import { GradientOrbLayer } from "./GradientOrbLayer";
import { GradientBackgroundNoiseSvg } from "./svg/GradientBackgroundNoiseSvg";

type GradientBackgroundProps = {
  backgroundColor: string;
  orbs: readonly GradientOrbConfig[];
  svgIdPrefix: string;
  width: number;
  height: number;
};

/**
 * Renders base fill, all orbs, and the noise overlay for the given size.
 *
 * @param props - Scene props
 * @param props.backgroundColor - Solid SVG rect fill behind orbs
 * @param props.orbs - Orb configs mapped to `GradientOrbLayer` instances
 * @param props.width - SVG width in logical pixels
 * @param props.height - SVG height in logical pixels
 * @returns Fragment of stacked SVG and orb layers
 */
export const GradientBackground = ({
  backgroundColor,
  orbs,
  svgIdPrefix,
  width,
  height,
}: GradientBackgroundProps) => (
  <>
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Rect width="100%" height="100%" fill={backgroundColor} />
    </Svg>
    {orbs.map((orb) => (
      <GradientOrbLayer key={orb.id} orb={orb} svgIdPrefix={svgIdPrefix} />
    ))}
    <GradientBackgroundNoiseSvg
      height={height}
      svgIdPrefix={svgIdPrefix}
      width={width}
    />
  </>
);
